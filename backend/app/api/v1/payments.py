from typing import Dict, Any
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.employee import Employee
from app.models.order import Order
from app.models.table import RestaurantTable
from app.models.payment import Payment
from app.models.setting import RestaurantSettings
from app.schemas.payment import PaymentCreate, PaymentResponse, ReceiptDataResponse
from app.api.deps import require_cashier, get_current_employee

router = APIRouter(prefix="/payments", tags=["Payments & Cashier Checkout"])

@router.post("/checkout", response_model=PaymentResponse, status_code=201)
def process_checkout(
    payload: PaymentCreate,
    current_cashier: Employee = Depends(require_cashier),
    db: Session = Depends(get_db)
):
    """
    Process payment for an order (Cash, Card, or Other).
    Enforces idempotency, calculates exact change, sets payment_status to 'paid',
    and releases Dine-In tables.
    """
    # 1. Idempotency Check: Prevent duplicate payment submissions
    existing_payment = db.query(Payment).filter(
        Payment.idempotency_key == payload.idempotency_key
    ).first()
    if existing_payment:
        return existing_payment

    # 2. Fetch and Validate Order
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_status == "paid":
        raise HTTPException(status_code=400, detail="This order is already settled and paid")
    if order.order_status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot process payment for a cancelled order")

    # 3. Cash Payment Validation & Exact Change Computation
    grand_total = Decimal(str(order.grand_total))
    received_amount = Decimal(str(payload.received_amount))

    if payload.payment_method.lower() == "cash":
        if received_amount < grand_total:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient payment amount. Total is Rs. {grand_total}, but received Rs. {received_amount}."
            )
        change_given = received_amount - grand_total
    else:
        # Card or Other method: received equals grand_total unless specified
        change_given = Decimal("0.00")
        if received_amount < grand_total:
            received_amount = grand_total

    # 4. Atomic Transactional Commit
    txn_ref = payload.transaction_ref or f"TXN-{order.order_number}-{datetime.now(timezone.utc).strftime('%H%M%S')}"

    payment = Payment(
        order_id=order.id,
        payment_method=payload.payment_method.lower(),
        amount_paid=grand_total,
        received_amount=received_amount,
        change_given=change_given,
        transaction_ref=txn_ref,
        cashier_id=current_cashier.id,
        idempotency_key=payload.idempotency_key,
        status="completed"
    )
    db.add(payment)

    # Update order payment state
    order.payment_status = "paid"
    order.order_status = "completed"
    order.updated_at = datetime.now(timezone.utc)

    # Release Dine-In Table
    if order.table_id:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
        if table:
            table.status = "available"
            table.active_order_id = None

    db.commit()
    db.refresh(payment)
    return payment

# -------------------------------------------------------------
# Thermal Receipt Formatter Endpoint
# -------------------------------------------------------------
@router.get("/receipt/{order_id}", response_model=ReceiptDataResponse)
def get_receipt_data(order_id: str, db: Session = Depends(get_db)):
    """Generate 80mm ESC/POS formatted receipt data for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    settings_rows = db.query(RestaurantSettings).all()
    settings_dict = {s.key: s.value for s in settings_rows}

    # Fetch latest payment record
    latest_payment = db.query(Payment).filter(Payment.order_id == order.id).order_by(Payment.created_at.desc()).first()

    cashier_name = "Cashier Staff"
    if latest_payment and latest_payment.cashier:
        cashier_name = latest_payment.cashier.full_name
    elif order.employee:
        cashier_name = order.employee.full_name

    receipt_items = []
    for item in order.items:
        receipt_items.append({
            "name": item.product_name_snapshot,
            "qty": item.quantity,
            "unit_price": float(item.unit_price_snapshot),
            "total": float(item.line_total),
        })

    is_paid = order.payment_status == "paid"
    pay_method = latest_payment.payment_method.upper() if latest_payment else ("PAID" if is_paid else "UNPAID")
    received_amt = float(latest_payment.received_amount) if latest_payment else float(order.grand_total)
    change_amt = float(latest_payment.change_given) if latest_payment else 0.0

    return ReceiptDataResponse(
        restaurant={
            "name": settings_dict.get("restaurant_name", "Loaf n Leaf"),
            "tagline": settings_dict.get("restaurant_tagline", "Artisan Cafe & Charcoal Grill"),
            "address": settings_dict.get("address", "Plot 12-C, 7th Zamzama Commercial Lane, Clifton, Karachi"),
            "phone": settings_dict.get("phone", "+92 21 3583 8920"),
            "ntn": settings_dict.get("ntn_number", "7829104-5"),
            "header": settings_dict.get("receipt_header", "TAX INVOICE"),
            "footer": settings_dict.get("receipt_footer", "Thank you for dining with us!"),
        },
        order={
            "id": order.id,
            "order_number": order.order_number,
            "order_type": "DINE IN" if order.order_type == "dine_in" else "TAKEAWAY",
            "table_number": order.table_number or "N/A",
            "created_at": order.created_at.isoformat(),
            "cashier": cashier_name,
        },
        items=receipt_items,
        summary={
            "subtotal": float(order.subtotal),
            "discount": float(order.discount_amount),
            "tax_rate": float(order.tax_rate),
            "tax_amount": float(order.tax_amount),
            "grand_total": float(order.grand_total),
            "payment_method": pay_method,
            "received_amount": received_amt,
            "change_given": change_amt,
            "transaction_ref": latest_payment.transaction_ref if latest_payment else f"ORD-{order.order_number}",
        }
    )
