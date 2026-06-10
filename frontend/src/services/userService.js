import { apiFetch } from './api';

export async function getUsers() {
  const response = await apiFetch('/users/');
  return await response.json();
}

export async function getUser(id) {
  const response = await apiFetch(`/users/${id}`);
  return await response.json();
}

export async function createUser(data) {
  const response = await apiFetch('/users/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updateUser(id, data) {
  const response = await apiFetch(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function activateUser(id) {
  const response = await apiFetch(`/users/${id}/situation`, {
    method: 'PATCH',
    body: JSON.stringify({ situation: 'A' })
  });
  return await response.json();
}

export async function deleteUser(id) {
  const response = await apiFetch(`/users/${id}`, {
    method: 'DELETE'
  });
  return await response.json();
}