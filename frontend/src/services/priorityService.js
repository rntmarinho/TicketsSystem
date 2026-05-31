import { apiFetch } from './api';

export async function getPriorities() {
  const response = await apiFetch('/priorities/');
  return await response.json();
}

export async function createPriority(data) {
  const response = await apiFetch('/priorities/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updatePriority(id, data) {
  const response = await apiFetch(`/priorities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deletePriority(id) {
  const response = await apiFetch(`/priorities/${id}`, {
    method: 'DELETE'
  });
  return await response.json();
}