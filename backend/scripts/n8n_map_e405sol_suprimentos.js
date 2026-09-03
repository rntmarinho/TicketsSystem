// Code node (n8n): transforma as linhas da E405SOL (+ E099USU e E044CCU) no
// payload de POST /gestao/suprimentos/sync do TicketsSystem (módulo Suprimentos).
// Mapeamento validado em 03/09/2026 contra a linha 2580 importada por planilha.
const sol = $('Agrupar E405SOL').first().json.rows || [];
const usuarios = {};
for (const u of ($('Agrupar Usuarios').first().json.rows || [])) usuarios[String(u.CODUSU)] = u.NOMUSU;
const ccus = {};
for (const c of ($('Agrupar Centros de Custo').first().json.rows || [])) ccus[String(c.CODCCU).trim()] = c.DESCCU;

const num = (v) => { if (v === undefined || v === null) return 0; const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const txt = (v) => { if (v === undefined || v === null) return null; const t = String(v).trim(); return t === '' ? null : t; };
const dec = (v) => { const t = txt(v); return t === null ? null : t; }; // backend faz parse_numeric ('9,1492' ok)
const dat = (v) => { const t = txt(v); if (!t || t === '31/12/1900' || t === '00/00/0000') return null; const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const codOuVazio = (v) => { const t = txt(v); return t === null || t === '0' ? null : t; };
const nomeUsu = (cod) => { const t = codOuVazio(cod); return t ? (usuarios[t] || null) : null; };

const rows = sol.map((r) => {
  const qtdSol = num(r.QTDSOL), qtdCan = num(r.QTDCAN);
  const numCot = num(r.NUMCOT), numPct = num(r.NUMPCT), numPed = num(r.NUMPED);
  const cancelTotal = qtdSol > 0 && qtdCan >= qtdSol;
  const cancelParcial = qtdCan > 0 && !cancelTotal;
  let situacao;
  if (cancelTotal) situacao = 'Cancelada';
  else if (numPed > 0) situacao = 'Gerou OC';
  else if (numCot > 0) situacao = 'Cotada';
  else if (numPct > 0) situacao = 'Em Processo de Cotação';
  else situacao = 'Não Cotada';
  if (cancelParcial && !cancelTotal) situacao += ' (cancelada parcialmente)';
  const naoCotadaAtiva = !cancelTotal && numCot === 0 && numPct === 0;

  return {
    transacao: txt(r.CODTNS),
    produto: txt(r.CODPRO),
    derivacao: txt(r.CODDER),
    familia: txt(r.CODFAM),
    um: txt(r.UNIMED),
    descricao_complementar_produto: txt(r.CPLPRO),
    centro_custo: txt(r.CCURES),
    descricao_centro_custo: ccus[String(r.CCURES || '').trim()] || null,
    requisicao: codOuVazio(r.NUMEME) || '0',
    seq_requisicao: txt(r.SEQEME),
    solicitacao: txt(r.NUMSOL),
    seq_solicitacao: txt(r.SEQSOL),
    cotacao: txt(r.NUMCOT) || '0',
    situacao,
    qtde_solicitada: dec(r.QTDSOL),
    preco_sol: dec(r.PRESOL),
    qtde_aprovada: dec(r.QTDAPR),
    qtde_cancelada: dec(r.QTDCAN),
    previsao: dat(r.DATPRV),
    deposito: txt(r.CODDEP),
    filial_pedido: txt(r.FILPED),
    data_solicitacao: dat(r.DATSOL),
    pedido: txt(r.NUMPED) || '0',
    seq_pedido: txt(r.SEQIPD),
    filial_sol: txt(r.FILSOL),
    prioridade_compra: txt(r.CODPRI),
    interno: txt(r.SOLINT) || 'N',
    obs_solicitacao: txt(r.OBSSOL),
    procedencia: num(r.NUMEME) > 0 ? 'Requisição' : 'Manual/Reposição',
    usuario_aplicacao: codOuVazio(r.USURES),
    nome_usuario_aplicacao: nomeUsu(r.USURES),
    cta_financeira: txt(r.CTAFIN),
    cta_contabil: txt(r.CTARED),
    data_limite_compra: dat(r.DATLIC),
    data_envio: dat(r.DATEFC),
    processo_cotacao: txt(r.NUMPCT) || '0',
    aprovacao_solicitante: txt(r.INDAPS),
    aprovada_pelo_solicitante: txt(r.APRSOL),
    cod_bem_principal: txt(r.CODBEM),
    cliente: txt(r.CODCLI),
    usuario_cancelamento: codOuVazio(r.USUCAN),
    data_cancelamento: dat(r.DATCAN),
    hora_cancelamento: codOuVazio(r.HORCAN),
    descricao_tipo_compra: txt(r.TIPCPR) === 'D' ? 'Compra Direta' : txt(r.TIPCPR),
    modalidade: txt(r.CODMOD),
    usuario_comprador: txt(r.USUCPR) || '0',
    nome_usuario_comprador: nomeUsu(r.USUCPR),
    seq_end_entrega: txt(r.SEQENT),
    usuario_solicitante: codOuVazio(r.USUSOL),
    nome_usuario_solicitante: nomeUsu(r.USUSOL),
    usuario_geracao: codOuVazio(r.CODUSU),
    nome_usuario_geracao: nomeUsu(r.CODUSU),
    // flags pro backend decidir inserção/status automático
    erp_cancelada: cancelTotal,
    erp_comprada: numPed > 0,
    erp_nao_cotada_ativa: naoCotadaAtiva,
  };
});

// Lotes de 400 linhas por POST (≈300 KB cada) — o HTTP Request roda uma vez por item.
const LOTE = 400;
const total = rows.length, naoCotadasAtivas = rows.filter((r) => r.erp_nao_cotada_ativa).length;
const itens = [];
for (let i = 0; i < rows.length; i += LOTE) {
  itens.push({ json: { rows: rows.slice(i, i + LOTE), lote: Math.floor(i / LOTE) + 1, lotes: Math.ceil(rows.length / LOTE), total, nao_cotadas_ativas: naoCotadasAtivas } });
}
return itens.length ? itens : [{ json: { rows: [], lote: 0, lotes: 0, total: 0, nao_cotadas_ativas: 0 } }];
