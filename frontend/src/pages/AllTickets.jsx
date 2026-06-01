import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import React from 'react';
import {
  Search, Ticket, Calendar, Clock,
  ChevronDown, ChevronUp, X, SlidersHorizontal,
  Layers, ArrowUpDown
} from 'lucide-react';
import { apiFetch } from '../services/api';
import './styles/AllTickets.css';

/* ─── Definições Auxiliares ────────────────────────────────────────────── */
const STATUS_META = {
  open:   { label: 'Aberto',         bg: '#dbeafe', color: '#1d4ed8' },
  in_progress: { label: 'Em Atendimento', bg: '#fef3c7', color: '#b45309' },
  closed: { label: 'Fechado',        bg: '#dcfce7', color: '#15803d' },
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

/* ─── Sub-componentes ──────────────────────────────────────────────────── */
const Badge = ({ children, bg, color }) => (
  <span className="at-badge" style={{ background: bg, color }}>{children}</span>
);

const Chip = ({ label, onRemove }) => (
  <span className="at-chip">
    {label}
    <button onClick={onRemove}><X size={11} /></button>
  </span>
);

/* ─── Componente Principal ─────────────────────────────────────────────── */
const AllTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  /* Critérios de Filtragem */
  const [fStatus, setFStatus]       = useState('');
  const [fCategory, setFCategory]   = useState('');
  const [fPriority, setFPriority]   = useState('');
  
  const [groupBy, setGroupBy] = useState('none');
  const [sortBy, setSortBy]   = useState('creation_desc'); 

  useEffect(() => {
    apiFetch('/tickets/')
      .then(r => r.json())
      .then(data => { setTickets(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const uniq = (key) => [...new Set(tickets.map(t => t[key]).filter(Boolean))].sort();
  const categories = useMemo(() => uniq('category'), [tickets]);
  const priorities = useMemo(() => uniq('priority'), [tickets]);

  const filtered = useMemo(() => {
    let list = [...tickets];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.subject?.toLowerCase().includes(q) ||
        t.user?.toLowerCase().includes(q)    ||
        String(t.id).includes(q)             ||
        t.category?.toLowerCase().includes(q)
      );
    }
    if (fStatus)   list = list.filter(t => t.status === fStatus);
    if (fCategory) list = list.filter(t => t.category === fCategory);
    if (fPriority) list = list.filter(t => t.priority === fPriority);

    list.sort((a, b) => {
      if (sortBy === 'creation_asc') return new Date(a.creation) - new Date(b.creation);
      if (sortBy === 'sla_asc')      return new Date(a.sla) - new Date(b.sla);
      if (sortBy === 'id')           return a.id - b.id;
      return new Date(b.creation) - new Date(a.creation); // default: creation_desc
    });

    return list;
  }, [tickets, search, fStatus, fCategory, fPriority, sortBy]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '': filtered };

    const getKey = (t) => {
      if (groupBy === 'status')   return t.status ?? 'Indefinido';
      if (groupBy === 'category') return t.category ?? 'Sem categoria';
      if (groupBy === 'priority') return t.priority ?? 'Sem prioridade';
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

  const toggleGroup = (key) => setCollapsed(p => ({ ...p, [key]: !p[key] }));
  const clearFilters = () => { setFStatus(''); setFCategory(''); setFPriority(''); };
  const activeFilters = [fStatus, fCategory, fPriority].filter(Boolean).length;

  const renderRow = (ticket) => {
    const sm = STATUS_META[ticket.status] ?? { label: ticket.status, bg: '#f3f4f6', color: '#374151' };
    
    // Análise temporal do SLA
    const isSlaOverdue = new Date(ticket.sla) < new Date();

    return (
      <tr key={ticket.id} className="at-row">
        <td className="at-td at-id">#{ticket.id}</td>
        <td className="at-td at-subject">
          <span className="at-assunto">{ticket.subject}</span>
          <span className="at-cat-tag">{ticket.category || 'Não categorizado'}</span>
        </td>
        <td className="at-td">
          <div className="at-user-cell">
            <span>{ticket.user || '—'}</span>
          </div>
        </td>
        <td className="at-td">{ticket.priority}</td>
        <td className="at-td"><Badge bg={sm.bg} color={sm.color}>{sm.label}</Badge></td>
        <td className="at-td at-date">
          <Calendar size={13} style={{marginRight: '4px'}}/>
          {fmtDate(ticket.creation)}
        </td>
        <td className="at-td at-date" style={{ color: isSlaOverdue ? '#dc2626' : 'inherit', fontWeight: isSlaOverdue ? 'bold' : 'normal' }}>
          <Clock size={13} style={{marginRight: '4px'}}/>
          {fmtDate(ticket.sla)}
        </td>
        <td className="at-td">
          <Link to={`/tickets/${ticket.id}`} className="at-btn-view">Inspecionar</Link>
        </td>
      </tr>
    );
  };

  if (loading) return <div className="at-loading">Processando registros...</div>;

  return (
    <div className="at-container">
      <div className="at-topbar">
        <div className="at-title-block">
          <Ticket size={24} />
          <div>
            <h1 className="at-h1">Inventário de Chamados</h1>
            <p className="at-subtitle">{filtered.length} registro{filtered.length !== 1 ? 's' : ''} indexado(s)</p>
          </div>
        </div>

        <div className="at-controls">
          <div className="at-search">
            <Search size={16} className="at-search-icon" />
            <input
              type="text"
              placeholder="Pesquisar por assunto ou solicitante..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="at-clear-search" onClick={() => setSearch('')}><X size={14} /></button>}
          </div>
          <button
            className={`at-btn-filters ${filtersOpen ? 'open' : ''}`}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal size={16} /> Parâmetros
          </button>
        </div>
      </div>

      {activeFilters > 0 && (
        <div className="at-chips">
          {fStatus   && <Chip label={`Status: ${fStatus}`} onRemove={() => setFStatus('')} />}
          {fCategory && <Chip label={`Categoria: ${fCategory}`} onRemove={() => setFCategory('')} />}
          {fPriority && <Chip label={`Prioridade: ${fPriority}`} onRemove={() => setFPriority('')} />}
          <button className="at-clear-all" onClick={clearFilters}>Restaurar padrão</button>
        </div>
      )}

      {filtersOpen && (
        <div className="at-filter-panel">
          <div className="at-filter-grid">
            <div className="at-filter-group">
              <label>Status</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">Global</option>
                <option value="open">Aberto</option>
                <option value="in_progress">Em Atendimento</option>
                <option value="closed">Fechado</option>
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
              <label>Prioridade</label>
              <select value={fPriority} onChange={e => setFPriority(e.target.value)}>
                <option value="">Todas</option>
                {priorities.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="at-filter-row2">
            <div className="at-filter-group">
              <label><Layers size={13} /> Agrupamento Estrutural</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                <option value="none">Linear (Sem agrupamento)</option>
                <option value="status">Por Status</option>
                <option value="category">Por Categoria</option>
                <option value="priority">Por Prioridade</option>
              </select>
            </div>
            <div className="at-filter-group">
              <label><ArrowUpDown size={13} /> Critério de Ordenação</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="creation_desc">Criação (Decrescente)</option>
                <option value="creation_asc">Criação (Crescente)</option>
                <option value="sla_asc">SLA (Urgência)</option>
                <option value="id">Identificador Numérico</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="at-card">
        {filtered.length === 0 ? (
          <div className="at-empty">
            <p>Nenhum registro satisfaz os critérios definidos.</p>
          </div>
        ) : (
          <table className="at-table">
            <thead>
              <tr>
                <th className="at-th">ID</th>
                <th className="at-th">Assunto / Categoria</th>
                <th className="at-th">Requisitante</th>
                <th className="at-th">Prioridade</th>
                <th className="at-th">Estado</th>
                <th className="at-th">Abertura</th>
                <th className="at-th">Limite (SLA)</th>
                <th className="at-th">Operação</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([groupKey, groupTickets]) => (
                <React.Fragment key={`g-${groupKey}`}>
                  {groupBy !== 'none' && (
                    <tr className="at-group-row">
                      <td colSpan={8}>
                        <button className="at-group-toggle" onClick={() => toggleGroup(groupKey)}>
                          {collapsed[groupKey] ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
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