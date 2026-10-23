from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_password, verify_pin, create_access_token, hash_password, hash_pin
from app.models.employee import Employee
from app.schemas.auth import LoginRequest, TokenResponse, EmployeeResponse, EmployeeCreate, EmployeeUpdate
from app.api.deps import get_current_employee, require_admin

router = APIRouter(prefix="/auth", tags=["Authentication & Staff"])

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Standard staff login via email/username + password OR quick PIN."""
    employee = None
    if payload.pin:
        clean_pin = payload.pin.strip()
        candidates = db.query(Employee).filter(Employee.is_active == True).all()
        for cand in candidates:
            if cand.hashed_pin and verify_pin(clean_pin, cand.hashed_pin):
                employee = cand
                break
    elif payload.identifier:
        clean_ident = payload.identifier.strip().lower()
        employee = db.query(Employee).filter(
            (Employee.username.ilike(clean_ident)) | (Employee.email.ilike(clean_ident)),
            Employee.is_active == True
        ).first()
        
        if employee:
            if not payload.password or not verify_password(payload.password, employee.hashed_password):
                raise HTTPException(status_code=401, detail="Incorrect password")
                
    if not employee:
        raise HTTPException(status_code=401, detail="Invalid staff credentials or account inactive")

    token = create_access_token({"sub": employee.id, "role": employee.role})
    return TokenResponse(access_token=token, employee=employee)

@router.get("/me", response_model=EmployeeResponse)
def get_me(current_employee: Employee = Depends(get_current_employee)):
    """Return currently authenticated employee profile."""
    return current_employee

# -------------------------------------------------------------
# Admin Staff Management
# -------------------------------------------------------------
@router.get("/staff", response_model=List[EmployeeResponse], dependencies=[Depends(require_admin)])
def list_staff(db: Session = Depends(get_db)):
    """List all staff accounts (Admin Only)."""
    return db.query(Employee).order_by(Employee.created_at.desc()).all()

@router.post("/staff", response_model=EmployeeResponse, status_code=201, dependencies=[Depends(require_admin)])
def create_staff(payload: EmployeeCreate, db: Session = Depends(get_db)):
    """Create a new staff account (Admin Only)."""
    existing = db.query(Employee).filter(
        (Employee.username == payload.username.strip()) | (Employee.email == payload.email.strip().lower())
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already in use")

    new_emp = Employee(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        hashed_pin=hash_pin(payload.pin) if payload.pin else None,
        role=payload.role,
        phone=payload.phone,
        is_active=payload.is_active
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return new_emp

@router.put("/staff/{employee_id}", response_model=EmployeeResponse, dependencies=[Depends(require_admin)])
def update_staff(employee_id: str, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    """Update employee details, role, or reset credentials (Admin Only)."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if payload.full_name is not None:
        emp.full_name = payload.full_name.strip()
    if payload.role is not None:
        emp.role = payload.role
    if payload.phone is not None:
        emp.phone = payload.phone
    if payload.is_active is not None:
        emp.is_active = payload.is_active
    if payload.password:
        emp.hashed_password = hash_password(payload.password)
    if payload.pin:
        emp.hashed_pin = hash_pin(payload.pin)

    db.commit()
    db.refresh(emp)
    return emp
