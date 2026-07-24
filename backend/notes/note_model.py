from datetime import datetime
from database.connect_database import get_db_connection


class NoteModel:

    @staticmethod
    def create(data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_notes (title, content, scope, color, owner_id)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data["title"],
            data.get("content", ""),
            data["scope"],
            data.get("color", "#fff9c4"),
            data["owner_id"]
        ))

        note_id = cursor.fetchone()[0]

        conn.commit()
        cursor.close()
        conn.close()

        return note_id

    @staticmethod
    def get_all(scope, owner_id=None):
        """
        scope='pessoal': owner_id é obrigatório e restringe às anotações do
        próprio usuário (acesso exclusivo do criador).
        scope='setor': todas as anotações compartilhadas, de qualquer autor.
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        base_query = """
            SELECT
                n.id, n.title, n.content, n.scope, n.color,
                n.owner_id, u.name, n.created_at, n.updated_at
            FROM tbl_notes n
            LEFT JOIN tbl_users u ON u.id = n.owner_id
            WHERE n.scope = %s
        """
        params = [scope]

        if scope == "pessoal":
            base_query += " AND n.owner_id = %s"
            params.append(owner_id)

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
            SELECT id, title, content, scope, color, owner_id
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
