import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../services/api';
import { getTasks } from '../services/gestao/taskService';
import { getStatusMeta } from '../constants/ticketStatus';
import { useAuth } from '../context/AuthContext';
import './styles/CalendarView.css';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const TASK_COR = { bg: '#ede9fe', color: '#6d28d9' };

const parseDate = (val) => {
  if (!val) return null;
  const clean = typeof val === 'string' ? val.replace(' GMT', '') : val;
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
};

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Calendário pessoal (09/09/2026, pedido da Renata): mostra sempre só os
// itens da PRÓPRIA pessoa — chamados em que é solicitante ou responsável
// (t.user_id / t.assigned_to, campos que a API de chamados já devolve, sem
// precisar de mudança no backend) + tarefas de projeto de que é responsável
// (GET /gestao/tasks/?assignee_id=<eu>, que já filtra isso sozinho). Aberto
// pra todo papel agora — antes era só ADMIN/GESTOR_PROJETO/VISUALIZADOR, e
// esses viam o calendário de todo mundo, não só o próprio.
const CalendarView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id;

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [tickets, setTickets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myId) return;
    setLoading(true);
    Promise.all([
      apiFetch('/tickets/').then((r) => r.json()).catch(() => []),
      getTasks({ assigneeId: myId }).catch(() => []),
    ]).then(([ticketData, taskData]) => {
      const ownTickets = (Array.isArray(ticketData) ? ticketData : [])
        .filter((t) => t.user_id === myId || t.assigned_to === myId);
      setTickets(ownTickets);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setLoading(false);
    });
  }, [myId]);

  const itemsByDay = useMemo(() => {
    const map = {};
    const push = (key, item) => {
      if (!map[key]) map[key] = [];
      map[key].push(item);
    };
    tickets.forEach((t) => {
      const due = parseDate(t.sla);
      if (!due) return;
      push(dayKey(due), { id: `chamado-${t.id}`, kind: 'chamado', label: `#${t.id} ${t.subject}`, status: t.status, to: `/tickets/${t.id}` });
    });
    tasks.forEach((t) => {
      const due = parseDate(t.due_date);
      if (!due) return;
      push(dayKey(due), { id: `tarefa-${t.id}`, kind: 'tarefa', label: t.title, to: `/gestao/projetos/${t.project_id}` });
    });
    return map;
  }, [tickets, tasks]);

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
        <p className="cal-hint">Seus chamados e tarefas de projeto.</p>

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
                  const cor = item.kind === 'tarefa' ? TASK_COR : getStatusMeta(item.status);
                  return (
                    <div
                      key={item.id}
                      className="cal-item"
                      style={{ background: cor.bg, color: cor.color }}
                      title={item.label}
                      onClick={() => navigate(item.to)}
                    >
                      {item.label}
                      {item.kind === 'tarefa' && <span className="cal-item-tag">Tarefa</span>}
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
