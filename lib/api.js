const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    redirect: 'follow',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getReports() {
  if (!API_URL) throw new Error('API_URL 尚未設定');
  return request(`${API_URL}?action=getReports`);
}

export async function addReport(data) {
  if (!API_URL) throw new Error('API_URL 尚未設定');
  return request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'addReport', data }),
  });
}

export async function updateReport(id, field, value) {
  if (!API_URL) throw new Error('API_URL 尚未設定');
  return request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'updateReport', id, data: { [field]: value } }),
  });
}

export async function deleteReport(id) {
  if (!API_URL) throw new Error('API_URL 尚未設定');
  return request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'deleteReport', id }),
  });
}
  if (!API_URL) throw new Error('API_URL 尚未設定');
  return request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'auth', password }),
  });
}
