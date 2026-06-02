from database.connect_database import get_db_connection

class CategoryModel:
    # Método para criar uma nova categoria
    @staticmethod
    def create(data):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_categories (name, priority_id)
            VALUES (%s, %s)
            RETURNING id
        """, (data["name"], data["priority_id"]))
        # O método RETURNING id retorna o ID da categoria recém-criada
        category_id = cursor.fetchone()[0]

        conn.commit()
        cursor.close()
        conn.close()

        return category_id

    # Método para obter todas as categorias, incluindo a nomenclatura da prioridade vinculada
    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()

        # Utilização de JOIN para buscar a nomenclatura da prioridade vinculada
        cursor.execute("""
            SELECT c.id, c.name, c.priority_id, p.name as priority_name
            FROM tbl_categories c
            LEFT JOIN tbl_priorities p ON c.priority_id = p.id
            ORDER BY c.name ASC
        """)
        # O resultado da consulta inclui o ID, nome da categoria, ID da prioridade e o nome da prioridade vinculada
        categories = cursor.fetchall()

        cursor.close()
        conn.close()

        return categories

    # Método para deletar uma categoria existente
    @staticmethod
    def delete(category_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        # O método DELETE é utilizado para remover a categoria com o ID especificado
        cursor.execute("""
            DELETE FROM tbl_categories
            WHERE id = %s
        """, (category_id,))

        conn.commit()
        cursor.close()
        conn.close()