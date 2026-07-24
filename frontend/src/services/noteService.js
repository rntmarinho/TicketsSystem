import { apiFetch } from './api';

export async function getNotes(scope) {
  const response = await apiFetch(`/notes/?scope=${scope}`);
  return await response.json();
}

export async function createNote(data) {
  const response = await apiFetch('/notes/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updateNote(id, data) {
  const response = await apiFetch(`/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deleteNote(id) {
  const response = await apiFetch(`/notes/${id}`, {
    method: 'DELETE'
  });
  return await response.json();
}
