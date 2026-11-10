"""
Seed script: tạo tài khoản Admin trong database.
Chạy: cd backend && python seed_admin.py
"""

import sys
import os

# Thêm thư mục backend vào path để import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models import User
from app.core.security import hash_password


ADMIN_EMAIL = "admin@ticketrush.com"
ADMIN_PASSWORD = "admin@123"
ADMIN_FULL_NAME = "Admin"


def seed_admin():
    db = SessionLocal()
    try:
        # Kiểm tra admin đã tồn tại chưa
        existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if existing:
            print(f"⚠️  Admin account already exists: {ADMIN_EMAIL} (role={existing.role})")
            if existing.role != "ADMIN":
                existing.role = "ADMIN"
                db.commit()
                print(f"✅ Updated role to ADMIN for {ADMIN_EMAIL}")
            return

        # Tạo admin user
        admin_user = User(
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            full_name=ADMIN_FULL_NAME,
            role="ADMIN",
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print(f"✅ Admin account created successfully!")
        print(f"   Email:     {ADMIN_EMAIL}")
        print(f"   Full Name: {ADMIN_FULL_NAME}")
        print(f"   Role:      ADMIN")
        print(f"   ID:        {admin_user.id}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error creating admin account: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
