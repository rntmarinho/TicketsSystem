from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum, func
from database.gestao_db import Base
from gestao.models.team_models import new_uuid
from gestao.models.project_models import APPROVAL_STATUSES


class ApprovalRequest(Base):
    """
    Solicitação de aprovação genérica (não amarrada a Project — esse já tem
    seu próprio approver_id/approval_status desde a Fase 1). Uso: qualquer
    pedido pessoa-a-pessoa que precise de "sim/não" registrado, ex: início de
    PDI, liberação de recurso, o que a Fase 2+ demandar.
    """
    __tablename__ = "approval_requests"

    id = Column(String(36), primary_key=True, default=new_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    requester_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
    approver_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Enum(*APPROVAL_STATUSES, name="approval_request_status", native_enum=False), nullable=False, default="PENDENTE")
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
