from datetime import date
from database.gestao_db import SessionLocal
from gestao.models.suprimentos_models import SUPRIMENTOS_STATUSES, SUPRIMENTOS_STATUS_LABELS, PLANILHA_COLUNAS
from gestao.models.legacy import LegacyUser
from gestao.suprimentos import suprimentos_service


def _parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _build_summary(session, itens):
    total = len(itens)
    por_status = {s: 0 for s in SUPRIMENTOS_STATUSES}
    por_comprador = {}
    por_centro_custo = {}
    valor_total = 0

    comprador_ids = {i.comprador_id for i in itens if i.comprador_id}
    nomes_comprador = {}
    if comprador_ids:
        for u in session.query(LegacyUser).filter(LegacyUser.id.in_(comprador_ids)).all():
            nomes_comprador[u.id] = u.name

    for item in itens:
        por_status[item.status] = por_status.get(item.status, 0) + 1

        nome_comprador = nomes_comprador.get(item.comprador_id, "Sem comprador definido")
        por_comprador[nome_comprador] = por_comprador.get(nome_comprador, 0) + 1

        centro = item.descricao_centro_custo or item.centro_custo or "Sem centro de custo"
        por_centro_custo[centro] = por_centro_custo.get(centro, 0) + 1

        if item.preco_sol and item.qtde_solicitada:
            valor_total += float(item.preco_sol) * float(item.qtde_solicitada)

    # Linhas detalhadas — mesma visão da tela de trabalho (GestaoSuprimentos),
    # mas sem restrição de dono/comprador (relatório gerencial, ver
    # list_all_for_report). Reaproveita serialize_item, mesma serialização
    # usada pela tela e pela exportação .xlsx.
    itens_detalhados = [suprimentos_service.serialize_item(session, i) for i in itens]

    return {
        "total": total,
        "valor_total": round(valor_total, 2),
        "por_status": [
            {"status": s, "label": SUPRIMENTOS_STATUS_LABELS[s], "qtd": por_status[s]}
            for s in SUPRIMENTOS_STATUSES
        ],
        "por_comprador": sorted(
            [{"nome": k, "qtd": v} for k, v in por_comprador.items()], key=lambda x: -x["qtd"]
        ),
        # Top 15 pro gráfico de barras — não é a fonte do filtro (ver
        # centros_custo_disponiveis, que traz todos, sem corte).
        "por_centro_custo": sorted(
            [{"nome": k, "qtd": v} for k, v in por_centro_custo.items()], key=lambda x: -x["qtd"]
        )[:15],
        "centros_custo_disponiveis": sorted(por_centro_custo.keys()),
        "itens": itens_detalhados,
    }


class SuprimentosReportController:

    @staticmethod
    def get_summary(inicio_str, fim_str, centro_custo=None):
        inicio, fim = _parse_date(inicio_str), _parse_date(fim_str)
        session = SessionLocal()
        try:
            itens = suprimentos_service.list_all_for_report(session, inicio, fim, centro_custo)
            payload = _build_summary(session, itens)
            if centro_custo:
                # Sem o filtro de centro de custo aplicado, senão o dropdown
                # "encolhe" pra só a opção já escolhida depois de filtrar.
                todos = suprimentos_service.list_all_for_report(session, inicio, fim)
                payload["centros_custo_disponiveis"] = sorted({
                    (i.descricao_centro_custo or i.centro_custo or "Sem centro de custo") for i in todos
                })
            return payload, 200
        finally:
            session.close()

    @staticmethod
    def build_export_rows(inicio_str, fim_str, centro_custo=None):
        """Retorna (linhas_serializadas, colunas_ordenadas, rotulos) pra
        reports/report_routes.py montar o .xlsx — reaproveita serialize_item
        (mesmas colunas da planilha do ERP + campos de acompanhamento) já
        usado pela tela de trabalho."""
        inicio, fim = _parse_date(inicio_str), _parse_date(fim_str)
        session = SessionLocal()
        try:
            itens = suprimentos_service.list_all_for_report(session, inicio, fim, centro_custo)
            linhas = [suprimentos_service.serialize_item(session, i) for i in itens]
            colunas_planilha = list(PLANILHA_COLUNAS.values())
            colunas_acompanhamento = [
                "prazo", "status", "status_descricao", "justificativa", "transporte", "status_pedido", "comprador",
            ]
            rotulos = {atributo: label for label, atributo in PLANILHA_COLUNAS.items()}
            rotulos.update({
                "prazo": "Prazo", "status": "Status", "status_descricao": "Descrição do Status",
                "justificativa": "Justificativa", "transporte": "Transporte",
                "status_pedido": "Status da Ordem de Compra", "comprador": "Comprador",
            })
            colunas = colunas_planilha + colunas_acompanhamento
            return linhas, colunas, rotulos
        finally:
            session.close()
