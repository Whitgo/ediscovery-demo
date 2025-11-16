const API_URL = process.env.REACT_APP_API_URL || "https://localhost:4443/api";

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}