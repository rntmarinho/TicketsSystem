"""
Migração única (Fase 1 da fusão com o APPCNS) — copia pro módulo de gestão
novo:
  tbl_projects            -> projects (Project)
  tbl_tickets type='tarefa' -> tasks (Task)
  tbl_messages (dessas tarefas) -> task_comments (TaskComment)
  tbl_ticket_anexos (dessas tarefas) -> attachments (Attachment), copiando o
      arquivo físico de backend/public/anexos/ pra backend/public/gestao_anexos/
      (copia, não move — o arquivo original continua servindo o chamado legado)

NÃO apaga nem altera tbl_tickets/tbl_projects/tbl_messages/tbl_ticket_anexos —
o módulo antigo continua funcionando, só passa a ser somente-leitura na UI
(feito à parte, no frontend) e para de oferecer `type='tarefa'` na criação.

Idempotente: usa `migrated_from_project_id`/`migrated_from_ticket_id` (colunas
únicas) pra pular o que já foi migrado se o script rodar de novo — seguro
rodar mais de uma vez, por engano ou pra pegar tarefas/projetos criados depois
da primeira execução.

Rodar manualmente na janela de deploy da Fase 1 (não a cada boot):
    cd backend && python -m scripts.migrate_tarefa_tickets
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database.connect_database import get_db_connection  # noqa: E402
from database.gestao_db import SessionLocal  # noqa: E402
from gestao.models.project_models import Project  # noqa: E402
from gestao.models.task_models import Task  # noqa: E402
from gestao.models.team_models import Team  # noqa: E402
from gestao.models.attachment_models import Attachment  # noqa: E402

STATUS_MAP_PROJECT = {"active": "EM_ANDAMENTO", "archived": "CONCLUIDO"}
STATUS_MAP_TASK = {"open": "A_FAZER", "in_progress": "FAZENDO", "pending": "BLOQUEADO", "closed": "FEITO"}

OLD_ANEXOS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "anexos")
NEW_ANEXOS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "gestao_anexos")


def _default_team_id(session):
    team = session.query(Team).filter(Team.name == "Geral").first()
    if not team:
        raise RuntimeError("Equipe padrão 'Geral' não existe — rode o boot da aplicação (gestao/bootstrap.py) antes.")
    return team.id


def _fallback_owner_id(legacy_conn):
    """tbl_projects.owner_id é opcional (sem NOT NULL) — a tela antiga de criação
    de projeto nunca preenchia esse campo automaticamente a partir do usuário
    logado, então projeto legado com owner_id nulo é um caso real, não hipotético.
    O novo Project.owner_id é obrigatório, então usa o ADMIN mais antigo como
    dono de fallback quando o legado não tem um — reatribuível depois pela UI."""
    cursor = legacy_conn.cursor()
    cursor.execute("SELECT id FROM tbl_users WHERE access_type = 'ADMIN' ORDER BY id ASC LIMIT 1")
    row = cursor.fetchone()
    cursor.close()
    if not row:
        raise RuntimeError("Nenhum usuário ADMIN encontrado — necessário como dono de fallback pra projetos legados sem owner_id.")
    return row[0]


def migrate_projects(session, legacy_conn, default_team_id):
    """Retorna dict {old_project_id (int): new_project_id (str)}."""
    already = {
        row[0]: row[1]
        for row in session.query(Project.migrated_from_project_id, Project.id)
        .filter(Project.migrated_from_project_id.isnot(None))
        .all()
    }

    cursor = legacy_conn.cursor()
    cursor.execute("SELECT id, name, description, status, owner_id, created_at FROM tbl_projects")
    rows = cursor.fetchall()
    cursor.close()

    fallback_owner_id = None
    id_map = dict(already)
    created = 0
    fallback_used = 0
    for old_id, name, description, status, owner_id, created_at in rows:
        if old_id in id_map:
            continue
        if owner_id is None:
            if fallback_owner_id is None:
                fallback_owner_id = _fallback_owner_id(legacy_conn)
            owner_id = fallback_owner_id
            fallback_used += 1
        project = Project(
            name=name,
            description=description,
            status=STATUS_MAP_PROJECT.get(status, "EM_ANDAMENTO"),
            team_id=default_team_id,
            owner_id=owner_id,
            migrated_from_project_id=old_id,
            created_at=created_at,
        )
        session.add(project)
        session.flush()
        id_map[old_id] = project.id
        created += 1

    session.commit()
    print(f"Projetos migrados: {created} novo(s), {len(already)} já migrado(s) antes"
          f"{f', {fallback_used} sem dono original (atribuído ao admin mais antigo, reatribuir manualmente se necessário)' if fallback_used else ''}.")
    return id_map


def migrate_tasks(session, legacy_conn, project_id_map):
    already_ticket_ids = {
        row[0]
        for row in session.query(Task.migrated_from_ticket_id).filter(Task.migrated_from_ticket_id.isnot(None)).all()
    }

    cursor = legacy_conn.cursor()
    cursor.execute("""
        SELECT id, subject, description, status, user_id, assigned_to, project_id,
               creation, start_date, sla, close_time
        FROM tbl_tickets
        WHERE type = 'tarefa'
    """)
    rows = cursor.fetchall()
    cursor.close()

    created = 0
    skipped_no_project = 0
    task_id_map = {}
    for (ticket_id, subject, description, status, user_id, assigned_to, project_id,
         creation, start_date, sla, close_time) in rows:
        if ticket_id in already_ticket_ids:
            continue

        new_project_id = project_id_map.get(project_id) if project_id else None
        if project_id and not new_project_id:
            # Projeto do chamado não foi migrado (não deveria acontecer, migrate_projects
            # roda antes) — a tarefa vira "sem projeto" em vez de travar a migração inteira.
            skipped_no_project += 1

        task = Task(
            title=subject,
            description=description,
            status=STATUS_MAP_TASK.get(status, "A_FAZER"),
            priority="MEDIA",  # tbl_tickets.priority_id referencia um cadastro livre de
                                # prioridades (nome/SLA/cor) sem correspondência direta com
                                # o enum novo (BAIXA/MEDIA/ALTA/URGENTE) — todas migram como
                                # MEDIA; reclassificar manualmente depois se precisar.
            assignee_id=assigned_to,
            created_by=user_id,
            project_id=new_project_id,
            start_date=start_date,
            due_date=sla,
            actual_ended_at=close_time,
            migrated_from_ticket_id=ticket_id,
            created_at=creation,
        )
        session.add(task)
        session.flush()
        task_id_map[ticket_id] = task.id
        created += 1

    session.commit()
    print(f"Tarefas migradas: {created} nova(s), {len(already_ticket_ids)} já migrada(s) antes"
          f"{f', {skipped_no_project} sem projeto correspondente' if skipped_no_project else ''}.")
    return task_id_map


def migrate_comments(session, legacy_conn, task_id_map):
    if not task_id_map:
        return
    cursor = legacy_conn.cursor()
    cursor.execute(
        "SELECT id, ticket_id, message, sender, creation FROM tbl_messages WHERE ticket_id = ANY(%s)",
        (list(task_id_map.keys()),),
    )
    rows = cursor.fetchall()
    cursor.close()

    from gestao.models.task_models import TaskComment
    created = 0
    for _msg_id, ticket_id, message, sender, creation in rows:
        task_id = task_id_map[ticket_id]
        exists = (
            session.query(TaskComment)
            .filter(TaskComment.task_id == task_id, TaskComment.body == message, TaskComment.author_id == sender)
            .first()
        )
        if exists:
            continue
        session.add(TaskComment(task_id=task_id, author_id=sender, body=message, created_at=creation))
        created += 1
    session.commit()
    print(f"Comentários migrados: {created}.")


def migrate_attachments(session, legacy_conn, task_id_map):
    if not task_id_map:
        return
    cursor = legacy_conn.cursor()
    cursor.execute(
        """SELECT id, ticket_id, nome_original, nome_arquivo, tipo_mime, tamanho_bytes,
                  usuario_upload, data_upload
           FROM tbl_ticket_anexos WHERE ticket_id = ANY(%s)""",
        (list(task_id_map.keys()),),
    )
    rows = cursor.fetchall()
    cursor.close()

    os.makedirs(NEW_ANEXOS_DIR, exist_ok=True)
    created = 0
    skipped_missing_file = 0
    for (_anexo_id, ticket_id, nome_original, nome_arquivo, tipo_mime, tamanho_bytes,
         usuario_upload, data_upload) in rows:
        task_id = task_id_map[ticket_id]
        exists = (
            session.query(Attachment)
            .filter(Attachment.task_id == task_id, Attachment.file_path == nome_arquivo)
            .first()
        )
        if exists:
            continue

        origem = os.path.join(OLD_ANEXOS_DIR, nome_arquivo)
        destino = os.path.join(NEW_ANEXOS_DIR, nome_arquivo)
        if not os.path.exists(origem):
            skipped_missing_file += 1
            continue
        if not os.path.exists(destino):
            shutil.copy2(origem, destino)

        session.add(Attachment(
            task_id=task_id,
            file_name=nome_original,
            file_path=nome_arquivo,
            file_size=tamanho_bytes or 0,
            mime_type=tipo_mime,
            uploaded_by=usuario_upload,
            uploaded_at=data_upload,
        ))
        created += 1
    session.commit()
    print(f"Anexos migrados: {created}"
          f"{f', {skipped_missing_file} pulado(s) por arquivo físico ausente' if skipped_missing_file else ''}.")


def main():
    session = SessionLocal()
    legacy_conn = get_db_connection()
    try:
        default_team_id = _default_team_id(session)
        project_id_map = migrate_projects(session, legacy_conn, default_team_id)
        task_id_map = migrate_tasks(session, legacy_conn, project_id_map)
        migrate_comments(session, legacy_conn, task_id_map)
        migrate_attachments(session, legacy_conn, task_id_map)
        print("Migração concluída. tbl_projects/tbl_tickets/tbl_messages/tbl_ticket_anexos não foram alterados.")
    finally:
        legacy_conn.close()
        session.close()


if __name__ == "__main__":
    main()
