import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.session import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=lambda: f"pay-{uuid.uuid4().hex[:12]}")
    order_id = Column(String, ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    payment_method = Column(String, nullable=False)  # 'cash', 'card', 'other'
    
    # Financial Exact Arithmetic
    amount_paid = Column(Numeric(precision=10, scale=2), nullable=False)
    received_amount = Column(Numeric(precision=10, scale=2), nullable=False)
    change_given = Column(Numeric(precision=10, scale=2), nullable=False, default=0.00)
    
    transaction_ref = Column(String, nullable=True)
    cashier_id = Column(String, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    
    # Idempotency key to safely prevent accidental double charges on slow networks or retries
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, nullable=False, default="completed")  # 'completed', 'refunded', 'partial_refund'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    order = relationship("Order", back_populates="payments")
    cashier = relationship("Employee", back_populates="payments", foreign_keys=[cashier_id])
    refunds = relationship("Refund", back_populates="payment", cascade="all, delete-orphan")

class Refund(Base):
    __tablename__ = "refunds"

    id = Column(String, primary_key=True, default=lambda: f"ref-{uuid.uuid4().hex[:12]}")
    payment_id = Column(String, ForeignKey("payments.id", ondelete="RESTRICT"), nullable=False)
    order_id = Column(String, ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False)
    amount = Column(Numeric(precision=10, scale=2), nullable=False)
    reason = Column(String, nullable=False)
    authorized_by_employee_id = Column(String, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    payment = relationship("Payment", back_populates="refunds")
