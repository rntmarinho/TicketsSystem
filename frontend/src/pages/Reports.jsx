import { useEffect, useState, useMemo, useRef } from 'react';
import {
  BarChart3, PieChart, Users, Tag, AlertCircle,
  CheckCircle2, Clock, TrendingUp, TrendingDown,
  Calendar, Activity, Award, Zap, Filter,
  ChevronDown, Download, RefreshCw, ArrowUp, ArrowDown,
  FileText, FileSpreadsheet, FileJson, X, Check
} from 'lucide-react';
import './styles/Reports.css';

/* ─────────────────────────────────────────────
   UTILITÁRIOS DE EXPORTAÇÃO
───────────────────────────────────────────── */

// Exportar como CSV
const exportCSV = (tickets, metricas, periodoFiltro) => {
  const periodoLabel = {
    todos: 'Todo período',
    '7d': 'Últimos 7 dias',
    '30d': 'Últimos 30 dias',
    '90d': 'Últimos 90 dias',
  }[periodoFiltro] || periodoFiltro;

  const linhas = [
    // Cabeçalho do relatório
    [`Relatório de Chamados — ${periodoLabel}`],
    [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
    [],
    // Seção: Resumo
    ['=== RESUMO GERAL ==='],
    ['Métrica', 'Valor'],
    ['Total de Chamados', metricas.total],
    ['Abertos', metricas.abertos],
    ['Em Atendimento', metricas.atendimento],
    ['Fechados', metricas.fechados],
    ['Alta Prioridade', metricas.alta],
    ['Média Prioridade', metricas.media],
    ['Baixa Prioridade', metricas.baixa],
    ['Taxa de Resolução (%)', metricas.taxaResolucao],
    [],
    // Seção: Chamados
    ['=== CHAMADOS DETALHADOS ==='],
    ['ID', 'Assunto', 'Solicitante', 'Categoria', 'Prioridade', 'Status', 'Data Criação'],
    ...tickets.map(t => [
      t.id,
      `"${(t.assunto || '').replace(/"/g, '""')}"`,
      t.solicitante_nome || 'Desconhecido',
      t.categoria_nome || t.categoria || 'Sem Categoria',
      t.prioridade,
      t.status,
      new Date(t.data_criacao).toLocaleString('pt-BR'),
    ]),
    [],
    // Seção: Categorias
    ['=== POR CATEGORIA ==='],
    ['Categoria', 'Total', '% do Total'],
    ...metricas.categorias.map(c => [
      c.nome,
      c.qtd,
      metricas.total > 0 ? ((c.qtd / metricas.total) * 100).toFixed(1) + '%' : '0%',
    ]),
    [],
    // Seção: Solicitantes
    ['=== POR SOLICITANTE ==='],
    ['Solicitante', 'Total', 'Fechados', 'Taxa de Resolução'],
    ...metricas.usuarios.map(u => [
      u.nome,
      u.total,
      u.fechados,
      u.taxa + '%',
    ]),
  ];

  const csvContent = linhas.map(row => row.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `relatorio_chamados_${formatDateFilename()}.csv`);
};

// Exportar como JSON
const exportJSON = (tickets, metricas, periodoFiltro) => {
  const payload = {
    meta: {
      titulo: 'Relatório de Chamados',
      periodo: periodoFiltro,
      geradoEm: new Date().toISOString(),
      totalRegistros: tickets.length,
    },
    resumo: {
      total: metricas.total,
      abertos: metricas.abertos,
      emAtendimento: metricas.atendimento,
      fechados: metricas.fechados,
      taxaResolucao: parseFloat(metricas.taxaResolucao),
      porPrioridade: {
        alta: metricas.alta,
        media: metricas.media,
        baixa: metricas.baixa,
      },
    },
    categorias: metricas.categorias,
    solicitantes: metricas.usuarios,
    evolucaoDiaria: metricas.porDia,
    chamados: tickets.map(t => ({
      id: t.id,
      assunto: t.assunto,
      solicitante: t.solicitante_nome || 'Desconhecido',
      categoria: t.categoria_nome || t.categoria || 'Sem Categoria',
      prioridade: t.prioridade,
      status: t.status,
      dataCriacao: t.data_criacao,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `relatorio_chamados_${formatDateFilename()}.json`);
};

// Exportar como PDF (via impressão do navegador com estilos customizados)
const exportPDF = (tickets, metricas, periodoFiltro) => {
  const periodoLabel = {
    todos: 'Todo período',
    '7d': 'Últimos 7 dias',
    '30d': 'Últimos 30 dias',
    '90d': 'Últimos 90 dias',
  }[periodoFiltro] || periodoFiltro;

  const CORES_CAT = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4'];
  const CORES_PRIORIDADE = { alta: '#ef4444', media: '#f59e0b', baixa: '#22c55e' };
  const CORES_STATUS = { aberto: '#3b82f6', 'em atendimento': '#f59e0b', fechado: '#22c55e' };

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Relatório de Chamados</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; color: #1e293b; background: #fff; font-size: 13px; }
        .page { padding: 32px 40px; max-width: 960px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #6366f1; margin-bottom: 28px; }
        .header h1 { font-size: 22px; font-weight: 700; color: #1e293b; }
        .header p { font-size: 12px; color: #64748b; margin-top: 4px; }
        .badge { background: #ede9fe; color: #6366f1; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .section-title { font-size: 14px; font-weight: 700; color: #374151; margin: 24px 0 12px; display: flex; align-items: center; gap: 6px; }
        .section-title::before { content: ''; display: inline-block; width: 3px; height: 14px; background: #6366f1; border-radius: 2px; }
        .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 4px; }
        .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
        .kpi label { font-size: 11px; color: #64748b; display: block; margin-bottom: 4px; }
        .kpi strong { font-size: 24px; font-weight: 700; color: #1e293b; }
        .kpi span { font-size: 11px; color: #94a3b8; display: block; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
        thead tr { background: #f1f5f9; }
        th { text-align: left; padding: 9px 12px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
        td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) td { background: #fafafa; }
        .pill { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
        .bar-wrap { display: flex; align-items: center; gap: 8px; }
        .bar-track { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 3px; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { padding: 20px; }
        }
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

        <div class="section-title">Resumo Geral</div>
        <div class="kpi-row">
          <div class="kpi"><label>Total de Chamados</label><strong>${metricas.total}</strong></div>
          <div class="kpi"><label>Em Aberto</label><strong style="color:#3b82f6">${metricas.abertos}</strong></div>
          <div class="kpi"><label>Em Atendimento</label><strong style="color:#f59e0b">${metricas.atendimento}</strong></div>
          <div class="kpi"><label>Resolvidos</label><strong style="color:#22c55e">${metricas.fechados}</strong></div>
        </div>
        <div class="kpi-row" style="margin-top:12px">
          <div class="kpi"><label>Alta Prioridade</label><strong style="color:#ef4444">${metricas.alta}</strong></div>
          <div class="kpi"><label>Média Prioridade</label><strong style="color:#f59e0b">${metricas.media}</strong></div>
          <div class="kpi"><label>Baixa Prioridade</label><strong style="color:#22c55e">${metricas.baixa}</strong></div>
          <div class="kpi"><label>Taxa de Resolução</label><strong style="color:#6366f1">${metricas.taxaResolucao}%</strong></div>
        </div>

        <div class="section-title">Por Categoria</div>
        <table>
          <thead><tr><th>#</th><th>Categoria</th><th>Total</th><th>% do Total</th><th>Distribuição</th></tr></thead>
          <tbody>
            ${metricas.categorias.map((c, i) => {
              const pct = metricas.total > 0 ? ((c.qtd / metricas.total) * 100).toFixed(1) : 0;
              const cor = CORES_CAT[i % CORES_CAT.length];
              return `<tr>
                <td><strong style="color:${cor}">${i + 1}</strong></td>
                <td><strong>${c.nome}</strong></td>
                <td><strong>${c.qtd}</strong></td>
                <td>${pct}%</td>
                <td>
                  <div class="bar-wrap">
                    <div class="bar-track">
                      <div class="bar-fill" style="width:${pct}%;background:${cor}"></div>
                    </div>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="section-title">Por Solicitante</div>
        <table>
          <thead><tr><th>Solicitante</th><th>Total</th><th>Fechados</th><th>Taxa de Resolução</th><th>Desempenho</th></tr></thead>
          <tbody>
            ${metricas.usuarios.map((u) => {
              const taxa = parseFloat(u.taxa);
              const cor = taxa >= 70 ? '#22c55e' : taxa >= 40 ? '#f59e0b' : '#ef4444';
              return `<tr>
                <td><strong>${u.nome}</strong></td>
                <td>${u.total}</td>
                <td>${u.fechados}</td>
                <td><strong style="color:${cor}">${u.taxa}%</strong></td>
                <td>
                  <div class="bar-wrap">
                    <div class="bar-track">
                      <div class="bar-fill" style="width:${u.taxa}%;background:${cor}"></div>
                    </div>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="section-title">Chamados Detalhados</div>
        <table>
          <thead><tr><th>ID</th><th>Assunto</th><th>Solicitante</th><th>Categoria</th><th>Prioridade</th><th>Status</th><th>Data</th></tr></thead>
          <tbody>
            ${tickets.slice(0, 50).map(t => {
              const corP = CORES_PRIORIDADE[t.prioridade] || '#94a3b8';
              const corS = CORES_STATUS[t.status] || '#94a3b8';
              return `<tr>
                <td><strong style="color:#6366f1">#${t.id}</strong></td>
                <td>${t.assunto || '—'}</td>
                <td>${t.solicitante_nome || '—'}</td>
                <td>${t.categoria_nome || t.categoria || 'Sem Categoria'}</td>
                <td><span class="pill" style="background:${corP}20;color:${corP}">${t.prioridade}</span></td>
                <td><span class="pill" style="background:${corS}20;color:${corS}">${t.status}</span></td>
                <td>${new Date(t.data_criacao).toLocaleDateString('pt-BR')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${tickets.length > 50 ? `<p style="font-size:11px;color:#94a3b8;margin-top:8px">* Exibindo os primeiros 50 de ${tickets.length} chamados. Para o conjunto completo, exporte em CSV ou JSON.</p>` : ''}

        <div class="footer">
          <span>Sistema de Gestão de Chamados</span>
          <span>Relatório gerado automaticamente • ${new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=1000,height=700');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
};

// Helpers
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

const formatDateFilename = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
};

/* ─────────────────────────────────────────────
   COMPONENTE: MENU DE EXPORTAÇÃO
───────────────────────────────────────────── */
const ExportMenu = ({ onExport, loading }) => {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(null); // 'pdf' | 'csv' | 'json'
  const menuRef = useRef(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExport = async (format) => {
    setExporting(format);
    setOpen(false);
    await new Promise(r => setTimeout(r, 300)); // feedback visual
    onExport(format);
    setTimeout(() => setExporting(null), 1500);
  };

  const options = [
    { id: 'pdf', label: 'Exportar PDF', sublabel: 'Relatório visual para impressão', icon: FileText, color: '#ef4444' },
    { id: 'csv', label: 'Exportar CSV', sublabel: 'Dados tabulares para Excel', icon: FileSpreadsheet, color: '#22c55e' },
    { id: 'json', label: 'Exportar JSON', sublabel: 'Dados estruturados completos', icon: FileJson, color: '#3b82f6' },
  ];

  return (
    <div className="export-wrapper" ref={menuRef}>
      <button
        className={`rp-export-btn ${exporting ? 'exporting' : ''}`}
        onClick={() => setOpen(o => !o)}
        disabled={loading || !!exporting}
      >
        {exporting ? (
          <>
            <Check size={16} className="export-check" />
            Exportando...
          </>
        ) : (
          <>
            <Download size={16} />
            Exportar
            <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </>
        )}
      </button>

      {open && (
        <div className="export-dropdown">
          <div className="export-dropdown-header">
            <span>Escolha o formato</span>
            <button className="export-dropdown-close" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>
          {options.map(opt => (
            <button
              key={opt.id}
              className="export-option"
              onClick={() => handleExport(opt.id)}
            >
              <div className="export-option-icon" style={{ background: opt.color + '15', color: opt.color }}>
                <opt.icon size={18} />
              </div>
              <div className="export-option-text">
                <strong>{opt.label}</strong>
                <span>{opt.sublabel}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   COMPONENTES AUXILIARES (sem alteração)
───────────────────────────────────────────── */

const DonutChart = ({ percentage, color, size = 80 }) => {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle
        cx="40" cy="40" r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
        {Math.round(percentage)}%
      </text>
    </svg>
  );
};

const HorizontalBar = ({ value, max, color, label, count }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="hbar-row">
      <span className="hbar-label">{label}</span>
      <div className="hbar-track">
        <div className="hbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="hbar-count">{count}</span>
    </div>
  );
};

const KpiCard = ({ title, value, subtitle, icon: Icon, color, trend, trendUp }) => (
  <div className="kpi-card" style={{ '--accent': color }}>
    <div className="kpi-icon"><Icon size={22} /></div>
    <div className="kpi-body">
      <span className="kpi-title">{title}</span>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-sub">{subtitle}</span>
    </div>
    {trend !== undefined && (
      <div className={`kpi-trend ${trendUp ? 'up' : 'down'}`}>
        {trendUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        <span>{trend}%</span>
      </div>
    )}
  </div>
);

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────── */
const Reports = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('geral');
  const [periodoFiltro, setPeriodoFiltro] = useState('todos');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = () => {
    setRefreshing(true);
    fetch('/api/tickets')
      .then(res => res.json())
      .then(data => {
        setTickets(data);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(err => {
        console.error('Erro ao carregar relatórios:', err);
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => { fetchData(); }, []);

  const ticketsFiltrados = useMemo(() => {
    const agora = new Date();
    return tickets.filter(t => {
      const criado = new Date(t.data_criacao);
      if (periodoFiltro === '7d') return (agora - criado) <= 7 * 86400000;
      if (periodoFiltro === '30d') return (agora - criado) <= 30 * 86400000;
      if (periodoFiltro === '90d') return (agora - criado) <= 90 * 86400000;
      return true;
    });
  }, [tickets, periodoFiltro]);

  const metricas = useMemo(() => {
    const t = ticketsFiltrados;
    const total = t.length;
    const abertos = t.filter(x => x.status === 'aberto').length;
    const atendimento = t.filter(x => x.status === 'em atendimento').length;
    const fechados = t.filter(x => x.status === 'fechado').length;
    const alta = t.filter(x => x.prioridade === 'alta').length;
    const media = t.filter(x => x.prioridade === 'media').length;
    const baixa = t.filter(x => x.prioridade === 'baixa').length;
    const taxaResolucao = total > 0 ? ((fechados / total) * 100).toFixed(1) : 0;
    const pendentes = abertos + atendimento;

    const catMap = {};
    t.forEach(x => {
      const k = x.categoria_nome || x.categoria || 'Sem Categoria';
      catMap[k] = (catMap[k] || 0) + 1;
    });
    const categorias = Object.entries(catMap)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd);

    const userMap = {};
    t.forEach(x => {
      const k = x.solicitante_nome || 'Desconhecido';
      if (!userMap[k]) userMap[k] = { total: 0, fechados: 0 };
      userMap[k].total++;
      if (x.status === 'fechado') userMap[k].fechados++;
    });
    const usuarios = Object.entries(userMap)
      .map(([nome, d]) => ({ nome, ...d, taxa: d.total > 0 ? ((d.fechados / d.total) * 100).toFixed(0) : 0 }))
      .sort((a, b) => b.total - a.total);

    const hoje = new Date();
    const dias14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() - (13 - i));
      return d;
    });
    const porDia = dias14.map(d => {
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const count = t.filter(x => {
        const c = new Date(x.data_criacao);
        return c.toDateString() === d.toDateString();
      }).length;
      return { label, count };
    });
    const maxDia = Math.max(...porDia.map(d => d.count), 1);

    return { total, abertos, atendimento, fechados, alta, media, baixa,
      taxaResolucao, pendentes, categorias, usuarios, porDia, maxDia };
  }, [ticketsFiltrados]);

  // ── Handler de exportação ──────────────────
  const handleExport = (format) => {
    if (format === 'csv') exportCSV(ticketsFiltrados, metricas, periodoFiltro);
    if (format === 'json') exportJSON(ticketsFiltrados, metricas, periodoFiltro);
    if (format === 'pdf') exportPDF(ticketsFiltrados, metricas, periodoFiltro);
  };

  if (loading) return (
    <div className="reports-loading">
      <div className="spinner" />
      <p>Carregando indicadores...</p>
    </div>
  );

  const CORES_PRIORIDADE = { alta: '#ef4444', media: '#f59e0b', baixa: '#22c55e' };
  const CORES_STATUS = { abertos: '#3b82f6', atendimento: '#f59e0b', fechados: '#22c55e' };
  const CORES_CAT = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4'];

  const tabs = [
    { id: 'geral', label: 'Visão Geral', icon: BarChart3 },
    { id: 'tempo', label: 'Evolução Temporal', icon: Activity },
    { id: 'categorias', label: 'Categorias', icon: Tag },
    { id: 'equipe', label: 'Equipe', icon: Users },
  ];

  return (
    <div className="rp-container">

      {/* ── CABEÇALHO ─────────────────────────── */}
      <header className="rp-header">
        <div className="rp-title-block">
          <h1>Central de Relatórios</h1>
          <p>Análise em tempo real dos chamados do sistema</p>
        </div>

        <div className="rp-controls">
          <div className="rp-period-filter">
            <Filter size={16} />
            <select value={periodoFiltro} onChange={e => setPeriodoFiltro(e.target.value)}>
              <option value="todos">Todo período</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
            </select>
            <ChevronDown size={14} />
          </div>

          <button className="rp-refresh-btn" onClick={fetchData} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            Atualizar
          </button>

          {/* ✅ NOVO: Menu de exportação */}
          <ExportMenu onExport={handleExport} loading={loading} />
        </div>
      </header>

      {/* ── TABS ──────────────────────────────── */}
      <nav className="rp-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`rp-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ══════════════════════════════════════
          TAB: VISÃO GERAL
      ══════════════════════════════════════ */}
      {activeTab === 'geral' && (
        <div className="rp-fade">
          <div className="kpi-grid">
            <KpiCard title="Total de Chamados" value={metricas.total}
              subtitle={`${periodoFiltro === 'todos' ? 'Todos os registros' : `Período selecionado`}`}
              icon={BarChart3} color="#6366f1" />
            <KpiCard title="Em Aberto" value={metricas.abertos}
              subtitle="Aguardando atendimento"
              icon={Clock} color="#3b82f6" />
            <KpiCard title="Em Atendimento" value={metricas.atendimento}
              subtitle="Em andamento"
              icon={Zap} color="#f59e0b" />
            <KpiCard title="Resolvidos" value={metricas.fechados}
              subtitle="Chamados encerrados"
              icon={CheckCircle2} color="#22c55e" />
          </div>

          <div className="rp-row">
            <div className="rp-card rp-card--sm">
              <h3 className="rp-card-title"><Award size={18} /> Taxa de Resolução</h3>
              <div className="donut-center">
                <DonutChart percentage={parseFloat(metricas.taxaResolucao)} color="#22c55e" size={120} />
              </div>
              <div className="donut-legend">
                <span style={{ color: '#22c55e' }}>● Fechados: {metricas.fechados}</span>
                <span style={{ color: '#f59e0b' }}>● Pendentes: {metricas.pendentes}</span>
              </div>
            </div>

            <div className="rp-card rp-card--md">
              <h3 className="rp-card-title"><Activity size={18} /> Distribuição por Status</h3>
              <div className="status-bars">
                {[
                  { label: 'Abertos', val: metricas.abertos, cor: CORES_STATUS.abertos },
                  { label: 'Em Atendimento', val: metricas.atendimento, cor: CORES_STATUS.atendimento },
                  { label: 'Fechados', val: metricas.fechados, cor: CORES_STATUS.fechados },
                ].map(s => (
                  <div key={s.label} className="status-bar-item">
                    <div className="status-bar-header">
                      <span style={{ color: s.cor }}>● {s.label}</span>
                      <strong>{metricas.total > 0 ? ((s.val / metricas.total) * 100).toFixed(1) : 0}%</strong>
                    </div>
                    <div className="status-track">
                      <div className="status-fill" style={{
                        width: metricas.total > 0 ? `${(s.val / metricas.total) * 100}%` : '0%',
                        background: s.cor
                      }} />
                    </div>
                    <small>{s.val} chamados</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="rp-card rp-card--sm">
              <h3 className="rp-card-title"><AlertCircle size={18} /> Por Prioridade</h3>
              <div className="priority-bubbles">
                {[
                  { label: 'Alta', val: metricas.alta, cor: CORES_PRIORIDADE.alta },
                  { label: 'Média', val: metricas.media, cor: CORES_PRIORIDADE.media },
                  { label: 'Baixa', val: metricas.baixa, cor: CORES_PRIORIDADE.baixa },
                ].map(p => (
                  <div key={p.label} className="priority-bubble" style={{ '--bc': p.cor }}>
                    <strong style={{ color: p.cor }}>{p.val}</strong>
                    <span>{p.label}</span>
                  </div>
                ))}
              </div>
              <div className="priority-bars">
                {[
                  { label: 'Alta', val: metricas.alta, cor: CORES_PRIORIDADE.alta },
                  { label: 'Média', val: metricas.media, cor: CORES_PRIORIDADE.media },
                  { label: 'Baixa', val: metricas.baixa, cor: CORES_PRIORIDADE.baixa },
                ].map(p => (
                  <HorizontalBar key={p.label} label={p.label} value={p.val}
                    max={metricas.total} color={p.cor} count={p.val} />
                ))}
              </div>
            </div>
          </div>

          <div className="rp-card">
            <h3 className="rp-card-title"><Clock size={18} /> Chamados Mais Recentes</h3>
            <table className="rp-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Assunto</th>
                  <th>Solicitante</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {ticketsFiltrados.slice(0, 8).map(t => (
                  <tr key={t.id}>
                    <td className="td-id">#{t.id}</td>
                    <td className="td-subject">{t.assunto}</td>
                    <td>{t.solicitante_nome || '—'}</td>
                    <td>
                      <span className="pill" style={{
                        background: CORES_PRIORIDADE[t.prioridade] + '20',
                        color: CORES_PRIORIDADE[t.prioridade]
                      }}>{t.prioridade}</span>
                    </td>
                    <td>
                      <span className={`pill pill-status pill-${t.status?.replace(' ', '-')}`}>{t.status}</span>
                    </td>
                    <td className="td-date">
                      {new Date(t.data_criacao).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ticketsFiltrados.length === 0 && (
              <div className="rp-empty">Nenhum chamado encontrado no período selecionado.</div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: EVOLUÇÃO TEMPORAL
      ══════════════════════════════════════ */}
      {activeTab === 'tempo' && (
        <div className="rp-fade">
          <div className="rp-card">
            <h3 className="rp-card-title"><TrendingUp size={18} /> Chamados por Dia (últimos 14 dias)</h3>
            <div className="bar-chart-container">
              {metricas.porDia.map((d, i) => (
                <div key={i} className="bar-chart-col">
                  <div className="bar-chart-bar-wrap">
                    <div
                      className="bar-chart-bar"
                      style={{ height: `${(d.count / metricas.maxDia) * 100}%` }}
                      title={`${d.label}: ${d.count} chamados`}
                    >
                      {d.count > 0 && <span className="bar-chart-val">{d.count}</span>}
                    </div>
                  </div>
                  <span className="bar-chart-label">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rp-row">
            <div className="rp-card rp-card--sm">
              <h3 className="rp-card-title"><Zap size={18} /> Pico de Chamados</h3>
              {(() => {
                const pico = [...metricas.porDia].sort((a, b) => b.count - a.count)[0];
                return (
                  <div className="pico-box">
                    <strong>{pico?.count || 0}</strong>
                    <span>chamados em {pico?.label || '—'}</span>
                    <p>Dia com maior volume registrado nos últimos 14 dias</p>
                  </div>
                );
              })()}
            </div>

            <div className="rp-card rp-card--sm">
              <h3 className="rp-card-title"><Activity size={18} /> Média Diária</h3>
              <div className="pico-box">
                <strong>
                  {(metricas.porDia.reduce((a, d) => a + d.count, 0) / 14).toFixed(1)}
                </strong>
                <span>chamados por dia</span>
                <p>Média calculada nos últimos 14 dias</p>
              </div>
            </div>

            <div className="rp-card rp-card--sm">
              <h3 className="rp-card-title"><CheckCircle2 size={18} /> Dias sem Chamados</h3>
              <div className="pico-box">
                <strong>
                  {metricas.porDia.filter(d => d.count === 0).length}
                </strong>
                <span>dias sem registro</span>
                <p>Nos últimos 14 dias analisados</p>
              </div>
            </div>
          </div>

          <div className="rp-card">
            <h3 className="rp-card-title"><Calendar size={18} /> Detalhamento por Dia</h3>
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Total</th>
                  <th>Distribuição visual</th>
                </tr>
              </thead>
              <tbody>
                {metricas.porDia.filter(d => d.count > 0).map((d, i) => (
                  <tr key={i}>
                    <td className="td-date">{d.label}</td>
                    <td><strong>{d.count}</strong></td>
                    <td>
                      <div className="inline-bar-track">
                        <div className="inline-bar-fill"
                          style={{ width: `${(d.count / metricas.maxDia) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
                {metricas.porDia.every(d => d.count === 0) && (
                  <tr><td colSpan={3} className="td-empty">Nenhum chamado no período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: CATEGORIAS
      ══════════════════════════════════════ */}
      {activeTab === 'categorias' && (
        <div className="rp-fade">
          <div className="rp-row">
            <div className="rp-card rp-card--lg">
              <h3 className="rp-card-title"><Tag size={18} /> Chamados por Categoria</h3>
              {metricas.categorias.length === 0 ? (
                <div className="rp-empty">Nenhuma categoria encontrada.</div>
              ) : (
                <div className="cat-bars">
                  {metricas.categorias.map((c, i) => (
                    <div key={c.nome} className="cat-bar-row">
                      <div className="cat-bar-info">
                        <span className="cat-dot" style={{ background: CORES_CAT[i % CORES_CAT.length] }} />
                        <span className="cat-name">{c.nome}</span>
                        <span className="cat-pct">
                          {metricas.total > 0 ? ((c.qtd / metricas.total) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div className="cat-track">
                        <div className="cat-fill" style={{
                          width: metricas.total > 0 ? `${(c.qtd / metricas.total) * 100}%` : '0%',
                          background: CORES_CAT[i % CORES_CAT.length]
                        }} />
                      </div>
                      <span className="cat-count">{c.qtd} chamados</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rp-card rp-card--sm">
              <h3 className="rp-card-title"><PieChart size={18} /> Resumo</h3>
              <div className="cat-summary">
                <div className="cat-summary-item">
                  <strong>{metricas.categorias.length}</strong>
                  <span>Categorias ativas</span>
                </div>
                <div className="cat-summary-item">
                  <strong>{metricas.categorias[0]?.nome || '—'}</strong>
                  <span>Mais chamados</span>
                </div>
                <div className="cat-summary-item">
                  <strong>{metricas.categorias[metricas.categorias.length - 1]?.nome || '—'}</strong>
                  <span>Menos chamados</span>
                </div>
                <div className="cat-summary-item">
                  <strong>
                    {metricas.categorias.length > 0
                      ? (metricas.total / metricas.categorias.length).toFixed(1)
                      : 0}
                  </strong>
                  <span>Média por categoria</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rp-card">
            <h3 className="rp-card-title"><BarChart3 size={18} /> Tabela Detalhada por Categoria</h3>
            <table className="rp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Categoria</th>
                  <th>Total</th>
                  <th>Abertos</th>
                  <th>Em Atendimento</th>
                  <th>Fechados</th>
                  <th>% do Total</th>
                </tr>
              </thead>
              <tbody>
                {metricas.categorias.map((c, i) => {
                  const catTickets = ticketsFiltrados.filter(t =>
                    (t.categoria_nome || t.categoria || 'Sem Categoria') === c.nome
                  );
                  const ab = catTickets.filter(t => t.status === 'aberto').length;
                  const at = catTickets.filter(t => t.status === 'em atendimento').length;
                  const fc = catTickets.filter(t => t.status === 'fechado').length;
                  const pct = metricas.total > 0 ? ((c.qtd / metricas.total) * 100).toFixed(1) : 0;
                  return (
                    <tr key={c.nome}>
                      <td className="td-id">
                        <span className="cat-rank" style={{ background: CORES_CAT[i % CORES_CAT.length] }}>
                          {i + 1}
                        </span>
                      </td>
                      <td><strong>{c.nome}</strong></td>
                      <td><strong>{c.qtd}</strong></td>
                      <td><span className="pill" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{ab}</span></td>
                      <td><span className="pill" style={{ background: '#fef3c7', color: '#b45309' }}>{at}</span></td>
                      <td><span className="pill" style={{ background: '#dcfce7', color: '#15803d' }}>{fc}</span></td>
                      <td>
                        <div className="pct-cell">
                          <div className="pct-track">
                            <div className="pct-fill" style={{
                              width: `${pct}%`,
                              background: CORES_CAT[i % CORES_CAT.length]
                            }} />
                          </div>
                          <span>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {metricas.categorias.length === 0 && (
              <div className="rp-empty">Sem dados de categorias.</div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: EQUIPE
      ══════════════════════════════════════ */}
      {activeTab === 'equipe' && (
        <div className="rp-fade">
          <div className="kpi-grid">
            <KpiCard
              title="Solicitantes Ativos"
              value={metricas.usuarios.length}
              subtitle="Com chamados no período"
              icon={Users} color="#8b5cf6"
            />
            <KpiCard
              title="Maior Volume"
              value={metricas.usuarios[0]?.nome?.split(' ')[0] || '—'}
              subtitle={`${metricas.usuarios[0]?.total || 0} chamados abertos`}
              icon={Award} color="#f59e0b"
            />
            <KpiCard
              title="Melhor Resolução"
              value={
                metricas.usuarios.sort((a, b) => b.taxa - a.taxa)[0]?.nome?.split(' ')[0] || '—'
              }
              subtitle={`${metricas.usuarios.sort((a, b) => b.taxa - a.taxa)[0]?.taxa || 0}% de taxa`}
              icon={TrendingUp} color="#22c55e"
            />
            <KpiCard
              title="Média por Usuário"
              value={metricas.usuarios.length > 0
                ? (metricas.total / metricas.usuarios.length).toFixed(1)
                : 0}
              subtitle="Chamados por solicitante"
              icon={BarChart3} color="#06b6d4"
            />
          </div>

          <div className="rp-card">
            <h3 className="rp-card-title"><Users size={18} /> Desempenho por Solicitante</h3>
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Solicitante</th>
                  <th>Total</th>
                  <th>Abertos</th>
                  <th>Em Atend.</th>
                  <th>Fechados</th>
                  <th>Taxa de Resolução</th>
                  <th>Desempenho</th>
                </tr>
              </thead>
              <tbody>
                {metricas.usuarios.map((u, i) => {
                  const userTickets = ticketsFiltrados.filter(t => (t.solicitante_nome || 'Desconhecido') === u.nome);
                  const ab = userTickets.filter(t => t.status === 'aberto').length;
                  const at = userTickets.filter(t => t.status === 'em atendimento').length;
                  const taxaNum = parseFloat(u.taxa);
                  const cor = taxaNum >= 70 ? '#22c55e' : taxaNum >= 40 ? '#f59e0b' : '#ef4444';
                  return (
                    <tr key={u.nome}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar" style={{ background: CORES_CAT[i % CORES_CAT.length] }}>
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <strong>{u.nome}</strong>
                        </div>
                      </td>
                      <td><strong>{u.total}</strong></td>
                      <td><span className="pill" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{ab}</span></td>
                      <td><span className="pill" style={{ background: '#fef3c7', color: '#b45309' }}>{at}</span></td>
                      <td><span className="pill" style={{ background: '#dcfce7', color: '#15803d' }}>{u.fechados}</span></td>
                      <td><strong style={{ color: cor }}>{u.taxa}%</strong></td>
                      <td>
                        <div className="perf-track">
                          <div className="perf-fill" style={{ width: `${u.taxa}%`, background: cor }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {metricas.usuarios.length === 0 && (
              <div className="rp-empty">Nenhum dado de usuários no período.</div>
            )}
          </div>

          <div className="rp-card">
            <h3 className="rp-card-title"><Award size={18} /> Ranking de Volume</h3>
            <div className="ranking-list">
              {metricas.usuarios.slice(0, 5).map((u, i) => (
                <div key={u.nome} className="ranking-item">
                  <div className="ranking-pos" style={{
                    background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#e5e7eb',
                    color: i < 3 ? '#fff' : '#6b7280'
                  }}>{i + 1}</div>
                  <div className="ranking-avatar" style={{ background: CORES_CAT[i % CORES_CAT.length] }}>
                    {u.nome.charAt(0)}
                  </div>
                  <div className="ranking-info">
                    <strong>{u.nome}</strong>
                    <span>{u.total} chamados • {u.taxa}% resolvidos</span>
                  </div>
                  <div className="ranking-bar-wrap">
                    <div className="ranking-bar" style={{
                      width: `${metricas.usuarios[0]?.total > 0 ? (u.total / metricas.usuarios[0].total) * 100 : 0}%`,
                      background: CORES_CAT[i % CORES_CAT.length]
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Reports;