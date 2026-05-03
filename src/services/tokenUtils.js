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

  // SmallRye JWT places role names under the standard MicroProfile "groups" claim.
  // Fall back to "roles" for backwards compatibility with older tokens.
  const roles = Array.isArray(payload.groups)
    ? payload.groups
    : Array.isArray(payload.roles)
      ? payload.roles
      : [];

  return {
    id: payload.id,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    roles,
  };
}
