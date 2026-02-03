from fastapi import APIRouter
from pydantic import BaseModel
from app.firebase import db_ref, USE_REST_API, settings
import requests

router = APIRouter()

class SimulationRequest(BaseModel):
    action: str  # WET, DRY, or RESET

@router.post("/simulate")
async def trigger_simulation(req: SimulationRequest):
    """Simulate waste detection for testing purposes"""
    
    if req.action == "RESET":
        payload = {"lastWaste": "NONE"}
    else:
        payload = {"lastWaste": req.action}  # WET or DRY
        
    try:
        if db_ref:
            db_ref.child("bin").update(payload)
        elif USE_REST_API:
            requests.patch(f"{settings.FIREBASE_DB_URL}/bin.json", json=payload)
            
        return {"status": "success", "action": req.action}
    except Exception as e:
        return {"status": "error", "message": str(e)}
