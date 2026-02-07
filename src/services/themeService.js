const STORAGE_KEY = "wallet_theme";

/**
 * Get the stored theme or default to "dark".
 */
export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || "dark";
}

/**
 * Save theme to localStorage and apply it to the document.
 */
export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Toggle between dark and light themes.
 * Returns the new theme string.
 */
export function toggleTheme() {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/**
 * Apply the theme to the document root element.
 * Call once on app startup.
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme || getTheme());
}
