import { apiFetch } from '../api';

export async function getTasks({ projectId, assigneeId, topLevel } = {}) {
  const params = new URLSearchParams();
  if (projectId) params.set('project_id', projectId);
  if (assigneeId) params.set('assignee_id', assigneeId);
  if (topLevel) params.set('top_level', 'true');
  const qs = params.toString();
  const r = await apiFetch(`/gestao/tasks/${qs ? `?${qs}` : ''}`);
  return r.json();
}

export async function getTask(id) {
  const r = await apiFetch(`/gestao/tasks/${id}`);
  return r.json();
}

export async function createTask(data) {
  const r = await apiFetch('/gestao/tasks/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function updateTask(id, data) {
  const r = await apiFetch(`/gestao/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteTask(id) {
  const r = await apiFetch(`/gestao/tasks/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function moveTask(id, direction) {
  const r = await apiFetch(`/gestao/tasks/${id}/move`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });
  return r.json();
}

export async function createDependency(taskId, data) {
  const r = await apiFetch(`/gestao/tasks/${taskId}/dependencies`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteDependency(dependencyId) {
  const r = await apiFetch(`/gestao/tasks/dependencies/${dependencyId}`, { method: 'DELETE' });
  return r.json();
}

export async function getComments(taskId) {
  const r = await apiFetch(`/gestao/tasks/${taskId}/comments`);
  return r.json();
}

export async function createComment(taskId, body) {
  const r = await apiFetch(`/gestao/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return r.json();
}
