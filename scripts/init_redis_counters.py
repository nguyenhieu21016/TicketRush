"""
Script to initialize Redis seat counters from MySQL database.
Run this after deploying ElastiCache Redis to sync initial state.

Usage:
    python init_redis_counters.py
"""

import os
import sys
from dotenv import load_dotenv
import redis
from sqlalchemy import create_engine, text

load_dotenv()

# Database connection
DATABASE_URL = (
    f"mysql+pymysql://{os.getenv('DB_USER')}:"
    f"{os.getenv('DB_PASSWORD')}@"
    f"{os.getenv('DB_HOST')}:"
    f"{os.getenv('DB_PORT')}/"
    f"{os.getenv('DB_NAME')}"
)

# Redis connection
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    db=int(os.getenv('REDIS_DB', 0)),
    password=os.getenv('REDIS_PASSWORD'),
    ssl=(os.getenv('REDIS_SSL', 'false').lower() == 'true'),
    decode_responses=True
)


def init_redis_from_db():
    """Initialize Redis seat counters from current MySQL state."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        result = conn.execute(text(
            """
            SELECT id, standard_available, vip_available, vvip_available
            FROM events
            WHERE status = 'ACTIVE'
            """
        ))

        events = result.fetchall()

        if not events:
            print("No active events found in database")
            return

        print(f"Found {len(events)} active events, initializing Redis counters...")

        for event in events:
            event_id, standard, vip, vvip = event

            redis_client.set(f"event:{event_id}:tier:STANDARD:available", standard)
            redis_client.set(f"event:{event_id}:tier:VIP:available", vip)
            redis_client.set(f"event:{event_id}:tier:VVIP:available", vvip)

            print(f"Event {event_id}: STANDARD={standard}, VIP={vip}, VVIP={vvip}")

        print(f"\n✓ Successfully initialized Redis counters for {len(events)} events")


def verify_redis_counters():
    """Verify Redis counters match database."""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        result = conn.execute(text(
            """
            SELECT id, standard_available, vip_available, vvip_available
            FROM events
            WHERE status = 'ACTIVE'
            """
        ))

        events = result.fetchall()
        mismatches = []

        for event in events:
            event_id, db_standard, db_vip, db_vvip = event

            redis_standard = int(redis_client.get(f"event:{event_id}:tier:STANDARD:available") or 0)
            redis_vip = int(redis_client.get(f"event:{event_id}:tier:VIP:available") or 0)
            redis_vvip = int(redis_client.get(f"event:{event_id}:tier:VVIP:available") or 0)

            if (redis_standard != db_standard or
                redis_vip != db_vip or
                redis_vvip != db_vvip):
                mismatches.append({
                    'event_id': event_id,
                    'db': (db_standard, db_vip, db_vvip),
                    'redis': (redis_standard, redis_vip, redis_vvip)
                })

        if mismatches:
            print(f"\n⚠ Found {len(mismatches)} mismatches:")
            for m in mismatches:
                print(f"Event {m['event_id']}: DB={m['db']}, Redis={m['redis']}")
        else:
            print("\n✓ All Redis counters match database")


if __name__ == "__main__":
    try:
        print("Testing Redis connection...")
        redis_client.ping()
        print("✓ Redis connection successful\n")

        if len(sys.argv) > 1 and sys.argv[1] == "verify":
            verify_redis_counters()
        else:
            init_redis_from_db()
            print("\nRun with 'verify' argument to check sync:")
            print("  python init_redis_counters.py verify")

    except redis.RedisError as e:
        print(f"✗ Redis connection failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error: {e}")
        sys.exit(1)
