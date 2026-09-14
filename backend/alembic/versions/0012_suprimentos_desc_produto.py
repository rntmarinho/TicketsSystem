"""Suprimentos: descrição real do produto (cadastro Senior, E075PRO.DESPRO)

Revision ID: 0012_suprimentos_desc_produto
Revises: 0011_conferencia_oc
Create Date: 2026-09-14

O campo descricao_complementar_produto (CPLPRO) é só o complemento/derivação
do item na linha da solicitação — na Senior costuma vir em branco, e quando
o usuário não preenche, a coluna "Descrição" da tela ficava mostrando o que
tinha de mais parecido com um texto descritivo, que muitas vezes acabava
sendo a Observação da solicitação (achado real, 14/09/2026). A descrição
correta mora no cadastro do produto (E075PRO.DESPRO), buscada agora pelo
workflow n8n "Consominas - Suprimentos - Sync Solicitacoes Senior".
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_suprimentos_desc_produto"
down_revision = "0011_conferencia_oc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "suprimentos_solicitacoes",
        sa.Column("descricao_produto", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("suprimentos_solicitacoes", "descricao_produto")
