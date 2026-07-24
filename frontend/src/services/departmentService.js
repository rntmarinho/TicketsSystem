import { apiFetch } from './api';

export async function getDepartments() {
  const response = await apiFetch('/departments/');
  return await response.json();
}

export async function createDepartment(name) {
  const response = await apiFetch('/departments/', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  return await response.json();
}
