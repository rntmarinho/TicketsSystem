import { apiFetch } from '../api';

export async function getGoals(projectId) {
  const qs = projectId ? `?project_id=${projectId}` : '';
  const r = await apiFetch(`/gestao/goals/${qs}`);
  return r.json();
}

export async function createGoal(data) {
  const r = await apiFetch('/gestao/goals/', { method: 'POST', body: JSON.stringify(data) });
  return r.json();
}

export async function updateGoal(id, data) {
  const r = await apiFetch(`/gestao/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return r.json();
}

export async function deleteGoal(id) {
  const r = await apiFetch(`/gestao/goals/${id}`, { method: 'DELETE' });
  return r.json();
}
