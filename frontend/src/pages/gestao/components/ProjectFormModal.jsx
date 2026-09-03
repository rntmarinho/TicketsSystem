import { useState } from 'react';

const STATUS_LABELS = {
  PLANEJADO: 'Planejado',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluído',
};

const toInputDate = (iso) => (iso ? String(iso).slice(0, 10) : '');

/**
 * Modal de criar/editar projeto (03/09/2026) — usado pela lista de Projetos e
 * pelo cabeçalho do detalhe. Setor só editável por ADMIN/DIRETOR/GESTOR_PROJETO;
 * os demais criam no próprio setor (o backend força isso de qualquer forma).
 */
const ProjectFormModal = ({ mode, project, departments, teams, isPrivileged, userDepartment, onClose, onSaved, createProject, updateProject }) => {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    status: project?.status || 'PLANEJADO',
    department_id: project ? (project.department_id ?? '') : (userDepartment?.id ? String(userDepartment.id) : ''),
    team_id: project?.team_id || '',
    start_date: toInputDate(project?.start_date),
    end_date: toInputDate(project?.end_date),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };
    if (isPrivileged) payload.department_id = form.department_id ? Number(form.department_id) : null;
    if (isEdit) payload.status = form.status;
    else if (form.team_id) payload.team_id = form.team_id;
    const r = isEdit ? await updateProject(project.id, payload) : await createProject(payload);
    setSaving(false);
    if (!r || r.success === false) {
      alert((r && r.message) || 'Erro ao salvar o projeto.');
      return;
    }
    onSaved(r.project);
  };

  return (
    <div className="gestao-modal-overlay" onClick={onClose}>
      <div className="gestao-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar Projeto' : 'Novo Projeto'}</h2>
        <form onSubmit={handleSubmit}>
          <label>Nome</label>
          <input type="text" required minLength={2} maxLength={150} value={form.name} onChange={(e) => set('name', e.target.value)} />
          <label>Descrição</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
          {isEdit && (
            <>
              <label>Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </>
          )}
          <label>Setor</label>
          {isPrivileged ? (
            <select value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
              <option value="">Sem setor (só TI/diretoria enxerga)</option>
              {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </select>
          ) : (
            <input type="text" value={(project ? project.department : userDepartment?.name) || ''} disabled />
          )}
          <small className="gestao-hint">Quem é do setor escolhido enxerga o projeto; dono, aprovador e responsáveis por tarefa também.</small>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label>Início</label>
              <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </div>
            <div>
              <label>Término previsto</label>
              <input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
            </div>
          </div>
          {!isEdit && isPrivileged && teams.length > 1 && (
            <>
              <label>Equipe</label>
              <select value={form.team_id} onChange={(e) => set('team_id', e.target.value)}>
                <option value="">(padrão)</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </>
          )}
          <div className="gestao-modal-actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="gestao-btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : (isEdit ? 'Salvar' : 'Criar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectFormModal;
