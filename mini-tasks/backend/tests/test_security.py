import jwt
import pytest

from app.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_is_hashed_and_verifiable():
    h = hash_password("password123")
    assert h != "password123"
    assert verify_password("password123", h)
    assert not verify_password("wrong", h)


def test_jwt_roundtrip_and_tamper():
    token = create_access_token("user-1")
    assert decode_access_token(token) == "user-1"
    with pytest.raises(jwt.PyJWTError):
        decode_access_token(token + "x")
