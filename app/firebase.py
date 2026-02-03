import firebase_admin
from firebase_admin import credentials, db
from app.config import settings
import logging
import os
import requests
from datetime import datetime

# Setup Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SmartWasteFirebase")

# Global variables
firebase_app = None
db_ref = None
USE_REST_API = False

def initialize_firebase():
    """Initialize Firebase connection (Admin SDK or REST API)"""
    global firebase_app, db_ref, USE_REST_API
    
    db_url = settings.FIREBASE_DB_URL
    cred_path = settings.FIREBASE_CREDENTIALS_PATH

    if not db_url:
        logger.warning("FIREBASE_DB_URL not set. Running in offline mode.")
        return

    try:
        # Try Admin SDK first (if credentials file exists)
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_app = firebase_admin.initialize_app(cred, {'databaseURL': db_url})
            db_ref = db.reference('/')
            logger.info("✅ Firebase connected (Admin SDK - Secure)")
        else:
            # Fallback to REST API
            response = requests.get(f"{db_url}/.json", timeout=5)
            if response.status_code == 200:
                USE_REST_API = True
                logger.info("✅ Firebase connected (REST API - Public)")
            else:
                logger.error(f"Firebase REST API returned status {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Firebase initialization error: {e}")

def get_live_data():
    """
    Reads complete system data from Firebase
    Returns: dict with system state, bin status, waste classification, and connection info
    """
    global db_ref, USE_REST_API
    
    # Default state
    state = {
        # System state
        "systemState": "OFFLINE",
        "lastWaste": "NONE",
        
        # Bin status
        "wetFull": False,
        "dryFull": False,
        
        # Counters (if available)
        "wetCount": 0,
        "dryCount": 0,
        
        # Timestamps
        "lastUpdated": None,
        
        # Connection
        "connection_status": "Offline",
        "wifi_status": "Unknown"
    }
    
    try:
        data = None
        
        if db_ref:
            # Admin SDK method - get entire database
            data = db_ref.get()
        elif USE_REST_API:
            # REST API method - Fast fail for live data
            # No retries for live polling to prevent UI freezing
            try:
                response = requests.get(f"{settings.FIREBASE_DB_URL}/.json", timeout=2)
                if response.status_code == 200:
                    data = response.json()
            except requests.exceptions.RequestException:
                # Just fail silently for this poll, next one will try again
                pass
        
        if data:
            state["connection_status"] = "Online"
            
            # Parse system state
            if "system" in data:
                system_data = data["system"]
                state["systemState"] = system_data.get("state", "IDLE")
                state["wifi_status"] = system_data.get("wifi", "Connected")
                
                # Optional: SSID if available
                if "ssid" in system_data:
                    state["ssid"] = system_data["ssid"]
            
            # Parse bin data
            if "bin" in data:
                bin_data = data["bin"]
                state["lastWaste"] = bin_data.get("lastWaste", "NONE")
                state["wetFull"] = bin_data.get("wetFull", False)
                state["dryFull"] = bin_data.get("dryFull", False)
                
                # Counters (if available)
                state["wetCount"] = bin_data.get("wetCount", 0)
                state["dryCount"] = bin_data.get("dryCount", 0)
                
                # Timestamp
                state["lastUpdated"] = bin_data.get("lastUpdated", None)
            

            
            # DEBUG LOGGING
            print(f"🔥 FIREBASE RAW DATA: {data}")
            print(f"🔄 PARSED STATE: {state['systemState']} | Waste: {state['lastWaste']}")
            
            logger.debug(f"Firebase data: {state}")
            
    except Exception as e:
        logger.error(f"Error reading Firebase data: {e}") 
        state["connection_status"] = "Error"
    
    return state

def reset_waste_status():
    """
    Resets lastWaste to 'NONE' and system state to 'IDLE'
    Returns: bool indicating success
    """
    global db_ref, USE_REST_API
    
    try:
        payload = {
            "bin": {
                "lastWaste": "NONE"
            },
            "system": {
                "state": "IDLE"
            }
        }
        
        if db_ref:
            db_ref.update(payload)
            logger.info("✅ Reset system to IDLE state (Admin SDK)")
            return True
        elif USE_REST_API:
            # Update bin
            bin_url = f"{settings.FIREBASE_DB_URL}/bin.json"
            requests.patch(bin_url, json={"lastWaste": "NONE"}, timeout=3)
            
            # Update system
            system_url = f"{settings.FIREBASE_DB_URL}/system.json"
            requests.patch(system_url, json={"state": "IDLE"}, timeout=3)
            
            logger.info("✅ Reset system to IDLE state (REST API)")
            return True
    except Exception as e:
        logger.error(f"Error resetting waste status: {e}")
    
    return False

def update_system_state(new_state: str):
    """
    Update the system state in Firebase
    States: BOOTED, IDLE, OBJECT_DETECTED, ANALYZING, SORTING, CHECKING_BINS, COOLDOWN
    """
    global db_ref, USE_REST_API
    
    try:
        if db_ref:
            db_ref.child("system").update({"state": new_state})
            return True
        elif USE_REST_API:
            url = f"{settings.FIREBASE_DB_URL}/system.json"
            response = requests.patch(url, json={"state": new_state}, timeout=3)
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Error updating system state: {e}")
    
    return False

def get_connection_status():
    """Returns current Firebase connection status with details"""
    status = {
        "status": "Disconnected",
        "method": "None",
        "database_url": settings.FIREBASE_DB_URL or "Not configured"
    }
    
    if db_ref:
        status["status"] = "Connected"
        status["method"] = "Admin SDK (Secure)"
    elif USE_REST_API:
        status["status"] = "Connected"
        status["method"] = "REST API (Public)"
    
    return status

def get_statistics():
    """Get waste sorting statistics"""
    global db_ref, USE_REST_API
    
    stats = {
        "wetCount": 0,
        "dryCount": 0,
        "totalCount": 0,
        "wetPercentage": 0,
        "dryPercentage": 0
    }
    
    try:
        data = None
        
        if db_ref:
            data = db_ref.child("bin").get()
        elif USE_REST_API:
            response = requests.get(f"{settings.FIREBASE_DB_URL}/bin.json", timeout=3)
            if response.status_code == 200:
                data = response.json()
        
        if data:
            wet = data.get("wetCount", 0)
            dry = data.get("dryCount", 0)
            total = wet + dry
            
            stats["wetCount"] = wet
            stats["dryCount"] = dry
            stats["totalCount"] = total
            
            if total > 0:
                stats["wetPercentage"] = round((wet / total) * 100, 1)
                stats["dryPercentage"] = round((dry / total) * 100, 1)
    
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
    
    return stats
