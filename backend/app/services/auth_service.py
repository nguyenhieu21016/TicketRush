from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.models import User
from app.schemas import UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse


def register_user(db: Session, request: UserRegisterRequest) -> User:
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please log in or use another email."
        )

    hashed_pwd = hash_password(request.password)

    new_user = User(
        email=request.email,
        password_hash=hashed_pwd,
        full_name=request.full_name,
        role="USER"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def authenticate_user(db: Session, request: UserLoginRequest) -> TokenResponse:
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )