from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class LoginRequest(BaseModel):
    identifier: Optional[str] = None
    password: Optional[str] = None
    pin: Optional[str] = None

class EmployeeBase(BaseModel):
    username: str
    email: str
    full_name: str
    role: str  # 'admin', 'cashier', 'order_taker'
    phone: Optional[str] = None
    is_active: bool = True

class EmployeeCreate(EmployeeBase):
    password: str
    pin: Optional[str] = None

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    pin: Optional[str] = None

class EmployeeResponse(EmployeeBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee: EmployeeResponse
