from fastapi import APIRouter
from app.firebase import get_connection_status

router = APIRouter()

@router.get("/health")
async def health_check():
    """System health check endpoint"""
    conn_status = get_connection_status()
    return {
        "status": "healthy",
        "firebase": conn_status
    }
