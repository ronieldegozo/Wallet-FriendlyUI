/**
 * Decode a JWT token and return its payload.
 * Does NOT verify the signature — only extracts the data.
 */
export function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Get the current user info from the stored JWT token.
 * Returns { id, email, firstName, lastName, roles } or null.
 */
export function getUserFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const payload = decodeToken(token);
  if (!payload) return null;

  return {
    id: payload.id,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    roles: payload.roles || [],
  };
}
