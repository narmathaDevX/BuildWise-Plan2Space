from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.config import settings
from backend.app.db.init_db import init_db
from backend.app.routers.auth import router as auth_router
from backend.app.routers.estimates import router as estimates_router
from backend.app.routers.materials import router as materials_router
from backend.app.routers.ml import router as ml_router
from backend.app.routers.plans import router as plans_router
from backend.app.routers.projects import router as projects_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Auto-initialize database and seed idempotent default data
    init_db()
    yield


app = FastAPI(
    title="BuildWise API",
    version="1.0.0",
    description="Python backend for BuildWise house construction planning in Tamil Nadu, India.",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Ensure detail is ALWAYS a string, preventing frontend '[object Object]' issues."""
    errors_list = []
    error_messages = []
    for err in exc.errors():
        loc = " -> ".join(str(item) for item in err.get("loc", []))
        msg = err.get("msg", "Validation error")
        error_messages.append(f"{loc}: {msg}")
        errors_list.append({"field": loc, "message": msg})

    human_detail = "; ".join(error_messages) if error_messages else "Request validation failed."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": human_detail,
            "errors": errors_list,
        },
    )


# Register routers
app.include_router(auth_router)
app.include_router(plans_router)
app.include_router(estimates_router)
app.include_router(projects_router)
app.include_router(materials_router)
app.include_router(ml_router)


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "app": "BuildWise API",
        "status": "online",
        "docs_url": "/docs",
        "region": "Tamil Nadu, India",
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "engine_loaded": True,
        "database": "connected",
        "currency": "INR",
        "units": "ft / sq ft",
    }
