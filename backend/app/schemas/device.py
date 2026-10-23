from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class DeviceChallengeRequest(BaseModel):
    device_fingerprint: str

class DeviceChallengeResponse(BaseModel):
    challenge_id: str
    nonce: str
    timestamp: int
    expires_in: int

class DeviceVerifyAndLoginRequest(BaseModel):
    identifier: Optional[str] = None
    password: Optional[str] = None
    pin: Optional[str] = None
    device_fingerprint: str
    public_key_spki: str
    challenge_id: str
    signature: str
    device_name: Optional[str] = None
    device_info: Optional[Any] = None
    requested_role: Optional[str] = None

class DeviceStatusResponse(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    status: str
    permitted_roles: List[str] = []
    assigned_employee_id: Optional[str] = None
    assigned_employee_name: Optional[str] = None
    last_active_at: Optional[datetime] = None
    message: Optional[str] = None

class DeviceAdminApproveRequest(BaseModel):
    assigned_employee_id: Optional[str] = None
    permitted_roles: List[str] = ["order_taker"]
    device_name: Optional[str] = None

class DeviceAdminRejectRequest(BaseModel):
    reason: Optional[str] = None

class DeviceAdminRevokeRequest(BaseModel):
    reason: Optional[str] = None

class DeviceApprovalRequestSubmission(BaseModel):
    device_fingerprint: str
    device_name: Optional[str] = None
    notes: Optional[str] = None

class DeviceResponse(BaseModel):
    id: str
    device_fingerprint_hash: str
    device_name: str
    assigned_employee_id: Optional[str] = None
    assigned_employee_name: Optional[str] = None
    permitted_roles: List[str]
    status: str
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    last_active_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DevicePolicyResponse(BaseModel):
    max_devices_per_employee: int

class DevicePolicyUpdateRequest(BaseModel):
    max_devices_per_employee: int
