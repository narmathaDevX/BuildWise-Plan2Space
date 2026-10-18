from backend.app.services.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hashing():
    pwd = "MySecretPassword123"
    hashed = hash_password(pwd)

    # Password is not stored plaintext
    assert hashed != pwd
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    # Verification works
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_creation_and_decoding():
    payload = {"sub": "test@buildwise.local", "role": "admin"}
    token = create_access_token(payload)

    assert isinstance(token, str)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "test@buildwise.local"
    assert decoded["role"] == "admin"
