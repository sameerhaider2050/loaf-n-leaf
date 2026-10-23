import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import relationship
from app.db.session import Base

class AuthorizedDevice(Base):
    __tablename__ = "authorized_devices"

    id = Column(String, primary_key=True, default=lambda: f"dev-{uuid.uuid4().hex[:12]}")
    device_fingerprint_hash = Column(String, unique=True, index=True, nullable=False)
    device_name = Column(String, nullable=False)
    assigned_employee_id = Column(String, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    permitted_roles = Column(Text, nullable=False, default='["order_taker"]')  # JSON array string
    status = Column(String, nullable=False, default="pending")  # 'pending', 'approved', 'rejected', 'revoked'
    device_info = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    last_active_at = Column(DateTime, nullable=True)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    revoked_by = Column(String, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    credentials = relationship("DeviceCredentials", back_populates="device", cascade="all, delete-orphan", uselist=False)
    sessions = relationship("DeviceSession", back_populates="device", cascade="all, delete-orphan")
    requests = relationship("DeviceApprovalRequest", back_populates="device", cascade="all, delete-orphan")

class DeviceCredentials(Base):
    __tablename__ = "device_credentials"

    id = Column(String, primary_key=True, default=lambda: f"cred-{uuid.uuid4().hex[:12]}")
    device_id = Column(String, ForeignKey("authorized_devices.id", ondelete="CASCADE"), nullable=False, unique=True)
    public_key_spki = Column(Text, nullable=False)
    algorithm = Column(String, nullable=False, default="ECDSA-P256")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    device = relationship("AuthorizedDevice", back_populates="credentials")

class DeviceApprovalRequest(Base):
    __tablename__ = "device_approval_requests"

    id = Column(String, primary_key=True, default=lambda: f"req-{uuid.uuid4().hex[:12]}")
    device_id = Column(String, ForeignKey("authorized_devices.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    requested_role = Column(String, nullable=False)
    device_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # 'pending', 'approved', 'rejected'
    admin_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    device = relationship("AuthorizedDevice", back_populates="requests")

class DeviceSession(Base):
    __tablename__ = "device_sessions"

    id = Column(String, primary_key=True, default=lambda: f"ses-{uuid.uuid4().hex[:12]}")
    device_id = Column(String, ForeignKey("authorized_devices.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(String, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    last_seen_at = Column(DateTime, nullable=False)
    is_valid = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    device = relationship("AuthorizedDevice", back_populates="sessions")

class DeviceAuditLog(Base):
    __tablename__ = "device_audit_logs"

    id = Column(String, primary_key=True, default=lambda: f"aud-{uuid.uuid4().hex[:12]}")
    device_id = Column(String, nullable=True, index=True)
    employee_id = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
