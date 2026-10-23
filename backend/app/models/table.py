import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime
from app.db.session import Base

class RestaurantTable(Base):
    __tablename__ = "restaurant_tables"

    id = Column(String, primary_key=True, default=lambda: f"tbl-{uuid.uuid4().hex[:8]}")
    table_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    capacity = Column(Integer, default=4, nullable=False)
    status = Column(String, default="available", nullable=False)  # 'available', 'occupied', 'reserved'
    active_order_id = Column(String, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
