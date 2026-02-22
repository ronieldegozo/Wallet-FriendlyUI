import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFromToken } from "../../services/tokenUtils";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../../services/userService";
import {
  getCategoryTypes,
  addCategoryType,
  updateCategoryType,
  deleteCategoryType,
} from "../../services/categoryTypesService";
import ThemeToggle from "../../components/ThemeToggle";
import "./Admin.css";

const EMPTY_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  occupation: "",
  email: "",
  password: "",
  monthlySalary: "",
  role: "ROLE_USER",
};

export default function Admin() {
  const navigate = useNavigate();
  const currentUser = getUserFromToken();

  // Active admin tab
  const [adminTab, setAdminTab] = useState("users"); // "users" | "types"

  // ── User Management State ──
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingUserId, setEditingUserId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Category Types State ──
  const [categoryTypes, setCategoryTypes] = useState([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeModalMode, setTypeModalMode] = useState("add"); // "add" | "edit"
  const [typeInput, setTypeInput] = useState("");
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [deleteTypeConfirm, setDeleteTypeConfirm] = useState(null);

  useEffect(() => {
    fetchUsers();
    setCategoryTypes(getCategoryTypes());
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // ══════════════════════════════════════
  //  USER MANAGEMENT HANDLERS
  // ══════════════════════════════════════

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await getAllUsers();
      setUsers(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setFormData(EMPTY_FORM);
    setModalMode("create");
    setEditingUserId(null);
    setShowModal(true);
  }

  function openEditModal(user) {
    setFormData({
      firstName: user.firstName || "",
      middleName: user.middleName || "",
      lastName: user.lastName || "",
      occupation: user.occupation || "",
      email: user.email || "",
      password: "",
      monthlySalary: user.monthlySalary || "",
      role: user.roles?.[0] || "ROLE_USER",
    });
    setModalMode("edit");
    setEditingUserId(user.id);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setFormData(EMPTY_FORM);
    setEditingUserId(null);
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (modalMode === "create") {
        await createUser({
          ...formData,
          monthlySalary: Number(formData.monthlySalary) || 0,
        });
        setSuccess("User created successfully!");
      } else {
        const updatePayload = {
          firstName: formData.firstName,
          middleName: formData.middleName,
          lastName: formData.lastName,
          occupation: formData.occupation,
          email: formData.email,
          monthlySalary: Number(formData.monthlySalary) || 0,
          role: formData.role,
        };
        if (formData.password && formData.password.trim() !== "") {
          updatePayload.password = formData.password;
        }
        await updateUser(editingUserId, updatePayload);
        setSuccess("User updated successfully!");
      }
      closeModal();
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(userId) {
    setError("");
    try {
      await deleteUser(userId);
      setSuccess("User deleted successfully!");
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  // ══════════════════════════════════════
  //  CATEGORY TYPES HANDLERS
  // ══════════════════════════════════════

  function openAddTypeModal() {
    setTypeModalMode("add");
    setTypeInput("");
    setEditingTypeId(null);
    setShowTypeModal(true);
  }

  function openEditTypeModal(type) {
    setTypeModalMode("edit");
    setTypeInput(type.label);
    setEditingTypeId(type.id);
    setShowTypeModal(true);
  }

  function closeTypeModal() {
    setShowTypeModal(false);
    setTypeInput("");
    setEditingTypeId(null);
  }

  function handleTypeSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      let updated;
      if (typeModalMode === "add") {
        updated = addCategoryType(typeInput.trim());
        setSuccess("Category type added successfully!");
      } else {
        updated = updateCategoryType(editingTypeId, typeInput.trim());
        setSuccess("Category type updated successfully!");
      }
      setCategoryTypes(updated);
      closeTypeModal();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDeleteType() {
    if (!deleteTypeConfirm) return;
    setError("");
    try {
      const updated = deleteCategoryType(deleteTypeConfirm.id);
      setCategoryTypes(updated);
      setSuccess(`Category type "${deleteTypeConfirm.label}" deleted!`);
      setDeleteTypeConfirm(null);
    } catch (err) {
      setError(err.message);
    }
  }

  // ══════════════════════════════════════
  //  COMMON
  // ══════════════════════════════════════

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    navigate("/");
  }

  return (
    <div className="admin-page">
      {/* ── Header ── */}
      <header className="admin-header">
        <div className="admin-brand">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          <span>Wallet Friendly</span>
          <span className="admin-badge">Admin</span>
        </div>
        <div className="header-right">
          <button className="nav-link" onClick={() => navigate("/dashboard")}>
            Dashboard
          </button>
          <div className="admin-user-info">
            <div className="admin-avatar">
              {currentUser ? `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}` : "A"}
            </div>
            <span className="admin-user-name">
              {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Admin"}
            </span>
          </div>
          <ThemeToggle />
          <button className="logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="admin-content">
        {/* Messages */}
        {success && <div className="msg msg-success">{success}</div>}
        {error && <div className="msg msg-error">{error}</div>}

        {/* ── Admin Tabs ── */}
        <div className="admin-tab-bar">
          <button className={`admin-tab-btn ${adminTab === "users" ? "admin-tab-active" : ""}`} onClick={() => setAdminTab("users")}>
            User Management
          </button>
          <button className={`admin-tab-btn ${adminTab === "types" ? "admin-tab-active" : ""}`} onClick={() => setAdminTab("types")}>
            Category Types
          </button>
        </div>

        {/* ══════════════════════════════════════
            TAB: USER MANAGEMENT
            ══════════════════════════════════════ */}
        {adminTab === "users" && (
          <>
            <div className="admin-toolbar">
              <div>
                <h1>User Management</h1>
                <p className="admin-toolbar-sub">Create, view, update, and delete users</p>
              </div>
              <button className="btn-create" onClick={openCreateModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add User
              </button>
            </div>

            {loading ? (
              <div className="admin-loading">
                <div className="spinner-lg"></div>
                <p>Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="admin-empty">
                <p>No users found.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Occupation</th>
                      <th>Monthly Salary</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td className="name-cell">
                          <div className="table-avatar">
                            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                          </div>
                          <div>
                            <span className="table-name">{user.firstName} {user.middleName ? `${user.middleName} ` : ""}{user.lastName}</span>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td>{user.occupation || "—"}</td>
                        <td>{user.monthlySalary != null ? `₱${Number(user.monthlySalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</td>
                        <td>
                          <span className={`role-badge ${user.roles?.includes("ROLE_ADMIN") ? "role-admin" : "role-user"}`}>
                            {user.roles?.includes("ROLE_ADMIN") ? "Admin" : "User"}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <button className="btn-action btn-edit" title="Edit" onClick={() => openEditModal(user)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                          <button className="btn-action btn-delete" title="Delete" onClick={() => setDeleteConfirm(user.id)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            TAB: CATEGORY TYPES
            ══════════════════════════════════════ */}
        {adminTab === "types" && (
          <>
            <div className="admin-toolbar">
              <div>
                <h1>Category Types</h1>
                <p className="admin-toolbar-sub">Manage the list of savings category types available to all users</p>
              </div>
              <button className="btn-create btn-create-purple" onClick={openAddTypeModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Type
              </button>
            </div>

            {categoryTypes.length === 0 ? (
              <div className="admin-empty">
                <p>No category types defined. Add one to get started.</p>
              </div>
            ) : (
              <div className="types-grid">
                {categoryTypes.map((type) => (
                  <div className="type-card" key={type.id}>
                    <div className="type-card-left">
                      <div className="type-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                        </svg>
                      </div>
                      <div>
                        <span className="type-label">{type.label}</span>
                        <span className="type-id">{type.id}</span>
                      </div>
                    </div>
                    <div className="type-card-actions">
                      <button className="btn-action btn-edit" title="Edit" onClick={() => openEditTypeModal(type)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                      <button className="btn-action btn-delete" title="Delete" onClick={() => setDeleteTypeConfirm(type)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Delete User Confirmation Modal ── */}
      {deleteConfirm !== null && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Confirm Delete</h2>
            <p>Are you sure you want to delete this user? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Type Confirmation Modal ── */}
      {deleteTypeConfirm !== null && (
        <div className="modal-overlay" onClick={() => setDeleteTypeConfirm(null)}>
          <div className="modal-box modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="delete-warning-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2>Delete Category Type</h2>
            <p>Are you sure you want to delete <strong>"{deleteTypeConfirm.label}"</strong>?</p>
            <p className="delete-warning-text">Existing categories using this type will not be affected, but users will no longer be able to select it for new categories.</p>
            <div className="modal-actions modal-actions-center">
              <button className="btn-cancel" onClick={() => setDeleteTypeConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteType}>Delete Type</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit User Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === "create" ? "Create New User" : "Edit User"}</h2>
              <button className="modal-close" onClick={closeModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="firstName">First Name *</label>
                  <input id="firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                </div>
                <div className="form-field">
                  <label htmlFor="middleName">Middle Name</label>
                  <input id="middleName" name="middleName" value={formData.middleName} onChange={handleInputChange} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="lastName">Last Name *</label>
                  <input id="lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
                </div>
                <div className="form-field">
                  <label htmlFor="occupation">Occupation</label>
                  <input id="occupation" name="occupation" value={formData.occupation} onChange={handleInputChange} />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="email">Email *</label>
                <input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="password">
                    {modalMode === "create" ? "Password *" : "New Password"}
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={modalMode === "edit" ? "Leave blank to keep current" : ""}
                    value={formData.password}
                    onChange={handleInputChange}
                    required={modalMode === "create"}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="role">Role *</label>
                  <select id="role" name="role" value={formData.role} onChange={handleInputChange}>
                    <option value="ROLE_USER">User</option>
                    <option value="ROLE_ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="monthlySalary">Monthly Salary</label>
                <input id="monthlySalary" name="monthlySalary" type="number" step="0.01" value={formData.monthlySalary} onChange={handleInputChange} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? <span className="spinner-sm"></span> : modalMode === "create" ? "Create User" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add / Edit Type Modal ── */}
      {showTypeModal && (
        <div className="modal-overlay" onClick={closeTypeModal}>
          <div className="modal-box modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{typeModalMode === "add" ? "Add Category Type" : "Edit Category Type"}</h2>
              <button className="modal-close" onClick={closeTypeModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleTypeSubmit} className="modal-form">
              <div className="form-field">
                <label htmlFor="typeInput">Type Name *</label>
                <input
                  id="typeInput"
                  type="text"
                  placeholder="e.g. Education, Travel, Business"
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeTypeModal}>Cancel</button>
                <button type="submit" className="btn-submit btn-submit-purple">
                  {typeModalMode === "add" ? "Add Type" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
