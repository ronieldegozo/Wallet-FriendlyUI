const API_BASE_URL = `${import.meta.env.VITE_API_URL || ""}/rest/v1`;

/** Extract the most useful error message from backend error responses. */
function extractError(data, fallback) {
  if (data?.error?.details) return data.error.details;
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  return fallback;
}

export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(extractError(data, "Login failed. Please try again."));
  }

  return data;
}

/**
 * PUT /rest/v1/auth/change-password
 * Body: { currentPassword, newPassword, confirmPassword }
 */
export async function changePassword(currentPassword, newPassword, confirmPassword) {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(extractError(data, "Failed to change password."));
  }

  return data;
}
