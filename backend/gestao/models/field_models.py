from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum, UniqueConstraint, func
from sqlalchemy.orm import relationship
from database.gestao_db import Base
from gestao.models.team_models import new_uuid

CUSTOM_FIELD_TYPES = ("TEXTO", "NUMERO", "MOEDA", "DATA", "LISTA", "CHECKBOX", "PESSOA", "FORMULA")


class CustomField(Base):
    """
    Campo customizado por projeto (aba "Campos" do projeto). Tipo LISTA guarda as
    opções, e FORMULA guarda a config de operação, ambos serializados como JSON
    no mesmo texto `options` — igual ao APPCNS original. Avaliação de FORMULA é
    feita no frontend, no momento de exibir (não persistida), então não precisa
    de motor de fórmula no backend.
    """
    __tablename__ = "custom_fields"

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(Enum(*CUSTOM_FIELD_TYPES, name="custom_field_type", native_enum=False), nullable=False)
    options = Column(Text, nullable=True)
    order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="custom_fields")
    values = relationship("TaskCustomFieldValue", back_populates="custom_field", cascade="all, delete-orphan")


class TaskCustomFieldValue(Base):
    __tablename__ = "task_custom_field_values"
    __table_args__ = (UniqueConstraint("task_id", "custom_field_id", name="uq_task_custom_field_values_pair"),)

    id = Column(String(36), primary_key=True, default=new_uuid)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    custom_field_id = Column(String(36), ForeignKey("custom_fields.id", ondelete="CASCADE"), nullable=False, index=True)
    value = Column(Text, nullable=True)

    task = relationship("Task", back_populates="custom_field_values")
    custom_field = relationship("CustomField", back_populates="values")
