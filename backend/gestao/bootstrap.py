"""
Roda a cada boot (ver main.py::run_setup(), depois de run_alembic_upgrade()).
Garante que existe uma equipe padrão "Geral" e que todo usuário ativo
(qualquer papel, inclusive CLIENTE — funcionário, desde 02/09/2026) é membro dela — necessário porque `Project.team_id`
é obrigatório no schema e a Fase 1 não tem UI de gestão de equipe ainda (chega
na Fase 2). Idempotente: só cria o que ainda não existe.
"""
from database.gestao_db import SessionLocal
from gestao.models.team_models import Team, UserTeam
from gestao.models.legacy import LegacyUser

DEFAULT_TEAM_NAME = "Geral"
GESTOR_ROLES = ("ADMIN", "DIRETOR", "GESTOR_PROJETO")


def bootstrap_default_team():
    session = SessionLocal()
    try:
        team = session.query(Team).filter(Team.name == DEFAULT_TEAM_NAME).first()
        if team is None:
            team = Team(
                name=DEFAULT_TEAM_NAME,
                description="Equipe padrão, criada automaticamente — até a Fase 2 trazer gestão de equipes de verdade, todo o staff participa dela.",
            )
            session.add(team)
            session.flush()

        staff = (
            session.query(LegacyUser)
            .filter(LegacyUser.situation == "A")  # desde 02/09: todo ativo, inclusive CLIENTE (funcionário)
            .all()
        )
        existing_member_ids = {
            row[0]
            for row in session.query(UserTeam.user_id).filter(UserTeam.team_id == team.id).all()
        }

        added = 0
        for user in staff:
            if user.id in existing_member_ids:
                continue
            role = "GESTOR" if user.access_type in GESTOR_ROLES else "MEMBRO"
            session.add(UserTeam(user_id=user.id, team_id=team.id, role=role))
            added += 1

        session.commit()
        if added:
            print(f"Bootstrap do módulo de gestão: {added} usuário(s) adicionado(s) à equipe '{DEFAULT_TEAM_NAME}'.")
    except Exception as e:
        session.rollback()
        print(f"Aviso: bootstrap do módulo de gestão falhou: {e}")
    finally:
        session.close()
