from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.schemas import RegisterRequest, RegisterResponse, StatusResponse
from app.services import ticket_service

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.get("/status", response_model=StatusResponse)
def status(db: Session = Depends(get_db)):
    return ticket_service.get_status(db)


@router.post("/register", response_model=RegisterResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    ticket_id = ticket_service.register(db, body.full_name, body.email, body.phone)
    return RegisterResponse(ticket_id=ticket_id)
