from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
import models  # noqa: registers all models with Base
from auth.router import router as auth_router
from devices.router import router as devices_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DevSense API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(devices_router)
