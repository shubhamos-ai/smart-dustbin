# 🔥 Firebase Data Schema & System States

## Complete Firebase Structure

Your ESP32 syncs the following data to Firebase Realtime Database:

```json
{
  "system": {
    "state": "IDLE",           // Current system state
    "wifi": "Connected",        // Wi-Fi status
    "ssid": "YourNetwork"       // Optional: Network name
  },
  "bin": {
    "lastWaste": "NONE",        // Last detected waste type
    "wetFull": false,           // Wet bin full status
    "dryFull": false,           // Dry bin full status
    "wetCount": 0,              // Total wet waste items (optional)
    "dryCount": 0,              // Total dry waste items (optional)
    "lastUpdated": "timestamp"  // Last update time (optional)
  }
}
```

---

## 📍 System States

### State Flow Diagram

```
BOOTED → IDLE → OBJECT_DETECTED → ANALYZING → SORTING → CHECKING_BINS → COOLDOWN → IDLE
```

### State Descriptions

| State | Description | Firebase Updates | Duration | UI Animation |
|-------|-------------|------------------|----------|--------------|
| **BOOTED** | System startup | `/system/state = "BOOTED"` | ~2s | Boot animation |
| **IDLE** | Waiting for waste | `/system/state = "IDLE"` | ∞ | Idle breathing |
| **OBJECT_DETECTED** | Ultrasonic detected object | `/system/state = "OBJECT_DETECTED"` | ~500ms | Detection pulse |
| **ANALYZING** | Reading moisture sensors | `/system/state = "ANALYZING"`<br>`/bin/lastWaste = "WET"/"DRY"` | ~300ms | Scanning effect |
| **SORTING** | Servo rotating to bin | `/system/state = "SORTING"` | ~1500ms | Particle animation |
| **CHECKING_BINS** | Checking bin fullness | `/system/state = "CHECKING_BINS"`<br>`/bin/wetFull`<br>`/bin/dryFull` | ~500ms | Bin check glow |
| **COOLDOWN** | Preventing double detection | `/system/state = "COOLDOWN"` | ~800ms | Fade out |

---

## 🎬 Complete Waste Detection Cycle

### Timeline (Total: ~3.6 seconds)

```
0ms     │ IDLE
        │ ↓ (Object detected by ultrasonic)
        │
500ms   │ OBJECT_DETECTED
        │ Firebase: /system/state = "OBJECT_DETECTED"
        │ UI: Detection pulse animation
        │ ↓
        │
800ms   │ ANALYZING
        │ Firebase: /system/state = "ANALYZING"
        │          /bin/lastWaste = "WET" or "DRY"
        │ UI: Scanning effect, faster ring rotation
        │ ↓
        │
1100ms  │ SORTING
        │ Firebase: /system/state = "SORTING"
        │ UI: Particle flies to correct bin
        │     Bin card highlights
        │ ↓
        │
2600ms  │ CHECKING_BINS
        │ Firebase: /system/state = "CHECKING_BINS"
        │          /bin/wetFull = true/false
        │          /bin/dryFull = true/false
        │ UI: Both bins briefly glow
        │ ↓
        │
3100ms  │ COOLDOWN
        │ Firebase: /system/state = "COOLDOWN"
        │ UI: Fade out effects
        │ ↓
        │
3900ms  │ IDLE
        │ Firebase: /system/state = "IDLE"
        │          /bin/lastWaste = "NONE" (reset by website)
        │ UI: Return to ready state
```

---

## 🌐 Website Integration

### API Endpoints

#### `GET /api/status`
Returns complete system state:
```json
{
  "systemState": "SORTING",
  "lastWaste": "WET",
  "wetFull": false,
  "dryFull": false,
  "wetCount": 5,
  "dryCount": 3,
  "connection_status": "Online",
  "wifi_status": "Connected"
}
```

#### `POST /api/reset_detection`
Resets system to IDLE:
```json
{
  "success": true,
  "message": "System reset to IDLE"
}
```

#### `GET /api/statistics`
Returns waste sorting statistics:
```json
{
  "wetCount": 5,
  "dryCount": 3,
  "totalCount": 8,
  "wetPercentage": 62.5,
  "dryPercentage": 37.5
}
```

