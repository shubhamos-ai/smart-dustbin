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
        payload_bin = {"lastWaste": "NONE"}
        payload_system = {"state": "IDLE"}
    else:
        payload_bin = {"lastWaste": req.action}  # WET or DRY
        payload_system = {"state": "SORTING"} # Trigger sorting animation
        
    try:
        if db_ref:
            db_ref.child("bin").update(payload_bin)
            db_ref.child("system").update(payload_system)
        elif USE_REST_API:
            requests.patch(f"{settings.FIREBASE_DB_URL}/bin.json", json=payload_bin)
            requests.patch(f"{settings.FIREBASE_DB_URL}/system.json", json=payload_system)
            
        return {"status": "success", "action": req.action, "state": payload_system["state"]}
    except Exception as e:
        return {"status": "error", "message": str(e)}
