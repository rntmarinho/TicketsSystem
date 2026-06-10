import os
import time
import logging
import smtplib
from imap_tools import MailBox, AND
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from database.connect_database import get_db_connection
from tickets.ticket_model import TicketModel
import re
from tickets.messages.message_model import MessageModel
from tickets.ticket_model import TicketModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# ─── Busca as configurações de e-mail da base de dados ───────────────────────

def get_email_settings():
    """
    Retorna um dicionário com as configurações de e-mail
    armazenadas em tbl_user_settings.
    Lança RuntimeError se nenhuma configuração for encontrada.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT email_user, email_password,
                   smtp_host, smtp_port,
                   imap_host, imap_port,
                   check_interval
            FROM tbl_user_settings
            LIMIT 1
        """)

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            raise RuntimeError(
                "Nenhuma configuração de e-mail encontrada em tbl_user_settings."
            )

        return {
            "email_user":      row[0],
            "email_password":  row[1],
            "smtp_host":       row[2],
            "smtp_port":       int(row[3]) if row[3] else 587,
            "imap_host":       row[4],
            "imap_port":       int(row[5]) if row[5] else 993,
            "check_interval":  int(row[6]) if row[6] else 100,
        }

    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"Erro ao carregar configurações de e-mail: {e}")


# ─── Envio de notificação por e-mail ─────────────────────────────────────────

def send_email_notification(ticket, autor, conteudo):

    try:
        cfg = get_email_settings()
    except RuntimeError as e:
        logging.warning(str(e))
        return

    smtp_host = cfg["smtp_host"]
    smtp_port = cfg["smtp_port"]
    smtp_user = cfg["email_user"]
    smtp_pass = cfg["email_password"]

    if not smtp_user or not smtp_pass:
        logging.warning("SMTP não configurado.")
        return

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT email
            FROM tbl_users
            WHERE id = %s
        """, (ticket["user_id"],))

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            return

        destinatario = row[0]

        msg = MIMEMultipart("alternative")
        msg["Subject"] = (
            f"[Chamado #{ticket['id']}] "
            f"{ticket['subject']}"
        )
        msg["From"] = smtp_user
        msg["To"]   = destinatario

        texto = f"""
Chamado: #{ticket['id']}
Assunto: {ticket['subject']}

Autor:
{autor}

Mensagem:
{conteudo}
"""

        html = f"""
        <html>
        <body>
            <h2>Chamado #{ticket['id']}</h2>

            <p>
                <strong>Assunto:</strong>
                {ticket['subject']}
            </p>

            <hr>

            <p>
                <strong>Autor:</strong>
                {autor}
            </p>

            <div style="
                background:#f5f5f5;
                padding:15px;
                border-radius:5px;">
                {conteudo}
            </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(texto, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, destinatario, msg.as_string())

        logging.info(f"E-mail enviado para {destinatario}")

    except Exception as e:
        logging.error(f"Erro ao enviar e-mail: {e}")


# ─── Processamento IMAP ───────────────────────────────────────────────────────

