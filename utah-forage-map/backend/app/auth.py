import os
import time

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User

load_dotenv()

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")

bearer_scheme = HTTPBearer()

# In-memory JWKS cache: (keys_list, fetched_at_monotonic)
_jwks_cache: tuple[list, float] | None = None
_JWKS_TTL = 3600  # refresh keys every hour


def _get_jwks() -> list:
    global _jwks_cache
    now = time.monotonic()
    if _jwks_cache and now - _jwks_cache[1] < _JWKS_TTL:
        return _jwks_cache[0]
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    keys = resp.json()["keys"]
    _jwks_cache = (keys, now)
    return keys


def verify_auth0_token(token: str) -> dict:
    """Validate an Auth0 RS256 JWT against JWKS. Returns decoded payload."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise credentials_exc

    rsa_key = next(
        (k for k in _get_jwks() if k.get("kid") == unverified_header.get("kid")),
        None,
    )
    if rsa_key is None:
        raise credentials_exc

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/",
        )
    except JWTError:
        raise credentials_exc

    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = verify_auth0_token(credentials.credentials)
    auth0_id: str | None = payload.get("sub")
    if not auth0_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )
    user = db.query(User).filter(User.auth0_id == auth0_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user
