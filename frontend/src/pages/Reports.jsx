import { useEffect, useState, useRef } from 'react';
import {
  BarChart3, Users, Tag, AlertCircle, CheckCircle2,
  Clock, TrendingUp, Activity, Award, Zap, Filter,
  ChevronDown, Download, RefreshCw, ArrowUp, ArrowDown,
  FileText, FileSpreadsheet, X, Check, Circle, Building2, Timer
} from 'lucide-react';
import { apiFetch } from '../services/api';
import './styles/Reports.css';

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

const formatDateFilename = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const PERIODO_LABEL = {
  todos: 'Todo o período',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
};

const COR_CAT    = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16', '#f43f5e'];
const COR_PRIO   = { alta: '#ef4444', media: '#f59e0b', baixa: '#22c55e' };
const COR_STATUS = { aberto: '#3b82f6', 'em atendimento': '#f59e0b', fechado: '#22c55e' };

/* Formata data ISO string para exibição */
const fmtDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/* ─────────────────────────────────────────────
   EXPORTAÇÃO CSV
───────────────────────────────────────────── */

const exportCSV = (tickets, metricas, periodo) => {
  const linhas = [
    [`Relatório de Chamados — ${PERIODO_LABEL[periodo] ?? periodo}`],
    [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
    [],
    ['=== RESUMO GERAL ==='],
    ['Métrica', 'Valor'],
    ['Total de Chamados', metricas.total],
    ['Abertos', metricas.abertos],
    ['Em Atendimento', metricas.atendimento],
    ['Fechados', metricas.fechados],
    ...(metricas.prioridades || []).map(p => [`Prioridade: ${p.nome}`, p.qtd]),
    ['Taxa de Resolução (%)', metricas.taxa_resolucao],
    [],
    ['=== CHAMADOS DETALHADOS ==='],
    ['ID', 'Assunto', 'Solicitante', 'Categoria', 'Prioridade', 'Status', 'Data Criação'],
    ...tickets.map(t => [
      t.id,
      `"${(t.assunto || '').replace(/"/g, '""')}"`,
      t.solicitante_nome,
      t.categoria_nome,
      t.prioridade,
      t.status,
      t.data_criacao ? t.data_criacao.toLocaleString('pt-BR') : '—',
    ]),
    [],
    ['=== POR CATEGORIA ==='],
    ['Categoria', 'Total', '% do Total'],
    ...metricas.categorias.map(c => [
      c.nome, c.qtd,
      metricas.total > 0 ? ((c.qtd / metricas.total) * 100).toFixed(1) + '%' : '0%',
    ]),
    [],
    ['=== POR SOLICITANTE ==='],
    ['Solicitante', 'Total', 'Fechados', 'Taxa de Resolução'],
    ...metricas.usuarios.map(u => [u.nome, u.total, u.fechados, u.taxa + '%']),
  ];

  const csv = linhas.map(r => r.join(',')).join('\n');
  downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }),
    `relatorio_${formatDateFilename()}.csv`);
};

/* ─────────────────────────────────────────────
   EXPORTAÇÃO PDF
───────────────────────────────────────────── */

