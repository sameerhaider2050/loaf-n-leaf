from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.table import RestaurantTable
from app.models.order import Order
from app.schemas.table import TableCreate, TableUpdate, TableResponse
from app.schemas.order import OrderResponse
from app.api.deps import require_admin

router = APIRouter(prefix="/tables", tags=["Restaurant Tables"])

@router.get("", response_model=List[TableResponse])
def list_tables(db: Session = Depends(get_db)):
    """List all restaurant tables with live status and active order IDs."""
    return db.query(RestaurantTable).order_by(RestaurantTable.table_number.asc()).all()

@router.get("/{table_id}/active-bill", response_model=Optional[OrderResponse])
def get_table_active_bill(table_id: str, db: Session = Depends(get_db)):
    """Retrieve currently active dine-in bill for an occupied table."""
    table = db.query(RestaurantTable).filter(
        (RestaurantTable.id == table_id) | (RestaurantTable.table_number == table_id)
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
        
    if not table.active_order_id:
        return None

    order = db.query(Order).filter(Order.id == table.active_order_id).first()
    return order

@router.post("", response_model=TableResponse, status_code=201, dependencies=[Depends(require_admin)])
def create_table(payload: TableCreate, db: Session = Depends(get_db)):
    """Add a new restaurant table (Admin Only)."""
    clean_num = payload.table_number.strip().upper()
    existing = db.query(RestaurantTable).filter(RestaurantTable.table_number == clean_num).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Table number '{clean_num}' already exists")

    table = RestaurantTable(
        table_number=clean_num,
        name=payload.name.strip(),
        capacity=payload.capacity,
        status="available"
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    return table

@router.put("/{table_id}", response_model=TableResponse, dependencies=[Depends(require_admin)])
def update_table(table_id: str, payload: TableUpdate, db: Session = Depends(get_db)):
    """Update table label or capacity (Admin Only)."""
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if payload.name is not None:
        table.name = payload.name.strip()
    if payload.capacity is not None:
        table.capacity = payload.capacity
    if payload.status is not None:
        table.status = payload.status

    db.commit()
    db.refresh(table)
    return table

@router.delete("/{table_id}", dependencies=[Depends(require_admin)])
def delete_table(table_id: str, db: Session = Depends(get_db)):
    """Delete a table if it is not currently occupied (Admin Only)."""
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    if table.status == "occupied" or table.active_order_id:
        raise HTTPException(status_code=400, detail="Cannot delete an occupied table with an active bill")

    db.delete(table)
    db.commit()
    return {"success": True, "message": "Table deleted"}