def processar_emails_imap():

    try:
        cfg = get_email_settings()
    except RuntimeError as e:
        logging.error(str(e))
        return

    host     = cfg["imap_host"]
    port     = cfg["imap_port"]
    user     = cfg["email_user"]
    password = cfg["email_password"]

    try:
        logging.info(f"Conectando ao IMAP {host}")

        with MailBox(host, port=port).login(
            user, password, initial_folder="INBOX"
        ) as mailbox:

            mensagens = mailbox.fetch(AND(seen=False), mark_seen=True)

            for msg in mensagens:
                logging.info(f"Novo e-mail: {msg.subject}")

                conn = get_db_connection()
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT id
                    FROM tbl_users
                    WHERE email = %s
                """, (msg.from_,))

                usuario = cursor.fetchone()
                cursor.close()
                conn.close()

                user_id = usuario[0] if usuario else 1

                # Se o assunto contiver [Chamado #N], é uma resposta — adiciona
                # como mensagem no chamado existente; caso contrário, abre novo.
                ticket_id = extract_ticket_number(msg.subject)

                if ticket_id:
                    process_reply_email(msg, ticket_id, user_id)
                else:
                    process_new_ticket_email(msg, user_id)

    except Exception as e:
        logging.error(f"Erro no processamento IMAP: {e}")


# ─── Daemon principal ─────────────────────────────────────────────────────────

def iniciar_daemon_email():

    logging.info("Daemon de e-mail iniciado.")

    while True:
        try:
            # Intervalo relido a cada ciclo para reflectir alterações em tempo real
            cfg      = get_email_settings()
            intervalo = cfg["check_interval"]
        except RuntimeError as e:
            logging.error(str(e))
            intervalo = 100

        try:
            processar_emails_imap()
        except Exception as e:
            logging.error(f"Falha no daemon: {e}")

        time.sleep(intervalo)


# ─── Utilitários ──────────────────────────────────────────────────────────────

def extract_ticket_number(subject):

    match = re.search(
        r"\[Chamado\s*#(\d+)\]",
        subject,
        re.IGNORECASE
    )

    if match:
        return int(match.group(1))

    return None


def process_reply_email(msg, ticket_id, user_id):

    if not TicketModel.exists(ticket_id):
        logging.warning(f"Ticket #{ticket_id} não encontrado.")
        return

    body = msg.text or msg.html or ""

    MessageModel.create({
        "ticket_id": ticket_id,
        "message":   body,
        "sender": user_id,
        "private":   False
    })

    logging.info(f"Mensagem adicionada ao ticket #{ticket_id}")


def send_password_reset_email(destinatario, nome, nova_senha):
    """
    Envia a nova senha gerada automaticamente para o usuário.
    """
    try:
        cfg = get_email_settings()
    except RuntimeError as e:
        logging.warning(str(e))
        return

    smtp_host = cfg["smtp_host"]
    smtp_port = cfg["smtp_port"]
    smtp_user = cfg["email_user"]
    smtp_pass = cfg["email_password"]

    if not smtp_user or not smtp_pass:
        logging.warning("SMTP não configurado.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Redefinição de Senha — Sistema de Chamados"
        msg["From"] = smtp_user
        msg["To"] = destinatario

        texto = f"""
Olá, {nome}!

Sua senha foi redefinida com sucesso.

Nova senha: {nova_senha}

Recomendamos que você altere essa senha após o primeiro acesso, acessando seu perfil no sistema.

Caso não tenha solicitado a redefinição, entre em contato com o suporte imediatamente.
"""

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>Redefinição de Senha</h2>
            <p>Olá, <strong>{nome}</strong>!</p>
            <p>Sua senha foi redefinida com sucesso.</p>
            <div style="background:#f5f5f5; padding:15px; border-radius:8px; margin:20px 0; display:inline-block;">
                <strong>Nova senha:</strong>
                <span style="font-size:1.2rem; letter-spacing:2px; margin-left:10px;">{nova_senha}</span>
            </div>
            <p>Recomendamos que você altere essa senha após o primeiro acesso, acessando seu perfil no sistema.</p>
            <p style="color:#999; font-size:0.85rem;">Caso não tenha solicitado a redefinição, entre em contato com o suporte imediatamente.</p>
        </body>
        </html>
        """

        msg.attach(MIMEText(texto, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, destinatario, msg.as_string())

        logging.info(f"E-mail de redefinição de senha enviado para {destinatario}")

    except Exception as e:
        logging.error(f"Erro ao enviar e-mail de redefinição: {e}")


def process_new_ticket_email(msg, user_id):

    ticket_data = {
        "subject":     msg.subject,
        "category_id": 1,
        "user_id":     user_id,
        "priority_id": 3,    
        "description": msg.text or msg.html or ""
    }

    ticket_id = TicketModel.create(ticket_data)

    body = msg.text or msg.html or ""

    MessageModel.create({
        "ticket_id": ticket_id,
        "message":   body,
        "sender": user_id,
        "private":   False
    })

    logging.info(f"Ticket #{ticket_id} criado.")