"""marco inicial do modulo de gestao (scaffolding, sem tabelas ainda)

Revision ID: 0001_init_gestao
Revises:
Create Date: 2026-08-12

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001_init_gestao"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Intencionalmente vazia — nenhum modelo do módulo de gestão existe ainda
    # (chegam na Fase 1). Essa revisão só existe pra provar que o pipeline
    # Alembic (config, env.py, conexão, tabela alembic_version) funciona
    # ponta a ponta antes de qualquer tabela real ser criada.
    pass


def downgrade() -> None:
    pass