const exportPDF = (tickets, metricas, periodo) => {
  const periodoLabel = PERIODO_LABEL[periodo] ?? periodo;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório de Chamados</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;color:#1e293b;background:#fff;font-size:13px}
    .page{padding:32px 40px;max-width:960px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #6366f1;margin-bottom:28px}
    .header h1{font-size:22px;font-weight:700}
    .header p{font-size:12px;color:#64748b;margin-top:4px}
    .badge{background:#ede9fe;color:#6366f1;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600}
    .sec{font-size:14px;font-weight:700;color:#374151;margin:24px 0 12px;display:flex;align-items:center;gap:6px}
    .sec::before{content:'';display:inline-block;width:3px;height:14px;background:#6366f1;border-radius:2px}
    .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:4px}
    .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
    .kpi label{font-size:11px;color:#64748b;display:block;margin-bottom:4px}
    .kpi strong{font-size:24px;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#f1f5f9}
    th{text-align:left;padding:9px 12px;font-weight:600;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
    td{padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#334155}
    tr:last-child td{border-bottom:none}
    tr:nth-child(even) td{background:#fafafa}
    .pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600}
    .bar-wrap{display:flex;align-items:center;gap:8px}
    .bar-track{flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden}
    .bar-fill{height:100%;border-radius:3px}
    .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:20px}}
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <h1>📊 Central de Relatórios</h1>
      <p>Análise completa dos chamados do sistema</p>
    </div>
    <div style="text-align:right">
      <div class="badge">${periodoLabel}</div>
      <p style="font-size:11px;color:#94a3b8;margin-top:6px">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    </div>
  </div>

  <div class="sec">Resumo Geral</div>
  <div class="kpi-row">
    <div class="kpi"><label>Total</label><strong>${metricas.total}</strong></div>
    <div class="kpi"><label>Em Aberto</label><strong style="color:#3b82f6">${metricas.abertos}</strong></div>
    <div class="kpi"><label>Em Atendimento</label><strong style="color:#f59e0b">${metricas.atendimento}</strong></div>
    <div class="kpi"><label>Resolvidos</label><strong style="color:#22c55e">${metricas.fechados}</strong></div>
  </div>
  <div class="kpi-row" style="margin-top:12px">
    ${(metricas.prioridades || []).map(p => `<div class="kpi"><label>Prioridade: ${p.nome}</label><strong style="color:${p.color}">${p.qtd}</strong></div>`).join('')}
    <div class="kpi"><label>Taxa de Resolução</label><strong style="color:#6366f1">${metricas.taxa_resolucao}%</strong></div>
  </div>

  <div class="sec">Por Categoria</div>
  <table>
    <thead><tr><th>#</th><th>Categoria</th><th>Total</th><th>%</th><th>Distribuição</th></tr></thead>
    <tbody>
      ${metricas.categorias.map((c, i) => {
        const pct = metricas.total > 0 ? ((c.qtd / metricas.total) * 100).toFixed(1) : 0;
        const cor = COR_CAT[i % COR_CAT.length];
        return `<tr>
          <td><strong style="color:${cor}">${i + 1}</strong></td>
          <td><strong>${c.nome}</strong></td>
          <td><strong>${c.qtd}</strong></td>
          <td>${pct}%</td>
          <td><div class="bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${cor}"></div></div></div></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="sec">Por Solicitante</div>
  <table>
    <thead><tr><th>Solicitante</th><th>Total</th><th>Fechados</th><th>Taxa</th><th>Desempenho</th></tr></thead>
    <tbody>
      ${metricas.usuarios.map(u => {
        const taxa = parseFloat(u.taxa);
        const cor = taxa >= 70 ? '#22c55e' : taxa >= 40 ? '#f59e0b' : '#ef4444';
        return `<tr>
          <td><strong>${u.nome}</strong></td>
          <td>${u.total}</td>
          <td>${u.fechados}</td>
          <td><strong style="color:${cor}">${u.taxa}%</strong></td>
          <td><div class="bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:${u.taxa}%;background:${cor}"></div></div></div></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="sec">Chamados Detalhados</div>
  <table>
    <thead><tr><th>ID</th><th>Assunto</th><th>Solicitante</th><th>Categoria</th><th>Prioridade</th><th>Status</th><th>Data</th></tr></thead>
    <tbody>
      ${tickets.slice(0, 50).map(t => {
        const pEntry = (metricas.prioridades || []).find(p => p.nome === t.prioridade);
        const corP = pEntry?.color || '#94a3b8';
        const corS = COR_STATUS[t.status] || '#94a3b8';
        return `<tr>
          <td><strong style="color:#6366f1">#${t.id}</strong></td>
          <td>${t.assunto || '—'}</td>
          <td>${t.solicitante_nome || '—'}</td>
          <td>${t.categoria_nome || t.categoria || 'Sem Categoria'}</td>
          <td><span class="pill" style="background:${corP}20;color:${corP}">${t.prioridade}</span></td>
          <td><span class="pill" style="background:${corS}20;color:${corS}">${t.status}</span></td>
          <td>${fmtDate(t.data_criacao)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  ${tickets.length > 50 ? `<p style="font-size:11px;color:#94a3b8;margin-top:8px">* Exibindo os primeiros 50 de ${tickets.length} chamados.</p>` : ''}

  <div class="footer">
    <span>Sistema de Gestão de Chamados</span>
    <span>Relatório gerado automaticamente • ${new Date().toLocaleDateString('pt-BR')}</span>
  </div>
</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1000,height=700');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
};

/* ─────────────────────────────────────────────
   COMPONENTE: MENU EXPORTAR
───────────────────────────────────────────── */

const ExportMenu = ({ onExport, disabled }) => {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handle = async (fmt) => {
    setOpen(false);
    onExport(fmt);
    setDone(fmt);
    setTimeout(() => setDone(null), 2000);
  };

  const opts = [
    { id: 'pdf', label: 'Exportar PDF', sub: 'Relatório para impressão', icon: FileText, color: '#ef4444' },
    { id: 'csv', label: 'Exportar CSV', sub: 'Planilha compatível com Excel', icon: FileSpreadsheet, color: '#22c55e' },
  ];

  return (
    <div className="exp-wrap" ref={ref}>
      <button
        className={`rp-btn rp-btn--outline${done ? ' rp-btn--done' : ''}`}
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
      >
        {done ? <><Check size={15} /> Exportado</> : <><Download size={15} /> Exportar <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} /></>}
      </button>

      {open && (
        <div className="exp-dropdown">
          <div className="exp-dropdown-head">
            <span>Escolha o formato</span>
            <button className="exp-dropdown-close" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>
          {opts.map(o => (
            <button key={o.id} className="exp-opt" onClick={() => handle(o.id)}>
              <div className="exp-opt-icon" style={{ background: o.color + '18', color: o.color }}>
                <o.icon size={17} />
              </div>
              <div className="exp-opt-text">
                <strong>{o.label}</strong>
                <span>{o.sub}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   COMPONENTE: DONUT SVG
───────────────────────────────────────────── */

const Donut = ({ pct, color, size = 96 }) => {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <circle
        cx="44" cy="44" r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="44" y="48" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
};

/* ─────────────────────────────────────────────
   COMPONENTE: KPI CARD
───────────────────────────────────────────── */

const KpiCard = ({ title, value, sub, icon: Icon, color, trend, up }) => (
  <div className="kpi-card" style={{ '--ac': color }}>
    <div className="kpi-icon-wrap"><Icon size={20} /></div>
    <div className="kpi-content">
      <span className="kpi-label">{title}</span>
      <strong className="kpi-val">{value}</strong>
      <span className="kpi-sub">{sub}</span>
    </div>
    {trend !== undefined && (
      <div className={`kpi-trend ${up ? 'up' : 'down'}`}>
        {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
        <span>{trend}%</span>
      </div>
    )}
  </div>
);

/* ─────────────────────────────────────────────
   COMPONENTE: BARRA HORIZONTAL
───────────────────────────────────────────── */

const HBar = ({ label, value, max, color }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="hbar">
      <span className="hbar-label">{label}</span>
      <div className="hbar-track">
        <div className="hbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="hbar-count">{value}</span>
    </div>
  );
};

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────── */

/* Métricas vazias usadas como estado inicial e fallback */
const METRICAS_VAZIAS = {
  total: 0, abertos: 0, atendimento: 0, fechados: 0,
  taxa_resolucao: '0.0', pendentes: 0,
  prioridades: [], clientes: [],
  categorias: [], usuarios: [], por_dia: [], tickets: [],
  tempo_medio_geral_horas: null,
  tempo_medio_categoria: [], tempo_medio_prioridade: [], tempo_medio_projeto: [],
};

/* Formata horas decimais em "X dias Y horas" (ou só horas se < 24h) */
const fmtDuracao = (horas) => {
  if (horas === null || horas === undefined) return '—';
  const totalHoras = Math.round(horas);
  const dias = Math.floor(totalHoras / 24);
  const resto = totalHoras % 24;
  if (dias === 0) return `${resto}h`;
  return `${dias}d ${resto}h`;
};

const Reports = () => {
  const [m, setM]                   = useState(METRICAS_VAZIAS);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]               = useState('geral');
  const [periodo, setPeriodo]       = useState('todos');

  /* ── fetch ── */
  const fetchData = (p = periodo) => {
    setRefreshing(true);
    apiFetch(`/reports/summary?periodo=${p}`)
      .then(r => r.json())
      .then(data => {
        setM({ ...METRICAS_VAZIAS, ...data });
        setLoading(false);
        setRefreshing(false);
      })
      .catch(err => {
        console.error('Erro ao carregar relatórios:', err);
        setLoading(false);
        setRefreshing(false);
      });
  };

  /* Busca inicial e re-fetch automático quando o período muda */
  useEffect(() => { fetchData(periodo); }, [periodo]);

  /* maxDia para escala do gráfico de barras */
  const maxDia = Math.max(...(m.por_dia || []).map(d => d.count), 1);

  /* ── export handler ── */
  const handleExport = fmt => {
    /* Adapta a estrutura do backend para as funções de exportação */
    const ticketsExport = m.tickets.map(t => ({
      id:               t.id,
      assunto:          t.assunto,
      solicitante_nome: t.solicitante,
      categoria_nome:   t.categoria,
      prioridade:       t.prioridade,
      status:           t.status,
      data_criacao:     t.data_criacao ? new Date(t.data_criacao) : null,
    }));
    const metricasExport = {
      total:          m.total,
      abertos:        m.abertos,
      atendimento:    m.atendimento,
      fechados:       m.fechados,
      prioridades:    m.prioridades,
      taxa_resolucao: m.taxa_resolucao,
      categorias:     m.categorias,
      usuarios:       m.usuarios,
      clientes:       m.clientes,
      por_dia:        m.por_dia,
    };
    if (fmt === 'csv') exportCSV(ticketsExport, metricasExport, periodo);
    if (fmt === 'pdf') exportPDF(ticketsExport, metricasExport, periodo);
  };

  /* ── tabs ── */
  const TABS = [
    { id: 'geral',      label: 'Visão Geral',        icon: BarChart3  },
    { id: 'tempo',      label: 'Evolução Temporal',   icon: Activity   },
    { id: 'resolucao',  label: 'Tempo de Resolução',  icon: Timer      },
    { id: 'categorias', label: 'Categorias',          icon: Tag        },
    { id: 'equipe',     label: 'Equipe',              icon: Users      },
    { id: 'clientes',   label: 'Clientes',            icon: Building2  },
  ];

  /* ── loading ── */
  if (loading) return (
    <div className="rp-loading">
      <div className="rp-spinner" />
      <p>Carregando relatórios…</p>
    </div>
  );

  /* ── render ── */
  return (
    <div className="rp-root">

      {/* HEADER */}
      <header className="rp-header">
        <div>
          <h1 className="rp-title">Central de Relatórios</h1>
          <p className="rp-subtitle">Análise em tempo real dos chamados do sistema</p>
        </div>
        <div className="rp-controls">
          <div className="rp-filter">
            <Filter size={15} />
            <select value={periodo} onChange={e => setPeriodo(e.target.value)}>
              <option value="todos">Todo o período</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
            </select>
            <ChevronDown size={13} />
          </div>

          <button className="rp-btn rp-btn--primary" onClick={() => fetchData(periodo)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spinning' : ''} />
            Atualizar
          </button>

          <ExportMenu onExport={handleExport} disabled={refreshing} />
        </div>
      </header>

      {/* TABS */}
      <nav className="rp-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`rp-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </nav>

      {/* ════════════════════════════════════════
          ABA: VISÃO GERAL
      ════════════════════════════════════════ */}
      {tab === 'geral' && (
        <div className="rp-fade">

          {/* KPIs principais */}
          <div className="kpi-grid">
            <KpiCard title="Total de Chamados"  value={m.total}       sub="no período selecionado"  icon={BarChart3}   color="#6366f1" />
            <KpiCard title="Em Aberto"          value={m.abertos}     sub="aguardando atendimento"  icon={Clock}       color="#3b82f6" />
            <KpiCard title="Em Atendimento"     value={m.atendimento} sub="em andamento"            icon={Zap}         color="#f59e0b" />
            <KpiCard title="Resolvidos"         value={m.fechados}    sub="chamados encerrados"     icon={CheckCircle2} color="#22c55e" />
          </div>

          {/* Linha de cards analíticos */}
          <div className="rp-row-3">

            {/* Taxa de resolução */}
            <div className="rp-card">
              <h3 className="rp-card-title"><Award size={16} /> Taxa de Resolução</h3>
              <div className="donut-wrap">
                <Donut pct={parseFloat(m.taxa_resolucao)} color="#22c55e" size={110} />
              </div>
              <div className="donut-legend">
                <span><Circle size={10} fill="#22c55e" color="#22c55e" /> Fechados: <strong>{m.fechados}</strong></span>
                <span><Circle size={10} fill="#f59e0b" color="#f59e0b" /> Pendentes: <strong>{m.pendentes}</strong></span>
              </div>
            </div>

            {/* Distribuição por status */}
            <div className="rp-card">
              <h3 className="rp-card-title"><Activity size={16} /> Por Status</h3>
              <div className="status-list">
                {[
                  { label: 'Abertos',        val: m.abertos,     cor: '#3b82f6' },
                  { label: 'Em Atendimento', val: m.atendimento, cor: '#f59e0b' },
                  { label: 'Fechados',       val: m.fechados,    cor: '#22c55e' },
                ].map(s => (
                  <div key={s.label} className="status-item">
                    <div className="status-item-head">
                      <span style={{ color: s.cor }}>● {s.label}</span>
                      <strong>{m.total > 0 ? ((s.val / m.total) * 100).toFixed(1) : 0}%</strong>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: m.total > 0 ? `${(s.val / m.total) * 100}%` : '0%',
                        background: s.cor,
                      }} />
                    </div>
                    <small>{s.val} chamados</small>
                  </div>
                ))}
              </div>
            </div>

            {/* Por prioridade */}
            <div className="rp-card">
              <h3 className="rp-card-title"><AlertCircle size={16} /> Por Prioridade</h3>
              <div className="prio-bubbles">
                {(m.prioridades || []).map(p => (
                  <div key={p.nome} className="prio-bubble" style={{ '--bc': p.color }}>
                    <strong style={{ color: p.color }}>{p.qtd}</strong>
                    <span>{p.nome}</span>
                  </div>
                ))}
              </div>
              <div className="prio-hbars">
                {(m.prioridades || []).map(p => (
                  <HBar key={p.nome} label={p.nome} value={p.qtd} max={m.total} color={p.color} />
                ))}
              </div>
            </div>
          </div>

          {/* Tabela de chamados recentes */}
          <div className="rp-card rp-card--full">
            <h3 className="rp-card-title"><Clock size={16} /> Chamados Mais Recentes</h3>
            {m.tickets.length === 0 ? (
              <div className="rp-empty">Nenhum chamado no período selecionado.</div>
            ) : (
              <div className="table-scroll">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>ID</th><th>Assunto</th><th>Solicitante</th>
                      <th>Prioridade</th><th>Status</th><th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.tickets.slice(0, 10).map(t => (
                      <tr key={t.id}>
                        <td className="td-id">#{t.id}</td>
                        <td className="td-subject">{t.assunto}</td>
                        <td>{t.solicitante}</td>
                        <td>
                          {(() => {
                            const pEntry = (m.prioridades || []).find(p => p.nome === t.prioridade);
                            const cor = pEntry?.color || '#94a3b8';
                            return <span className="pill" style={{ background: cor + '20', color: cor }}>{t.prioridade}</span>;
                          })()}
                        </td>
                        <td>
                          <span className={`pill pill-${t.status?.replace(/\s+/g, '-')}`}>{t.status}</span>
                        </td>
                        <td className="td-date">{fmtDate(t.data_criacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          ABA: EVOLUÇÃO TEMPORAL
      ════════════════════════════════════════ */}
      {tab === 'tempo' && (
        <div className="rp-fade">

          {/* Gráfico de barras */}
          <div className="rp-card rp-card--full">
            <h3 className="rp-card-title"><TrendingUp size={16} /> Chamados por Dia — últimos 14 dias</h3>
            <div className="barchart">
              {m.por_dia.map((d, i) => (
                <div key={i} className="barchart-col">
                  <div className="barchart-bar-wrap">
                    <div
                      className="barchart-bar"
                      style={{ height: `${(d.count / maxDia) * 100}%` }}
                      title={`${d.label}: ${d.count}`}
                    >
                      {d.count > 0 && <span className="barchart-val">{d.count}</span>}
                    </div>
                  </div>
                  <span className="barchart-label">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cards de estatísticas */}
          <div className="rp-row-3">
            {(() => {
              const pico = [...m.por_dia].sort((a, b) => b.count - a.count)[0];
              const media = (m.por_dia.reduce((a, d) => a + d.count, 0) / 14).toFixed(1);
              const semChamados = m.por_dia.filter(d => d.count === 0).length;
              return (
                <>
                  <div className="rp-card stat-card">
                    <div className="stat-icon" style={{ background: '#6366f110', color: '#6366f1' }}><Zap size={22} /></div>
                    <strong className="stat-val">{pico?.count || 0}</strong>
                    <span className="stat-label">Pico de chamados</span>
                    <small className="stat-sub">em {pico?.label || '—'}</small>
                  </div>
                  <div className="rp-card stat-card">
                    <div className="stat-icon" style={{ background: '#14b8a610', color: '#14b8a6' }}><Activity size={22} /></div>
                    <strong className="stat-val">{media}</strong>
                    <span className="stat-label">Média diária</span>
                    <small className="stat-sub">chamados por dia</small>
                  </div>
                  <div className="rp-card stat-card">
                    <div className="stat-icon" style={{ background: '#22c55e10', color: '#22c55e' }}><CheckCircle2 size={22} /></div>
                    <strong className="stat-val">{semChamados}</strong>
                    <span className="stat-label">Dias sem chamados</span>
                    <small className="stat-sub">nos últimos 14 dias</small>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Tabela detalhada */}
          <div className="rp-card rp-card--full">
            <h3 className="rp-card-title"><BarChart3 size={16} /> Detalhamento Diário</h3>
            <div className="table-scroll">
              <table className="rp-table">
                <thead>
                  <tr><th>Data</th><th>Total</th><th>Distribuição visual</th></tr>
                </thead>
                <tbody>
                  {m.por_dia.filter(d => d.count > 0).map((d, i) => (
                    <tr key={i}>
                      <td className="td-date">{d.label}</td>
                      <td><strong>{d.count}</strong></td>
                      <td>
                        <div className="inline-bar-track">
                          <div className="inline-bar-fill" style={{ width: `${(d.count / maxDia) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {m.por_dia.every(d => d.count === 0) && (
                    <tr><td colSpan={3} className="rp-empty">Nenhum chamado no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          ABA: TEMPO DE RESOLUÇÃO
      ════════════════════════════════════════ */}
      {tab === 'resolucao' && (
        <div className="rp-fade">

          <div className="kpi-grid">
            <KpiCard
              title="Tempo Médio Geral"
              value={fmtDuracao(m.tempo_medio_geral_horas)}
              sub="da abertura até o fechamento"
              icon={Timer} color="#6366f1"
            />
            <KpiCard
              title="Chamados Considerados"
              value={(m.tempo_medio_categoria || []).reduce((acc, c) => acc + c.qtd, 0)}
              sub="fechados no período" icon={CheckCircle2} color="#22c55e"
            />
          </div>

          <div className="rp-row-3">
            <div className="rp-card">
              <h3 className="rp-card-title"><Tag size={16} /> Por Categoria</h3>
              {(m.tempo_medio_categoria || []).length === 0 ? (
                <div className="rp-empty">Nenhum chamado fechado no período.</div>
              ) : (
                <div className="prio-hbars">
                  {m.tempo_medio_categoria.map((c, i) => (
                    <HBar
                      key={c.nome}
                      label={`${c.nome} (${fmtDuracao(c.horas)})`}
                      value={c.horas}
                      max={Math.max(...m.tempo_medio_categoria.map(x => x.horas), 1)}
                      color={COR_CAT[i % COR_CAT.length]}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rp-card">
              <h3 className="rp-card-title"><AlertCircle size={16} /> Por Prioridade</h3>
              {(m.tempo_medio_prioridade || []).length === 0 ? (
                <div className="rp-empty">Nenhum chamado fechado no período.</div>
              ) : (
                <div className="prio-hbars">
                  {m.tempo_medio_prioridade.map((p, i) => (
                    <HBar
                      key={p.nome}
                      label={`${p.nome} (${fmtDuracao(p.horas)})`}
                      value={p.horas}
                      max={Math.max(...m.tempo_medio_prioridade.map(x => x.horas), 1)}
                      color={COR_CAT[(i + 3) % COR_CAT.length]}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rp-card">
              <h3 className="rp-card-title"><Building2 size={16} /> Por Projeto</h3>
              {(m.tempo_medio_projeto || []).length === 0 ? (
                <div className="rp-empty">Nenhum chamado fechado no período.</div>
              ) : (
                <div className="prio-hbars">
                  {m.tempo_medio_projeto.map((p, i) => (
                    <HBar
                      key={p.nome}
                      label={`${p.nome} (${fmtDuracao(p.horas)})`}
                      value={p.horas}
                      max={Math.max(...m.tempo_medio_projeto.map(x => x.horas), 1)}
                      color={COR_CAT[(i + 5) % COR_CAT.length]}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          ABA: CATEGORIAS
      ════════════════════════════════════════ */}
      {tab === 'categorias' && (
        <div className="rp-fade">
          <div className="rp-row-sidebar">

            {/* Barras de categoria */}
            <div className="rp-card rp-col-main">
              <h3 className="rp-card-title"><Tag size={16} /> Chamados por Categoria</h3>
              {m.categorias.length === 0 ? (
                <div className="rp-empty">Nenhuma categoria encontrada.</div>
              ) : (
                <div className="cat-bars">
                  {m.categorias.map((c, i) => {
                    const pct = m.total > 0 ? ((c.qtd / m.total) * 100).toFixed(1) : 0;
                    const cor = COR_CAT[i % COR_CAT.length];
                    return (
                      <div key={c.nome} className="cat-row">
                        <div className="cat-row-head">
                          <span className="cat-dot" style={{ background: cor }} />
                          <span className="cat-name">{c.nome}</span>
                          <span className="cat-pct">{pct}%</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${pct}%`, background: cor }} />
                        </div>
                        <small className="cat-count">{c.qtd} chamados</small>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resumo lateral */}
            <div className="rp-card rp-col-side">
              <h3 className="rp-card-title"><BarChart3 size={16} /> Resumo</h3>
              <div className="summary-items">
                {[
                  { label: 'Categorias ativas',   value: m.categorias.length },
                  { label: 'Mais chamados',        value: m.categorias[0]?.nome || '—' },
                  { label: 'Menos chamados',       value: m.categorias[m.categorias.length - 1]?.nome || '—' },
                  { label: 'Média por categoria',  value: m.categorias.length > 0 ? (m.total / m.categorias.length).toFixed(1) : 0 },
                ].map(s => (
                  <div key={s.label} className="summary-item">
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabela detalhada de categorias */}
          <div className="rp-card rp-card--full">
            <h3 className="rp-card-title"><BarChart3 size={16} /> Tabela Detalhada por Categoria</h3>
            <div className="table-scroll">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>#</th><th>Categoria</th><th>Total</th>
                    <th>Abertos</th><th>Em Atend.</th><th>Fechados</th><th>% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {m.categorias.map((c, i) => {
                    const ct = m.tickets.filter(t => t.categoria === c.nome);
                    const ab = ct.filter(t => t.status === 'aberto').length;
                    const at = ct.filter(t => t.status === 'em atendimento').length;
                    const fc = ct.filter(t => t.status === 'fechado').length;
                    const pct = m.total > 0 ? ((c.qtd / m.total) * 100).toFixed(1) : 0;
                    const cor = COR_CAT[i % COR_CAT.length];
                    return (
                      <tr key={c.nome}>
                        <td><span className="rank-badge" style={{ background: cor }}>{i + 1}</span></td>
                        <td><strong>{c.nome}</strong></td>
                        <td><strong>{c.qtd}</strong></td>
                        <td><span className="pill pill-aberto">{ab}</span></td>
                        <td><span className="pill pill-em-atendimento">{at}</span></td>
                        <td><span className="pill pill-fechado">{fc}</span></td>
                        <td>
                          <div className="pct-cell">
                            <div className="bar-track" style={{ flex: 1 }}>
                              <div className="bar-fill" style={{ width: `${pct}%`, background: cor }} />
                            </div>
                            <span style={{ minWidth: 38, textAlign: 'right' }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {m.categorias.length === 0 && <div className="rp-empty">Sem dados de categorias.</div>}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          ABA: EQUIPE
      ════════════════════════════════════════ */}
      {tab === 'equipe' && (
        <div className="rp-fade">
          <div className="kpi-grid">
            <KpiCard
              title="Solicitantes Ativos" value={m.usuarios.length}
              sub="com chamados no período" icon={Users} color="#8b5cf6"
            />
            <KpiCard
              title="Maior Volume"
              value={m.usuarios[0]?.nome?.split(' ')[0] || '—'}
              sub={`${m.usuarios[0]?.total || 0} chamados`}
              icon={Award} color="#f59e0b"
            />
            <KpiCard
              title="Melhor Resolução"
              value={[...m.usuarios].sort((a, b) => b.taxa - a.taxa)[0]?.nome?.split(' ')[0] || '—'}
              sub={`${[...m.usuarios].sort((a, b) => b.taxa - a.taxa)[0]?.taxa || 0}% de taxa`}
              icon={TrendingUp} color="#22c55e"
            />
            <KpiCard
              title="Média por Usuário"
              value={m.usuarios.length > 0 ? (m.total / m.usuarios.length).toFixed(1) : 0}
              sub="chamados por solicitante" icon={BarChart3} color="#06b6d4"
            />
          </div>

          {/* Tabela de desempenho */}
          <div className="rp-card rp-card--full">
            <h3 className="rp-card-title"><Users size={16} /> Desempenho por Solicitante</h3>
            <div className="table-scroll">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Solicitante</th><th>Total</th><th>Abertos</th>
                    <th>Em Atend.</th><th>Fechados</th><th>Taxa</th><th>Desempenho</th>
                  </tr>
                </thead>
                <tbody>
                  {m.usuarios.map((u, i) => {
                    const ut = m.tickets.filter(t => t.solicitante === u.nome);
                    const ab = ut.filter(t => t.status === 'aberto').length;
                    const at = ut.filter(t => t.status === 'em atendimento').length;
                    const taxaNum = parseFloat(u.taxa);
                    const cor = taxaNum >= 70 ? '#22c55e' : taxaNum >= 40 ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={u.nome}>
                        <td>
                          <div className="user-cell">
                            <div className="avatar" style={{ background: COR_CAT[i % COR_CAT.length] }}>
                              {u.nome.charAt(0).toUpperCase()}
                            </div>
                            <strong>{u.nome}</strong>
                          </div>
                        </td>
                        <td><strong>{u.total}</strong></td>
                        <td><span className="pill pill-aberto">{ab}</span></td>
                        <td><span className="pill pill-em-atendimento">{at}</span></td>
                        <td><span className="pill pill-fechado">{u.fechados}</span></td>
                        <td><strong style={{ color: cor }}>{u.taxa}%</strong></td>
                        <td>
                          <div className="bar-track" style={{ minWidth: 120 }}>
                            <div className="bar-fill" style={{ width: `${u.taxa}%`, background: cor }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {m.usuarios.length === 0 && <div className="rp-empty">Nenhum dado de usuários no período.</div>}
          </div>

          {/* Ranking */}
          <div className="rp-card rp-card--full">
            <h3 className="rp-card-title"><Award size={16} /> Ranking de Volume</h3>
            <div className="ranking">
              {m.usuarios.slice(0, 5).map((u, i) => (
                <div key={u.nome} className="ranking-item">
                  <div className="ranking-pos" style={{
                    background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#e5e7eb',
                    color: i < 3 ? '#fff' : '#6b7280',
                  }}>{i + 1}</div>
                  <div className="avatar" style={{ background: COR_CAT[i % COR_CAT.length] }}>
                    {u.nome.charAt(0)}
                  </div>
                  <div className="ranking-info">
                    <strong>{u.nome}</strong>
                    <span>{u.total} chamados • {u.taxa}% resolvidos</span>
                  </div>
                  <div className="bar-track ranking-bar">
                    <div className="bar-fill" style={{
                      width: `${m.usuarios[0]?.total > 0 ? (u.total / m.usuarios[0].total) * 100 : 0}%`,
                      background: COR_CAT[i % COR_CAT.length],
                    }} />
                  </div>
                </div>
              ))}
              {m.usuarios.length === 0 && <div className="rp-empty">Sem dados no período.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          ABA: CLIENTES
      ════════════════════════════════════════ */}
      {tab === 'clientes' && (
        <div className="rp-fade">

          {/* KPIs */}
          <div className="kpi-grid">
            <KpiCard
              title="Clientes Ativos" value={m.clientes?.length ?? 0}
              sub="com chamados no período" icon={Building2} color="#6366f1"
            />
            <KpiCard
              title="Maior Volume"
              value={(m.clientes || [])[0]?.nome || '—'}
              sub={`${(m.clientes || [])[0]?.total || 0} chamados`}
              icon={Award} color="#f59e0b"
            />
            <KpiCard
              title="Melhor Resolução"
              value={[...(m.clientes || [])].sort((a, b) => parseFloat(b.taxa) - parseFloat(a.taxa))[0]?.nome || '—'}
              sub={`${[...(m.clientes || [])].sort((a, b) => parseFloat(b.taxa) - parseFloat(a.taxa))[0]?.taxa || 0}% de taxa`}
              icon={TrendingUp} color="#22c55e"
            />
            <KpiCard
              title="Média por Cliente"
              value={(m.clientes?.length ?? 0) > 0 ? (m.total / m.clientes.length).toFixed(1) : 0}
              sub="chamados por cliente" icon={BarChart3} color="#06b6d4"
            />
          </div>

          {/* Tabela de clientes */}
          <div className="rp-card rp-card--full">
            <h3 className="rp-card-title"><Building2 size={16} /> Chamados por Cliente</h3>
            <div className="table-scroll">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>#</th><th>Cliente</th><th>CNPJ</th><th>Total</th>
                    <th>Abertos</th><th>Em Atend.</th><th>Fechados</th><th>Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {(m.clientes || []).map((c, i) => {
                    const taxaNum = parseFloat(c.taxa);
                    const cor = taxaNum >= 70 ? '#22c55e' : taxaNum >= 40 ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={c.nome}>
                        <td><span className="rank-badge" style={{ background: COR_CAT[i % COR_CAT.length] }}>{i + 1}</span></td>
                        <td>
                          <div className="user-cell">
                            <div className="avatar" style={{ background: COR_CAT[i % COR_CAT.length] }}>
                              {c.nome.charAt(0).toUpperCase()}
                            </div>
                            <strong>{c.nome}</strong>
                          </div>
                        </td>
                        <td className="td-date">{c.cnpj}</td>
                        <td><strong>{c.total}</strong></td>
                        <td><span className="pill pill-aberto">{c.abertos}</span></td>
                        <td><span className="pill pill-em-atendimento">{c.atendimento}</span></td>
                        <td><span className="pill pill-fechado">{c.fechados}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="bar-track" style={{ flex: 1, minWidth: 80 }}>
                              <div className="bar-fill" style={{ width: `${c.taxa}%`, background: cor }} />
                            </div>
                            <strong style={{ color: cor, minWidth: 36 }}>{c.taxa}%</strong>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(m.clientes?.length ?? 0) === 0 && <div className="rp-empty">Nenhum dado de clientes no período.</div>}
          </div>

        </div>
      )}

    </div>
  );
};

export default Reports;
