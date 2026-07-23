from database.connect_database import get_db_connection

class PriorityModel:

    @staticmethod
    def create(data):
        conn = get_db_connection()
        cursor = conn.cursor()

        # Inserção atualizada com as colunas sla e color
        cursor.execute("""
            INSERT INTO tbl_priorities (name, sla, color)
            VALUES (%s, %s, %s)
            RETURNING id
        """, (data["name"], data["sla"], data.get("color", "#2563eb")))

        priority_id = cursor.fetchone()[0]

        conn.commit()
        cursor.close()
        conn.close()

        return priority_id

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, sla, color
            FROM tbl_priorities
            ORDER BY id ASC
        """)

        priorities = cursor.fetchall()

        cursor.close()
        conn.close()

        return priorities

    @staticmethod
    def update(priority_id, data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_priorities
            SET name = %s, sla = %s, color = %s
            WHERE id = %s
        """, (
            data["name"],
            data["sla"],
            data.get("color", "#2563eb"),
            priority_id
        ))

        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def get_by_id(priority_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name, sla, color
            FROM tbl_priorities
            WHERE id = %s
        """, (priority_id,))

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        return row

    @staticmethod
    def delete(priority_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM tbl_priorities
            WHERE id = %s
        """, (priority_id,))

        conn.commit()
        cursor.close()
        conn.close()