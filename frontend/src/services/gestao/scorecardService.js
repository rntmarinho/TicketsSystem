import { apiFetch } from '../api';

export async function getScorecardItems(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await apiFetch(`/gestao/scorecard/${qs ? `?${qs}` : ''}`);
  return r.json();
}

export async function createScorecardItem(data) {
  const r = await apiFetch('/gestao/scorecard/', { method: 'POST', body: JSON.stringify(data) });
  return r.json();
}

export async function updateScorecardItem(id, data) {
  const r = await apiFetch(`/gestao/scorecard/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return r.json();
}

export async function deleteScorecardItem(id) {
  const r = await apiFetch(`/gestao/scorecard/${id}`, { method: 'DELETE' });
  return r.json();
}
