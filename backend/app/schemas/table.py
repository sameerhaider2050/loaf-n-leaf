from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class TableBase(BaseModel):
    table_number: str
    name: str
    capacity: int = 4
    status: str = "available"  # 'available', 'occupied', 'reserved'

class TableCreate(TableBase):
    pass

class TableUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[str] = None

class TableResponse(TableBase):
    id: str
    active_order_id: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True
