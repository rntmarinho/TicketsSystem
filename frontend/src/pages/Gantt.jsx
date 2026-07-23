import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GanttChartSquare } from 'lucide-react';
import { apiFetch } from '../services/api';
import { getProjects } from '../services/projectService';
import { getStatusMeta, normalizeStatus } from '../constants/ticketStatus';
import './styles/Gantt.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 36; // px por dia na régua

const startOfDay = (d) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const parseDate = (val) => {
  if (!val) return null;
  const clean = typeof val === 'string' ? val.replace(' GMT', '') : val;
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDay = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const Gantt = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFilter = searchParams.get('project') || '';

  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const endpoint = projectFilter ? `/tickets/?project_id=${projectFilter}` : '/tickets/';

    Promise.all([
      apiFetch(endpoint).then(r => r.json()),
      getProjects().catch(() => [])
    ])
      .then(([ticketData, projectData]) => {
        setTickets(Array.isArray(ticketData) ? ticketData : []);
        setProjects(Array.isArray(projectData) ? projectData : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Não foi possível carregar os dados do Gantt.');
        setLoading(false);
      });
  }, [projectFilter]);

  const items = useMemo(() => {
    return tickets
      .map(t => ({
        ...t,
        _start: parseDate(t.start_date) || parseDate(t.creation),
        _end: parseDate(t.sla),
      }))
      .filter(t => t._start && t._end)
      .sort((a, b) => a._start - b._start);
  }, [tickets]);

  const { rangeStart, totalDays } = useMemo(() => {
    const hoje = startOfDay(new Date());
    if (items.length === 0) {
      return { rangeStart: new Date(hoje.getTime() - 3 * DAY_MS), totalDays: 21 };
    }
    const minStart = items.reduce((min, t) => (t._start < min ? t._start : min), items[0]._start);
    const maxEnd = items.reduce((max, t) => (t._end > max ? t._end : max), items[0]._end);

    const start = startOfDay(new Date(Math.min(minStart.getTime(), hoje.getTime()) - DAY_MS));
    const end = startOfDay(new Date(maxEnd.getTime() + DAY_MS));
    const span = Math.max(14, Math.ceil((end - start) / DAY_MS));

    return { rangeStart: start, totalDays: span };
  }, [items]);

  const dayColumns = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => new Date(rangeStart.getTime() + i * DAY_MS));
  }, [rangeStart, totalDays]);

  const offsetDays = (date) => Math.round((startOfDay(date) - rangeStart) / DAY_MS);

  if (loading) return <div className="gantt-loading">Carregando Gantt...</div>;

  return (
    <div className="gantt-container">
      <header className="gantt-header">
        <div className="gantt-title-block">
          <GanttChartSquare size={24} />
          <h1>Gantt</h1>
        </div>

        <select
          className="gantt-project-select"
          value={projectFilter}
          onChange={e => (e.target.value ? setSearchParams({ project: e.target.value }) : setSearchParams({}))}
        >
          <option value="">Todos os projetos</option>
          {projects
            .filter(p => p.status !== 'archived' || String(p.id) === projectFilter)
            .map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>

        {error && <div className="gantt-error">{error}</div>}
      </header>

      {items.length === 0 ? (
        <div className="gantt-empty">Nenhum item com data de início e prazo definidos.</div>
      ) : (
        <div className="gantt-scroll">
          <div className="gantt-grid" style={{ width: totalDays * DAY_WIDTH + 260 }}>

            <div className="gantt-ruler">
              <div className="gantt-ruler-spacer" />
              {dayColumns.map((d, i) => (
                <div
                  key={i}
                  className={`gantt-ruler-cell ${startOfDay(d).getTime() === startOfDay(new Date()).getTime() ? 'gantt-ruler-cell--today' : ''}`}
                  style={{ width: DAY_WIDTH }}
                >
                  {fmtDay(d)}
                </div>
              ))}
            </div>

            {items.map(item => {
              const sm = getStatusMeta(item.status);
              const startOffset = offsetDays(item._start);
              const durationDays = Math.max(1, offsetDays(item._end) - startOffset + 1);

              return (
                <div key={item.id} className="gantt-row">
                  <div className="gantt-row-label" title={item.subject}>
                    <span className="gantt-row-id">#{item.id}</span>
                    <span className="gantt-row-subject">{item.subject}</span>
                    {item.type === 'tarefa' && <span className="gantt-row-tag">Tarefa</span>}
                  </div>

                  <div className="gantt-row-track" style={{ width: totalDays * DAY_WIDTH }}>
                    <div
                      className="gantt-bar"
                      style={{
                        left: startOffset * DAY_WIDTH,
                        width: durationDays * DAY_WIDTH - 4,
                        background: sm.bg,
                        color: sm.color,
                        border: `1px solid ${sm.color}`,
                      }}
                      title={`${item.subject} — ${normalizeStatus(item.status)}`}
                      onClick={() => navigate(`/tickets/${item.id}`)}
                    >
                      {sm.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Gantt;
