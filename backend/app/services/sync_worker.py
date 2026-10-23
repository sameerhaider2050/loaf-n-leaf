import asyncio
import json
import logging
from datetime import datetime, timezone
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.sync import SyncRecord
from app.services.backup_service import create_local_backup

logger = logging.getLogger("sync_worker")

class CloudSyncWorker:
    def __init__(self):
        self.is_running = False
        self._task: asyncio.Task | None = None

    async def start(self):
        """Start background replication and backup loop."""
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Cloud Synchronization & Backup Worker started")

    async def stop(self):
        """Gracefully stop background loop."""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Cloud Synchronization Worker stopped")

    async def _run_loop(self):
        """Periodic replication execution every 60 seconds."""
        backup_counter = 0
        while self.is_running:
            try:
                # 1. Sync pending records to Cloud / Supabase
                await self.sync_pending_records()

                # 2. Daily / periodic local backup check (every 1 hour = 60 loops)
                backup_counter += 1
                if backup_counter >= 60:
                    backup_counter = 0
                    db = SessionLocal()
                    try:
                        create_local_backup(db, backup_type="scheduled")
                    except Exception as e:
                        logger.error(f"Scheduled backup error: {e}")
                    finally:
                        db.close()

            except Exception as e:
                logger.warning(f"Sync loop iteration error: {e}")

            # Sleep 60 seconds before next iteration
            await asyncio.sleep(60)

    async def sync_pending_records(self) -> int:
        """
        Replicate pending synchronization records to Supabase.
        If internet is down, keeps records safe locally in pending_sync state.
        """
        if not settings.ENABLE_CLOUD_SYNC or not settings.SUPABASE_URL:
            return 0

        db = SessionLocal()
        synced_count = 0
        try:
            pending = db.query(SyncRecord).filter(
                SyncRecord.status == "pending_sync"
            ).order_by(SyncRecord.created_at.asc()).limit(50).all()

            if not pending:
                return 0

            headers = {
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                for record in pending:
                    try:
                        payload = json.loads(record.payload) if record.payload else {}
                        # Post to Supabase REST table: /rest/v1/{entity_type}s
                        endpoint = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/{record.entity_type}s"
                        
                        resp = await client.post(endpoint, json=payload, headers=headers)
                        if resp.status_code in [200, 201, 204]:
                            record.status = "synced"
                            record.synced_at = datetime.now(timezone.utc)
                            synced_count += 1
                        else:
                            record.retry_count += 1
                            record.error_message = f"Supabase HTTP {resp.status_code}: {resp.text[:200]}"
                            if record.retry_count > 10:
                                record.status = "sync_error"
                    except Exception as e:
                        record.retry_count += 1
                        record.error_message = f"Network or parsing error: {str(e)[:200]}"
                        # Network outage detected; break early to avoid hammering
                        break

            db.commit()
        except Exception as e:
            logger.error(f"Error during sync execution: {e}")
        finally:
            db.close()

        return synced_count

sync_worker = CloudSyncWorker()
