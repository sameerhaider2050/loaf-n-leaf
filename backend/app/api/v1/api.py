from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.devices import router as devices_router
from app.api.v1.categories import router as categories_router
from app.api.v1.products import router as products_router
from app.api.v1.tables import router as tables_router
from app.api.v1.orders import router as orders_router
from app.api.v1.payments import router as payments_router
from app.api.v1.reports import router as reports_router
from app.api.v1.sync import router as sync_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(devices_router)
api_router.include_router(categories_router)
api_router.include_router(products_router)
api_router.include_router(tables_router)
api_router.include_router(orders_router)
api_router.include_router(payments_router)
api_router.include_router(reports_router)
api_router.include_router(sync_router)
