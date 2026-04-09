from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, verify_auth0_token
from app.database import get_db
from app.models import User
from app.schemas import UserRead, UserSyncPayload

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/sync", response_model=UserRead, status_code=status.HTTP_200_OK)
def sync_user(payload: UserSyncPayload, db: Session = Depends(get_db)):
    """
    Called by the frontend immediately after a successful Auth0 social login.
    Creates the user on first sign-in; updates name/avatar on subsequent calls.
    """
    token_data = verify_auth0_token(payload.access_token)
    auth0_id: str = token_data["sub"]
    email: str = token_data.get("email", "")
    name: str = token_data.get("name", "")
    picture: str = token_data.get("picture", "")

    user = db.query(User).filter(User.auth0_id == auth0_id).first()
    if user:
        user.email = email or user.email
        user.display_name = name or user.display_name
        user.avatar_url = picture or user.avatar_url
    else:
        # Derive a unique username from email local-part or Auth0 sub
        base = (email.split("@")[0] if email else auth0_id.replace("|", "_"))[:30]
        username, suffix = base, 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base}{suffix}"
            suffix += 1

        user = User(
            auth0_id=auth0_id,
            email=email,
            username=username,
            display_name=name or None,
            avatar_url=picture or None,
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
