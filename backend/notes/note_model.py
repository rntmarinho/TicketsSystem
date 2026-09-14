from datetime import datetime
from database.connect_database import get_db_connection


class NoteModel:

    @staticmethod
    def get_department_id(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT department_id FROM tbl_users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        return row[0] if row else None

    @staticmethod
    def create(data):
        # Setor gravado na nota (09/09/2026) = setor do autor NO MOMENTO da
        # criação — usado pra restringir a aba "Setor" só a quem é do mesmo
        # setor, sem exceção nem pra ADMIN (ver note_routes.py/note_controller.py).
        department_id = NoteModel.get_department_id(data["owner_id"])

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_notes (title, content, scope, color, owner_id, department_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data["title"],
            data.get("content", ""),
            data["scope"],
            data.get("color", "#fff9c4"),
            data["owner_id"],
            department_id,
        ))

        note_id = cursor.fetchone()[0]

        conn.commit()
        cursor.close()
        conn.close()

        return note_id

    @staticmethod
    def get_all(scope, owner_id=None, department_id=None):
        """
        scope='pessoal': owner_id é obrigatório e restringe às anotações do
        próprio usuário (acesso exclusivo do criador).
        scope='setor': só as anotações do MESMO setor de quem está pedindo
        (department_id) — estritamente por setor, sem exceção nem pra ADMIN
        (09/09/2026, decisão da Renata — diferente do padrão "ADMIN vê tudo"
        usado no resto do sistema). Quem não tem setor cadastrado não vê
        nenhuma (comparação com NULL nunca bate, nem NULL com NULL).
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        base_query = """
            SELECT
                n.id, n.title, n.content, n.scope, n.color,
                n.owner_id, u.name, n.created_at, n.updated_at, n.department_id
            FROM tbl_notes n
            LEFT JOIN tbl_users u ON u.id = n.owner_id
            WHERE n.scope = %s
        """
        params = [scope]

        if scope == "pessoal":
            base_query += " AND n.owner_id = %s"
            params.append(owner_id)
        else:
            base_query += " AND n.department_id = %s"
            params.append(department_id)

        base_query += " ORDER BY n.updated_at DESC"

        cursor.execute(base_query, tuple(params))
        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        return rows

    @staticmethod
    def get_by_id(note_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, title, content, scope, color, owner_id, department_id
            FROM tbl_notes
            WHERE id = %s
        """, (note_id,))

        row = cursor.fetchone()

        cursor.close()
        conn.close()

        return row

    @staticmethod
    def update(note_id, data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_notes
            SET title = %s, content = %s, color = %s, updated_at = %s
            WHERE id = %s
        """, (
            data["title"],
            data.get("content", ""),
            data.get("color", "#fff9c4"),
            datetime.now(),
            note_id
        ))

        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def delete(note_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM tbl_notes WHERE id = %s", (note_id,))

        conn.commit()
        cursor.close()
        conn.close()
