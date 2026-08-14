from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, func
from database.gestao_db import Base
from gestao.models.team_models import new_uuid


class AuditLog(Base):
    """
    Log de auditoria do módulo de gestão — write-only pelo código (via
    gestao.audit_log.record()), leitura só por ADMIN/DIRETOR. `metadata_json`
    (não `metadata`, nome reservado pelo SQLAlchemy Declarative) guarda um
    JSON serializado como texto com detalhes extras da ação.
    """
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(Integer, ForeignKey("tbl_users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=True, index=True)
    entity_id = Column(String(36), nullable=True, index=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
