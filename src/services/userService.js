const API_BASE_URL = "/rest/v1/savings";

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
 * GET /rest/v1/savings — Fetch all users
 */
export async function getAllUsers() {
  const response = await fetch(API_BASE_URL, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await safeJson(response);
  if (!response.ok) throw new Error(extractError(data, "Failed to fetch users."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * GET /rest/v1/savings/user/{userId} — Fetch user by ID
 */
export async function getUserById(userId) {
  const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await safeJson(response);
  if (!response.ok) throw new Error(extractError(data, "Failed to fetch user."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * POST /rest/v1/savings — Create a new user
 * Fields: firstName, middleName, lastName, occupation, email, password, monthlySalary, role
 */
export async function createUser(userData) {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(userData),
  });
  const data = await safeJson(response);
  if (!response.ok) throw new Error(extractError(data, "Failed to create user."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * PUT /rest/v1/savings/user/{userId} — Update user
 * Fields: firstName, middleName, lastName, occupation, email, monthlySalary
 */
export async function updateUser(userId, userData) {
  const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(userData),
  });
  const data = await safeJson(response);
  if (!response.ok) throw new Error(extractError(data, "Failed to update user."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}

/**
 * DELETE /rest/v1/savings/user/{userId} — Delete user
 */
export async function deleteUser(userId) {
  const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await safeJson(response);
  if (!response.ok) throw new Error(extractError(data, "Failed to delete user."));
  if (!data) throw new Error("Server is waking up. Please try again in a few seconds.");
  return data;
}
