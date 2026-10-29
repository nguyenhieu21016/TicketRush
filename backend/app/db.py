from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

if str(settings.db_url).startswith("sqlite"):
    engine = create_engine(settings.db_url, connect_args={"check_same_thread": False})
else:
    # Pool nhỏ vì RDS db.t3.micro chịu ít kết nối: tối đa = số instance x số worker x (pool + overflow)
    engine = create_engine(settings.db_url, pool_size=settings.pool_size, max_overflow=settings.pool_overflow,
                           pool_pre_ping=True, pool_recycle=1800)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
