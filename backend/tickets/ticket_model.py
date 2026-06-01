from database.connect_database import get_db_connection

class TicketModel:

    @staticmethod
    def get_priority_sla(priority_id):
        """
        Recupera o valor quantitativo de horas estabelecido para o SLA 
        de uma dada prioridade na base de dados.
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT sla 
            FROM tbl_priorities 
            WHERE id = %s
        """, (priority_id,))

        result = cursor.fetchone()

        cursor.close()
        conn.close()

        return result[0] if result else None

    @staticmethod
    def create(data, calculated_sla):
        """
        Persiste o chamado no banco de dados com o SLA já computado.
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tbl_tickets (
                subject,
                category_id,
                user_id,
                priority_id,
                status,
                sla
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data["subject"],
            data["category_id"],
            data["user_id"],
            data["priority_id"],
            "open",
            calculated_sla
        ))

        ticket_id = cursor.fetchone()[0]

        conn.commit()

        cursor.close()
        conn.close()

        return ticket_id

    @staticmethod
    def get_by_id(ticket_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                t.id,
                t.subject,
                t.status,
                t.creation,
                t.sla,
                c.name,
                p.name,
                u.name
            FROM tbl_tickets t
            LEFT JOIN tbl_categories c
                ON c.id = t.category_id
            LEFT JOIN tbl_priorities p
                ON p.id = t.priority_id
            LEFT JOIN tbl_users u
                ON u.id = t.user_id
            WHERE t.id = %s
        """, (ticket_id,))

        ticket = cursor.fetchone()

        cursor.close()
        conn.close()

        return ticket

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                t.id,
                t.subject,
                t.status,
                t.creation,
                t.sla,
                c.name,
                p.name,
                u.name
            FROM tbl_tickets t
            LEFT JOIN tbl_categories c
                ON c.id = t.category_id
            LEFT JOIN tbl_priorities p
                ON p.id = t.priority_id
            LEFT JOIN tbl_users u
                ON u.id = t.user_id
            ORDER BY t.creation DESC
        """)

        tickets = cursor.fetchall()

        cursor.close()
        conn.close()

        return tickets

    @staticmethod
    def update_status(ticket_id, status):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_tickets
            SET status = %s
            WHERE id = %s
        """, (status, ticket_id))

        conn.commit()

        cursor.close()
        conn.close()

    @staticmethod
    def delete(ticket_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            DELETE FROM tbl_tickets
            WHERE id = %s
        """, (ticket_id,))

        conn.commit()

        cursor.close()
        conn.close()

    @staticmethod
    def exists(ticket_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id
            FROM tbl_tickets
            WHERE id = %s
        """, (ticket_id,))

        result = cursor.fetchone()

        cursor.close()
        conn.close()

        return result is not None