from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel

class OrderItemCreate(BaseModel):
    product_id: str
    quantity: int = 1
    special_instructions: Optional[str] = None

class OrderItemResponse(BaseModel):
    id: str
    product_id: Optional[str] = None
    product_name_snapshot: str
    unit_price_snapshot: Decimal
    quantity: int
    line_total: Decimal
    special_instructions: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    order_type: str = "dine_in"  # 'dine_in' or 'takeaway'
    table_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    special_instructions: Optional[str] = None
    items: List[OrderItemCreate]

class OrderAppendItems(BaseModel):
    items: List[OrderItemCreate]

class OrderStatusUpdate(BaseModel):
    order_status: str  # 'pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'

class OrderResponse(BaseModel):
    id: str
    order_number: int
    order_type: str
    table_id: Optional[str] = None
    table_number: Optional[str] = None
    employee_id: str
    order_status: str
    payment_status: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    grand_total: Decimal
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    special_instructions: Optional[str] = None
    sync_status: str
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True
