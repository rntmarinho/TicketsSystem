import { apiFetch, safeJson } from './api';

export async function login(email, password) {
  const response = await apiFetch('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  return await safeJson(response);
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}