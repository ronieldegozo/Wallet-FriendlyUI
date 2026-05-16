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

/** DELETE /rest/v1/groups/{id} — admin only. Detaches all members. */
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

/** DELETE /rest/v1/groups/members/{userId} — admin only. */
export async function removeUserFromGroup(userId) {
  const res = await fetch(`${API_BASE}/members/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to remove user from group."))
  return true
}

/**
 * GET /rest/v1/groups/me/summary — any authenticated user.
 * Returns the aggregated summary for the caller's own group only.
 * Returns null when the caller has no group (404 from server).
 */
export async function getMyGroupSummary() {
  const res = await fetch(`${API_BASE}/me/summary`, {
    method: "GET",
    headers: authHeaders(),
  })
  if (res.status === 404) return null
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to fetch group summary."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return data.data
}

/** GET /rest/v1/groups/{groupId}/summary — admin only. */
export async function getAdminGroupSummary(groupId) {
  const res = await fetch(`${API_BASE}/${groupId}/summary`, {
    method: "GET",
    headers: authHeaders(),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(extractError(data, "Failed to fetch group summary."))
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.")
  return data.data
}
