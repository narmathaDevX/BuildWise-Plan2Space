import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from backend.app.db.session import Base


def generate_uuid() -> str:
    return uuid.uuid4().hex[:12]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), default="Builder")
    created_at = Column(DateTime(timezone=True), default=utc_now)

    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), default="My Dream Home")
    location = Column(String(255), default="Tamil Nadu")
    form_json = Column(Text, nullable=True)
    selected_plan_id = Column(String(64), nullable=True)
    construction_start_date = Column(String(32), nullable=True)
    current_month = Column(Integer, default=1)
    status = Column(String(64), default="Planning")
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="projects")
    plans = relationship("PlanModel", back_populates="project", cascade="all, delete-orphan")
    estimates = relationship("Estimate", back_populates="project", cascade="all, delete-orphan")
    materials = relationship("Material", back_populates="project", cascade="all, delete-orphan")

    def get_form(self) -> dict[str, Any]:
        if not self.form_json:
            return {}
        try:
            return json.loads(self.form_json)
        except Exception:
            return {}

    def set_form(self, data: dict[str, Any]) -> None:
        self.form_json = json.dumps(data)


class PlanModel(Base):
    __tablename__ = "plans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    plan_id = Column(String(64), index=True, nullable=False)
    seed = Column(Integer, default=42)
    plan_json = Column(Text, nullable=False)
    score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint("project_id", "plan_id", name="uq_project_plan_id"),
    )

    project = relationship("Project", back_populates="plans")

    def get_plan_data(self) -> dict[str, Any]:
        try:
            return json.loads(self.plan_json)
        except Exception:
            return {}

    def set_plan_data(self, data: dict[str, Any]) -> None:
        self.plan_json = json.dumps(data)


class Estimate(Base):
    __tablename__ = "estimates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    plan_id = Column(String(64), nullable=True)
    cost_json = Column(Text, nullable=True)
    schedule_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    project = relationship("Project", back_populates="estimates")

    def get_cost(self) -> dict[str, Any] | None:
        if not self.cost_json:
            return None
        try:
            return json.loads(self.cost_json)
        except Exception:
            return None

    def set_cost(self, data: dict[str, Any]) -> None:
        self.cost_json = json.dumps(data)

    def get_schedule(self) -> dict[str, Any] | None:
        if not self.schedule_json:
            return None
        try:
            return json.loads(self.schedule_json)
        except Exception:
            return None

    def set_schedule(self, data: dict[str, Any]) -> None:
        self.schedule_json = json.dumps(data)


class Material(Base):
    __tablename__ = "materials"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    key = Column(String(64), nullable=False)
    name = Column(String(128), nullable=False)
    category = Column(String(64), nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    unit = Column(String(32), nullable=False, default="units")
    rate = Column(Float, nullable=False, default=0.0)
    purchased = Column(Boolean, default=False)
    is_custom = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    project = relationship("Project", back_populates="materials")
