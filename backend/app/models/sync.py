import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, Integer, BigInteger
from app.db.session import Base

class SyncRecord(Base):
    __tablename__ = "synchronization_records"

    id = Column(String, primary_key=True, default=lambda: f"sync-{uuid.uuid4().hex[:12]}")
    entity_type = Column(String, nullable=False, index=True)  # 'order', 'payment', 'product', 'device'
    entity_id = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False)  # 'INSERT', 'UPDATE', 'DELETE'
    payload = Column(Text, nullable=False)  # JSON snapshot
    status = Column(String, nullable=False, default="pending_sync", index=True)  # 'pending_sync', 'synced', 'sync_error', 'conflict_review'
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    synced_at = Column(DateTime, nullable=True)

class BackupRecord(Base):
    __tablename__ = "backup_records"

    id = Column(String, primary_key=True, default=lambda: f"bak-{uuid.uuid4().hex[:12]}")
    backup_type = Column(String, nullable=False)  # 'scheduled', 'manual', 'cloud_export'
    file_path = Column(String, nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    checksum_sha256 = Column(String, nullable=False)
    status = Column(String, nullable=False, default="verified")  # 'in_progress', 'verified', 'failed'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
