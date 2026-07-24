from database.connect_database import get_db_connection


class DepartmentModel:

    @staticmethod
    def create(name):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_departments (name)
            VALUES (%s)
            RETURNING id
        """, (name,))

        department_id = cursor.fetchone()[0]

        conn.commit()
        cursor.close()
        conn.close()

        return department_id

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name
            FROM tbl_departments
            ORDER BY name
        """)

        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        return rows

    @staticmethod
    def get_by_name(name):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name
            FROM tbl_departments
            WHERE name = %s
        """, (name,))

        row = cursor.fetchone()

        cursor.close()
        conn.close()

        return row
