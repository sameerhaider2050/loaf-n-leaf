import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Numeric, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.session import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=lambda: f"ord-{uuid.uuid4().hex[:12]}")
    order_number = Column(Integer, nullable=False, index=True)
    order_type = Column(String, nullable=False, default="dine_in")  # 'dine_in', 'takeaway'
    table_id = Column(String, ForeignKey("restaurant_tables.id", ondelete="SET NULL"), nullable=True)
    table_number = Column(String, nullable=True)
    employee_id = Column(String, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    
    # Critical: Strict separation of preparation status and payment status
    order_status = Column(String, nullable=False, default="pending", index=True)
    # 'draft', 'pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'
    
    payment_status = Column(String, nullable=False, default="unpaid", index=True)
    # 'unpaid', 'partially_paid', 'paid', 'refund_pending', 'refunded'

    # Financial Totals (Strict numeric fixed-point, no floating point error)
    subtotal = Column(Numeric(precision=10, scale=2), nullable=False, default=0.00)
    discount_amount = Column(Numeric(precision=10, scale=2), nullable=False, default=0.00)
    tax_rate = Column(Numeric(precision=5, scale=2), nullable=False, default=13.00)
    tax_amount = Column(Numeric(precision=10, scale=2), nullable=False, default=0.00)
    grand_total = Column(Numeric(precision=10, scale=2), nullable=False, default=0.00)

    # Optional Customer Details
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    special_instructions = Column(Text, nullable=True)
    
    # Offline Synchronization State
    sync_status = Column(String, nullable=False, default="local_only", index=True)
    # 'local_only', 'pending_sync', 'synced', 'sync_error'
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    employee = relationship("Employee", back_populates="orders", foreign_keys=[employee_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.created_at")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_orders_created_at_status", "created_at", "order_status"),
    )

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, default=lambda: f"item-{uuid.uuid4().hex[:12]}")
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    
    # Immutable historical snapshots: Changing menu prices must NEVER alter past orders
    product_name_snapshot = Column(String, nullable=False)
    unit_price_snapshot = Column(Numeric(precision=10, scale=2), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    line_total = Column(Numeric(precision=10, scale=2), nullable=False)
    special_instructions = Column(Text, nullable=True)
    added_by_employee_id = Column(String, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order", back_populates="items")
