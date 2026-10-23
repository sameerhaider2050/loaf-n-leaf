import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
from jose import jwt, JWTError

from app.core.config import settings

def hash_password(password: str) -> str:
    """Hash plaintext password using direct bcrypt with secure salt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), 
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def hash_pin(pin: str) -> str:
    """Secure hash for staff quick PIN."""
    return hash_password(pin.strip())

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """Verify staff quick PIN."""
    return verify_password(plain_pin.strip(), hashed_pin)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

# Ephemeral in-memory store for challenge nonces
# key: challenge_id -> { "nonce": str, "fingerprint": str, "created_at": float }
_challenge_store: Dict[str, Dict[str, Any]] = {}

def create_device_challenge(fingerprint: str) -> Dict[str, Any]:
    """Generate a single-use random cryptographic challenge nonce."""
    clean_expired_challenges()
    challenge_id = secrets.token_urlsafe(24)
    nonce = secrets.token_hex(32)
    now = time.time()
    
    _challenge_store[challenge_id] = {
        "nonce": nonce,
        "fingerprint": fingerprint,
        "created_at": now
    }
    
    return {
        "challenge_id": challenge_id,
        "nonce": nonce,
        "timestamp": int(now * 1000),
        "expires_in": settings.CHALLENGE_EXPIRE_SECONDS
    }

def consume_device_challenge(challenge_id: str, fingerprint: str) -> Optional[str]:
    """Validate and consume single-use challenge nonce (prevents replay)."""
    clean_expired_challenges()
    challenge = _challenge_store.pop(challenge_id, None)
    if not challenge:
        return None
    
    now = time.time()
    if now - challenge["created_at"] > settings.CHALLENGE_EXPIRE_SECONDS:
        return None
        
    if challenge["fingerprint"] != fingerprint:
        return None
        
    return challenge["nonce"]

def clean_expired_challenges():
    """Prune expired nonces from memory."""
    now = time.time()
    expired = [k for k, v in _challenge_store.items() if now - v["created_at"] > settings.CHALLENGE_EXPIRE_SECONDS]
    for k in expired:
        _challenge_store.pop(k, None)
