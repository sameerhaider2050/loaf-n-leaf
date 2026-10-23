import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=lambda: f"cat-{uuid.uuid4().hex[:8]}")
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=lambda: f"prod-{uuid.uuid4().hex[:8]}")
    code = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, nullable=False, index=True)
    category_id = Column(String, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False)
    price = Column(Numeric(precision=10, scale=2), nullable=False)
    cost = Column(Numeric(precision=10, scale=2), default=0.00, nullable=False)
    image_url = Column(String, nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    category = relationship("Category", back_populates="products")
