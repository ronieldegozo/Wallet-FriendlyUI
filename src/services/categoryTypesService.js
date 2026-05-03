const API_BASE = `${import.meta.env.VITE_API_URL || ""}/rest/v1`;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function extractError(data, fallback) {
  if (data?.error?.details) return data.error.details;
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  return fallback;
}

/**
 * Normalise the API entity ({ id, slug, label }) to the shape the UI already expects:
 * { id: <slug>, label: <label>, _dbId: <numeric id> }.
 *
 * The form value selected by users is the slug (e.g. "savings"), which is what gets
 * stored on SavingsCategory.type — same as before localStorage was retired.
 */
function toUiType(apiType) {
  return {
    id: apiType.slug,
    label: apiType.label,
    _dbId: apiType.id,
  };
}

/**
 * GET /rest/v1/category-types — list all available types.
 * Any authenticated user can read.
 */
export async function getCategoryTypes() {
  const res = await fetch(`${API_BASE}/category-types`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to load category types."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  const list = Array.isArray(data.data) ? data.data : [];
  return list.map(toUiType);
}

/**
 * POST /rest/v1/category-types — admin only.
 */
export async function addCategoryType(label) {
  const res = await fetch(`${API_BASE}/category-types`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ label }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to add category type."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return toUiType(data.data);
}

/**
 * PUT /rest/v1/category-types/{id} — admin only.
 * @param dbId numeric id from the backend (passed as `_dbId` on the UI object)
 */
export async function updateCategoryType(dbId, label) {
  const res = await fetch(`${API_BASE}/category-types/${dbId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ label }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to update category type."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return toUiType(data.data);
}

/**
 * DELETE /rest/v1/category-types/{id} — admin only.
 */
export async function deleteCategoryType(dbId) {
  const res = await fetch(`${API_BASE}/category-types/${dbId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to delete category type."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return true;
}
