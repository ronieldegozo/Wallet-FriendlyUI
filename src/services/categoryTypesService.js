const STORAGE_KEY = "wallet_category_types";

const DEFAULT_TYPES = [
  { id: "savings", label: "Savings" },
  { id: "investment", label: "Investment" },
  { id: "insurance", label: "Insurance" },
  { id: "emergency", label: "Emergency" },
  { id: "other", label: "Other" },
];

/**
 * Get all category types from localStorage.
 * Returns the default list if none are saved yet.
 */
export function getCategoryTypes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore parse errors
  }
  // Initialize with defaults
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TYPES));
  return DEFAULT_TYPES;
}

/**
 * Save category types to localStorage.
 */
export function saveCategoryTypes(types) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

/**
 * Add a new category type.
 */
export function addCategoryType(label) {
  const types = getCategoryTypes();
  const id = label.toLowerCase().replace(/\s+/g, "-");
  if (types.some((t) => t.id === id)) {
    throw new Error(`Category type "${label}" already exists.`);
  }
  const updated = [...types, { id, label }];
  saveCategoryTypes(updated);
  return updated;
}

/**
 * Update an existing category type by id.
 */
export function updateCategoryType(oldId, newLabel) {
  const types = getCategoryTypes();
  const newId = newLabel.toLowerCase().replace(/\s+/g, "-");
  // Check if new id conflicts with another type
  if (newId !== oldId && types.some((t) => t.id === newId)) {
    throw new Error(`Category type "${newLabel}" already exists.`);
  }
  const updated = types.map((t) =>
    t.id === oldId ? { id: newId, label: newLabel } : t
  );
  saveCategoryTypes(updated);
  return updated;
}

/**
 * Delete a category type by id.
 */
export function deleteCategoryType(id) {
  const types = getCategoryTypes();
  const updated = types.filter((t) => t.id !== id);
  saveCategoryTypes(updated);
  return updated;
}
