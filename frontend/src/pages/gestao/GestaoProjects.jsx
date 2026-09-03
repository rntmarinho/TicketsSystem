import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, FolderKanban, Loader2, Building2, Search, MoreVertical, Archive, ArchiveRestore, Trash2, Pencil, User, ListChecks, CalendarDays,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getProjects, createProject, updateProject, deleteProject } from '../../services/gestao/projectService';
import { getTeams } from '../../services/gestao/teamService';
import { getDepartments } from '../../services/departmentService';
import ProjectFormModal from './components/ProjectFormModal';
import './styles/Gestao.css';

export const STATUS_LABELS = {
  PLANEJADO: 'Planejado',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluído',
};

// Espelha services/gestao_permissions.py::PROJECT_MANAGER_ROLES — criam projeto
// em qualquer setor e gerenciam qualquer projeto. Os demais criam só no próprio
// setor e gerenciam só os projetos de que são donos (o backend é quem decide).
const PRIVILEGED_ROLES = ['ADMIN', 'DIRETOR', 'GESTOR_PROJETO'];

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : null);

const CardMenu = ({ project, canManage, onOpen, onEdit, onArchive, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const stop = (e) => e.stopPropagation();
  return (
    <div className="gestao-card-menu" ref={ref} onClick={stop}>
      <button type="button" className="gestao-icon-btn" title="Ações" onClick={() => setOpen((v) => !v)}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="gestao-card-menu-list">
          <button type="button" onClick={() => { setOpen(false); onOpen(); }}><FolderKanban size={14} /> Abrir</button>
          {canManage && (
            <>
              <button type="button" onClick={() => { setOpen(false); onEdit(); }}><Pencil size={14} /> Editar</button>
              <button type="button" onClick={() => { setOpen(false); onArchive(); }}>
                {project.archived_at ? <><ArchiveRestore size={14} /> Desarquivar</> : <><Archive size={14} /> Arquivar</>}
              </button>
              <button type="button" className="danger" onClick={() => { setOpen(false); onDelete(); }}><Trash2 size={14} /> Excluir</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const GestaoProjects = () => {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', project }
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const isPrivileged = PRIVILEGED_ROLES.includes(role);
  const myDepartmentId = user?.department_id || null;
  const canCreate = role !== 'VISUALIZADOR' && (isPrivileged || !!myDepartmentId);
  const canManage = (p) => isPrivileged || (p.owner?.id != null && p.owner.id === user?.id);

  const load = async () => {
    setLoading(true);
    const [projectsData, teamsData, deptData] = await Promise.all([getProjects({ includeArchived: showArchived }), getTeams(), getDepartments()]);
    setProjects(Array.isArray(projectsData) ? projectsData : []);
    setTeams(Array.isArray(teamsData) ? teamsData : []);
    setDepartments(Array.isArray(deptData) ? deptData : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleArchive = async (p) => {
    const acao = p.archived_at ? 'desarquivar' : 'arquivar';
    if (!window.confirm(`Deseja ${acao} o projeto "${p.name}"?${p.archived_at ? '' : ' Ele some da lista e do Kanban geral, mas pode ser desarquivado depois.'}`)) return;
    const r = await updateProject(p.id, { archived: !p.archived_at });
    if (r.success === false) alert(r.message || `Não foi possível ${acao}.`);
    load();
  };

  const handleDelete = async (p) => {
    const n = p.task_count || 0;
    const msg = `Excluir o projeto "${p.name}"?\n\nIsso apaga o projeto${n ? ` e suas ${n} tarefa(s)` : ''}, com comentários, anexos, marcos, riscos, decisões e ideias. Não dá pra desfazer.\n\nSe a ideia é só tirar da lista, use "Arquivar".`;
    if (!window.confirm(msg)) return;
    const r = await deleteProject(p.id);
    if (r.success === false) alert(r.message || 'Não foi possível excluir.');
    load();
  };

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (filterDept === '__none__' && p.department_id) return false;
      if (filterDept && filterDept !== '__none__' && String(p.department_id) !== filterDept) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (q && !`${p.name} ${p.description || ''} ${p.owner?.name || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, filterDept, filterStatus, search]);

  const hasFilter = Boolean(search || filterDept || filterStatus);

  if (loading) {
    return <div className="gestao-loading"><Loader2 className="spin" size={28} /></div>;
  }

  return (
    <div className="gestao-container">
      <header className="gestao-header">
        <h1><FolderKanban size={24} /> Projetos</h1>
        {canCreate && (
          <button className="gestao-btn-primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={18} /> Novo Projeto
          </button>
        )}
      </header>

      <div className="gestao-toolbar">
        <div className="gestao-search">
          <Search size={15} />
          <input placeholder="Buscar por nome, descrição ou dono..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="gestao-select-inline" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} title="Filtrar por status">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {isPrivileged && departments.length > 0 && (
          <select className="gestao-select-inline" value={filterDept} onChange={(e) => setFilterDept(e.target.value)} title="Filtrar por setor">
            <option value="">Todos os setores</option>
            {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            <option value="__none__">Sem setor</option>
          </select>
        )}
        <label className="gestao-check">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivados
        </label>
        <span className="gestao-toolbar-count">
          {hasFilter ? `${visibleProjects.length} de ${projects.length}` : `${projects.length}`} projeto(s)
        </span>
      </div>

      {!isPrivileged && !myDepartmentId && (
        <p className="gestao-hint">
          Seu usuário não tem setor cadastrado — você só enxerga projetos em que é dono, aprovador ou responsável por
          alguma tarefa. Peça ao TI pra cadastrar seu setor na tela Usuários.
        </p>
      )}

      <div className="gestao-project-grid">
        {visibleProjects.length === 0 && (
          <p className="gestao-empty">{projects.length === 0 ? 'Nenhum projeto ainda.' : 'Nenhum projeto com esses filtros.'}</p>
        )}
        {visibleProjects.map((p) => (
          <div
            key={p.id}
            className={`gestao-project-card${p.archived_at ? ' archived' : ''}`}
            onClick={() => navigate(`/gestao/projetos/${p.id}`)}
          >
            <div className="gestao-project-card-header">
              <h3>{p.name}</h3>
              <div className="gestao-project-card-actions">
                {p.archived_at ? (
                  <span className="gestao-badge gestao-status-arquivado" title={`Arquivado em ${fmtDate(p.archived_at)}`}>Arquivado</span>
                ) : (
                  <span className={`gestao-badge gestao-status-${p.status?.toLowerCase()}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                )}
                <CardMenu
                  project={p} canManage={canManage(p)}
                  onOpen={() => navigate(`/gestao/projetos/${p.id}`)}
                  onEdit={() => setModal({ mode: 'edit', project: p })}
                  onArchive={() => handleArchive(p)}
                  onDelete={() => handleDelete(p)}
                />
              </div>
            </div>
            <div className="gestao-project-setor">
              <Building2 size={13} /> {p.department || 'Sem setor'}
            </div>
            {p.description && <p className="gestao-project-desc">{p.description}</p>}
            <div className="gestao-progress-bar">
              <div className="gestao-progress-fill" style={{ width: `${p.percent_complete || 0}%` }} />
            </div>
            <div className="gestao-project-meta">
              <span>{p.percent_complete || 0}% concluído</span>
              {p.overdue_count > 0 && <span className="gestao-overdue">{p.overdue_count} atrasada(s)</span>}
            </div>
            <div className="gestao-project-footer">
              <span title="Dono"><User size={12} /> {p.owner?.name?.split(' ')[0] || '—'}</span>
              <span title="Tarefas"><ListChecks size={12} /> {p.task_count ?? 0}</span>
              {(p.start_date || p.end_date) && (
                <span title="Período"><CalendarDays size={12} /> {fmtDate(p.start_date) || '…'} – {fmtDate(p.end_date) || '…'}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <ProjectFormModal
          mode={modal.mode}
          project={modal.project}
          departments={departments}
          teams={teams}
          isPrivileged={isPrivileged}
          userDepartment={{ id: myDepartmentId, name: user?.department }}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
          createProject={createProject}
          updateProject={updateProject}
        />
      )}
    </div>
  );
};

export default GestaoProjects;
