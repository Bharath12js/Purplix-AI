"""Assurance record signing — D3.

Self-signed Ed25519 for v1, plus one cheap addition: each record embeds the
hash of the previous record for the same target. That buys tamper-evidence
now — you cannot silently delete or reorder an inconvenient iteration — and a
hash chain is the natural on-ramp to a transparency log in v2 rather than a
thing you'd throw away to build one.

Key handling: generated to disk for Sprint 0, KMS/HSM by Sprint D.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

_KEY_PATH = Path(__file__).resolve().parent.parent / "data" / "signing_key.pem"


def _load_or_create() -> ed25519.Ed25519PrivateKey:
    _KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
    if _KEY_PATH.exists():
        return serialization.load_pem_private_key(_KEY_PATH.read_bytes(), password=None)  # type: ignore[return-value]
    key = ed25519.Ed25519PrivateKey.generate()
    _KEY_PATH.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    return key


def canonical(payload: dict) -> bytes:
    """Stable bytes for hashing and signing. Sorted keys, no incidental spacing."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def public_key_id() -> str:
    pub = _load_or_create().public_key().public_bytes(
        encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw
    )
    return hashlib.sha256(pub).hexdigest()[:16]


def public_key_pem() -> str:
    return (
        _load_or_create()
        .public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )


def sign_record(payload: dict, prev_hash: str) -> dict:
    """Returns {payload, prev_hash, self_hash, signature, public_key_id}."""
    body = dict(payload)
    body["prev_hash"] = prev_hash
    blob = canonical(body)
    self_hash = hashlib.sha256(blob).hexdigest()
    sig = _load_or_create().sign(blob).hex()
    return {
        "payload": body,
        "prev_hash": prev_hash,
        "self_hash": self_hash,
        "signature": sig,
        "public_key_id": public_key_id(),
    }


def verify_record(record: dict) -> bool:
    """Verify signature AND that self_hash matches the payload actually shown.

    Both halves matter: a valid signature over a different payload than the one
    on screen is the failure mode worth catching.
    """
    try:
        blob = canonical(record["payload"])
        if hashlib.sha256(blob).hexdigest() != record["self_hash"]:
            return False
        pub = _load_or_create().public_key()
        pub.verify(bytes.fromhex(record["signature"]), blob)
        return True
    except Exception:
        return False
