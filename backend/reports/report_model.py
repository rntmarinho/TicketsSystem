from datetime import datetime, timedelta
from database.connect_database import get_db_connection


STATUS_MAP = {
    'open':           'aberto',
    'aberto':         'aberto',
    'in_progress':    'em atendimento',
    'andamento':      'em atendimento',
    'em atendimento': 'em atendimento',
    'closed':         'fechado',
    'fechado':        'fechado',
}

STATUSES_ABERTO      = ('open', 'aberto')
STATUSES_ATENDIMENTO = ('in_progress', 'andamento', 'em atendimento')
STATUSES_FECHADO     = ('closed', 'fechado')


def _period_filter(periodo: str):
    """
    Retorna (sql_fragment, params).
    sql_fragment inclui AND inicial, pronto para concatenar.
    """
    dias = {'7d': 7, '30d': 30, '90d': 90}
    if periodo in dias:
        return "AND t.creation >= NOW() - INTERVAL '%s days'", (dias[periodo],)
    return "", ()


class ReportModel:

    @staticmethod
    def get_summary(periodo: str) -> dict:
        conn = get_db_connection()
        cursor = conn.cursor()
        period_sql, period_params = _period_filter(periodo)

        try:
            # ── 1. Totais gerais por status ──────────────────────────────────
            cursor.execute(f"""
                SELECT
                    COUNT(*)                                           AS total,
                    COUNT(*) FILTER (WHERE t.status IN %s)            AS abertos,
                    COUNT(*) FILTER (WHERE t.status IN %s)            AS atendimento,
                    COUNT(*) FILTER (WHERE t.status IN %s)            AS fechados
                FROM tbl_tickets t
                WHERE 1=1 {period_sql}
            """, (STATUSES_ABERTO, STATUSES_ATENDIMENTO, STATUSES_FECHADO) + period_params)

            row = cursor.fetchone()
            total      = int(row[0] or 0)
            abertos    = int(row[1] or 0)
            atendimento= int(row[2] or 0)
            fechados   = int(row[3] or 0)
            taxa_resolucao = round((fechados / total * 100), 1) if total > 0 else 0.0
            pendentes  = abertos + atendimento

            # ── 2. Prioridades dinâmicas (nome e cor do banco) ───────────────
            # Usa LEFT JOIN com filtro de período no JOIN para preservar
            # prioridades com zero chamados no período
            if period_params:
                cursor.execute("""
                    SELECT
                        p.name,
                        COALESCE(p.color, '#6366f1') AS color,
                        COUNT(t.id)                  AS qtd
                    FROM tbl_priorities p
                    LEFT JOIN tbl_tickets t
                        ON t.priority_id = p.id
                        AND t.creation >= NOW() - INTERVAL '%s days'
                    GROUP BY p.id, p.name, p.color
                    ORDER BY qtd DESC, p.id ASC
                """, period_params)
            else:
                cursor.execute("""
                    SELECT
                        p.name,
                        COALESCE(p.color, '#6366f1') AS color,
                        COUNT(t.id)                  AS qtd
                    FROM tbl_priorities p
                    LEFT JOIN tbl_tickets t ON t.priority_id = p.id
                    GROUP BY p.id, p.name, p.color
                    ORDER BY qtd DESC, p.id ASC
                """)

            prioridades = [
                {"nome": r[0], "color": r[1], "qtd": int(r[2])}
                for r in cursor.fetchall()
            ]

            # ── 3. Chamados por categoria ────────────────────────────────────
            cursor.execute(f"""
                SELECT
                    COALESCE(c.name, 'Sem Categoria') AS nome,
                    COUNT(*)                           AS qtd
                FROM tbl_tickets t
                LEFT JOIN tbl_categories c ON c.id = t.category_id
                WHERE 1=1 {period_sql}
                GROUP BY nome
                ORDER BY qtd DESC
            """, period_params)

            categorias = [
                {"nome": r[0], "qtd": int(r[1])}
                for r in cursor.fetchall()
            ]

            # ── 4. Chamados por solicitante ──────────────────────────────────
            cursor.execute(f"""
                SELECT
                    COALESCE(u.name, 'Desconhecido')               AS nome,
                    COUNT(*)                                        AS total,
                    COUNT(*) FILTER (WHERE t.status IN %s)         AS fechados
                FROM tbl_tickets t
                LEFT JOIN tbl_users u ON u.id = t.user_id
                WHERE 1=1 {period_sql}
                GROUP BY nome
                ORDER BY total DESC
            """, (STATUSES_FECHADO,) + period_params)

            usuarios = []
            for r in cursor.fetchall():
                nome, tot, fech = r[0], int(r[1]), int(r[2])
                taxa = round((fech / tot * 100)) if tot > 0 else 0
                usuarios.append({"nome": nome, "total": tot, "fechados": fech, "taxa": str(taxa)})

            # ── 5. Chamados por cliente ──────────────────────────────────────
            # Relacionamento: tbl_tickets → tbl_users.client_id → tbl_clients
            cursor.execute(f"""
                SELECT
                    COALESCE(cl.razao, 'Sem Cliente')              AS nome,
                    COALESCE(cl.cnpj,  '—')                        AS cnpj,
                    COUNT(*)                                        AS total,
                    COUNT(*) FILTER (WHERE t.status IN %s)         AS abertos,
                    COUNT(*) FILTER (WHERE t.status IN %s)         AS atendimento,
                    COUNT(*) FILTER (WHERE t.status IN %s)         AS fechados
                FROM tbl_tickets t
                LEFT JOIN tbl_users   u  ON u.id  = t.user_id
                LEFT JOIN tbl_clients cl ON cl.id = u.client_id
                WHERE 1=1 {period_sql}
                GROUP BY cl.id, cl.razao, cl.cnpj
                ORDER BY total DESC
            """, (STATUSES_ABERTO, STATUSES_ATENDIMENTO, STATUSES_FECHADO) + period_params)

            clientes = []
            for r in cursor.fetchall():
                nome, cnpj, tot = r[0], r[1], int(r[2])
                ab, at, fc = int(r[3]), int(r[4]), int(r[5])
                taxa = round((fc / tot * 100)) if tot > 0 else 0
                clientes.append({
                    "nome":       nome,
                    "cnpj":       cnpj,
                    "total":      tot,
                    "abertos":    ab,
                    "atendimento": at,
                    "fechados":   fc,
                    "taxa":       str(taxa),
                })

            # ── 6. Evolução diária — últimos 14 dias ─────────────────────────
            cursor.execute("""
                SELECT DATE(creation) AS dia, COUNT(*) AS count
                FROM tbl_tickets
                WHERE creation >= NOW() - INTERVAL '14 days'
                GROUP BY dia
                ORDER BY dia
            """)

            contagem_db = {str(r[0]): int(r[1]) for r in cursor.fetchall()}
            hoje = datetime.now().date()
            por_dia = []
            for i in range(13, -1, -1):
                d = hoje - timedelta(days=i)
                por_dia.append({"label": d.strftime('%d/%m'), "count": contagem_db.get(str(d), 0)})

            # ── 6b. Tempo médio de resolução (creation → close_time) ─────────
            # Só considera chamados/tarefas já fechados no período.
            cursor.execute(f"""
                SELECT AVG(EXTRACT(EPOCH FROM (t.close_time - t.creation))) / 3600.0
                FROM tbl_tickets t
                WHERE t.close_time IS NOT NULL {period_sql}
            """, period_params)
            row = cursor.fetchone()
            tempo_medio_geral = round(float(row[0]), 1) if row and row[0] is not None else None

            cursor.execute(f"""
                SELECT
                    COALESCE(c.name, 'Sem Categoria') AS nome,
                    AVG(EXTRACT(EPOCH FROM (t.close_time - t.creation))) / 3600.0 AS horas,
                    COUNT(*) AS qtd
                FROM tbl_tickets t
                LEFT JOIN tbl_categories c ON c.id = t.category_id
                WHERE t.close_time IS NOT NULL {period_sql}
                GROUP BY nome
                ORDER BY horas DESC
            """, period_params)
            tempo_medio_categoria = [
                {"nome": r[0], "horas": round(float(r[1]), 1), "qtd": int(r[2])}
                for r in cursor.fetchall()
            ]

            cursor.execute(f"""
                SELECT
                    COALESCE(p.name, '—') AS nome,
                    AVG(EXTRACT(EPOCH FROM (t.close_time - t.creation))) / 3600.0 AS horas,
                    COUNT(*) AS qtd
                FROM tbl_tickets t
                LEFT JOIN tbl_priorities p ON p.id = t.priority_id
                WHERE t.close_time IS NOT NULL {period_sql}
                GROUP BY nome
                ORDER BY horas DESC
            """, period_params)
            tempo_medio_prioridade = [
                {"nome": r[0], "horas": round(float(r[1]), 1), "qtd": int(r[2])}
                for r in cursor.fetchall()
            ]

            cursor.execute(f"""
                SELECT
                    COALESCE(pr.name, 'Sem Projeto') AS nome,
                    AVG(EXTRACT(EPOCH FROM (t.close_time - t.creation))) / 3600.0 AS horas,
                    COUNT(*) AS qtd
                FROM tbl_tickets t
                LEFT JOIN tbl_projects pr ON pr.id = t.project_id
                WHERE t.close_time IS NOT NULL {period_sql}
                GROUP BY nome
                ORDER BY horas DESC
            """, period_params)
            tempo_medio_projeto = [
                {"nome": r[0], "horas": round(float(r[1]), 1), "qtd": int(r[2])}
                for r in cursor.fetchall()
            ]

            # ── 7. Lista de chamados ─────────────────────────────────────────
            cursor.execute(f"""
                SELECT
                    t.id,
                    t.subject,
                    t.status,
                    t.creation,
                    COALESCE(c.name,  'Sem Categoria') AS categoria,
                    COALESCE(p.name,  '—')              AS prioridade,
                    COALESCE(u.name,  'Desconhecido')   AS solicitante,
                    COALESCE(cl.razao,'Sem Cliente')    AS cliente
                FROM tbl_tickets t
                LEFT JOIN tbl_categories c  ON c.id  = t.category_id
                LEFT JOIN tbl_priorities p  ON p.id  = t.priority_id
                LEFT JOIN tbl_users      u  ON u.id  = t.user_id
                LEFT JOIN tbl_clients    cl ON cl.id = u.client_id
                WHERE 1=1 {period_sql}
                ORDER BY t.creation DESC
            """, period_params)

            tickets = []
            for r in cursor.fetchall():
                raw_status = (r[2] or '').lower()
                tickets.append({
                    "id":          r[0],
                    "assunto":     r[1] or '—',
                    "status":      STATUS_MAP.get(raw_status, raw_status),
                    "data_criacao": r[3].isoformat() if r[3] else None,
                    "categoria":   r[4],
                    "prioridade":  r[5],
                    "solicitante": r[6],
                    "cliente":     r[7],
                })

            return {
                "total":          total,
                "abertos":        abertos,
                "atendimento":    atendimento,
                "fechados":       fechados,
                "taxa_resolucao": str(taxa_resolucao),
                "pendentes":      pendentes,
                "prioridades":    prioridades,
                "categorias":     categorias,
                "usuarios":       usuarios,
                "clientes":       clientes,
                "por_dia":        por_dia,
                "tickets":        tickets,
                "tempo_medio_geral_horas": tempo_medio_geral,
                "tempo_medio_categoria":   tempo_medio_categoria,
                "tempo_medio_prioridade":  tempo_medio_prioridade,
                "tempo_medio_projeto":     tempo_medio_projeto,
            }

        finally:
            cursor.close()
            conn.close()
