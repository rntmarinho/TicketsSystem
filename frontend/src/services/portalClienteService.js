import { apiFetch } from './api';

export async function getPortalProjects() {
  const r = await apiFetch('/portal-cliente/projects');
  return r.json();
}

export async function getPortalProject(id) {
  const r = await apiFetch(`/portal-cliente/projects/${id}`);
  return r.json();
}

export async function getPortalProjectTasks(id) {
  const r = await apiFetch(`/portal-cliente/projects/${id}/tasks`);
  return r.json();
}
