from database.connect_database import get_db_connection


class ProjectModel:

    @staticmethod
    def create(data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_projects (name, description, owner_id)
            VALUES (%s, %s, %s)
            RETURNING id
        """, (
            data["name"],
            data.get("description"),
            data.get("owner_id")
        ))

        project_id = cursor.fetchone()[0]

        conn.commit()
        cursor.close()
        conn.close()

        return project_id

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                p.id, p.name, p.description, p.status,
                p.owner_id, o.name, p.created_at
            FROM tbl_projects p
            LEFT JOIN tbl_users o ON o.id = p.owner_id
            ORDER BY p.created_at DESC
        """)

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return rows

    @staticmethod
    def get_by_id(project_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                p.id, p.name, p.description, p.status,
                p.owner_id, o.name, p.created_at
            FROM tbl_projects p
            LEFT JOIN tbl_users o ON o.id = p.owner_id
            WHERE p.id = %s
        """, (project_id,))

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        return row

    @staticmethod
    def update(project_id, data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_projects
            SET name = %s, description = %s, owner_id = %s
            WHERE id = %s
        """, (
            data["name"],
            data.get("description"),
            data.get("owner_id"),
            project_id
        ))

        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def update_status(project_id, status):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_projects
            SET status = %s
            WHERE id = %s
        """, (status, project_id))

        conn.commit()
        cursor.close()
        conn.close()
