import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.routers import auth, media, albums

logger = logging.getLogger("photomap")


# ── Security headers middleware ──
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if get_settings().environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"PhotoMap API starting up (env={settings.environment})...")

    # Create blob containers on startup (for Azurite)
    try:
        from app.services.storage import ensure_containers
        await ensure_containers()
    except Exception as e:
        logger.warning(f"Could not ensure blob containers (storage may not be ready): {e}")

    yield
    logger.info("PhotoMap API shutting down...")


settings = get_settings()

app = FastAPI(
    title="PhotoMap API",
    description="Photo & Video management platform with map pinning",
    version="1.0.0",
    lifespan=lifespan,
    # Disable docs in production
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS — explicit methods and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Routers
app.include_router(auth.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(albums.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "environment": settings.environment}
