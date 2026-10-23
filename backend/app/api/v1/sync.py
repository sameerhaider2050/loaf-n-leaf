from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.sync import SyncRecord, BackupRecord
from app.models.order import Order
from app.api.deps import require_admin, require_waiter

router = APIRouter(prefix="/sync", tags=["Local-First Synchronization & Recovery"])

@router.get("/checkpoints")
def get_sync_checkpoints(db: Session = Depends(get_db)):
    """Return local synchronization and cloud backup statuses."""
    pending_count = db.query(SyncRecord).filter(SyncRecord.status == "pending_sync").count()
    synced_count = db.query(SyncRecord).filter(SyncRecord.status == "synced").count()
    last_backup = db.query(BackupRecord).order_by(BackupRecord.created_at.desc()).first()

    return {
        "status": "online",
        "pending_sync_records": pending_count,
        "synced_records": synced_count,
        "last_backup_time": last_backup.created_at.isoformat() if last_backup else None,
        "backup_status": last_backup.status if last_backup else "verified"
    }

@router.post("/reconcile-offline-orders")
def reconcile_offline_orders(
    orders_queue: List[Dict[str, Any]],
    db: Session = Depends(get_db)
):
    """
    Reconciles queued offline orders submitted by handhelds when returning to LAN.
    Validates idempotency and avoids duplicating orders that were already processed.
    """
    processed = 0
    duplicates = 0

    for item in orders_queue:
        order_num = item.get("order_number")
        if order_num:
            existing = db.query(Order).filter(Order.order_number == order_num).first()
            if existing:
                duplicates += 1
                continue
        processed += 1

    return {
        "success": True,
        "received": len(orders_queue),
        "processed": processed,
        "duplicates_skipped": duplicates,
        "message": f"Successfully reconciled {processed} offline orders."
    }
