"""Contractor milestone payment protection schedule service.

Implements the standard Tamil Nadu 8-stage civil payment milestone gate with 5% handover retention,
protecting homeowners from contractor abandonment and premature cash drawdowns.
"""

from typing import Any

CONTRACTOR_MILESTONE_TEMPLATE = [
    {
        "milestone_number": 1,
        "stage_name": "Mobilization & Site Demarcation",
        "pct_share": 5.0,
        "description": "Initial contractor advance after water, electricity, temporary shed, and column marking layout approval.",
        "inspection_gate": "Verify centerline boundary markers with DTCP approved plan; ensure TNEB meter and borewell yield are functional.",
        "risk_rating": "Low",
    },
    {
        "milestone_number": 2,
        "stage_name": "Footings & Plinth Beam Casting",
        "pct_share": 15.0,
        "description": "Completion of RCC footings, stub columns, anti-termite soil treatment, gravel backfilling, and plinth beam concreting.",
        "inspection_gate": "Verify 50mm concrete cover blocks on plinth rebar, minimum 14 days curing completed, and anti-termite chemical certification.",
        "risk_rating": "High",
    },
    {
        "milestone_number": 3,
        "stage_name": "RCC Columns & Roof Slab Casting",
        "pct_share": 20.0,
        "description": "Casting of all G.F. RCC columns, beam formwork, reinforcement rebar tied with steel binding wire, and roof slab concrete pouring.",
        "inspection_gate": "Pre-pour rebar inspection: bar spacing (Fe550D TMT), electrical fan hook conduit pipes embedded, cover blocks placed, and 21-day slab propping agreement.",
        "risk_rating": "Critical",
    },
    {
        "milestone_number": 4,
        "stage_name": "Brick Masonry & Lintel Bands",
        "pct_share": 15.0,
        "description": "Erection of 9-inch exterior perimeter brick walls and 4.5-inch interior partition walls with cast RCC lintels and sunshades.",
        "inspection_gate": "Check plumb-bob vertical alignment, 1:6 cement-sand mortar ratio, raked joints for plaster grip, and minimum 7-day ponding/spraying water curing.",
        "risk_rating": "Medium",
    },
    {
        "milestone_number": 5,
        "stage_name": "Concealed Plumbing & Electrical Rough-in",
        "pct_share": 15.0,
        "description": "Wall chasing, PVC electrical conduit runs, distribution board boxes, CPVC water supply lines, and PVC drainage pipe work.",
        "inspection_gate": "Hydraulic pressure testing of CPVC water lines at 10 kg/cm² for 24 hours (zero leak drop) before concealing with cement mortar.",
        "risk_rating": "High",
    },
    {
        "milestone_number": 6,
        "stage_name": "Internal Plastering & Floor Tiles",
        "pct_share": 15.0,
        "description": "1:4 smooth sponge internal plastering with GI chicken wire mesh at beam-column joints, followed by floor vitrified tile laying.",
        "inspection_gate": "Tap tiles with wooden mallet to confirm zero hollow drummy sounds beneath tiles; verify 2mm uniform grout lines and slope towards floor drains.",
        "risk_rating": "Medium",
    },
    {
        "milestone_number": 7,
        "stage_name": "Painting, Sanitary Fittings & Joinery",
        "pct_share": 10.0,
        "description": "Two coats Birla wall putty, primer, Asian Paints Royale finish coats, teakwood main door varnishing, and CP tap/commode fittings.",
        "inspection_gate": "Test all electrical circuit breakers (MCBs/ELCB), inspect water flow in all flush tanks and diverters, check window slide smooth operation.",
        "risk_rating": "Medium",
    },
    {
        "milestone_number": 8,
        "stage_name": "Handover & Defect Liability Retention (90 Days)",
        "pct_share": 5.0,
        "description": "Mandatory retention fund withheld by the owner for 90 days after housewarming / occupancy to rectify latent defects or seepage.",
        "inspection_gate": "Check entire terrace for rainwater accumulation during monsoons, verify zero hairline wall shrinkage cracks, inspect all plumbing joints.",
        "risk_rating": "Owner Protection Fund",
    },
]


def generate_milestone_schedule(
    civil_cost: float = 3250000.0,
    current_completed_stages: int = 1,
) -> dict[str, Any]:
    """Generates the itemized 8-stage contractor payment escrow breakdown."""
    total_cost = max(500000.0, float(civil_cost))

    milestones = []
    paid_so_far = 0
    pending_amount = 0

    for item in CONTRACTOR_MILESTONE_TEMPLATE:
        num = item["milestone_number"]
        pct = item["pct_share"]
        amt = int(round((total_cost * pct) / 100.0))

        if num <= current_completed_stages:
            status = "released"
            paid_so_far += amt
        elif num == current_completed_stages + 1:
            status = "pending_inspection"
            pending_amount += amt
        else:
            status = "upcoming"
            pending_amount += amt

        milestones.append(
            {
                "milestone_number": num,
                "stage_name": item["stage_name"],
                "pct_share": pct,
                "amount": amt,
                "description": item["description"],
                "inspection_gate": item["inspection_gate"],
                "risk_rating": item["risk_rating"],
                "status": status,
                "is_retention": (num == 8),
            }
        )

    return {
        "total_civil_contract": total_cost,
        "currency": "INR",
        "milestones_count": len(milestones),
        "paid_so_far": paid_so_far,
        "pending_amount": pending_amount,
        "retention_reserve_amount": int(round(total_cost * 0.05)),
        "retention_period_days": 90,
        "milestones": milestones,
        "contractor_protection_clause": (
            "Payment release is strictly contingent upon passing the written physical inspection gate. "
            "Never release Stage 8 retention until 90 days post-occupancy has elapsed with zero roof seepage."
        ),
    }
