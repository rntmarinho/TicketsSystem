import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getPortalProject, getPortalProjectTasks } from '../../services/portalClienteService';
import '../gestao/styles/Gestao.css';

const STATUS_LABELS = { A_FAZER: 'A Fazer', FAZENDO: 'Fazendo', BLOQUEADO: 'Bloqueado', FEITO: 'Feito' };
const PRIORITY_CLASS = { BAIXA: 'gestao-priority-baixa', MEDIA: 'gestao-priority-media', ALTA: 'gestao-priority-alta', URGENTE: 'gestao-priority-urgente' };

const PortalClienteProject = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPortalProject(id), getPortalProjectTasks(id)]).then(([p, t]) => {
      setProject(p);
      setTasks(Array.isArray(t) ? t : []);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  if (!project || project.success === false) {
    return <div className="gestao-container"><p className="gestao-empty">Projeto não encontrado.</p></div>;
  }

  return (
    <div className="gestao-container">
      <Link to="/portal-cliente" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--text)' }}>
        <ArrowLeft size={16} /> Meus Projetos
      </Link>
      <header className="gestao-header">
        <h1>{project.name}</h1>
      </header>
      {project.description && <p style={{ opacity: 0.8, marginTop: -12 }}>{project.description}</p>}
      <div className="gestao-progress-bar"><div className="gestao-progress-fill" style={{ width: `${project.percent_complete || 0}%` }} /></div>
      <p className="gestao-project-meta">{project.percent_complete || 0}% concluído</p>

      <h3 className="gestao-section-title">Tarefas</h3>
      <div className="gestao-task-list">
        {tasks.map((t) => (
          <div key={t.id} className="gestao-task-row">
            <div className="gestao-task-row-title">{t.title}</div>
            <div>{t.assignee?.name || '—'}</div>
            <div className={PRIORITY_CLASS[t.priority]}>{t.priority}</div>
            <div>{t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '—'}</div>
            <div>{STATUS_LABELS[t.status]}</div>
          </div>
        ))}
        {tasks.length === 0 && <p className="gestao-empty">Nenhuma tarefa cadastrada ainda.</p>}
      </div>
    </div>
  );
};

export default PortalClienteProject;
