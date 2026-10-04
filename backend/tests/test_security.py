from datetime import timedelta

from cryptography.fernet import Fernet
from jose import jwt

from app.core import security
from app.core.config import settings


def test_password_reset_token_has_dedicated_type():
    token = security.create_password_reset_token(123)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

    assert payload["sub"] == "123"
    assert payload["type"] == "password_reset"


def test_refresh_token_has_refresh_type():
    token = security.create_refresh_token(123, expires_delta=timedelta(minutes=5))
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

    assert payload["sub"] == "123"
    assert payload["type"] == "refresh"


def test_github_token_round_trip(monkeypatch):
    key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setattr(settings, "GITHUB_TOKEN_ENCRYPTION_KEY", key)

    token = "ghp_test_token_value"
    encrypted = security.encrypt_github_token(token)

    assert encrypted != token
    assert security.decrypt_github_token(encrypted) == token
