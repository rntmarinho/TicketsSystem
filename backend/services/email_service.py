import os
import re
import time
import uuid
import string
import secrets
import logging
import smtplib
import bcrypt
from imap_tools import MailBox, AND
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import make_msgid, parseaddr
from werkzeug.utils import secure_filename
from database.connect_database import get_db_connection
from tickets.ticket_model import TicketModel
from tickets.messages.message_model import MessageModel
from tickets.anexos.anexo_model import AnexoModel
from tickets.anexos.anexo_controller import EXTENSOES_PERMITIDAS, TAMANHO_MAXIMO, anexos_dir
from users.user_model import UserModel

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

        # Message-ID próprio + threading: se o chamado já tem uma âncora de
        # e-mail (primeiro e-mail da thread, seja de entrada ou de saída),
        # referencia ela pra manter a conversa agrupada no cliente de e-mail
        # do solicitante, além do tag [Chamado #N] no assunto (fallback já
        # existente caso o cliente de e-mail não preserve os cabeçalhos).
        novo_message_id = make_msgid()
        msg["Message-ID"] = novo_message_id

        anchor = ticket.get("email_message_id")
        if anchor:
            msg["In-Reply-To"] = anchor
            msg["References"] = anchor

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

        # Só grava se o chamado ainda não tiver âncora (ex: chamado aberto pela
        # tela, sem e-mail de origem) — não sobrescreve a âncora de um chamado
        # que já nasceu por e-mail.
        TicketModel.set_email_message_id(ticket["id"], novo_message_id)

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
                # Cada e-mail é processado isoladamente — um e-mail malformado
                # não pode impedir os demais da mesma leva de serem processados.
                try:
                    logging.info(f"Novo e-mail: {msg.subject}")

                    raw_from = _header(msg, "from") or msg.from_
                    display_name, email_addr = parseaddr(raw_from)
                    email_addr = (email_addr or msg.from_ or "").strip().lower()

                    if not email_addr:
                        logging.warning("E-mail recebido sem remetente identificável — ignorado.")
                        continue

                    user_id = get_or_create_user_by_email(email_addr, display_name)

                    # 1ª tentativa: casar pelo Message-ID (In-Reply-To/References)
                    # da própria thread — robusto mesmo se o assunto for alterado.
                    # 2ª tentativa (fallback): tag [Chamado #N] no assunto.
                    ticket_id = resolve_ticket_id(msg)

                    if ticket_id:
                        process_reply_email(msg, ticket_id, user_id)
                    else:
                        process_new_ticket_email(msg, user_id)

                except Exception as e:
                    logging.error(f"Falha ao processar e-mail '{msg.subject}': {e}")

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
        subject or "",
        re.IGNORECASE
    )

    if match:
        return int(match.group(1))

    return None


def _header(msg, name):
    """Lê um cabeçalho cru do e-mail (imap_tools guarda como tupla de strings)."""
    values = msg.headers.get(name)
    return values[0].strip() if values else None


def resolve_ticket_id(msg):
    """
    Tenta casar o e-mail recebido com um chamado existente:
    1. Message-ID citado em In-Reply-To ou em qualquer entrada de References
       (mais robusto — sobrevive a assunto alterado/traduzido).
    2. Fallback: tag [Chamado #N] no assunto (comportamento original).
    """
    candidatos = []

    in_reply_to = _header(msg, "in-reply-to")
    if in_reply_to:
        candidatos.append(in_reply_to)

    references = _header(msg, "references")
    if references:
        candidatos.extend([r.strip() for r in references.split() if r.strip()])

    for message_id in candidatos:
        ticket_id = TicketModel.get_by_email_message_id(message_id)
        if ticket_id:
            return ticket_id

    return extract_ticket_number(msg.subject)


def _default_client_id():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM tbl_clients WHERE cnpj = %s", ("00000000000000",))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row[0] if row else None


