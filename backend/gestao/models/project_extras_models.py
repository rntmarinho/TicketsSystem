"""Itens simples associados a um projeto: marcos, riscos, decisões, recurso/hora."""
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint, func
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

RISK_LEVELS = ("BAIXO", "MEDIO", "ALTO")
RISK_STATUSES = ("ABERTO", "MITIGADO", "ENCERRADO")


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    done = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Risk(Base):
    __tablename__ = "risks"

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    impact = Column(Enum(*RISK_LEVELS, name="risk_level_impact", native_enum=False), nullable=False, default="MEDIO")
    probability = Column(Enum(*RISK_LEVELS, name="risk_level_probability", native_enum=False), nullable=False, default="MEDIO")
    mitigation_plan = Column(Text, nullable=True)
    status = Column(Enum(*RISK_STATUSES, name="risk_status", native_enum=False), nullable=False, default="ABERTO")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Decision(Base):
    __tablename__ = "decisions"

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    decided_by_id = Column(Integer, ForeignKey("tbl_users.id"), nullable=False)
    decided_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ResourceRate(Base):
    __tablename__ = "resource_rates"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_resource_rates_pair"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
    hourly_rate = Column(Float, nullable=False, default=0)
