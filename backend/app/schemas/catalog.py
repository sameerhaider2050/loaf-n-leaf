from typing import Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel

class CategoryBase(BaseModel):
    name: str
    slug: str
    sort_order: int = 0
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class CategoryResponse(CategoryBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    category_id: str
    price: Decimal
    cost: Optional[Decimal] = Decimal("0.00")
    code: Optional[str] = None
    image_url: Optional[str] = None
    is_available: bool = True
    description: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[Decimal] = None
    cost: Optional[Decimal] = None
    code: Optional[str] = None
    image_url: Optional[str] = None
    is_available: Optional[bool] = None
    description: Optional[str] = None

class ProductResponse(ProductBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
