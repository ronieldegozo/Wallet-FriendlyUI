const API_BASE = `${import.meta.env.VITE_API_URL || ""}/rest/v1`;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** Safely parse JSON — returns null if body is empty or not JSON. */
async function safeJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/** Extract the most useful error message from backend error responses. */
function extractError(data, fallback) {
  if (data?.error?.details) return data.error.details;
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  return fallback;
}

/**
 * GET /rest/v1/savings — Get all users' savings (authenticated).
 * We filter on the frontend by the logged-in user's ID.
 */
export async function getAllSavings() {
  const res = await fetch(`${API_BASE}/savings`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to fetch savings."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * GET /rest/v1/savings/user/{userId} — Get user by ID (admin).
 */
export async function getUserSavingsById(userId) {
  const res = await fetch(`${API_BASE}/savings/user/${userId}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to fetch user savings."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * POST /rest/v1/category/{categoryId}/deposit
 * Body: { userId, amount, note }
 */
export async function deposit(categoryId, userId, amount, note) {
  const res = await fetch(`${API_BASE}/category/${categoryId}/deposit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ userId, amount: Number(amount), note }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Deposit failed."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * POST /rest/v1/category/user/{userId}/withdraw
 * Body: { category, withdrawAmount, date, note }
 * @param date — YYYY-MM-DD string (the deposit date to withdraw from)
 */
export async function withdraw(userId, categoryId, withdrawAmount, date, note) {
  const res = await fetch(`${API_BASE}/category/user/${userId}/withdraw`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      category: categoryId,
      withdrawAmount: Number(withdrawAmount),
      date,
      note,
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Withdrawal failed."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * POST /rest/v1/category/savings/userid/{userId} — Create a new savings category
 * Body: { name, amount, type }
 */
export async function createCategory(userId, name, amount, type, goalDeadline) {
  const body = { name, amount: Number(amount) || 0, type };
  if (goalDeadline) body.goalDeadline = goalDeadline;
  const res = await fetch(`${API_BASE}/category/savings/userid/${userId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to create category."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * PUT /rest/v1/category/user/{userId}?categoryId={categoryId} — Update a category
 * Body: { name, amount, type }
 */
export async function updateCategory(userId, categoryId, name, amount, type, goalDeadline) {
  const body = { name, amount: Number(amount) || 0, type };
  if (goalDeadline) body.goalDeadline = goalDeadline;
  const res = await fetch(`${API_BASE}/category/user/${userId}?categoryId=${categoryId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to update category."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * DELETE /rest/v1/category/user/{userId}/category/{categoryId} — Delete a category
 */
export async function deleteCategory(userId, categoryId) {
  const res = await fetch(`${API_BASE}/category/user/${userId}/category/${categoryId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to delete category."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * GET /rest/v1/category/user/{userId}/transactions
 */
export async function getTransactionHistory(userId) {
  const res = await fetch(`${API_BASE}/category/user/${userId}/transactions`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractError(data, "Failed to fetch transactions."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}
