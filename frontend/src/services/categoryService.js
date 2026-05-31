import { apiFetch } from './api';

export async function getCategories() {
  const response = await apiFetch('/categories/');
  return await response.json();
}

export async function createCategory(data) {
  const response = await apiFetch('/categories/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function deleteCategory(id) {
  const response = await apiFetch(`/categories/${id}`, {
    method: 'DELETE'
  });
  return await response.json();
}