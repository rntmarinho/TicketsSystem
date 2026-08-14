import { apiFetch } from '../api';

export async function getFields(projectId) {
  const r = await apiFetch(`/gestao/projects/${projectId}/fields`);
  return r.json();
}

export async function createField(projectId, data) {
  const r = await apiFetch(`/gestao/projects/${projectId}/fields`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function updateField(id, data) {
  const r = await apiFetch(`/gestao/fields/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteField(id) {
  const r = await apiFetch(`/gestao/fields/${id}`, { method: 'DELETE' });
  return r.json();
}
