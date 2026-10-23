import csv
import io
from typing import Optional
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.schemas.report import SalesReportResponse, SalesReportMetrics, TopItemMetric
from app.api.deps import require_admin

router = APIRouter(prefix="/reports", tags=["Sales & Reports"])

@router.get("/summary", response_model=SalesReportResponse, dependencies=[Depends(require_admin)])
def get_sales_summary(
    period: str = Query("today", pattern="^(today|week|month|all)$"),
    db: Session = Depends(get_db)
):
    """Calculate financial sales report metrics from actual transactions (Admin Only)."""
    now = datetime.now(timezone.utc)
    
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)

    # Completed & Paid orders in range
    paid_orders = db.query(Order).filter(
        Order.payment_status == "paid",
        Order.created_at >= start_date
    ).all()

    total_sales = sum((Decimal(str(o.grand_total)) for o in paid_orders), Decimal("0.00"))
    total_orders = len(paid_orders)
    avg_order_value = round(total_sales / total_orders, 2) if total_orders > 0 else Decimal("0.00")
    total_tax = sum((Decimal(str(o.tax_amount)) for o in paid_orders), Decimal("0.00"))
    total_discount = sum((Decimal(str(o.discount_amount)) for o in paid_orders), Decimal("0.00"))

    # Payments by method
    payments = db.query(Payment).filter(Payment.created_at >= start_date).all()
    cash_sales = sum((Decimal(str(p.amount_paid)) for p in payments if p.payment_method == "cash"), Decimal("0.00"))
    card_sales = sum((Decimal(str(p.amount_paid)) for p in payments if p.payment_method == "card"), Decimal("0.00"))
    other_sales = sum((Decimal(str(p.amount_paid)) for p in payments if p.payment_method not in ["cash", "card"]), Decimal("0.00"))

    # Top items
    top_items_query = db.query(
        OrderItem.product_name_snapshot,
        func.sum(OrderItem.quantity).label("total_qty"),
        func.sum(OrderItem.line_total).label("total_revenue")
    ).join(Order).filter(
        Order.payment_status == "paid",
        Order.created_at >= start_date
    ).group_by(OrderItem.product_name_snapshot).order_by(func.sum(OrderItem.quantity).desc()).limit(10).all()

    top_items = [
        TopItemMetric(
            product_name=row[0],
            total_qty=int(row[1] or 0),
            total_revenue=Decimal(str(row[2] or 0.00))
        )
        for row in top_items_query
    ]

    recent_txns = []
    for o in paid_orders[:15]:
        recent_txns.append({
            "order_number": o.order_number,
            "order_type": o.order_type,
            "table_number": o.table_number,
            "grand_total": float(o.grand_total),
            "created_at": o.created_at.isoformat()
        })

    return SalesReportResponse(
        period=period,
        start_date=start_date.isoformat(),
        end_date=now.isoformat(),
        metrics=SalesReportMetrics(
            total_sales=total_sales,
            total_orders=total_orders,
            average_order_value=avg_order_value,
            cash_sales=cash_sales,
            card_sales=card_sales,
            other_sales=other_sales,
            total_tax=total_tax,
            total_discount=total_discount
        ),
        top_items=top_items,
        recent_transactions=recent_txns
    )

@router.get("/export-csv", dependencies=[Depends(require_admin)])
def export_sales_csv(db: Session = Depends(get_db)):
    """Export completed orders and financial records as CSV (Admin Only)."""
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Order #", "Type", "Table", "Status", "Payment", 
        "Subtotal", "Tax", "Discount", "Grand Total", "Created At"
    ])

    for o in orders:
        writer.writerow([
            o.order_number,
            o.order_type,
            o.table_number or "N/A",
            o.order_status,
            o.payment_status,
            float(o.subtotal),
            float(o.tax_amount),
            float(o.discount_amount),
            float(o.grand_total),
            o.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=loaf_n_leaf_sales_{datetime.now().strftime('%Y%m%d')}.csv"}
    )
