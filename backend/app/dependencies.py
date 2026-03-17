import logging
import time
import uuid
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# Cache JWKS keys with TTL (1 hour)
_jwks_cache: dict | None = None
_jwks_cache_time: float = 0.0
_JWKS_TTL_SECONDS = 3600

# Fixed UUID for dev user so it persists across restarts
_DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def _get_jwks(domain: str) -> dict:
    global _jwks_cache, _jwks_cache_time
    now = time.monotonic()
    if _jwks_cache is not None and (now - _jwks_cache_time) < _JWKS_TTL_SECONDS:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://{domain}/.well-known/jwks.json")
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_time = now
        return _jwks_cache


async def _get_or_create_dev_user(db: AsyncSession) -> User:
    """Get or create a dev user for local development (no Auth0 needed)."""
    result = await db.execute(select(User).where(User.id == _DEV_USER_ID))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            id=_DEV_USER_ID,
            auth0_sub="dev|local-debug-user",
            email="dev@photomap.local",
            display_name="Dev User",
            avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=dev",
        )
        db.add(user)
        await db.flush()
        logger.info("Created dev user for local debugging")
    return user


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    # ── Dev auth bypass ──
    if settings.dev_auth_bypass:
        logger.debug("Dev auth bypass active — using dev user")
        return await _get_or_create_dev_user(db)

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = credentials.credentials

    try:
        jwks = await _get_jwks(settings.auth0_domain)
        unverified_header = jwt.get_unverified_header(token)

        rsa_key = {}
        for key in jwks.get("keys", []):
            if key["kid"] == unverified_header.get("kid"):
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break

        if not rsa_key:
            # Key rotation may have happened — clear cache and retry once
            global _jwks_cache
            _jwks_cache = None
            jwks = await _get_jwks(settings.auth0_domain)
            for key in jwks.get("keys", []):
                if key["kid"] == unverified_header.get("kid"):
                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"],
                    }
                    break
            if not rsa_key:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to find signing key")

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=[settings.auth0_algorithms],
            audience=settings.auth0_api_audience,
            issuer=f"https://{settings.auth0_domain}/",
        )
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    sub: str = payload.get("sub", "")
    email: str = payload.get("email", payload.get("sub", ""))
    name: str = payload.get("name", payload.get("nickname", ""))
    picture: str = payload.get("picture", "")

    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # Upsert user
    result = await db.execute(select(User).where(User.auth0_sub == sub))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            auth0_sub=sub,
            email=email,
            display_name=name,
            avatar_url=picture,
        )
        db.add(user)
        await db.flush()
    else:
        # Update profile fields from Auth0 token
        if email:
            user.email = email
        if name:
            user.display_name = name
        if picture:
            user.avatar_url = picture
        await db.flush()

    return user
