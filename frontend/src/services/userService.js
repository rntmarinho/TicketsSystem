import { apiFetch } from './api';

export async function getUsers() {

  const response = await apiFetch(
    '/users'
  );

  return await response.json();
}

export async function createUser(data) {

  const response = await apiFetch(
    '/users',
    {
      method: 'POST',
      body: JSON.stringify(data)
    }
  );

  return await response.json();
}