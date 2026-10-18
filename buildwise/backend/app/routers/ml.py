from typing import Any
from fastapi import APIRouter

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])


@router.get("/status")
def get_ml_status() -> dict[str, Any]:
    return {
        "model_type": "formula_based",
        "artifact_loaded": False,
        "features": [
            "budget_fit_ratio",
            "vastu_shastra_quadrants",
            "cross_ventilation_openings",
            "carpet_space_efficiency",
            "aspect_ratio_proportions",
            "tncdbr_regulatory_margin",
            "plumbing_cluster_efficiency",
        ],
        "metrics": None,
        "status": "transparent_formula",
        "description": (
            "Transparent civil engineering plinth-area formula derived from Central Public Works Department (CPWD) "
            "and Tamil Nadu Public Works Department (TN PWD SOR 2025-2026). Floor plan scores represent a deterministic "
            "Fitness Score computed via Weighted Multi-Criteria Decision Analysis (TNCDBR-MCDA-v2.0) evaluating statutory "
            "compliance, Vastu alignment, cross-ventilation, and cost feasibility. No unverified black-box neural networks are used for scoring."
        ),
        "rates_as_of": "TN PWD SOR 2025–2026 (Active October 2026)",
        "methodology": "Weighted Multi-Criteria Decision Analysis (MCDA)",
        "ai_assistant_provider": "Google Gemini (Plan Advisor & Explanations Only)",
    }
