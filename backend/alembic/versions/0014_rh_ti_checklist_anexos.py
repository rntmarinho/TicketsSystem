"""RH: cancelamento, checklist de TI, chamado auto-criado e anexos de vaga

Revision ID: 0014_rh_ti_checklist_anexos
Revises: 0013_rh_vaga_solicitacao
Create Date: 2026-09-18

Adiciona a parte 2 do formulario FOR 12.0.4 (checklist de provisionamento de
TI -- computador, VPN, e-mail, softwares etc., tudo opcional) e o campo que
guarda o chamado de TI auto-criado quando o RH marca a vaga como criada.
CANCELADA em VAGA_STATUSES nao precisa de migration (Enum aqui e so
sa.Enum(..., native_enum=False), guardado como VARCHAR simples, sem CHECK
constraint -- mesmo padrao ja usado por suprimentos_status).
"""
from alembic import op
import sqlalchemy as sa

revision = "0014_rh_ti_checklist_anexos"
down_revision = "0013_rh_vaga_solicitacao"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("rh_vagas_solicitacoes", sa.Column("chamado_ti_id", sa.Integer(), sa.ForeignKey("tbl_tickets.id"), nullable=True))

    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_mobiliario", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_telefone_celular", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_materiais_escritorio", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_computador", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_perfil_computador", sa.Text(), nullable=True))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_softwares", sa.Text(), nullable=True))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_outros_softwares", sa.Text(), nullable=True))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_acesso_pastas_rede", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_caminho_pastas_rede", sa.Text(), nullable=True))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_acesso_vpn", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_conta_email", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_email_substituicao", sa.String(255), nullable=True))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_criacao_assinatura_email", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_acesso_intranet", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_senha_telefone_fixo", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_necessidade_art", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_necessidade_epi", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_necessidade_alojamento", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_kit_roupa_cama_banho", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_baixada", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_periodicidade_baixada", sa.String(120), nullable=True))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_deslocamento_mensal", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("rh_vagas_solicitacoes", sa.Column("ti_dias_deslocamento", sa.String(120), nullable=True))

    op.add_column("attachments", sa.Column("vaga_id", sa.String(36), sa.ForeignKey("rh_vagas_solicitacoes.id", ondelete="CASCADE"), nullable=True))
    op.create_index("ix_attachments_vaga_id", "attachments", ["vaga_id"])


def downgrade() -> None:
    op.drop_index("ix_attachments_vaga_id", table_name="attachments")
    op.drop_column("attachments", "vaga_id")

    op.drop_column("rh_vagas_solicitacoes", "ti_dias_deslocamento")
    op.drop_column("rh_vagas_solicitacoes", "ti_deslocamento_mensal")
    op.drop_column("rh_vagas_solicitacoes", "ti_periodicidade_baixada")
    op.drop_column("rh_vagas_solicitacoes", "ti_baixada")
    op.drop_column("rh_vagas_solicitacoes", "ti_kit_roupa_cama_banho")
    op.drop_column("rh_vagas_solicitacoes", "ti_necessidade_alojamento")
    op.drop_column("rh_vagas_solicitacoes", "ti_necessidade_epi")
    op.drop_column("rh_vagas_solicitacoes", "ti_necessidade_art")
    op.drop_column("rh_vagas_solicitacoes", "ti_senha_telefone_fixo")
    op.drop_column("rh_vagas_solicitacoes", "ti_acesso_intranet")
    op.drop_column("rh_vagas_solicitacoes", "ti_criacao_assinatura_email")
    op.drop_column("rh_vagas_solicitacoes", "ti_email_substituicao")
    op.drop_column("rh_vagas_solicitacoes", "ti_conta_email")
    op.drop_column("rh_vagas_solicitacoes", "ti_acesso_vpn")
    op.drop_column("rh_vagas_solicitacoes", "ti_caminho_pastas_rede")
    op.drop_column("rh_vagas_solicitacoes", "ti_acesso_pastas_rede")
    op.drop_column("rh_vagas_solicitacoes", "ti_outros_softwares")
    op.drop_column("rh_vagas_solicitacoes", "ti_softwares")
    op.drop_column("rh_vagas_solicitacoes", "ti_perfil_computador")
    op.drop_column("rh_vagas_solicitacoes", "ti_computador")
    op.drop_column("rh_vagas_solicitacoes", "ti_materiais_escritorio")
    op.drop_column("rh_vagas_solicitacoes", "ti_telefone_celular")
    op.drop_column("rh_vagas_solicitacoes", "ti_mobiliario")

    op.drop_column("rh_vagas_solicitacoes", "chamado_ti_id")
