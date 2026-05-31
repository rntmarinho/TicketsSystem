import os
import time
import logging
import smtplib
from dotenv import load_dotenv
from imap_tools import MailBox, AND
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from database.connect_database import get_db_connection
from tickets.ticket_model import TicketModel
import re
from tickets.messages.message_model import MessageModel
from tickets.ticket_model import TicketModel

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

def send_email_notification(ticket, autor, conteudo):

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("EMAIL_USER")
    smtp_pass = os.getenv("EMAIL_PASSWORD")

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
        msg["To"] = destinatario

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

        with smtplib.SMTP(
            smtp_host,
            smtp_port
        ) as server:

            server.starttls()

            server.login(
                smtp_user,
                smtp_pass
            )

            server.sendmail(
                smtp_user,
                destinatario,
                msg.as_string()
            )

        logging.info(
            f"E-mail enviado para {destinatario}"
        )

    except Exception as e:

        logging.error(
            f"Erro ao enviar e-mail: {e}"
        )

def processar_emails_imap():

    host = os.getenv("EMAIL_HOST")
    port = int(os.getenv("EMAIL_PORT", 993))
    user = os.getenv("EMAIL_USER")
    password = os.getenv("EMAIL_PASSWORD")

    try:

        logging.info(
            f"Conectando ao IMAP {host}"
        )

        with MailBox(
            host,
            port=port
        ).login(
            user,
            password,
            initial_folder="INBOX"
        ) as mailbox:

            mensagens = mailbox.fetch(
                AND(seen=False),
                mark_seen=True
            )

            for msg in mensagens:

                logging.info(
                    f"Novo e-mail: {msg.subject}"
                )

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

                user_id = (
                    usuario[0]
                    if usuario
                    else 1
                )

                ticket_data = {
                    "subject": msg.subject,
                    "category_id": 1,
                    "user_id": user_id,
                    "priority_id": 2,
                    "status": "open",
                    "sla": None
                }

                ticket_id = TicketModel.create(
                    ticket_data
                )

                logging.info(
                    f"Chamado #{ticket_id} criado."
                )

    except Exception as e:

        logging.error(
            f"Erro no processamento IMAP: {e}"
        )

def iniciar_daemon_email():

    intervalo = int(
        os.getenv(
            "EMAIL_CHECK_INTERVAL",
            100
        )
    )

    logging.info(
        "Daemon de e-mail iniciado."
    )

    while True:

        try:

            processar_emails_imap()

        except Exception as e:

            logging.error(
                f"Falha no daemon: {e}"
            )

        time.sleep(intervalo)

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

        logging.warning(
            f"Ticket #{ticket_id} não encontrado."
        )

        return

    body = msg.text or msg.html or ""

    MessageModel.create({
        "ticket_id": ticket_id,
        "message": body,
        "signature": user_id,
        "private": False
    })

    logging.info(
        f"Mensagem adicionada ao ticket #{ticket_id}"
    )

def process_new_ticket_email(msg, user_id):

    ticket_data = {
        "subject": msg.subject,
        "category_id": 1,
        "user_id": user_id,
        "priority_id": 2
    }

    ticket_id = TicketModel.create(
        ticket_data
    )

    body = msg.text or msg.html or ""

    MessageModel.create({
        "ticket_id": ticket_id,
        "message": body,
        "signature": user_id,
        "private": False
    })

    logging.info(
        f"Ticket #{ticket_id} criado."
    )