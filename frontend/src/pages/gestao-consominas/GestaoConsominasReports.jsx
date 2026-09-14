import { useState, useEffect } from 'react';
import {
  Package, BarChart3, AlertCircle, Clock, Activity, Users, Building2,
  RefreshCw, FileSpreadsheet,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { getStatusMeta } from '../../constants/suprimentosStatus';
import '../styles/Reports.css';
// Mesmas classes de tabela do módulo de trabalho de Suprimentos, pra essa
// visualização ficar igual (mesma convenção que Reports.jsx já usava).
import '../gestao/styles/Gestao.css';

/* Componentes pequenos duplicados de Reports.jsx de propósito (poucas linhas
   cada) — evita criar um módulo compartilhado só pra isso e arriscar quebrar
   as 6 abas de chamado que continuam lá. */
const KpiCard = ({ title, value, sub, icon: Icon, color }) => (
  <div className="kpi-card" style={{ '--ac': color }}>
    <div className="kpi-icon-wrap"><Icon size={20} /></div>
    <div className="kpi-content">
      <span className="kpi-label">{title}</span>
      <strong className="kpi-val">{value}</strong>
      <span className="kpi-sub">{sub}</span>
    </div>
  </div>
);

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

const COR_CAT = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16', '#f43f5e'];

const SUPRIMENTOS_VAZIO = {
  total: 0, valor_total: 0, por_status: [], por_comprador: [], por_centro_custo: [],
  centros_custo_disponiveis: [], itens: [],
};

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

// Página nova (09/09/2026): relatórios corporativos, começando pelo de
// Suprimentos — tirado de dentro de Reports.jsx (aba "Suprimentos", que
// existia ali desde 25/08) porque agora é módulo próprio, "Gestão
// Consominas", só ADMIN/DIRETOR (rota protegida em App.jsx).
const GestaoConsominasReports = () => {
  const [msup, setMsup] = useState(SUPRIMENTOS_VAZIO);
  const [supLoading, setSupLoading] = useState(false);
  const [supExporting, setSupExporting] = useState(false);
  const [supDe, setSupDe] = useState('');
  const [supAte, setSupAte] = useState('');
  const [supCentroCusto, setSupCentroCusto] = useState('');

  const fetchSuprimentos = (de = supDe, ate = supAte, centroCusto = supCentroCusto) => {
    setSupLoading(true);
    const params = new URLSearchParams();
    if (de) params.set('inicio', de);
    if (ate) params.set('fim', ate);
    if (centroCusto) params.set('centro_custo', centroCusto);
    apiFetch(`/reports/suprimentos/summary?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        setMsup({ ...SUPRIMENTOS_VAZIO, ...data });
        setSupLoading(false);
      })
      .catch(err => {
        console.error('Erro ao carregar relatório de Suprimentos:', err);
        setSupLoading(false);
      });
  };

  useEffect(() => { fetchSuprimentos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportSuprimentos = async () => {
    setSupExporting(true);
    try {
      const params = new URLSearchParams();
      if (supDe) params.set('inicio', supDe);
      if (supAte) params.set('fim', supAte);
      if (supCentroCusto) params.set('centro_custo', supCentroCusto);
      const r = await apiFetch(`/reports/suprimentos/export?${params.toString()}`);
      if (!r.ok) throw new Error('Falha ao exportar');
      const blob = await r.blob();
      downloadBlob(blob, `suprimentos_${formatDateFilename()}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar Suprimentos:', err);
      alert('Erro ao exportar planilha de Suprimentos.');
    } finally {
      setSupExporting(false);
    }
  };

  const maxSupStatus = Math.max(...msup.por_status.map(s => s.qtd), 1);
  const maxSupComprador = Math.max(...msup.por_comprador.map(c => c.qtd), 1);
  const maxSupCentroCusto = Math.max(...msup.por_centro_custo.map(c => c.qtd), 1);
  const fmtMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Mesmo cálculo de prazo (72h) usado em GestaoSuprimentos.jsx — duplicado
  // aqui de propósito (função pequena, evita criar um módulo compartilhado
  // só pra isso).
  const formatPrazo = (prazoISO) => {
    if (!prazoISO) return { label: 'Sem prazo', bg: '#f3f4f6', color: '#374151' };
    const limite = new Date(`${prazoISO}T23:59:59`);
    const diffHoras = (limite.getTime() - Date.now()) / 3_600_000;
    if (diffHoras < 0) return { label: `Atrasado (${Math.round(Math.abs(diffHoras))}h)`, bg: '#fee2e2', color: '#991b1b' };
    if (diffHoras < 24) return { label: `${Math.max(1, Math.round(diffHoras))}h restantes`, bg: '#fef3c7', color: '#b45309' };
    const dias = Math.floor(diffHoras / 24);
    return { label: `${dias}d restantes`, bg: '#dcfce7', color: '#166534' };
  };

  // Mesma lógica de GestaoSuprimentos.jsx — o ERP exporta "0" (não vazio) em
  // pedido/seq_pedido enquanto a solicitação ainda não virou ordem de compra.
  const formatPedido = (pedido, seqPedido) => {
    const numPedido = String(pedido ?? '').trim();
    if (!numPedido || numPedido === '0') return '—';
    const numSeq = String(seqPedido ?? '').trim();
    return numSeq && numSeq !== '0' ? `${numPedido}/${numSeq}` : numPedido;
  };

  // Mesma lógica de GestaoSuprimentos.jsx — Numeric(14,4) serializado cru
  // ("1.0000") parece errado na tela; formata como BR, sem zeros à direita.
  const formatDecimalDisplay = (value, { grouping = false } = {}) => {
    if (value === null || value === undefined || value === '') return '';
    const numero = Number(value);
    if (Number.isNaN(numero)) return String(value);
    return numero.toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: grouping });
  };

  return (
    <div className="rp-root">
      <header className="rp-header">
        <div>
          <h1 className="rp-title">Gestão Consominas</h1>
          <p className="rp-subtitle">Relatórios corporativos — Suprimentos (mais módulos em breve)</p>
        </div>
      </header>

      <div className="rp-fade">

        {/* Filtro de período (Data Limite p/ Compra) + exportação */}
        <div className="rp-card rp-card--full sup-toolbar">
          <div className="sup-toolbar-dates">
            <label>Data Limite de
              <input type="date" value={supDe} onChange={e => setSupDe(e.target.value)} />
            </label>
            <label>até
              <input type="date" value={supAte} onChange={e => setSupAte(e.target.value)} />
            </label>
            <label>Centro de Custo
              <select value={supCentroCusto} onChange={e => setSupCentroCusto(e.target.value)}>
                <option value="">Todos</option>
                {msup.centros_custo_disponiveis.map(cc => <option key={cc} value={cc}>{cc}</option>)}
              </select>
            </label>
            <button className="rp-btn rp-btn--primary" onClick={() => fetchSuprimentos()} disabled={supLoading}>
              <RefreshCw size={15} className={supLoading ? 'spinning' : ''} />
              Aplicar
            </button>
          </div>
          <button className="rp-btn" onClick={handleExportSuprimentos} disabled={supExporting}>
            <FileSpreadsheet size={15} />
            {supExporting ? 'Exportando...' : 'Exportar Suprimentos (.xlsx)'}
          </button>
        </div>

        {supLoading ? (
          <div className="rp-empty">Carregando dados de Suprimentos…</div>
        ) : (
          <>
            <div className="kpi-grid">
              <KpiCard title="Total de Linhas" value={msup.total} sub="no período selecionado" icon={Package} color="#6366f1" />
              <KpiCard title="Valor Total" value={fmtMoeda(msup.valor_total)} sub="Σ Preço Sol. × Qtde Solicitada" icon={BarChart3} color="#14b8a6" />
              {msup.por_status.filter(s => s.status === 'ATRASADO').map(s => (
                <KpiCard key="atrasado" title="Atrasados" value={s.qtd} sub="status Atrasado" icon={AlertCircle} color="#ef4444" />
              ))}
              {msup.por_status.filter(s => s.status === 'PENDENTE').map(s => (
                <KpiCard key="pendente" title="Pendentes" value={s.qtd} sub="status Pendente" icon={Clock} color="#f59e0b" />
              ))}
            </div>

            <div className="rp-row-3">
              <div className="rp-card">
                <h3 className="rp-card-title"><Activity size={16} /> Por Status</h3>
                {msup.por_status.map(s => (
                  <HBar key={s.status} label={s.label} value={s.qtd} max={maxSupStatus} color={getStatusMeta(s.status).color} />
                ))}
              </div>
              <div className="rp-card">
                <h3 className="rp-card-title"><Users size={16} /> Por Comprador</h3>
                {msup.por_comprador.length === 0 && <div className="rp-empty">Sem dados no período.</div>}
                {msup.por_comprador.map((c, i) => (
                  <HBar key={c.nome} label={c.nome} value={c.qtd} max={maxSupComprador} color={COR_CAT[i % COR_CAT.length]} />
                ))}
              </div>
              <div className="rp-card">
                <h3 className="rp-card-title"><Building2 size={16} /> Por Centro de Custo</h3>
                {msup.por_centro_custo.length === 0 && <div className="rp-empty">Sem dados no período.</div>}
                {msup.por_centro_custo.map((c, i) => (
                  <HBar key={c.nome} label={c.nome} value={c.qtd} max={maxSupCentroCusto} color={COR_CAT[i % COR_CAT.length]} />
                ))}
              </div>
            </div>

            {/* Visualização detalhada — mesma tabela do módulo de trabalho
                (GestaoSuprimentos), mas com TODAS as linhas, sem restrição
                de comprador. Só leitura aqui — edição continua no módulo. */}
            <div className="rp-card rp-card--full">
              <h3 className="rp-card-title"><Package size={16} /> Linhas de Suprimentos ({msup.itens.length})</h3>
              <div className="gestao-table-wrap suprimentos-table-wrap">
                <table className="gestao-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Descrição</th>
                      <th>Quantidade</th>
                      <th>Centro de Custo</th>
                      <th>Solicitação</th>
                      <th>Ordem de Compra</th>
                      <th>Status da OC</th>
                      <th>Data Limite p/ Compra</th>
                      <th>Prazo</th>
                      <th>Status</th>
                      <th>Justificativa</th>
                      <th>Comprador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {msup.itens.length === 0 ? (
                      <tr><td colSpan={12} className="gestao-empty">Nenhuma linha no período/filtro selecionado.</td></tr>
                    ) : (
                      msup.itens.map(item => {
                        const meta = getStatusMeta(item.status);
                        const prazoMeta = formatPrazo(item.prazo);
                        return (
                          <tr key={item.id}>
                            <td className="suprimentos-col-wrap">{item.produto || '—'}</td>
                            <td className="suprimentos-col-wrap">{item.descricao_complementar_produto || '—'}</td>
                            <td className="suprimentos-col-qtd">{formatDecimalDisplay(item.qtde_solicitada, { grouping: true }) || '—'}</td>
                            <td className="suprimentos-col-wrap">{item.descricao_centro_custo || item.centro_custo || '—'}</td>
                            <td>{item.solicitacao || '—'}{item.seq_solicitacao ? `/${item.seq_solicitacao}` : ''}</td>
                            <td>{formatPedido(item.pedido, item.seq_pedido)}</td>
                            <td className="suprimentos-col-wrap">{item.status_pedido || '—'}</td>
                            <td>{item.data_limite_compra || '—'}</td>
                            <td className="suprimentos-col-prazo">
                              <span className="suprimentos-badge" style={{ background: prazoMeta.bg, color: prazoMeta.color }}>{prazoMeta.label}</span>
                            </td>
                            <td><span className="suprimentos-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span></td>
                            <td className="suprimentos-col-justificativa">{item.justificativa || '—'}</td>
                            <td>{item.comprador?.name || '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GestaoConsominasReports;
