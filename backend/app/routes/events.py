from fastapi import APIRouter

router = APIRouter(
    prefix= "/api/events",
    tags=["Events"]
)

@router.get("/")
def get_events():
    return {
        "events": [],
        "total": 0
    }