from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.api.v1.api import api_router
from app.services.sync_worker import sync_worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database & Seed Default Accounts
    db = SessionLocal()
    try:
        init_db(db)
        print("[FastAPI] Database initialized & seeded with default accounts.")
    finally:
        db.close()
    
    # Start background cloud sync & scheduled backup worker
    await sync_worker.start()
    
    yield
    
    # Shutdown
    await sync_worker.stop()
    print("[FastAPI] Shutting down Loaf n Leaf server.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade Restaurant Management & POS System for Loaf n Leaf",
    lifespan=lifespan
)

# Cross-Origin Resource Sharing (CORS) for Windows desktop, mobile, and web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Endpoints
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "documentation": "/docs"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "currency": settings.DEFAULT_CURRENCY,
        "timezone": settings.TIMEZONE,
        "database": "connected"
    }
