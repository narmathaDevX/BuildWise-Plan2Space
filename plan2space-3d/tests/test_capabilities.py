"""Tests for /health and /api/v1/capabilities endpoints."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Plan2Space 3D"
    assert data["version"] == "1.0.0"


def test_capabilities_endpoint():
    response = client.get("/api/v1/capabilities")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.0.0"
    assert "shapely" in data["geometry_engine"]
    assert "coordinate_system" in data
    assert data["coordinate_system"]["2D"] == "Math convention: X right, Y up in metres"
    assert "3D_glTF" in data["coordinate_system"]
    assert "defaults" in data
    assert data["defaults"]["wall_height_m"] == 2.7
    assert "glb" in data["supported_export_formats"]
    assert "obj" in data["supported_export_formats"]
