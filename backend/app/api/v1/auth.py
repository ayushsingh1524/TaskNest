from typing import Any
import secrets
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError

from app.api import deps
from app.core.config import settings
from app.core import security
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserLogin, ForgotPassword, ResetPassword
from app.schemas.token import Token

router = APIRouter()

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(deps.get_db)) -> Any:
    result = await db.execute(select(User).where((User.email == user_in.email) | (User.username == user_in.username)))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="The user with this username or email already exists in the system.")
    db_user = User(email=user_in.email, username=user_in.username, password_hash=security.get_password_hash(user_in.password))
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
async def login(response: Response, user_in: UserLogin, db: AsyncSession = Depends(deps.get_db)) -> Any:
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    if not user or not security.verify_password(user_in.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token = security.create_access_token(subject=user.id)
    refresh_token = security.create_refresh_token(subject=user.id)
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True,
                        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
                        samesite="lax", secure=settings.COOKIE_SECURE)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(deps.get_db)) -> Any:
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token subject")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"access_token": security.create_access_token(subject=user.id), "token_type": "bearer"}

@router.post("/logout")
async def logout(response: Response) -> Any:
    response.delete_cookie("refresh_token")
    return {"message": "Successfully logged out"}

@router.post("/forgot-password")
async def forgot_password(data: ForgotPassword, db: AsyncSession = Depends(deps.get_db)) -> Any:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()
    if not user:
        return {"message": "If an account exists, a password reset link has been sent."}
    reset_token = security.create_password_reset_token(subject=user.id)
    try:
        from app.core.email import send_reset_password_email
        await send_reset_password_email(user.email, reset_token)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send reset email. Please try again later.")
    return {"message": "If an account exists, a password reset link has been sent."}

@router.post("/reset-password")
async def reset_password(data: ResetPassword, db: AsyncSession = Depends(deps.get_db)) -> Any:
    try:
        payload = jwt.decode(data.token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = security.get_password_hash(data.new_password)
    await db.commit()
    return {"message": "Password updated successfully"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(deps.get_current_user)) -> Any:
    return current_user

# --- OAuth Routes ---

import httpx
from fastapi.responses import RedirectResponse

def _set_oauth_state_cookie(response: Response, state: str) -> None:
    response.set_cookie(key="oauth_state", value=state, httponly=True, max_age=600,
                        samesite="lax", secure=settings.COOKIE_SECURE)

def _validate_oauth_state(request: Request, state: str) -> None:
    expected_state = request.cookies.get("oauth_state")
    if not expected_state or not secrets.compare_digest(expected_state, state):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

@router.get("/github/login")
async def github_login():
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub Client ID not configured")
    state = secrets.token_urlsafe(32)
    params = urlencode({"client_id": settings.GITHUB_CLIENT_ID, "scope": "read:user user:email",
                        "prompt": "consent", "state": state})
    res = RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")
    _set_oauth_state_cookie(res, state)
    return res

@router.get("/github/callback")
async def github_callback(request: Request, code: str, state: str, response: Response,
                          db: AsyncSession = Depends(deps.get_db)):
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
    _validate_oauth_state(request, state)

    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://github.com/login/oauth/access_token",
                                      headers={"Accept": "application/json"},
                                      data={"client_id": settings.GITHUB_CLIENT_ID,
                                            "client_secret": settings.GITHUB_CLIENT_SECRET, "code": code})
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to get GitHub access token")
        user_res = await client.get("https://api.github.com/user",
                                    headers={"Authorization": f"Bearer {access_token}"})
        user_res.raise_for_status()
        user_data = user_res.json()
        emails_res = await client.get("https://api.github.com/user/emails",
                                      headers={"Authorization": f"Bearer {access_token}"})
        emails_res.raise_for_status()
        emails_data = emails_res.json()
        if not emails_data:
            raise HTTPException(status_code=400, detail="GitHub account has no accessible email")
        primary_email = next((e["email"] for e in emails_data if e.get("primary")), emails_data[0]["email"])

    github_id = str(user_data.get("id"))
    username = user_data.get("login")
    avatar = user_data.get("avatar_url")
    try:
        encrypted_github_token = security.encrypt_github_token(access_token)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="GitHub credential encryption is not configured") from exc

    result = await db.execute(select(User).where((User.email == primary_email) | (User.github_id == github_id)))
    user = result.scalars().first()

    if user:
        user.github_id = github_id
        user.github_username = username
        user.github_access_token = encrypted_github_token
        if not user.avatar:
            user.avatar = avatar
        if not user.auth_provider:
            user.auth_provider = "github"
        await db.commit()
    else:
        user = User(email=primary_email, username=f"gh_{username}", avatar=avatar,
                    github_id=github_id, github_username=username,
                    github_access_token=encrypted_github_token, auth_provider="github")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    jwt_refresh_token = security.create_refresh_token(subject=user.id)
    res = RedirectResponse(url=f"{settings.FRONTEND_URL}/oauth/callback")
    res.delete_cookie("oauth_state")
    res.set_cookie(key="refresh_token", value=jwt_refresh_token, httponly=True,
                   max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
                   samesite="lax", secure=settings.COOKIE_SECURE)
    return res

@router.get("/google/login")
async def google_login(request: Request):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google Client ID not configured")
    redirect_uri = f"{settings.FRONTEND_URL}/api/v1/auth/google/callback"
    state = secrets.token_urlsafe(32)
    params = urlencode({"client_id": settings.GOOGLE_CLIENT_ID, "response_type": "code",
                        "scope": "openid email profile", "redirect_uri": redirect_uri,
                        "prompt": "select_account", "state": state})
    res = RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")
    _set_oauth_state_cookie(res, state)
    return res

@router.get("/google/callback")
async def google_callback(request: Request, code: str, state: str, response: Response,
                          db: AsyncSession = Depends(deps.get_db)):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    _validate_oauth_state(request, state)
    redirect_uri = f"{settings.FRONTEND_URL}/api/v1/auth/google/callback"

    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://oauth2.googleapis.com/token",
                                      data={"client_id": settings.GOOGLE_CLIENT_ID,
                                            "client_secret": settings.GOOGLE_CLIENT_SECRET,
                                            "code": code, "grant_type": "authorization_code",
                                            "redirect_uri": redirect_uri})
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to get Google access token")
        user_res = await client.get("https://www.googleapis.com/oauth2/v2/userinfo",
                                    headers={"Authorization": f"Bearer {access_token}"})
        user_res.raise_for_status()
        user_data = user_res.json()

    google_id = str(user_data.get("id"))
    email = user_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account email unavailable")
    avatar = user_data.get("picture")
    raw_name = user_data.get("name") or email.split("@")[0]
    username_base = raw_name.lower().replace(" ", "")

    result = await db.execute(select(User).where((User.email == email) | (User.google_id == google_id)))
    user = result.scalars().first()

    if user:
        user.google_id = google_id
        if not user.avatar:
            user.avatar = avatar
        if not user.auth_provider:
            user.auth_provider = "google"
        await db.commit()
    else:
        user = User(email=email, username=f"go_{username_base}", avatar=avatar,
                    google_id=google_id, auth_provider="google")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    jwt_refresh_token = security.create_refresh_token(subject=user.id)
    res = RedirectResponse(url=f"{settings.FRONTEND_URL}/oauth/callback")
    res.delete_cookie("oauth_state")
    res.set_cookie(key="refresh_token", value=jwt_refresh_token, httponly=True,
                   max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
                   samesite="lax", secure=settings.COOKIE_SECURE)
    return res
