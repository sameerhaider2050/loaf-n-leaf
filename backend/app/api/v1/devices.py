import json
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import (
    create_device_challenge,
    consume_device_challenge,
    verify_password,
    verify_pin,
    create_access_token
)
from app.core.device_crypto import verify_device_signature
from app.models.employee import Employee
from app.models.device import (
    AuthorizedDevice,
    DeviceCredentials,
    DeviceApprovalRequest,
    DeviceSession,
    DeviceAuditLog
)
from app.models.setting import RestaurantSettings
from app.schemas.device import (
    DeviceChallengeRequest,
    DeviceChallengeResponse,
    DeviceVerifyAndLoginRequest,
    DeviceStatusResponse,
    DeviceResponse,
    DeviceAdminApproveRequest,
    DeviceAdminRejectRequest,
    DeviceAdminRevokeRequest,
    DeviceApprovalRequestSubmission,
    DevicePolicyResponse,
    DevicePolicyUpdateRequest
)
from app.api.deps import get_current_employee, require_admin

router = APIRouter(prefix="/devices", tags=["Cryptographic Device Access Control"])

def log_audit(db: Session, device_id: Optional[str], employee_id: Optional[str], action: str, details: str, ip: str = ""):
    """Record security audit log entry."""
    entry = DeviceAuditLog(
        device_id=device_id,
        employee_id=employee_id,
        action=action,
        details=details,
        ip_address=ip
    )
    db.add(entry)
    db.commit()

# -------------------------------------------------------------
# 1. POST /challenge
# -------------------------------------------------------------
@router.post("/challenge", response_model=DeviceChallengeResponse)
def get_challenge(payload: DeviceChallengeRequest):
    """Issue a single-use random cryptographic challenge nonce to sign."""
    if not payload.device_fingerprint:
        raise HTTPException(status_code=400, detail="device_fingerprint required")
    challenge = create_device_challenge(payload.device_fingerprint)
    return challenge

