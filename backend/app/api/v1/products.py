from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.catalog import Product, Category
from app.schemas.catalog import ProductCreate, ProductUpdate, ProductResponse
from app.api.deps import require_admin

router = APIRouter(prefix="/products", tags=["Menu Products"])

@router.get("", response_model=List[ProductResponse])
def list_products(
    category_id: Optional[str] = None,
    category_slug: Optional[str] = None,
    search: Optional[str] = None,
    available_only: bool = False,
    db: Session = Depends(get_db)
):
    """List products with optional search, category, and availability filters."""
    query = db.query(Product)
    if available_only:
        query = query.filter(Product.is_available == True)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    elif category_slug and category_slug != "all":
        cat = db.query(Category).filter(Category.slug == category_slug).first()
        if cat:
            query = query.filter(Product.category_id == cat.id)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((Product.name.ilike(s)) | (Product.code.ilike(s)))

    return query.order_by(Product.name.asc()).all()

@router.post("", response_model=ProductResponse, status_code=201, dependencies=[Depends(require_admin)])
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    """Create a new menu item (Admin Only)."""
    clean_code = payload.code.strip() if payload.code else None
    if clean_code:
        existing = db.query(Product).filter(Product.code == clean_code).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Product code '{clean_code}' already exists")

    prod = Product(
        name=payload.name.strip(),
        category_id=payload.category_id,
        price=payload.price,
        cost=payload.cost or 0.00,
        code=clean_code,
        image_url=payload.image_url,
        is_available=payload.is_available,
        description=payload.description
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod

@router.put("/{product_id}", response_model=ProductResponse, dependencies=[Depends(require_admin)])
def update_product(product_id: str, payload: ProductUpdate, db: Session = Depends(get_db)):
    """Update product information or pricing (Admin Only)."""
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.name is not None:
        prod.name = payload.name.strip()
    if payload.category_id is not None:
        prod.category_id = payload.category_id
    if payload.price is not None:
        prod.price = payload.price
    if payload.cost is not None:
        prod.cost = payload.cost
    if payload.code is not None:
        prod.code = payload.code.strip() if payload.code else None
    if payload.image_url is not None:
        prod.image_url = payload.image_url
    if payload.is_available is not None:
        prod.is_available = payload.is_available
    if payload.description is not None:
        prod.description = payload.description

    db.commit()
    db.refresh(prod)
    return prod

@router.put("/{product_id}/toggle-availability", response_model=ProductResponse)
def toggle_availability(product_id: str, db: Session = Depends(get_db)):
    """Quick 86 / toggle product availability for floor staff and cashiers."""
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    prod.is_available = not prod.is_available
    db.commit()
    db.refresh(prod)
    return prod

@router.delete("/{product_id}", dependencies=[Depends(require_admin)])
def delete_product(product_id: str, db: Session = Depends(get_db)):
    """Delete product catalog entry (Admin Only)."""
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(prod)
    db.commit()
    return {"success": True, "message": "Product removed from catalog"}
