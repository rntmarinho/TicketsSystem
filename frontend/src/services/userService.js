import { apiFetch } from './api';

export async function getUsers() {
  const response = await apiFetch('/api/users');
  return await response.json();
}

export async function getUser(id) {
  const response = await apiFetch(`/api/users/${id}`);
  return await response.json();
}

export async function createUser(data) {
  const response = await apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updateUser(id, data) {
  const response = await apiFetch(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deleteUser(id) {
  const response = await apiFetch(`/api/users/${id}`, {
    method: 'DELETE'
  });
  return await response.json();
}