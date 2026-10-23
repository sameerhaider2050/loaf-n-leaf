from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel

class PaymentCreate(BaseModel):
    order_id: str
    payment_method: str  # 'cash', 'card', 'other'
    received_amount: Decimal
    transaction_ref: Optional[str] = None
    idempotency_key: str

class PaymentResponse(BaseModel):
    id: str
    order_id: str
    payment_method: str
    amount_paid: Decimal
    received_amount: Decimal
    change_given: Decimal
    transaction_ref: Optional[str] = None
    cashier_id: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ReceiptDataResponse(BaseModel):
    restaurant: Dict[str, str]
    order: Dict[str, Any]
    items: List[Dict[str, Any]]
    summary: Dict[str, Any]
