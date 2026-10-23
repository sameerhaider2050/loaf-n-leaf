import base64
import hashlib
from typing import Tuple
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.exceptions import InvalidSignature

def compute_public_key_fingerprint(public_key_spki_b64: str) -> str:
    """Compute 32-character SHA-256 hex fingerprint of SPKI public key."""
    spki_bytes = base64.b64decode(public_key_spki_b64)
    digest = hashlib.sha256(spki_bytes).hexdigest()
    return digest[:32]

def verify_device_signature(
    public_key_spki_b64: str,
    nonce: str,
    signature_b64: str
) -> bool:
    """
    Verify ECDSA P-256 SHA-256 signature against an SPKI public key.
    Handles both IEEE P1363 (64-byte r||s from WebCrypto/Android Keystore) 
    and standard DER-encoded signatures.
    """
    try:
        spki_bytes = base64.b64decode(public_key_spki_b64)
        public_key = serialization.load_der_public_key(spki_bytes)
        
        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            return False
            
        data = nonce.encode("utf-8")
        sig_bytes = base64.b64decode(signature_b64)
        
        # If signature is 64 bytes (IEEE P1363 format: 32 bytes r + 32 bytes s)
        if len(sig_bytes) == 64:
            r = int.from_bytes(sig_bytes[:32], "big")
            s = int.from_bytes(sig_bytes[32:], "big")
            der_signature = encode_dss_signature(r, s)
        else:
            der_signature = sig_bytes
            
        public_key.verify(
            der_signature,
            data,
            ec.ECDSA(hashes.SHA256())
        )
        return True
    except (InvalidSignature, ValueError, Exception):
        return False
