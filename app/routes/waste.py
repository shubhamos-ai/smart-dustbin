from fastapi import APIRouter
from app.firebase import get_live_data, reset_waste_status, get_statistics

router = APIRouter()

@router.get("/status")
def get_status():
    """
    Get current waste detection status from Firebase
    Returns complete system state including:
    - systemState: Current ESP32 state (IDLE, ANALYZING, SORTING, etc.)
    - lastWaste: Last detected waste type (WET/DRY/NONE)
    - bin status: wetFull, dryFull
    - counters: wetCount, dryCount
    - connection info
    """
    data = get_live_data()
    return data

@router.post("/reset_detection")
async def reset_detection():
    """
    Reset the waste detection status to NONE and system state to IDLE
    This should be called after the frontend animation completes
    """
    success = reset_waste_status()
    return {
        "success": success, 
        "message": "System reset to IDLE" if success else "Reset failed"
    }

@router.get("/statistics")
async def get_waste_statistics():
    """
    Get waste sorting statistics
    Returns counts and percentages for wet/dry waste
    """
    stats = get_statistics()
    return stats
