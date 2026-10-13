from typing import Any
from fastapi import APIRouter

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])


@router.get("/status")
def get_ml_status() -> dict[str, Any]:
    return {
        "model_type": "formula_based",
        "artifact_loaded": False,
        "features": [],
        "metrics": None,
        "status": "transparent_formula",
        "description": (
            "Audited civil engineering plinth-area formula derived from Central Public Works Department (CPWD) "
            "and Tamil Nadu Public Works Department (TN PWD) Schedule of Rates. No unverified or synthetic ML models are loaded."
        ),
        "rates_as_of": "October 2026",
    }
