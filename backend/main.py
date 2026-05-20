from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
import models
from auth.router import router as auth_router
from devices.router import router as devices_router
from worker.router import router as worker_router
from crawl.router import router as crawl_router
from favorites.router import router as favorites_router
from history.router import router as history_router

Base.metadata.create_all(bind=engine)
app = FastAPI(title="DevSense API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for r in [auth_router, devices_router, worker_router, crawl_router, favorites_router, history_router]:
    app.include_router(r)
