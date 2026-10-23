from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models.employee import Employee
from app.models.catalog import Product
from app.models.table import RestaurantTable
from app.models.order import Order, OrderItem
from app.models.setting import RestaurantSettings
from app.schemas.order import OrderCreate, OrderAppendItems, OrderStatusUpdate, OrderResponse
from app.api.deps import get_current_employee, require_waiter

router = APIRouter(prefix="/orders", tags=["Orders & Kitchen Workflow"])

def get_next_order_number(db: Session) -> int:
    """Generate incremental human-readable order number."""
    max_num = db.query(func.max(Order.order_number)).scalar()
    return (max_num or 1000) + 1

def get_tax_rate(db: Session) -> Decimal:
    """Fetch authoritative tax rate setting."""
    setting = db.query(RestaurantSettings).filter(RestaurantSettings.key == "tax_rate").first()
    return Decimal(setting.value) if setting else Decimal("13.00")

# -------------------------------------------------------------
# 1. POST / (Create Order: Dine-In or Takeaway)
# -------------------------------------------------------------
@router.post("", response_model=OrderResponse, status_code=201)
def create_order(
    payload: OrderCreate,
    current_employee: Employee = Depends(require_waiter),
    db: Session = Depends(get_db)
):
    """
    Create a new order (Dine-In or Takeaway).
    Validates products, takes immutable price snapshots, locks table if Dine-In,
    and computes authoritative financial totals on the backend.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cannot submit an order with zero items")

    table = None
    if payload.order_type == "dine_in":
        if not payload.table_id:
            raise HTTPException(status_code=400, detail="table_id is required for Dine-In orders")
        table = db.query(RestaurantTable).filter(
            (RestaurantTable.id == payload.table_id) | (RestaurantTable.table_number == payload.table_id)
        ).first()
        if not table:
            raise HTTPException(status_code=404, detail="Selected table does not exist")

        # If table already has an active bill, redirect caller to append to that bill
        if table.status == "occupied" and table.active_order_id:
            active_bill = db.query(Order).filter(Order.id == table.active_order_id).first()
            if active_bill and active_bill.payment_status != "paid":
                raise HTTPException(
                    status_code=400,
                    detail=f"Table {table.table_number} already has an active bill (#{active_bill.order_number}). Append items to the existing bill."
                )

    tax_rate = get_tax_rate(db)
    order_number = get_next_order_number(db)

    # Validate items and calculate subtotal
    subtotal = Decimal("0.00")
    order_items_to_create = []

    for item_in in payload.items:
        prod = db.query(Product).filter(Product.id == item_in.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product '{item_in.product_id}' not found")
        if not prod.is_available:
            raise HTTPException(status_code=400, detail=f"Product '{prod.name}' is currently unavailable (86'd)")
        if item_in.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Quantity for '{prod.name}' must be at least 1")

        unit_price = Decimal(str(prod.price))
        line_total = unit_price * Decimal(item_in.quantity)
        subtotal += line_total

        order_items_to_create.append(OrderItem(
            product_id=prod.id,
            product_name_snapshot=prod.name,
            unit_price_snapshot=unit_price,
            quantity=item_in.quantity,
            line_total=line_total,
            special_instructions=item_in.special_instructions,
            added_by_employee_id=current_employee.id
        ))

    discount_amount = Decimal("0.00")
    taxable_amount = max(Decimal("0.00"), subtotal - discount_amount)
    tax_amount = round(taxable_amount * (tax_rate / Decimal("100.0")), 2)
    grand_total = taxable_amount + tax_amount

    # Create Order
    new_order = Order(
        order_number=order_number,
        order_type=payload.order_type,
        table_id=table.id if table else None,
        table_number=table.table_number if table else None,
        employee_id=current_employee.id,
        order_status="pending",
        payment_status="unpaid",
        subtotal=subtotal,
        discount_amount=discount_amount,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        grand_total=grand_total,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        special_instructions=payload.special_instructions,
        sync_status="local_only"
    )

    db.add(new_order)
    db.flush()

    # Link items
    for item in order_items_to_create:
        item.order_id = new_order.id
        db.add(item)

    # If Dine-In, mark table occupied and link active order
    if table:
        table.status = "occupied"
        table.active_order_id = new_order.id

    db.commit()
    db.refresh(new_order)
    return new_order

# -------------------------------------------------------------
# 2. POST /{order_id}/append (Append Items to Active Table Bill)
# -------------------------------------------------------------
@router.post("/{order_id}/append", response_model=OrderResponse)
def append_items_to_order(
    order_id: str,
    payload: OrderAppendItems,
    current_employee: Employee = Depends(require_waiter),
    db: Session = Depends(get_db)
):
    """
    Append additional items to an active table bill or existing order.
    Recalculates subtotals and grand totals transactionally.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Cannot append items to a closed/paid order")
    if order.order_status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot append items to a completed or cancelled order")

    added_subtotal = Decimal("0.00")

    for item_in in payload.items:
        prod = db.query(Product).filter(Product.id == item_in.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product '{item_in.product_id}' not found")
        if not prod.is_available:
            raise HTTPException(status_code=400, detail=f"Product '{prod.name}' is currently unavailable")

        unit_price = Decimal(str(prod.price))
        line_total = unit_price * Decimal(item_in.quantity)
        added_subtotal += line_total

        new_item = OrderItem(
            order_id=order.id,
            product_id=prod.id,
            product_name_snapshot=prod.name,
            unit_price_snapshot=unit_price,
            quantity=item_in.quantity,
            line_total=line_total,
            special_instructions=item_in.special_instructions,
            added_by_employee_id=current_employee.id
        )
        db.add(new_item)

    # Recalculate totals
    order.subtotal += added_subtotal
    taxable_amount = max(Decimal("0.00"), order.subtotal - order.discount_amount)
    order.tax_amount = round(taxable_amount * (order.tax_rate / Decimal("100.0")), 2)
    order.grand_total = taxable_amount + order.tax_amount
    order.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)
    return order

# -------------------------------------------------------------
# 3. GET / (List Orders with Filtering)
# -------------------------------------------------------------
@router.get("", response_model=List[OrderResponse])
def list_orders(
    status: Optional[str] = None,
    order_type: Optional[str] = None,
    payment_status: Optional[str] = None,
    employee_id: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """List orders with optional status, type, and pagination filters."""
    query = db.query(Order)
    if status and status != "all":
        query = query.filter(Order.order_status == status)
    if order_type:
        query = query.filter(Order.order_type == order_type)
    if payment_status:
        query = query.filter(Order.payment_status == payment_status)
    if employee_id:
        query = query.filter(Order.employee_id == employee_id)

    return query.order_by(Order.created_at.desc()).limit(limit).all()

# -------------------------------------------------------------
# 4. GET /{order_id} (Full Details)
# -------------------------------------------------------------
@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: str, db: Session = Depends(get_db)):
    """Retrieve full order details including item snapshots."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# -------------------------------------------------------------
# 5. PUT /{order_id}/status (Update Preparation Status)
# -------------------------------------------------------------
@router.put("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Update kitchen preparation status: 'pending' -> 'accepted' -> 'preparing' -> 'ready'.
    IMPORTANT: Food readiness does NOT close tables; only settled cashier payment releases tables.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.order_status = payload.order_status
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return order
