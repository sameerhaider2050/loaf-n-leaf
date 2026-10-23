from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from app.db.session import Base

class RestaurantSettings(Base):
    __tablename__ = "restaurant_settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
