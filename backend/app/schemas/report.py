from typing import List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel

class SalesReportMetrics(BaseModel):
    total_sales: Decimal
    total_orders: int
    average_order_value: Decimal
    cash_sales: Decimal
    card_sales: Decimal
    other_sales: Decimal
    total_tax: Decimal
    total_discount: Decimal

class TopItemMetric(BaseModel):
    product_name: str
    total_qty: int
    total_revenue: Decimal

class SalesReportResponse(BaseModel):
    period: str
    start_date: str
    end_date: str
    metrics: SalesReportMetrics
    top_items: List[TopItemMetric]
    recent_transactions: List[Dict[str, Any]]
