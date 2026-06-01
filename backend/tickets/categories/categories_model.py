from database.connect_database import get_db_connection

class CategoryModel:

    @staticmethod
    def create(data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_categories (name)
            VALUES (%s)
            RETURNING id
        """, (data["name"],))

        category_id = cursor.fetchone()[0]

        conn.commit()
        cursor.close()
        conn.close()

        return category_id

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, name
            FROM tbl_categories
            ORDER BY name ASC
        """)

        categories = cursor.fetchall()

        cursor.close()
        conn.close()

        return categories

    @staticmethod
    def delete(category_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM tbl_categories
            WHERE id = %s
        """, (category_id,))

        conn.commit()
        cursor.close()
        conn.close()