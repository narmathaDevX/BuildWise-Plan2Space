"""API v1 package."""

from fastapi import APIRouter
from app.api.v1.capabilities import router as capabilities_router
from app.api.v1.floor_plans import router as floor_plans_router
from app.api.v1.conversions import router as conversions_router
from app.api.v1.design import router as design_router
from app.api.v1.saved_plans import router as saved_plans_router

api_router = APIRouter()
api_router.include_router(capabilities_router)
api_router.include_router(floor_plans_router)
api_router.include_router(conversions_router)
api_router.include_router(design_router)
api_router.include_router(saved_plans_router)

__all__ = ["api_router"]
