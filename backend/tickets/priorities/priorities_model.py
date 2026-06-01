from database.connect_database import get_db_connection

class PriorityModel:

    @staticmethod
    def create(data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_priorities (name)
            VALUES (%s)
            RETURNING id
        """, (data["name"],))

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
            SELECT id, name
            FROM tbl_priorities
            ORDER BY id ASC
        """)

        priorities = cursor.fetchall()

        cursor.close()
        conn.close()

        return priorities

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