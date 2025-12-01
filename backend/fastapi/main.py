from fastapi import FastAPI, HTTPException, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import os
import json
import csv
import io
from pathlib import Path

# Import routers
from routers import search, export, audit

app = FastAPI(
    title="eDiscovery FastAPI Service",
    description="Advanced search, export, and audit endpoints for eDiscovery system",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://localhost:3000",
        "https://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])

@app.get("/")
async def root():
    """Root endpoint - API information"""
    return {
        "service": "eDiscovery FastAPI Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "search": "/api/search",
            "export": "/api/export",
            "audit": "/api/audit",
            "docs": "/docs",
            "redoc": "/redoc"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
