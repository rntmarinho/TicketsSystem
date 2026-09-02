import { apiFetch } from '../api';

export async function getProjects() {
  const r = await apiFetch('/gestao/projects/');
  return r.json();
}

export async function getProject(id) {
  const r = await apiFetch(`/gestao/projects/${id}`);
  return r.json();
}

export async function createProject(data) {
  const r = await apiFetch('/gestao/projects/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function updateProject(id, data) {
  const r = await apiFetch(`/gestao/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteProject(id) {
  const r = await apiFetch(`/gestao/projects/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function getBoard(id) {
  const r = await apiFetch(`/gestao/projects/${id}/board`);
  return r.json();
}

export async function updateBoard(id, content) {
  const r = await apiFetch(`/gestao/projects/${id}/board`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  return r.json();
}

export async function getProjectClients(id) {
  const r = await apiFetch(`/gestao/projects/${id}/clients`);
  return r.json();
}

export async function addProjectClient(id, userId) {
  const r = await apiFetch(`/gestao/projects/${id}/clients`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
  return r.json();
}

export async function removeProjectClient(id, userId) {
  const r = await apiFetch(`/gestao/projects/${id}/clients/${userId}`, { method: 'DELETE' });
  return r.json();
}