---

## 🎨 UI State Animations

### State → Animation Mapping

| ESP32 State | Website Animation | Visual Effect |
|-------------|-------------------|---------------|
| IDLE | Breathing glow | Slow orbital ring rotation |
| OBJECT_DETECTED | Detection pulse | Hub pulses once |
| ANALYZING | Scanning effect | Fast ring rotation, hub glows |
| SORTING (WET) | Particle to left | Green particle flies to wet bin |
| SORTING (DRY) | Particle to right | Blue particle flies to dry bin |
| CHECKING_BINS | Bin check | Both bins glow briefly |
| COOLDOWN | Fade out | Smooth transition to idle |
| OFFLINE | Desaturated | Grayscale filter |

---

## 🔄 Polling Strategy

### Frontend Polling (200ms interval)

```javascript
// Every 200ms, the website:
1. Fetches /api/status
2. Checks if systemState changed
3. Triggers appropriate animation
4. Updates UI text and colors
5. Logs state transitions
```

### Why 200ms?
- **Fast enough**: Feels instant to users
- **Not too fast**: Doesn't overwhelm Firebase
- **Balanced**: ~5 requests/second is sustainable

---

## 📊 Data Flow

```
ESP32 Sensors
    ↓
ESP32 Logic (C++)
    ↓
Firebase Realtime Database
    ↓
FastAPI Backend (Python)
    ↓
REST API (/api/status)
    ↓
Website Frontend (JavaScript)
    ↓
User sees animation
```

---

## 🚀 Optional Enhancements

### Add Counters to ESP32

```cpp
// In your ESP32 code, after sorting:
if (wasteType == "WET") {
  wetCount++;
  Firebase.setInt(fbdo, "/bin/wetCount", wetCount);
} else {
  dryCount++;
  Firebase.setInt(fbdo, "/bin/dryCount", dryCount);
}
```

### Add Timestamps

```cpp
// Add timestamp when waste is detected
String timestamp = String(millis());
Firebase.setString(fbdo, "/bin/lastUpdated", timestamp);
```

### Add Wi-Fi Info

```cpp
// During setup or periodically
Firebase.setString(fbdo, "/system/wifi", "Connected");
Firebase.setString(fbdo, "/system/ssid", WiFi.SSID());
```

---

## 🎯 Key Design Principles

### ✅ What Makes This Stable

1. **State-based updates**: Only write to Firebase on state changes
2. **No blocking delays**: Uses `millis()` timers
3. **Auto-reconnect**: Wi-Fi and Firebase reconnect automatically
4. **Minimal writes**: ~6 Firebase writes per waste item
5. **Fast polling**: Website polls frequently but Firebase writes are rare

### ❌ What to Avoid

1. **Don't** write to Firebase in `loop()` without conditions
2. **Don't** use `delay()` for long periods
3. **Don't** spam Firebase with identical data
4. **Don't** forget to reset `lastWaste` after processing

---

## 🧪 Testing Commands

### Simulate States Manually

```bash
# Simulate WET waste detection
curl -X POST http://localhost:8000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"action":"WET"}'

# Simulate DRY waste detection
curl -X POST http://localhost:8000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"action":"DRY"}'

# Reset system
curl -X POST http://localhost:8000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"action":"RESET"}'

# Check current status
curl http://localhost:8000/api/status | python3 -m json.tool

# Get statistics
curl http://localhost:8000/api/statistics | python3 -m json.tool
```

---

## 📱 Mobile Access

Your system is accessible from any device on the same network:

1. Find your computer's IP address:
   ```bash
   hostname -I
   ```

2. Access from phone/tablet:
   ```
   http://YOUR_IP:8000
   ```

Example: `http://192.168.1.100:8000`

---

## 🎓 Summary

Your Smart Waste Management System now:

✅ Tracks **7 different system states**
✅ Syncs **5 core data points** to Firebase
✅ Provides **3 API endpoints** for data access
✅ Features **8 unique animations** for each state
✅ Polls Firebase **5 times per second** for instant response
✅ Supports **optional counters and timestamps**
✅ Works on **any device** (desktop, mobile, tablet)
✅ Designed for **24/7 operation** with auto-reconnect

**The system is production-ready!** 🎉
