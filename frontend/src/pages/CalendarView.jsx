import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../services/api';
import { getProjects } from '../services/projectService';
import { getStatusMeta } from '../constants/ticketStatus';
import './styles/CalendarView.css';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const parseDate = (val) => {
  if (!val) return null;
  const clean = typeof val === 'string' ? val.replace(' GMT', '') : val;
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
};

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const CalendarView = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFilter = searchParams.get('project') || '';
  const typeFilter = searchParams.get('type') || '';

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectFilter) params.set('project_id', projectFilter);
    if (typeFilter) params.set('type', typeFilter);
    const qs = params.toString();
    const endpoint = qs ? `/tickets/?${qs}` : '/tickets/';

    Promise.all([
      apiFetch(endpoint).then(r => r.json()),
      getProjects().catch(() => [])
    ])
      .then(([ticketData, projectData]) => {
        setTickets(Array.isArray(ticketData) ? ticketData : []);
        setProjects(Array.isArray(projectData) ? projectData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectFilter, typeFilter]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const itemsByDay = useMemo(() => {
    const map = {};
    tickets.forEach(t => {
      const due = parseDate(t.sla);
      if (!due) return;
      const key = dayKey(due);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tickets]);

  const weeks = useMemo(() => {
    const firstOfMonth = cursor;
    const firstWeekday = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - firstWeekday);

    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });

    const rows = [];
    for (let i = 0; i < 42; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const today = new Date();

  if (loading) return <div className="cal-loading">Carregando calendário...</div>;

  return (
    <div className="cal-container">
      <header className="cal-header">
        <div className="cal-title-block">
          <CalendarDays size={24} />
          <h1>Calendário</h1>
        </div>

        <select
          className="cal-project-select"
          value={projectFilter}
          onChange={e => updateParam('project', e.target.value)}
        >
          <option value="">Todos os projetos</option>
          {projects
            .filter(p => p.status !== 'archived' || String(p.id) === projectFilter)
            .map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          className="cal-project-select"
          value={typeFilter}
          onChange={e => updateParam('type', e.target.value)}
        >
          <option value="">Chamados e tarefas</option>
          <option value="chamado">Só chamados</option>
          <option value="tarefa">Só tarefas</option>
        </select>

        <div className="cal-nav">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft size={18} />
          </button>
          <span className="cal-month-label">{MESES[cursor.getMonth()]} {cursor.getFullYear()}</span>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="cal-grid">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="cal-weekday">{d}</div>
        ))}

        {weeks.flat().map((day, i) => {
          const isCurrentMonth = day.getMonth() === cursor.getMonth();
          const isToday = day.toDateString() === today.toDateString();
          const dayItems = itemsByDay[dayKey(day)] || [];

          return (
            <div
              key={i}
              className={`cal-day ${isCurrentMonth ? '' : 'cal-day--muted'} ${isToday ? 'cal-day--today' : ''}`}
            >
              <span className="cal-day-number">{day.getDate()}</span>
              <div className="cal-day-items">
                {dayItems.slice(0, 3).map(item => {
                  const sm = getStatusMeta(item.status);
                  return (
                    <div
                      key={item.id}
                      className="cal-item"
                      style={{ background: sm.bg, color: sm.color }}
                      title={item.subject}
                      onClick={() => navigate(`/tickets/${item.id}`)}
                    >
                      #{item.id} {item.subject}
                      {item.type === 'tarefa' && <span className="cal-item-tag">Tarefa</span>}
                    </div>
                  );
                })}
                {dayItems.length > 3 && (
                  <div className="cal-item-more">+{dayItems.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;