def _default_project_id():
    """Garante a existência do projeto 'Chamados Suporte' — todo chamado
    aberto automaticamente por e-mail entra nele, pra não ficar solto sem
    projeto (diferente de chamado aberto pela tela, que fica sem projeto
    por padrão, a menos que o usuário escolha um)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM tbl_projects WHERE name = %s", ("Chamados Suporte",))
    row = cursor.fetchone()

    if row:
        project_id = row[0]
    else:
        cursor.execute("""
            INSERT INTO tbl_projects (name, description)
            VALUES (%s, %s)
            RETURNING id
        """, ("Chamados Suporte", "Chamados abertos automaticamente por e-mail."))
        project_id = cursor.fetchone()[0]
        conn.commit()

    cursor.close()
    conn.close()

    return project_id


def get_or_create_user_by_email(email_addr, display_name=None):
    """
    Busca o usuário pelo e-mail do remetente; se não existir (remetente
    externo desconhecido), cria automaticamente como 'client' — antes,
    remetentes desconhecidos eram atribuídos ao usuário admin (id 1), o que
    misturava chamados de pessoas diferentes num único solicitante.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM tbl_users WHERE email = %s", (email_addr,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if row:
        return row[0]

    senha_aleatoria = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
    password_hash = bcrypt.hashpw(senha_aleatoria.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    user_id = UserModel.create({
        "name": display_name or email_addr,
        "email": email_addr,
        "client_id": _default_client_id(),
        "password": password_hash,
        "access_type": "client"
    })

    logging.info(f"Usuário criado automaticamente pra remetente desconhecido: {email_addr}")

    return user_id


def salvar_anexos_email(ticket_id, msg, usuario_id):
    """Persiste os anexos de um e-mail recebido na mesma pasta/tabela usada
    pelo upload manual de anexos (mesmas regras de extensão/tamanho)."""
    anexos = getattr(msg, "attachments", None)
    if not anexos:
        return

    pasta = anexos_dir()
    os.makedirs(pasta, exist_ok=True)

    for att in anexos:
        try:
            nome_original = att.filename or "anexo"
            ext = nome_original.rsplit(".", 1)[1].lower() if "." in nome_original else ""

            if ext not in EXTENSOES_PERMITIDAS:
                logging.warning(f"Anexo de e-mail ignorado (extensão não permitida): {nome_original}")
                continue

            payload = att.payload
            if not payload or len(payload) > TAMANHO_MAXIMO:
                logging.warning(f"Anexo de e-mail ignorado (vazio ou excede 10MB): {nome_original}")
                continue

            nome_arquivo = f"{uuid.uuid4().hex}.{ext}"
            caminho_fisico = os.path.join(pasta, nome_arquivo)

            with open(caminho_fisico, "wb") as f:
                f.write(payload)

            AnexoModel.create({
                "ticket_id": ticket_id,
                "nome_original": secure_filename(nome_original),
                "nome_arquivo": nome_arquivo,
                "caminho_arquivo": f"/anexos/{nome_arquivo}",
                "tipo_mime": att.content_type or "application/octet-stream",
                "tamanho_bytes": len(payload),
                "usuario_upload": usuario_id
            })

        except Exception as e:
            logging.error(f"Erro ao salvar anexo de e-mail '{getattr(att, 'filename', '?')}': {e}")


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

    salvar_anexos_email(ticket_id, msg, user_id)

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
        "priority_id": 1,
        "description": msg.text or msg.html or "",
        "project_id":  _default_project_id()
    }

    ticket_id = TicketModel.create(ticket_data)

    # Âncora da thread: o Message-ID do próprio e-mail que abriu o chamado.
    # Toda resposta subsequente (mesmo se o assunto for editado) casa por
    # In-Reply-To/References contra esse valor.
    TicketModel.set_email_message_id(ticket_id, _header(msg, "message-id"))

    body = msg.text or msg.html or ""

    MessageModel.create({
        "ticket_id": ticket_id,
        "message":   body,
        "sender": user_id,
        "private":   False
    })

    salvar_anexos_email(ticket_id, msg, user_id)

    logging.info(f"Ticket #{ticket_id} criado.")
