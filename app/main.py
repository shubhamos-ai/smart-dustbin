from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from app.routes import waste, health, simulate
from app.firebase import initialize_firebase
import os

# Initialize FastAPI app
app = FastAPI(
    title="Smart Waste Management System",
    description="AI-powered waste segregation system using IoT and Firebase",
    version="2.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase on startup
@app.on_event("startup")
async def startup_event():
    initialize_firebase()

# Mount Static Files
base_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(base_dir, "static")
templates_dir = os.path.join(base_dir, "templates")

app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Setup Templates
templates = Jinja2Templates(directory=templates_dir)

# Include API Routers
app.include_router(waste.router, prefix="/api", tags=["Waste Detection"])
app.include_router(health.router, prefix="/api", tags=["System Health"])
app.include_router(simulate.router, prefix="/api", tags=["Simulation"])

# Frontend Routes
@app.get("/")
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
