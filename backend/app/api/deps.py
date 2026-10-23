import json
from typing import Optional, List
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import decode_access_token
from app.models.employee import Employee
from app.models.device import DeviceSession, AuthorizedDevice

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_employee(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Employee:
    """Validate Bearer JWT and return authenticated Employee."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    employee_id = payload["sub"]
    employee = db.query(Employee).filter(Employee.id == employee_id, Employee.is_active == True).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee not found or account deactivated",
        )
    return employee

def require_role(allowed_roles: List[str]):
    """Role-Based Access Control decorator."""
    def role_checker(current_user: Employee = Depends(get_current_employee)) -> Employee:
        if current_user.role not in allowed_roles and "admin" not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}",
            )
        if current_user.role not in allowed_roles and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires role: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker

require_admin = require_role(["admin"])
require_cashier = require_role(["admin", "cashier"])
require_waiter = require_role(["admin", "cashier", "order_taker"])

def verify_device_session(
    x_device_session_token: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[AuthorizedDevice]:
    """
    Device-Based Access Control: Validates hardware device authorization.
    Rejects revoked terminals, expired sessions, and unapproved hardware.
    """
    if not x_device_session_token:
        # In transition mode or for initial registration
        return None
        
    session = db.query(DeviceSession).filter(
        DeviceSession.session_token == x_device_session_token,
        DeviceSession.is_valid == True
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "DEVICE_SESSION_INVALID", "message": "Terminal session has expired or is invalid."}
        )
        
    device = db.query(AuthorizedDevice).filter(AuthorizedDevice.id == session.device_id).first()
    if not device or device.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "DEVICE_REVOKED", "message": "Terminal authorization has been revoked by an administrator."}
        )
        
    return device