# -------------------------------------------------------------
# 2. POST /verify-and-login
# -------------------------------------------------------------
@router.post("/verify-and-login")
def verify_and_login(payload: DeviceVerifyAndLoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate staff credentials + enforce cryptographic device authorization (RBAC + DBAC)."""
    # A. Validate Single-Use Nonce
    nonce = consume_device_challenge(payload.challenge_id, payload.device_fingerprint)
    if not nonce:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CHALLENGE_EXPIRED", "message": "Authentication challenge expired or invalid. Please retry."}
        )

    # B. Authenticate Employee Credentials
    employee = None
    if payload.pin:
        candidates = db.query(Employee).filter(Employee.is_active == True).all()
        for cand in candidates:
            if cand.hashed_pin and verify_pin(payload.pin.strip(), cand.hashed_pin):
                employee = cand
                break
    elif payload.identifier:
        clean_ident = payload.identifier.strip().lower()
        employee = db.query(Employee).filter(
            (Employee.username.ilike(clean_ident)) | (Employee.email.ilike(clean_ident)),
            Employee.is_active == True
        ).first()
        if employee and (not payload.password or not verify_password(payload.password, employee.hashed_password)):
            employee = None

    if not employee:
        raise HTTPException(status_code=401, detail="Invalid staff credentials or account inactive")

    # C. Cryptographically Verify Signature
    is_valid_sig = verify_device_signature(
        payload.public_key_spki,
        nonce,
        payload.signature
    )
    client_ip = request.client.host if request.client else ""

    if not is_valid_sig:
        log_audit(db, None, employee.id, "SIGNATURE_VERIFICATION_FAILED", f"Fingerprint {payload.device_fingerprint} signature mismatch", client_ip)
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_DEVICE_SIGNATURE", "message": "Cryptographic device signature verification failed."}
        )

    # D. Check Device Authorization Status
    device = db.query(AuthorizedDevice).filter(AuthorizedDevice.device_fingerprint_hash == payload.device_fingerprint).first()

    # If completely new device: Register as PENDING and block access
    if not device:
        dev_name = payload.device_name.strip() if payload.device_name else f"Terminal {payload.device_fingerprint[:6].upper()}"
        target_role = payload.requested_role or employee.role
        
        device = AuthorizedDevice(
            device_fingerprint_hash=payload.device_fingerprint,
            device_name=dev_name,
            assigned_employee_id=employee.id,
            permitted_roles=json.dumps([target_role]),
            status="pending",
            device_info=json.dumps(payload.device_info) if payload.device_info else None,
            ip_address=client_ip
        )
        db.add(device)
        db.flush()

        creds = DeviceCredentials(
            device_id=device.id,
            public_key_spki=payload.public_key_spki
        )
        db.add(creds)

        req_entry = DeviceApprovalRequest(
            device_id=device.id,
            employee_id=employee.id,
            requested_role=target_role,
            device_name=dev_name,
            status="pending"
        )
        db.add(req_entry)
        db.commit()

        log_audit(db, device.id, employee.id, "DEVICE_REGISTERED", f"New terminal approval requested by {employee.full_name} for role {target_role}", client_ip)

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "DEVICE_UNAUTHORIZED",
                "status": "pending",
                "deviceId": device.id,
                "deviceName": dev_name,
                "message": "This terminal is awaiting administrator authorization."
            }
        )

    # Handle Non-Approved States
    if device.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "DEVICE_PENDING_APPROVAL",
                "status": "pending",
                "deviceId": device.id,
                "deviceName": device.device_name,
                "message": "This terminal is awaiting administrator approval."
            }
        )

    if device.status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "DEVICE_REJECTED",
                "status": "rejected",
                "deviceId": device.id,
                "deviceName": device.device_name,
                "message": "This terminal authorization was rejected by the administrator."
            }
        )

    if device.status == "revoked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "DEVICE_REVOKED",
                "status": "revoked",
                "deviceId": device.id,
                "deviceName": device.device_name,
                "message": "This terminal authorization was revoked. Access is blocked."
            }
        )

    # E. Role-Based & Device-Based Access Control (RBAC + DBAC) Matrix
    try:
        permitted_roles = json.loads(device.permitted_roles)
    except Exception:
        permitted_roles = [device.permitted_roles]

    target_role = payload.requested_role or employee.role
    if target_role not in permitted_roles and "*" not in permitted_roles:
        log_audit(
            db, device.id, employee.id, "DEVICE_ROLE_RESTRICTED",
            f"Employee {employee.full_name} ({employee.role}) blocked: device permits {permitted_roles}", client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "DEVICE_ROLE_MISMATCH",
                "status": "role_mismatch",
                "permittedRoles": permitted_roles,
                "userRole": employee.role,
                "message": f"This device is authorized only for {permitted_roles}. Your role '{target_role}' cannot operate on this terminal."
            }
        )

    # F. Issue Cryptographic Session Token & JWT
    session_token = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    now = datetime.now(timezone.utc)

    # Invalidate previous sessions on this device for this employee
    db.query(DeviceSession).filter(
        DeviceSession.device_id == device.id,
        DeviceSession.employee_id == employee.id
    ).update({"is_valid": False})

    new_session = DeviceSession(
        device_id=device.id,
        employee_id=employee.id,
        session_token=session_token,
        expires_at=expires_at,
        last_seen_at=now,
        is_valid=True
    )
    db.add(new_session)

    device.last_active_at = now
    device.ip_address = client_ip
    db.commit()

    log_audit(db, device.id, employee.id, "DEVICE_LOGIN_SUCCESS", f"Terminal authorized for {employee.full_name}", client_ip)

    jwt_token = create_access_token({"sub": employee.id, "role": employee.role, "device_id": device.id})

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "sessionToken": session_token,
        "user": {
            "id": employee.id,
            "username": employee.username,
            "email": employee.email,
            "name": employee.full_name,
            "role": employee.role,
            "phone": employee.phone,
            "is_active": employee.is_active
        },
        "device": {
            "id": device.id,
            "name": device.device_name,
            "permittedRoles": permitted_roles,
            "status": device.status
        }
    }

# -------------------------------------------------------------
# 3. GET /status/{fingerprint}
# -------------------------------------------------------------
@router.get("/status/{fingerprint}", response_model=DeviceStatusResponse)
def get_device_status(fingerprint: str, db: Session = Depends(get_db)):
    """Check device authorization status."""
    device = db.query(AuthorizedDevice).filter(AuthorizedDevice.device_fingerprint_hash == fingerprint).first()
    if not device:
        return DeviceStatusResponse(status="unregistered", message="Device not yet registered")

    assigned_name = None
    if device.assigned_employee_id:
        emp = db.query(Employee).filter(Employee.id == device.assigned_employee_id).first()
        if emp:
            assigned_name = emp.full_name

    try:
        roles = json.loads(device.permitted_roles)
    except Exception:
        roles = [device.permitted_roles]

    return DeviceStatusResponse(
        id=device.id,
        name=device.device_name,
        status=device.status,
        permitted_roles=roles,
        assigned_employee_id=device.assigned_employee_id,
        assigned_employee_name=assigned_name,
        last_active_at=device.last_active_at
    )

# -------------------------------------------------------------
# 4. POST /request-approval
# -------------------------------------------------------------
@router.post("/request-approval")
def request_approval(payload: DeviceApprovalRequestSubmission, db: Session = Depends(get_db)):
    """Update device friendly label or approval request notes."""
    device = db.query(AuthorizedDevice).filter(AuthorizedDevice.device_fingerprint_hash == payload.device_fingerprint).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if payload.device_name:
        device.device_name = payload.device_name.strip()
    
    req_entry = db.query(DeviceApprovalRequest).filter(DeviceApprovalRequest.device_id == device.id).first()
    if req_entry and payload.notes:
        req_entry.admin_notes = payload.notes.strip()

    db.commit()
    return {"success": True, "message": "Terminal details updated"}

# -------------------------------------------------------------
# Admin Device Management Endpoints
# -------------------------------------------------------------
@router.get("/admin/devices", response_model=List[DeviceResponse], dependencies=[Depends(require_admin)])
def list_admin_devices(db: Session = Depends(get_db)):
    """List all registered devices with their roles and status (Admin Only)."""
    devices = db.query(AuthorizedDevice).order_by(AuthorizedDevice.created_at.desc()).all()
    results = []
    for d in devices:
        try:
            roles = json.loads(d.permitted_roles)
        except Exception:
            roles = [d.permitted_roles]

        assigned_name = None
        if d.assigned_employee_id:
            emp = db.query(Employee).filter(Employee.id == d.assigned_employee_id).first()
            if emp:
                assigned_name = emp.full_name

        results.append(DeviceResponse(
            id=d.id,
            device_fingerprint_hash=d.device_fingerprint_hash,
            device_name=d.device_name,
            assigned_employee_id=d.assigned_employee_id,
            assigned_employee_name=assigned_name,
            permitted_roles=roles,
            status=d.status,
            device_info=d.device_info,
            ip_address=d.ip_address,
            last_active_at=d.last_active_at,
            created_at=d.created_at
        ))
    return results

@router.post("/admin/devices/{device_id}/approve", dependencies=[Depends(require_admin)])
def approve_device(
    device_id: str,
    payload: DeviceAdminApproveRequest,
    current_admin: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """Approve a terminal, assign roles and employee, and enforce device limit (Admin Only)."""
    device = db.query(AuthorizedDevice).filter(AuthorizedDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Enforce device limit policy
    if payload.assigned_employee_id:
        policy_row = db.query(RestaurantSettings).filter(RestaurantSettings.key == "max_devices_per_employee").first()
        max_limit = int(policy_row.value) if policy_row else 2

        count = db.query(AuthorizedDevice).filter(
            AuthorizedDevice.assigned_employee_id == payload.assigned_employee_id,
            AuthorizedDevice.status == "approved",
            AuthorizedDevice.id != device_id
        ).count()

        if count >= max_limit:
            raise HTTPException(
                status_code=400,
                detail=f"This employee already has {count} approved devices (maximum is {max_limit}). Revoke an existing device first."
            )

    now = datetime.now(timezone.utc)
    device.status = "approved"
    device.assigned_employee_id = payload.assigned_employee_id
    device.permitted_roles = json.dumps(payload.permitted_roles)
    if payload.device_name:
        device.device_name = payload.device_name.strip()
    device.approved_by = current_admin.full_name
    device.approved_at = now
    device.revoked_by = None
    device.revoked_at = None

    db.query(DeviceApprovalRequest).filter(
        DeviceApprovalRequest.device_id == device_id,
        DeviceApprovalRequest.status == "pending"
    ).update({"status": "approved", "reviewed_by": current_admin.full_name, "reviewed_at": now})

    db.commit()
    log_audit(db, device_id, payload.assigned_employee_id, "DEVICE_APPROVED", f"Approved by {current_admin.full_name} for {payload.permitted_roles}")
    return {"success": True, "message": f"Terminal '{device.device_name}' approved"}

@router.post("/admin/devices/{device_id}/reject", dependencies=[Depends(require_admin)])
def reject_device(
    device_id: str,
    payload: DeviceAdminRejectRequest,
    current_admin: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """Reject a terminal registration request (Admin Only)."""
    device = db.query(AuthorizedDevice).filter(AuthorizedDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.status = "rejected"
    now = datetime.now(timezone.utc)
    db.query(DeviceApprovalRequest).filter(DeviceApprovalRequest.device_id == device_id).update({
        "status": "rejected",
        "admin_notes": payload.reason or "Rejected by administrator",
        "reviewed_by": current_admin.full_name,
        "reviewed_at": now
    })
    db.query(DeviceSession).filter(DeviceSession.device_id == device_id).update({"is_valid": False})
    db.commit()

    log_audit(db, device_id, None, "DEVICE_REJECTED", f"Rejected by {current_admin.full_name}: {payload.reason or ''}")
    return {"success": True, "message": f"Terminal '{device.device_name}' rejected"}

@router.post("/admin/devices/{device_id}/revoke", dependencies=[Depends(require_admin)])
def revoke_device(
    device_id: str,
    payload: DeviceAdminRevokeRequest,
    current_admin: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """Instantly revoke terminal access and invalidate all active sessions (Admin Only)."""
    device = db.query(AuthorizedDevice).filter(AuthorizedDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    now = datetime.now(timezone.utc)
    device.status = "revoked"
    device.revoked_by = current_admin.full_name
    device.revoked_at = now

    # Invalidate all active sessions immediately
    db.query(DeviceSession).filter(DeviceSession.device_id == device_id).update({"is_valid": False})
    db.commit()

    log_audit(db, device_id, device.assigned_employee_id, "DEVICE_REVOKED", f"Revoked by {current_admin.full_name}: {payload.reason or 'Admin revocation'}")
    return {"success": True, "message": f"Terminal '{device.device_name}' revoked. All sessions terminated."}

@router.delete("/admin/devices/{device_id}", dependencies=[Depends(require_admin)])
def delete_device(device_id: str, db: Session = Depends(get_db)):
    """Permanently delete device registration (Admin Only)."""
    device = db.query(AuthorizedDevice).filter(AuthorizedDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    db.delete(device)
    db.commit()
    return {"success": True, "message": "Terminal deleted"}

@router.get("/admin/policy", response_model=DevicePolicyResponse, dependencies=[Depends(require_admin)])
def get_device_policy(db: Session = Depends(get_db)):
    """Get maximum allowed devices per employee (Admin Only)."""
    row = db.query(RestaurantSettings).filter(RestaurantSettings.key == "max_devices_per_employee").first()
    limit = int(row.value) if row else 2
    return DevicePolicyResponse(max_devices_per_employee=limit)

@router.put("/admin/policy", response_model=DevicePolicyResponse, dependencies=[Depends(require_admin)])
def update_device_policy(payload: DevicePolicyUpdateRequest, db: Session = Depends(get_db)):
    """Update maximum allowed devices per employee (Admin Only)."""
    row = db.query(RestaurantSettings).filter(RestaurantSettings.key == "max_devices_per_employee").first()
    if row:
        row.value = str(max(1, payload.max_devices_per_employee))
    else:
        db.add(RestaurantSettings(key="max_devices_per_employee", value=str(max(1, payload.max_devices_per_employee))))
    db.commit()
    return DevicePolicyResponse(max_devices_per_employee=max(1, payload.max_devices_per_employee))

@router.get("/admin/audit-logs", dependencies=[Depends(require_admin)])
def list_audit_logs(db: Session = Depends(get_db)):
    """List recent security audit events (Admin Only)."""
    logs = db.query(DeviceAuditLog).order_by(DeviceAuditLog.created_at.desc()).limit(100).all()
    return logs
