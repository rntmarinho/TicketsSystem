import { apiFetch } from '../api';

export async function getApprovalRequests() {
  const r = await apiFetch('/gestao/approval-requests/');
  return r.json();
}

export async function createApprovalRequest(data) {
  const r = await apiFetch('/gestao/approval-requests/', { method: 'POST', body: JSON.stringify(data) });
  return r.json();
}

export async function decideApprovalRequest(id, status) {
  const r = await apiFetch(`/gestao/approval-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  return r.json();
}
