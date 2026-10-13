import json
from pathlib import Path
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.db.models import Material, Project, User
from backend.app.db.session import get_db
from backend.app.routers.auth import get_current_user
from backend.app.routers.projects import get_current_project
from backend.app.services.materials import summarize_materials

router = APIRouter(prefix="/api/projects/current/materials", tags=["Materials"])


class PatchMaterialPayload(BaseModel):
    purchased: bool | None = None
    quantity: float | None = None
    rate: float | None = None


class AddMaterialPayload(BaseModel):
    name: str
    category: str = "Finishing"
    quantity: float = 1.0
    unit: str = "nos"
    rate: float = 0.0
    purchased: bool = False


@router.get("")
def list_materials(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        return {
            "rates_as_of": "October 2026",
            "total_cost": 0,
            "purchased_cost": 0,
            "purchased_count": 0,
            "total_count": 0,
            "purchase_progress": 0,
            "categories": [],
            "materials": [],
        }

    mats = db.query(Material).filter(Material.project_id == project.id).all()
    mats_data = [
        {
            "id": m.id,
            "key": m.key,
            "name": m.name,
            "category": m.category,
            "quantity": m.quantity,
            "unit": m.unit,
            "rate": m.rate,
            "purchased": m.purchased,
            "is_custom": m.is_custom,
        }
        for m in mats
    ]

    return summarize_materials(mats_data)


@router.patch("/{material_id}")
def update_material(
    material_id: str,
    payload: PatchMaterialPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="No active project found.")

    mat = (
        db.query(Material)
        .filter(Material.project_id == project.id, Material.id == material_id)
        .first()
    )
    if not mat:
        raise HTTPException(status_code=404, detail=f"Material '{material_id}' not found.")

    if payload.purchased is not None:
        mat.purchased = payload.purchased
    if payload.quantity is not None:
        mat.quantity = max(0.0, float(payload.quantity))
    if payload.rate is not None:
        mat.rate = max(0.0, float(payload.rate))

    db.commit()
    db.refresh(mat)

    return {
        "id": mat.id,
        "key": mat.key,
        "name": mat.name,
        "category": mat.category,
        "quantity": mat.quantity,
        "unit": mat.unit,
        "rate": mat.rate,
        "estimated_cost": int(round(mat.quantity * mat.rate)),
        "purchased": mat.purchased,
        "is_custom": mat.is_custom,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def add_custom_material(
    payload: AddMaterialPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="No active project found.")

    mat = Material(
        project_id=project.id,
        key=payload.name.lower().replace(" ", "_"),
        name=payload.name,
        category=payload.category,
        quantity=max(0.0, float(payload.quantity)),
        unit=payload.unit,
        rate=max(0.0, float(payload.rate)),
        purchased=payload.purchased,
        is_custom=True,
    )
    db.add(mat)
    db.commit()
    db.refresh(mat)

    return {
        "id": mat.id,
        "key": mat.key,
        "name": mat.name,
        "category": mat.category,
        "quantity": mat.quantity,
        "unit": mat.unit,
        "rate": mat.rate,
        "estimated_cost": int(round(mat.quantity * mat.rate)),
        "purchased": mat.purchased,
        "is_custom": mat.is_custom,
    }


@router.delete("/{material_id}")
def delete_custom_material(
    material_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = get_current_project(current_user, db)
    if not project:
        raise HTTPException(status_code=404, detail="No active project found.")

    mat = (
        db.query(Material)
        .filter(Material.project_id == project.id, Material.id == material_id)
        .first()
    )
    if not mat:
        raise HTTPException(status_code=404, detail=f"Material '{material_id}' not found.")

    if not mat.is_custom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Standard project materials cannot be deleted. You can mark them unpurchased or modify quantity.",
        )

    db.delete(mat)
    db.commit()
    return {"status": "deleted", "id": material_id}


@router.get("/dataset")
def get_materials_dataset() -> dict[str, Any]:
    dataset_path = Path(__file__).parent.parent / "data" / "tamilnadu_pwd_bai_materials_dataset.json"
    if not dataset_path.exists():
        raise HTTPException(status_code=404, detail="Materials provenance dataset not found.")
    with open(dataset_path, "r", encoding="utf-8") as f:
        items = json.load(f)
    return {
        "source_authority": "Government of Tamil Nadu Public Works Department (Buildings Organisation) & Builders Association of India",
        "schedule_name": "Tamil Nadu PWD Schedule of Rates (SOR) 2025–2026 & BAI State Centre Cost Index",
        "document_reference": "G.O. Ms No. 142/PWD & BAI-TN-2026-Q1",
        "effective_date": "2026-01-01",
        "regions_covered": ["Chennai Metro", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
        "total_records": len(items),
        "items": items,
    }


@router.get("/dataset/csv")
def download_materials_csv() -> PlainTextResponse:
    csv_path = Path(__file__).parent.parent / "data" / "tamilnadu_pwd_bai_materials_dataset.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Materials CSV dataset not found.")
    content = csv_path.read_text(encoding="utf-8")
    return PlainTextResponse(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="tamilnadu_pwd_bai_materials_2026.csv"'},
    )

