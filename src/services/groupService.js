const API_BASE = `${import.meta.env.VITE_API_URL || ""}/rest/v1/groups`

function authHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

async function safeJson(response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

function extractError(data, fallback) {
  if (data?.error?.details) return data.error.details
  if (data?.error?.message) return data.error.message
  if (data?.message) return data.message
  return fallback
}

/** GET /rest/v1/groups — admin only. */
export async function getAllGroups() {
  const res = await fetch(API_BASE, { method: "GET", headers: authHeaders() })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to fetch groups."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return Array.isArray(data.data) ? data.data : []
}

/** GET /rest/v1/groups/me — returns only groups the caller belongs to. */
export async function getMyGroups() {
  const res = await fetch(`${API_BASE}/me`, { method: "GET", headers: authHeaders() })
  if (res.status === 404) return []
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to fetch your groups."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return Array.isArray(data.data) ? data.data : []
}

/** POST /rest/v1/groups — admin only. */
export async function createGroup(name, description) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, description }),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to create group."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return data.data
}

/** PUT /rest/v1/groups/{id} — admin only. */
export async function updateGroup(groupId, name, description) {
  const res = await fetch(`${API_BASE}/${groupId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ name, description }),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to update group."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return data.data
}

/** DELETE /rest/v1/groups/{id} — admin only. */
export async function deleteGroup(groupId) {
  const res = await fetch(`${API_BASE}/${groupId}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to delete group."))
  return true
}

/** PUT /rest/v1/groups/{groupId}/members/{userId} — admin only. */
export async function assignUserToGroup(groupId, userId) {
  const res = await fetch(`${API_BASE}/${groupId}/members/${userId}`, {
    method: "PUT",
    headers: authHeaders(),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to assign user to group."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return data.data
}

/** DELETE /rest/v1/groups/{groupId}/members/{userId} — admin only. */
export async function removeUserFromGroup(groupId, userId) {
  const res = await fetch(`${API_BASE}/${groupId}/members/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to remove user from group."))
  return true
}

/** POST /rest/v1/groups/{groupId}/deposit */
export async function depositToGroup(groupId, amount, note, dateTime) {
  const body = { amount: Number(amount), note }
  if (dateTime) body.dateTime = dateTime
  const res = await fetch(`${API_BASE}/${groupId}/deposit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Group deposit failed."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return data.data
}

/** POST /rest/v1/groups/{groupId}/withdraw */
export async function withdrawFromGroup(groupId, amount, note, dateTime) {
  const body = { amount: Number(amount), note }
  if (dateTime) body.dateTime = dateTime
  const res = await fetch(`${API_BASE}/${groupId}/withdraw`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Group withdrawal failed."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return data.data
}

/** GET /rest/v1/groups/{groupId}/transactions */
export async function getGroupTransactions(groupId) {
  const res = await fetch(`${API_BASE}/${groupId}/transactions`, {
    method: "GET",
    headers: authHeaders(),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to fetch group transactions."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return Array.isArray(data.data) ? data.data : []
}

/** GET /rest/v1/groups/{groupId}/summary */
export async function getGroupSummary(groupId) {
  const res = await fetch(`${API_BASE}/${groupId}/summary`, {
    method: "GET",
    headers: authHeaders(),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to fetch group summary."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return data.data
}
