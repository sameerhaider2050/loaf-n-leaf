from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.catalog import Category
from app.schemas.catalog import CategoryCreate, CategoryUpdate, CategoryResponse
from app.api.deps import require_admin

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """List all categories ordered by sort_order."""
    return db.query(Category).filter(Category.is_active == True).order_by(Category.sort_order.asc()).all()

@router.post("", response_model=CategoryResponse, status_code=201, dependencies=[Depends(require_admin)])
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category (Admin Only)."""
    existing = db.query(Category).filter(Category.slug == payload.slug.strip().lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category slug already exists")

    cat = Category(
        name=payload.name.strip(),
        slug=payload.slug.strip().lower(),
        sort_order=payload.sort_order,
        is_active=payload.is_active
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.put("/{category_id}", response_model=CategoryResponse, dependencies=[Depends(require_admin)])
def update_category(category_id: str, payload: CategoryUpdate, db: Session = Depends(get_db)):
    """Update category name, slug, or sort order (Admin Only)."""
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if payload.name is not None:
        cat.name = payload.name.strip()
    if payload.slug is not None:
        cat.slug = payload.slug.strip().lower()
    if payload.sort_order is not None:
        cat.sort_order = payload.sort_order
    if payload.is_active is not None:
        cat.is_active = payload.is_active

    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/{category_id}", dependencies=[Depends(require_admin)])
def delete_category(category_id: str, db: Session = Depends(get_db)):
    """Soft delete or disable category (Admin Only)."""
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_active = False
    db.commit()
    return {"success": True, "message": "Category disabled"}
