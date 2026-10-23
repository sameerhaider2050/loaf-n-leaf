import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.db.session import Base

class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, default=lambda: f"emp-{uuid.uuid4().hex[:12]}")
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    hashed_pin = Column(String, nullable=True)
    role = Column(String, nullable=False, default="order_taker")  # 'admin', 'cashier', 'order_taker'
    phone = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    orders = relationship("Order", back_populates="employee", foreign_keys="Order.employee_id")
    payments = relationship("Payment", back_populates="cashier", foreign_keys="Payment.cashier_id")
