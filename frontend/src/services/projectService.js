import { apiFetch } from './api';

export async function getProjects() {
  const response = await apiFetch('/projects/');
  return await response.json();
}

export async function getProject(id) {
  const response = await apiFetch(`/projects/${id}`);
  return await response.json();
}

export async function createProject(data) {
  const response = await apiFetch('/projects/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updateProject(id, data) {
  const response = await apiFetch(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function setProjectStatus(id, status) {
  const response = await apiFetch(`/projects/${id}/situation`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  return await response.json();
}
