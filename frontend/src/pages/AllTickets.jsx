import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Ticket, Calendar, AlertCircle, User,
  ChevronDown, ChevronUp, X, SlidersHorizontal,
  Layers, ArrowUpDown, LayoutList, LayoutGrid
} from 'lucide-react';
import { apiFetch } from '../services/api'; // Importação do apiFetch adicionada
import './styles/AllTickets.css';

/* ─── helpers ─────────────────────────────────────────────────── */
const PRIORITY_WEIGHT = { alta: 3, media: 2, baixa: 1 };
const PRIORITY_LABEL  = { alta: 'Alta', media: 'Média', baixa: 'Baixa', Baixa: 'Baixa' };
const PRIORITY_COLOR  = { alta: '#ef4444', media: '#f59e0b', baixa: '#22c55e' };

const STATUS_META = {
  aberto:          { label: 'Aberto',          bg: '#dbeafe', color: '#1d4ed8' },
  'em atendimento':{ label: 'Em Atendimento',  bg: '#fef3c7', color: '#b45309' },
  fechado:         { label: 'Fechado',          bg: '#dcfce7', color: '#15803d' },
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

const fmtDateGroup = (iso) => {
  if (!iso) return 'Sem data';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
};

/* ─── sub-components ──────────────────────────────────────────── */
const Badge = ({ children, bg, color }) => (
  <span className="at-badge" style={{ background: bg, color }}>{children}</span>
);

const PriorityDot = ({ p }) => (
  <span className="at-priority-dot" style={{ '--c': PRIORITY_COLOR[p] }}>
    <span className="dot" /> {PRIORITY_LABEL[p] ?? p}
  </span>
);

const Chip = ({ label, onRemove }) => (
  <span className="at-chip">
    {label}
    <button onClick={onRemove}><X size={11} /></button>
  </span>
);

/* ─── main component ──────────────────────────────────────────── */
const AllTickets = () => {
  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  /* filters */
  const [fStatus,    setFStatus]    = useState('');
  const [fPriority,  setFPriority]  = useState('');
  const [fCategory,  setFCategory]  = useState('');
  const [fSolicitor, setFSolicitor] = useState('');
  const [fDateFrom,  setFDateFrom]  = useState('');
  const [fDateTo,    setFDateTo]    = useState('');

  /* grouping & sort */
  const [groupBy,  setGroupBy]  = useState('none');
  const [sortBy,   setSortBy]   = useState('date_desc'); 

  useEffect(() => {
    // Correção: apiFetch com barra no final
    apiFetch('/tickets/')
      .then(r => r.json())
      .then(data => { setTickets(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  /* unique values for filter dropdowns */
  const uniq = (key) => [...new Set(tickets.map(t => t[key]).filter(Boolean))].sort();
  const categories  = useMemo(() => uniq('categoria_nome'), [tickets]);
  const solicitors  = useMemo(() => uniq('solicitante_nome'), [tickets]);

  /* filtered list */
  const filtered = useMemo(() => {
    let list = [...tickets];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.assunto?.toLowerCase().includes(q)         ||
        t.solicitante_nome?.toLowerCase().includes(q)||
        String(t.id).includes(q)                     ||
        t.categoria_nome?.toLowerCase().includes(q)
      );
    }
    if (fStatus)    list = list.filter(t => t.status === fStatus);
    if (fPriority)  list = list.filter(t => t.prioridade === fPriority);
    if (fCategory)  list = list.filter(t => t.categoria_nome === fCategory);
    if (fSolicitor) list = list.filter(t => t.solicitante_nome === fSolicitor);
    if (fDateFrom)  list = list.filter(t => new Date(t.data_criacao) >= new Date(fDateFrom));
    if (fDateTo)    list = list.filter(t => new Date(t.data_criacao) <= new Date(fDateTo + 'T23:59:59'));

    /* sort */
    list.sort((a, b) => {
      if (sortBy === 'priority')   return (PRIORITY_WEIGHT[b.prioridade] ?? 0) - (PRIORITY_WEIGHT[a.prioridade] ?? 0);
      if (sortBy === 'date_asc')   return new Date(a.data_criacao) - new Date(b.data_criacao);
      if (sortBy === 'id')         return a.id - b.id;
      return new Date(b.data_criacao) - new Date(a.data_criacao);
    });

    return list;
  }, [tickets, search, fStatus, fPriority, fCategory, fSolicitor, fDateFrom, fDateTo, sortBy]);

  /* grouped list */
  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '': filtered };

    const getKey = (t) => {
      if (groupBy === 'status')    return t.status ?? 'Sem status';
      if (groupBy === 'priority')  return t.prioridade ?? 'Sem prioridade';
      if (groupBy === 'category')  return t.categoria_nome ?? 'Sem categoria';
      if (groupBy === 'solicitor') return t.solicitante_nome ?? 'Sem solicitante';
      if (groupBy === 'date')      return fmtDateGroup(t.data_criacao);
      return '';
    };

    const map = {};
    filtered.forEach(t => {
      const k = getKey(t);
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
    return map;
  }, [filtered, groupBy]);

  const activeFilters = [fStatus, fPriority, fCategory, fSolicitor, fDateFrom, fDateTo].filter(Boolean).length;

  const clearFilters = () => {
    setFStatus(''); setFPriority(''); setFCategory('');
    setFSolicitor(''); setFDateFrom(''); setFDateTo('');
  };

  const toggleGroup = (key) =>
    setCollapsed(p => ({ ...p, [key]: !p[key] }));

  const renderRow = (ticket) => {
    const sm = STATUS_META[ticket.status] ?? { label: ticket.status, bg: '#f3f4f6', color: '#374151' };
    return (
      <tr key={ticket.id} className="at-row">
        <td className="at-td at-id">#{ticket.id}</td>
        <td className="at-td at-subject">
          <span className="at-assunto">{ticket.assunto}</span>
          <span className="at-cat-tag">{ticket.categoria_nome || 'Sem categoria'}</span>
        </td>
        <td className="at-td">
          <div className="at-user-cell">
            <div className="at-avatar">{(ticket.solicitante_nome ?? '?')[0].toUpperCase()}</div>
            <span>{ticket.solicitante_nome || '—'}</span>
          </div>
        </td>
        <td className="at-td"><PriorityDot p={ticket.prioridade} /></td>
        <td className="at-td"><Badge bg={sm.bg} color={sm.color}>{sm.label}</Badge></td>
        <td className="at-td at-date">
          <Calendar size={13} />
          {fmtDate(ticket.data_criacao)}
        </td>
        <td className="at-td">
          <Link to={`/tickets/${ticket.id}`} className="at-btn-view">Ver</Link>
        </td>
      </tr>
    );
  };

  if (loading) return <div className="at-loading">Carregando chamados…</div>;

  return (
    <div className="at-container">
      <div className="at-topbar">
        <div className="at-title-block">
          <Ticket size={24} />
          <div>
            <h1 className="at-h1">Todos os Chamados</h1>
            <p className="at-subtitle">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="at-controls">
          <div className="at-search">
            <Search size={16} className="at-search-icon" />
            <input
              type="text"
              placeholder="Buscar por assunto, solicitante, ID ou categoria…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="at-clear-search" onClick={() => setSearch('')}><X size={14} /></button>}
          </div>

          <button
            className={`at-btn-filters ${filtersOpen ? 'open' : ''} ${activeFilters ? 'has-active' : ''}`}
            onClick={() => setFiltersOpen(p => !p)}
          >
            <SlidersHorizontal size={16} />
            Filtros
            {activeFilters > 0 && <span className="at-filter-count">{activeFilters}</span>}
          </button>
        </div>
      </div>

      {activeFilters > 0 && (
        <div className="at-chips">
          {fStatus    && <Chip label={`Status: ${STATUS_META[fStatus]?.label ?? fStatus}`} onRemove={() => setFStatus('')} />}
          {fPriority  && <Chip label={`Prioridade: ${PRIORITY_LABEL[fPriority] ?? fPriority}`} onRemove={() => setFPriority('')} />}
          {fCategory  && <Chip label={`Categoria: ${fCategory}`} onRemove={() => setFCategory('')} />}
          {fSolicitor && <Chip label={`Solicitante: ${fSolicitor}`} onRemove={() => setFSolicitor('')} />}
          {fDateFrom  && <Chip label={`De: ${fmtDate(fDateFrom)}`} onRemove={() => setFDateFrom('')} />}
          {fDateTo    && <Chip label={`Até: ${fmtDate(fDateTo)}`}   onRemove={() => setFDateTo('')} />}
          <button className="at-clear-all" onClick={clearFilters}>Limpar tudo</button>
        </div>
      )}

      {filtersOpen && (
        <div className="at-filter-panel">
          <div className="at-filter-grid">
            <div className="at-filter-group">
              <label>Status</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">Todos</option>
                <option value="aberto">Aberto</option>
                <option value="em atendimento">Em Atendimento</option>
                <option value="fechado">Fechado</option>
              </select>
            </div>

            <div className="at-filter-group">
              <label>Prioridade</label>
              <select value={fPriority} onChange={e => setFPriority(e.target.value)}>
                <option value="">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <div className="at-filter-group">
              <label>Categoria</label>
              <select value={fCategory} onChange={e => setFCategory(e.target.value)}>
                <option value="">Todas</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="at-filter-group">
              <label>Solicitante</label>
              <select value={fSolicitor} onChange={e => setFSolicitor(e.target.value)}>
                <option value="">Todos</option>
                {solicitors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="at-filter-group">
              <label>Data de criação — de</label>
              <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} />
            </div>

            <div className="at-filter-group">
              <label>Data de criação — até</label>
              <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} />
            </div>
          </div>

          <div className="at-filter-row2">
            <div className="at-filter-group">
              <label><Layers size={13} /> Agrupar por</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                <option value="none">Sem agrupamento</option>
                <option value="status">Status</option>
                <option value="priority">Prioridade</option>
                <option value="category">Categoria</option>
                <option value="solicitor">Solicitante</option>
                <option value="date">Mês/Ano</option>
              </select>
            </div>

            <div className="at-filter-group">
              <label><ArrowUpDown size={13} /> Ordenar por</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="date_desc">Data (mais recente)</option>
                <option value="date_asc">Data (mais antigo)</option>
                <option value="priority">Prioridade</option>
                <option value="id">ID</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="at-card">
        {filtered.length === 0 ? (
          <div className="at-empty">
            <Ticket size={40} strokeWidth={1.2} />
            <p>Nenhum chamado encontrado com os filtros aplicados.</p>
            {activeFilters > 0 && (
              <button className="at-btn-view" onClick={clearFilters}>Limpar filtros</button>
            )}
          </div>
        ) : (
          <table className="at-table">
            <thead>
              <tr>
                <th className="at-th">ID</th>
                <th className="at-th">Assunto / Categoria</th>
                <th className="at-th">Solicitante</th>
                <th className="at-th">Prioridade</th>
                <th className="at-th">Status</th>
                <th className="at-th">Data</th>
                <th className="at-th">Ação</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([groupKey, groupTickets]) => (
                <React.Fragment key={`g-${groupKey}`}>
                  {groupBy !== 'none' && (
                    <tr className="at-group-row">
                      <td colSpan={7}>
                        <button
                          className="at-group-toggle"
                          onClick={() => toggleGroup(groupKey)}
                        >
                          {collapsed[groupKey]
                            ? <ChevronDown size={15} />
                            : <ChevronUp size={15} />}
                          <span className="at-group-label">{groupKey}</span>
                          <span className="at-group-count">{groupTickets.length}</span>
                        </button>
                      </td>
                    </tr>
                  )}
                  {!collapsed[groupKey] && groupTickets.map(renderRow)}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AllTickets;