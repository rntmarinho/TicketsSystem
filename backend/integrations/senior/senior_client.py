"""
Cliente SOAP mínimo pro webservice GetDBInfo da Senior (Sapiens G5) — executa
um SELECT parametrizado direto no Oracle do ERP, contornando a camada de
regra de negócio dos webservices "oficiais". Primeira integração deste tipo
neste backend: o módulo Suprimentos recebe dados via push do n8n (que fala
SOAP com a Senior por fora deste repositório); este cliente existe porque o
módulo Financeiro / Conferência de OC precisa buscar os dados ao vivo, sem
depender de um workflow n8n novo.

Não usa lib SOAP completa (zeep/suds): o envelope é fixo o suficiente pra
montar como string e parsear a resposta com xml.etree, evitando mais uma
dependência pesada pra uma única operação.

Ver knowledge doc do projeto Grupo Consominas antes de mexer na query: o
dialeto SQL da Senior não é Oracle puro (sem ROWNUM/TOP/DUAL, sem CASE em
GROUP BY fora de agregado, sem COUNT(DISTINCT), comparação de DATE com
literal não é confiável, campo numérico "vazio" vem como 0 e não NULL).
"""
import base64
import os
import xml.etree.ElementTree as ET

import requests

SOAP_ACTION = ""
REQUEST_TIMEOUT_SECONDS = 60


class SeniorClientError(Exception):
    """Erro de configuração, rede, ou resposta inesperada do GetDBInfo."""


def _config():
    user = os.getenv("SENIOR_WS_SAPIENS_USER", "")
    password = os.getenv("SENIOR_WS_SAPIENS_PASSWORD", "")
    url = os.getenv("SENIOR_SAPIENS_DB_URL", "")
    if not user or not password or not url:
        raise SeniorClientError(
            "Integração com o Senior não configurada "
            "(SENIOR_WS_SAPIENS_USER / SENIOR_WS_SAPIENS_PASSWORD / SENIOR_SAPIENS_DB_URL)."
        )
    return user, password, url


def _escape(value):
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _build_envelope(user, password, sql):
    return (
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
        'xmlns:ser="http://services.senior.com.br">'
        "<soapenv:Header/><soapenv:Body><ser:GetDBInfo>"
        f"<user>{_escape(user)}</user><password>{_escape(password)}</password><encryption>0</encryption>"
        f"<parameters><pmSQL>{_escape(sql)}</pmSQL><pmParams></pmParams></parameters>"
        "</ser:GetDBInfo></soapenv:Body></soapenv:Envelope>"
    ).encode("utf-8")


def _parse_lines_xml(xml_bytes):
    """<line><CAMPO>valor</CAMPO>...</line> repetido, dentro de algum elemento
    raiz não documentado -> lista de dicts (campo -> valor)."""
    root = ET.fromstring(xml_bytes)
    return [
        {child.tag: (child.text or "") for child in line_el}
        for line_el in root.iter("line")
    ]


def get_db_info(sql):
    """
    Executa `sql` (um SELECT completo, texto fixo) via GetDBInfo e devolve uma
    lista de dicts (nome da coluna -> valor, sempre string, como a Senior
    devolve).

    IMPORTANTE: `sql` deve ser sempre montado a partir de texto fixo do
    próprio código (nunca concatenar entrada de usuário aqui sem validar) —
    filtros vindos de tela (ex.: busca por número da OC) devem ser aplicados
    em Python sobre o resultado, não injetados direto na SQL.
    """
    user, password, url = _config()
    envelope = _build_envelope(user, password, sql)
    try:
        response = requests.post(
            url,
            data=envelope,
            headers={"Content-Type": "text/xml; charset=UTF-8", "SOAPAction": SOAP_ACTION},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise SeniorClientError(f"Falha de rede ao chamar o Senior: {exc}") from exc

    if response.status_code != 200:
        raise SeniorClientError(f"Senior retornou HTTP {response.status_code}.")

    try:
        envelope_resposta = ET.fromstring(response.content)
    except ET.ParseError as exc:
        raise SeniorClientError(f"Resposta do Senior não é XML válido: {exc}") from exc

    retorno_el = next(
        (el for el in envelope_resposta.iter() if el.tag.endswith("pmReturnGetDBInfo")), None
    )
    if retorno_el is None or not (retorno_el.text or "").strip():
        raise SeniorClientError(f"Resposta do Senior sem pmReturnGetDBInfo: {response.text[:500]}")

    try:
        xml_decodificado = base64.b64decode(retorno_el.text)
    except ValueError as exc:
        raise SeniorClientError(f"Não foi possível decodificar base64 da resposta: {exc}") from exc

    try:
        return _parse_lines_xml(xml_decodificado)
    except ET.ParseError as exc:
        raise SeniorClientError(f"XML decodificado da resposta é inválido: {exc}") from exc
