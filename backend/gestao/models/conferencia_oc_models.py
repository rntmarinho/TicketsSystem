from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, func
from database.gestao_db import Base

CONFERENCIA_OC_SITUACOES = ("NAO_CONFERIDO", "CONFERIDO")


class ConferenciaOcStatus(Base):
    """
    Situação de conferência (Financeiro) de cada Ordem de Compra do Senior —
    campo que não existe no ERP, só neste sistema. Os demais dados da OC
    (fornecedor, valores, situação etc.) são buscados ao vivo no Senior via
    integrations/senior/senior_client.py, nunca espelhados aqui — esta tabela
    guarda só o que o ERP não tem.

    Uma OC sem linha aqui é tratada como NAO_CONFERIDO por padrão (ver
    gestao/conferencia_oc/conferencia_oc_service.py::listar_ordens).
    """
    __tablename__ = "conferencia_oc_status"

    numero_oc = Column(String(30), primary_key=True)
    situacao = Column(
        Enum(*CONFERENCIA_OC_SITUACOES, name="conferencia_oc_situacao", native_enum=False),
        nullable=False, default="NAO_CONFERIDO",
    )
    updated_by = Column(Integer, ForeignKey("tbl_users.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
