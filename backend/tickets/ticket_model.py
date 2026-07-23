from datetime import datetime, timedelta
from database.connect_database import get_db_connection

class TicketModel:
#Processo de criação de chamados com cálculo de SLA baseado na prioridade,
#incluindo tratamento de casos onde a prioridade não possui SLA definido.
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
        # Implementação de atribuição segura com fallback para 0 horas caso o SLA não esteja definido
        
        cursor.close()
        conn.close()

        return result[0] if result else None
    
#Metodo de criação de chamados que integra a recuperação do SLA, o cálculo do prazo final e a persistência do registro, garantindo a consistência temporal e a robustez frente a dados incompletos.
    @staticmethod
    def create(data):
        """
        Busca a métrica de SLA atrelada à prioridade requisitada, realiza o
        cômputo do prazo final e persiste o chamado no banco de dados.
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        #  Recuperação do quantitativo de horas estipulado para a prioridade
        cursor.execute("""
            SELECT sla 
            FROM tbl_priorities 
            WHERE id = %s
        """, (data["priority_id"],))
        
        resultado = cursor.fetchone()
        
        # Atribuição segura com conversão padrão para 0 caso não localizado
        sla_horas = resultado[0] if (resultado and resultado[0] is not None) else 0

        # Processamento temporal: estampa de tempo (timestamp) unificada
        data_criacao = datetime.now()
        prazo_sla = data_criacao + timedelta(hours=float(sla_horas))

        # Data de início: chamado usa a própria criação; tarefa de projeto
        # pode informar um início planejado diferente.
        start_date = data.get("start_date") or data_criacao

        #Inserção do registro contemplando as matrizes de data recém-calculadas
        cursor.execute("""
            INSERT INTO tbl_tickets (
                subject,
                category_id,
                user_id,
                priority_id,
                status,
                creation,
                sla,
                project_id,
                type,
                start_date,
                description
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data["subject"],
            data["category_id"],
            data["user_id"],
            data["priority_id"],
            "open",
            data_criacao,
            prazo_sla,
            data.get("project_id"),
            data.get("type", "chamado"),
            start_date,
            data.get("description")
        ))

        ticket_id = cursor.fetchone()[0]

        conn.commit()

        cursor.close()
        conn.close()

        return ticket_id

    #Método de consulta que integra a recuperação de dados do chamado com as informações correlatas de categoria, prioridade e usuário, proporcionando uma visão abrangente e contextualizada do registro.
    @staticmethod
    def get_by_id(ticket_id):
        conn = get_db_connection()
        cursor = conn.cursor()

        #Consulta que une as tabelas de tickets, categorias, prioridades e usuários para fornecer uma visão completa do chamado solicitado.
        cursor.execute("""
            SELECT
                t.id,
                t.subject,
                t.status,
                t.creation,
                t.sla,
                c.name,
                p.name,
                u.name,
                t.user_id,
                t.assigned_to,
                a.name,
                t.email_message_id,
                t.project_id,
                pr.name,
                t.type,
                t.start_date,
                t.close_time,
                t.description
            FROM tbl_tickets t
            LEFT JOIN tbl_categories c
                ON c.id = t.category_id
            LEFT JOIN tbl_priorities p
                ON p.id = t.priority_id
            LEFT JOIN tbl_users u
                ON u.id = t.user_id
            LEFT JOIN tbl_users a
                ON a.id = t.assigned_to
            LEFT JOIN tbl_projects pr
                ON pr.id = t.project_id
            WHERE t.id = %s
        """, (ticket_id,))
        #Atribuição direta do resultado da consulta, garantindo a integridade dos dados retornados e a clareza na manipulação do objeto ticket.
        ticket = cursor.fetchone()

        cursor.close()
        conn.close()

        return ticket

    #Método de consulta que recupera a lista completa de chamados, ordenada por data de criação, e enriquecida com as informações correlatas de categoria, prioridade e usuário, proporcionando uma visão abrangente e contextualizada dos registros.
    @staticmethod
    def get_all(owner_id=None, project_id=None):
        """
        owner_id: quando informado, restringe o resultado aos chamados abertos
        por esse usuário (usado para isolar o papel 'client' aos próprios chamados).
        project_id: quando informado, restringe aos itens vinculados a esse projeto
        (usado pelo Kanban ao filtrar por projeto).
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        base_query = """
            SELECT
                t.id,
                t.subject,
                t.status,
                t.creation,
                t.sla,
                c.name,
                p.name,
                u.name,
                t.user_id,
                t.assigned_to,
                a.name,
                t.project_id,
                pr.name,
                t.type,
                t.start_date,
                t.close_time,
                lm.last_message_at,
                lm.last_message_is_client
            FROM tbl_tickets t
            LEFT JOIN tbl_categories c
                ON c.id = t.category_id
            LEFT JOIN tbl_priorities p
                ON p.id = t.priority_id
            LEFT JOIN tbl_users u
                ON u.id = t.user_id
            LEFT JOIN tbl_users a
                ON a.id = t.assigned_to
            LEFT JOIN tbl_projects pr
                ON pr.id = t.project_id
            LEFT JOIN LATERAL (
                SELECT
                    m.creation AS last_message_at,
                    (mu.access_type = 'client') AS last_message_is_client
                FROM tbl_messages m
                LEFT JOIN tbl_users mu ON mu.id = m.sender
                WHERE m.ticket_id = t.id AND m.private = FALSE
                ORDER BY m.creation DESC
                LIMIT 1
            ) lm ON TRUE
        """

        conditions = []
        params = []

        if owner_id is not None:
            conditions.append("t.user_id = %s")
            params.append(owner_id)

        if project_id is not None:
            conditions.append("t.project_id = %s")
            params.append(project_id)

        if conditions:
            base_query += " WHERE " + " AND ".join(conditions)

        base_query += " ORDER BY t.creation DESC"

        cursor.execute(base_query, tuple(params))

        tickets = cursor.fetchall()

        cursor.close()
        conn.close()

        return tickets

    #Método de atualização que permite a modificação do status de um chamado específico, garantindo a persistência da alteração no banco de dados e a integridade do registro.
    @staticmethod
    def update_status(ticket_id, status):
        conn = get_db_connection()
        cursor = conn.cursor()

        # close_time só é preenchido quando o status vira 'closed'; mover o
        # card pra qualquer outra coluna (ex: reabrir) limpa a data de fechamento.
        close_time = datetime.now() if status == "closed" else None

        cursor.execute("""
            UPDATE tbl_tickets
            SET status = %s, close_time = %s
            WHERE id = %s
        """, (status, close_time, ticket_id))

        conn.commit()

        cursor.close()
        conn.close()

    @staticmethod
    def update_assignee(ticket_id, assigned_to):
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_tickets
            SET assigned_to = %s
            WHERE id = %s
        """, (assigned_to, ticket_id))

        conn.commit()

        cursor.close()
        conn.close()

    @staticmethod
    def update_dates(ticket_id, start_date=None, sla=None):
        """Edição manual de datas pela tela de detalhe (planejamento de
        tarefa de projeto) — só atualiza os campos informados."""
        conn = get_db_connection()
        cursor = conn.cursor()

        if start_date is not None:
            cursor.execute("""
                UPDATE tbl_tickets SET start_date = %s WHERE id = %s
            """, (start_date, ticket_id))

        if sla is not None:
            cursor.execute("""
                UPDATE tbl_tickets SET sla = %s WHERE id = %s
            """, (sla, ticket_id))

        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def update_general_fields(ticket_id, data):
        """Atualiza os campos gerais do chamado (assunto, categoria,
        prioridade, solicitante, projeto) editáveis pela tela de detalhe —
        só altera os campos de fato presentes no payload recebido."""
        colunas = ("subject", "description", "category_id", "priority_id", "user_id", "project_id")
        presentes = [c for c in colunas if c in data]

        if not presentes:
            return

        conn = get_db_connection()
        cursor = conn.cursor()

        set_clause = ", ".join(f"{c} = %s" for c in presentes)
        valores = [data[c] for c in presentes]
        valores.append(ticket_id)

        cursor.execute(
            f"UPDATE tbl_tickets SET {set_clause} WHERE id = %s",
            tuple(valores)
        )

        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def get_by_email_message_id(message_id):
        """Localiza o chamado cujo Message-ID âncora bate com o informado
        (usado pra casar In-Reply-To/References de um e-mail de resposta)."""
        if not message_id:
            return None

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id FROM tbl_tickets WHERE email_message_id = %s
        """, (message_id,))

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        return row[0] if row else None

    @staticmethod
    def set_email_message_id(ticket_id, message_id):
        """Grava o Message-ID âncora só se o chamado ainda não tiver um —
        garante que sempre aponte pro primeiro e-mail da thread."""
        if not message_id:
            return

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tbl_tickets
            SET email_message_id = %s
            WHERE id = %s AND email_message_id IS NULL
        """, (message_id, ticket_id))

        conn.commit()
        cursor.close()
        conn.close()

#Método de exclusão que remove um chamado específico do banco de dados, garantindo a integridade referencial e a consistência dos dados.
#Este método é necessário pois nem todo e-mail é um chamado válido
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
#Método de verificação que consulta a existência de um chamado específico no banco de dados, retornando um valor booleano que indica a presença ou ausência do registro.
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