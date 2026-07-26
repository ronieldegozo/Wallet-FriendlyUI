import { useEffect, useState, useRef } from "react";
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
import {
  getAllGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  assignUserToGroup,
  removeUserFromGroup,
} from "../../services/groupService";
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
  const adminInitials = currentUser ? `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}` : "A";
  const adminName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Admin";

  // Active admin tab
  const [adminTab, setAdminTab] = useState("users"); // "users" | "types" | "groups"

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
  const [editingType, setEditingType] = useState(null); // full type object being edited
  const [deleteTypeConfirm, setDeleteTypeConfirm] = useState(null);
  const [typeSubmitting, setTypeSubmitting] = useState(false);

  // ── Groups State ──
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState("create"); // "create" | "edit"
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState(null);
  const [assignModalUser, setAssignModalUser] = useState(null); // user object to assign
  const [assignSelectedGroupId, setAssignSelectedGroupId] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  // ── Profile menu (avatar dropdown) ──
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // ── User search filter (UI-side only) ──
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchCategoryTypes();
    fetchGroups();
  }, []);

  async function fetchCategoryTypes() {
    try {
      const types = await getCategoryTypes();
      setCategoryTypes(types);
    } catch (err) {
      setError(err.message);
    }
  }

  async function fetchGroups() {
    setGroupsLoading(true);
    try {
      const list = await getAllGroups();
      setGroups(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setGroupsLoading(false);
    }
  }

  function openCreateGroupModal() {
    setGroupModalMode("create");
    setEditingGroupId(null);
    setGroupName("");
    setGroupDescription("");
    setShowGroupModal(true);
  }

  function openEditGroupModal(group) {
    setGroupModalMode("edit");
    setEditingGroupId(group.id);
    setGroupName(group.name || "");
    setGroupDescription(group.description || "");
    setShowGroupModal(true);
  }

  function closeGroupModal() {
    setShowGroupModal(false);
    setEditingGroupId(null);
    setGroupName("");
    setGroupDescription("");
  }

  async function handleGroupSubmit(e) {
    e.preventDefault();
    setError("");
    setGroupSubmitting(true);
    try {
      if (groupModalMode === "create") {
        await createGroup(groupName.trim(), groupDescription.trim() || null);
        setSuccess("Group created successfully!");
      } else {
        await updateGroup(editingGroupId, groupName.trim(), groupDescription.trim() || null);
        setSuccess("Group updated successfully!");
      }
      await fetchGroups();
      await fetchUsers(false);
      closeGroupModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setGroupSubmitting(false);
    }
  }

  async function handleDeleteGroup() {
    if (!deleteGroupConfirm) return;
    setError("");
    try {
      await deleteGroup(deleteGroupConfirm.id);
      setSuccess(`Group "${deleteGroupConfirm.name}" deleted!`);
      setDeleteGroupConfirm(null);
      await fetchGroups();
      await fetchUsers(false);
    } catch (err) {
      setError(err.message);
    }
  }

  function openAssignGroupModal(user) {
    setAssignModalUser(user);
    setAssignSelectedGroupId("");
  }

  function closeAssignGroupModal() {
    setAssignModalUser(null);
    setAssignSelectedGroupId("");
  }

  async function refreshAfterGroupChange() {
    const [, freshUsers] = await Promise.all([fetchGroups(), fetchUsers(false)]);
    if (assignModalUser && freshUsers) {
      const updated = freshUsers.find((u) => u.id === assignModalUser.id);
      if (updated) setAssignModalUser(updated);
    }
  }

  async function handleAddToGroup(e) {
    e.preventDefault();
    if (!assignModalUser || !assignSelectedGroupId) return;
    setError("");
    setAssignSubmitting(true);
    try {
      await assignUserToGroup(Number(assignSelectedGroupId), assignModalUser.id);
      const gName = groups.find((g) => g.id === Number(assignSelectedGroupId))?.name;
      setSuccess(gName ? `Added ${assignModalUser.firstName} to "${gName}".` : "User group updated.");
      await refreshAfterGroupChange();
      setAssignSelectedGroupId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAssignSubmitting(false);
    }
  }

  async function handleRemoveFromGroup(groupId, groupName) {
    if (!assignModalUser) return;
    setError("");
    setAssignSubmitting(true);
    try {
      await removeUserFromGroup(groupId, assignModalUser.id);
      setSuccess(`Removed ${assignModalUser.firstName} from "${groupName}".`);
      await refreshAfterGroupChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setAssignSubmitting(false);
    }
  }

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Close avatar menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // ══════════════════════════════════════
  //  USER MANAGEMENT HANDLERS
  // ══════════════════════════════════════

  async function fetchUsers(showSpinner = true) {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const res = await getAllUsers();
      const list = res.data || [];
      setUsers(list);
      return list;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      if (showSpinner) setLoading(false);
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
      fetchUsers(false);
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
      fetchUsers(false);
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
    setEditingType(null);
    setShowTypeModal(true);
  }

  function openEditTypeModal(type) {
    setTypeModalMode("edit");
    setTypeInput(type.label);
    setEditingType(type);
    setShowTypeModal(true);
  }

  function closeTypeModal() {
    setShowTypeModal(false);
    setTypeInput("");
    setEditingType(null);
  }

  async function handleTypeSubmit(e) {
    e.preventDefault();
    setError("");
    setTypeSubmitting(true);
    try {
      if (typeModalMode === "add") {
        await addCategoryType(typeInput.trim());
        setSuccess("Category type added successfully!");
      } else {
        await updateCategoryType(editingType?._dbId, typeInput.trim());
        setSuccess("Category type updated successfully!");
      }
      await fetchCategoryTypes();
      closeTypeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setTypeSubmitting(false);
    }
  }

  async function handleDeleteType() {
    if (!deleteTypeConfirm) return;
    setError("");
    try {
      await deleteCategoryType(deleteTypeConfirm._dbId);
      setSuccess(`Category type "${deleteTypeConfirm.label}" deleted!`);
      setDeleteTypeConfirm(null);
      await fetchCategoryTypes();
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

  // Derived stats for the top banner
  const adminCount = users.filter((u) => u.roles?.includes("ROLE_ADMIN")).length;
  const userCount = users.filter((u) => !u.roles?.includes("ROLE_ADMIN")).length;

  // Search-filtered users
  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.firstName || "").toLowerCase().includes(q) ||
      (u.middleName || "").toLowerCase().includes(q) ||
      (u.lastName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.occupation || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="ad-shell">

      {/* ═════════════════ TOP NAV ═════════════════ */}
      <header className="ad-nav">
        <div className="ad-nav-inner">
          <div className="ad-nav-brand">
            <div className="ad-nav-logo">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <div className="ad-nav-titles">
              <span className="ad-nav-name">Wallet Friendly</span>
              <span className="ad-nav-tag">Admin Console</span>
            </div>
          </div>

          <div className="ad-nav-actions">
            <button className="ad-back-btn" onClick={() => navigate("/dashboard")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              Back to dashboard
            </button>
            <ThemeToggle />

            <div className="ad-avatar-wrap" ref={menuRef}>
              <button className="ad-avatar-btn" onClick={() => setMenuOpen((v) => !v)}>
                <span className="ad-avatar-circle">{adminInitials}</span>
                <span className="ad-avatar-name">{adminName}</span>
                <svg className={`ad-avatar-caret ${menuOpen ? "is-open" : ""}`} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {menuOpen && (
                <div className="ad-menu" role="menu">
                  <div className="ad-menu-head">
                    <div className="ad-menu-avatar">{adminInitials}</div>
                    <div className="ad-menu-id">
                      <span className="ad-menu-name">{adminName}</span>
                      <span className="ad-menu-email">{currentUser?.email || ""}</span>
                    </div>
                  </div>
                  <button className="ad-menu-item" onClick={() => { setMenuOpen(false); navigate("/dashboard"); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                    Dashboard
                  </button>
                  <div className="ad-menu-divider" />
                  <button className="ad-menu-item ad-menu-item-danger" onClick={handleLogout}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="ad-main">

        {/* ═════════════════ STAT BANNER ═════════════════ */}
        <section className="ad-banner">
          <div className="ad-banner-orb" />
          <div className="ad-banner-content">
            <div className="ad-banner-text">
              <span className="ad-banner-eyebrow">Admin Console</span>
              <h1>Manage your platform</h1>
              <p>Configure users, roles, and the savings categories available to everyone.</p>
            </div>
            <div className="ad-banner-stats">
              <div className="ad-banner-stat">
                <span className="ad-banner-stat-label">Total users</span>
                <span className="ad-banner-stat-value">{users.length}</span>
              </div>
              <div className="ad-banner-divider" />
              <div className="ad-banner-stat">
                <span className="ad-banner-stat-label">Admins</span>
                <span className="ad-banner-stat-value">{adminCount}</span>
              </div>
              <div className="ad-banner-divider" />
              <div className="ad-banner-stat">
                <span className="ad-banner-stat-label">Users</span>
                <span className="ad-banner-stat-value">{userCount}</span>
              </div>
              <div className="ad-banner-divider" />
              <div className="ad-banner-stat">
                <span className="ad-banner-stat-label">Category types</span>
                <span className="ad-banner-stat-value">{categoryTypes.length}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Toasts */}
        {success && <div className="ad-toast ad-toast-success"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>{success}</div>}
        {error && <div className="ad-toast ad-toast-error"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{error}</div>}

        {/* ═════════════════ SEGMENT TABS ═════════════════ */}
        <div className="ad-tabs">
          <button className={`ad-tab ${adminTab === "users" ? "ad-tab-active" : ""}`} onClick={() => setAdminTab("users")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <span>User Management</span>
            <span className="ad-tab-count">{users.length}</span>
          </button>
          <button className={`ad-tab ${adminTab === "types" ? "ad-tab-active" : ""}`} onClick={() => setAdminTab("types")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
            <span>Category Types</span>
            <span className="ad-tab-count">{categoryTypes.length}</span>
          </button>
          <button className={`ad-tab ${adminTab === "groups" ? "ad-tab-active" : ""}`} onClick={() => setAdminTab("groups")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <span>Groups</span>
            <span className="ad-tab-count">{groups.length}</span>
          </button>
        </div>

        {/* ═════════════════ USERS TAB ═════════════════ */}
        {adminTab === "users" && (
          <section className="ad-section">
            <div className="ad-section-toolbar">
              <div className="ad-search">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder="Search by name, email, occupation…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                {userSearch && (
                  <button className="ad-search-clear" onClick={() => setUserSearch("")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
              <button className="ad-btn-primary" onClick={openCreateModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add user
              </button>
            </div>

            {loading ? (
              <div className="ad-loading"><div className="ad-spinner-lg" /><p>Loading users…</p></div>
            ) : users.length === 0 ? (
              <div className="ad-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                <p>No users found</p>
                <span>Get started by creating your first account.</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="ad-empty">
                <p>No users match &ldquo;{userSearch}&rdquo;</p>
                <span>Try a different search term.</span>
              </div>
            ) : (
              <div className="ad-user-grid">
                {filteredUsers.map((user) => {
                  const isAdmin = user.roles?.includes("ROLE_ADMIN");
                  return (
                    <article className="ad-user-card" key={user.id}>
                      <div className="ad-user-top">
                        <div className={`ad-user-avatar ${isAdmin ? "ad-user-avatar-admin" : ""}`}>
                          {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                        </div>
                        <span className={`ad-role-badge ${isAdmin ? "ad-role-admin" : "ad-role-user"}`}>
                          {isAdmin ? "Admin" : "User"}
                        </span>
                      </div>
                      <div className="ad-user-id">
                        <span className="ad-user-name">{user.firstName} {user.middleName ? `${user.middleName} ` : ""}{user.lastName}</span>
                        <span className="ad-user-email">{user.email}</span>
                      </div>
                      <dl className="ad-user-meta">
                        <div>
                          <dt>Occupation</dt>
                          <dd>{user.occupation || "—"}</dd>
                        </div>
                        <div>
                          <dt>Monthly Salary</dt>
                          <dd>{user.monthlySalary != null ? `₱${Number(user.monthlySalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</dd>
                        </div>
                        <div>
                          <dt>Group</dt>
                          <dd>
                            {user.groups && user.groups.length > 0 ? (
                              <span className="ad-group-pills-wrap">
                                {user.groups.map((g) => (
                                  <span key={g.id} className="ad-group-pill">{g.name}</span>
                                ))}
                              </span>
                            ) : user.groupName ? (
                              <span className="ad-group-pill">{user.groupName}</span>
                            ) : (
                              <span className="ad-group-pill ad-group-pill-empty">No group</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                      <div className="ad-user-actions">
                        <button className="ad-btn-ghost" onClick={() => openEditModal(user)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                          Edit
                        </button>
                        <button className="ad-btn-ghost" onClick={() => openAssignGroupModal(user)} title="Assign or change group">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                          Group
                        </button>
                        <button className="ad-btn-ghost ad-btn-ghost-danger" onClick={() => setDeleteConfirm(user.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ═════════════════ TYPES TAB ═════════════════ */}
        {adminTab === "types" && (
          <section className="ad-section">
            <div className="ad-section-toolbar">
              <div className="ad-section-info">
                <h2>Savings Category Types</h2>
                <p>Define the labels users can pick when creating a savings category.</p>
              </div>
              <button className="ad-btn-primary ad-btn-primary-purple" onClick={openAddTypeModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add type
              </button>
            </div>

            {categoryTypes.length === 0 ? (
              <div className="ad-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                <p>No category types defined</p>
                <span>Add one to get started.</span>
              </div>
            ) : (
              <div className="ad-type-grid">
                {categoryTypes.map((type) => (
                  <article className="ad-type-card" key={type.id}>
                    <div className="ad-type-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" /></svg>
                    </div>
                    <div className="ad-type-id">
                      <span className="ad-type-label">{type.label}</span>
                      <span className="ad-type-slug">{type.id}</span>
                    </div>
                    <div className="ad-type-actions">
                      <button className="ad-icon-btn" title="Edit" onClick={() => openEditTypeModal(type)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                      </button>
                      <button className="ad-icon-btn ad-icon-btn-danger" title="Delete" onClick={() => setDeleteTypeConfirm(type)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═════════════════ GROUPS TAB ═════════════════ */}
        {adminTab === "groups" && (
          <section className="ad-section">
            <div className="ad-section-toolbar">
              <div className="ad-section-info">
                <h2>User Groups</h2>
                <p>Group users together so members of the same group can view each other&apos;s combined savings totals. Users with no group keep their data fully private.</p>
              </div>
              <div className="ad-search">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input type="text" placeholder="Search groups…" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} />
                {groupSearch && (
                  <button className="ad-search-clear" onClick={() => setGroupSearch("")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
              <button className="ad-btn-primary" onClick={openCreateGroupModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                New group
              </button>
            </div>

            {groupsLoading ? (
              <div className="ad-loading"><div className="ad-spinner-lg" /><p>Loading groups…</p></div>
            ) : groups.length === 0 ? (
              <div className="ad-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                <p>No groups yet</p>
                <span>Create one and start assigning users.</span>
              </div>
            ) : (
              <div className="ad-group-grid">
                {groups
                  .filter((g) => !groupSearch.trim() || (g.name || "").toLowerCase().includes(groupSearch.toLowerCase()))
                  .map((group) => {
                    const groupMembers = users.filter((u) =>
                      (u.groups && u.groups.some((g) => g.id === group.id))
                      || u.groupId === group.id
                      || u.groupName === group.name
                    );
                    const memberCount = group.memberCount || groupMembers.length;
                    return (
                      <article className="ad-group-card" key={group.id}>
                        <div className="ad-group-card-head">
                          <div className="ad-group-card-titles">
                            <span className="ad-group-card-name">{group.name}</span>
                            {group.description && <span className="ad-group-card-desc">{group.description}</span>}
                          </div>
                          <span className="ad-group-card-count">{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                        </div>

                        {groupMembers.length > 0 ? (
                          <ul className="ad-group-card-members">
                            {groupMembers.slice(0, 4).map((m) => (
                              <li key={m.id}>
                                <span className="ad-group-card-member-avatar">{(m.firstName?.[0] || "").toUpperCase()}{(m.lastName?.[0] || "").toUpperCase()}</span>
                                <span className="ad-group-card-member-name">{m.firstName} {m.lastName}</span>
                              </li>
                            ))}
                            {groupMembers.length > 4 && (
                              <li className="ad-group-card-member-more">+{groupMembers.length - 4} more</li>
                            )}
                          </ul>
                        ) : (
                          <p className="ad-group-card-empty">No members yet — assign users from the Users tab.</p>
                        )}

                        <div className="ad-group-card-actions">
                          <button className="ad-btn-ghost" onClick={() => openEditGroupModal(group)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            Edit
                          </button>
                          <button className="ad-btn-ghost ad-btn-ghost-danger" onClick={() => setDeleteGroupConfirm(group)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Delete User Confirmation Modal ── */}
      {deleteConfirm !== null && (
        <div className="ad-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="ad-modal-box ad-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-warn">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h2>Delete User</h2>
            <p>Are you sure you want to delete this user? This action cannot be undone.</p>
            <div className="ad-modal-actions ad-modal-actions-center">
              <button className="ad-btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="ad-btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Type Confirmation Modal ── */}
      {deleteTypeConfirm !== null && (
        <div className="ad-modal-overlay" onClick={() => setDeleteTypeConfirm(null)}>
          <div className="ad-modal-box ad-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-warn">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h2>Delete Category Type</h2>
            <p>Are you sure you want to delete <strong>&ldquo;{deleteTypeConfirm.label}&rdquo;</strong>?</p>
            <p className="ad-modal-warn-text">Existing categories using this type will not be affected, but users will no longer be able to select it for new categories.</p>
            <div className="ad-modal-actions ad-modal-actions-center">
              <button className="ad-btn-cancel" onClick={() => setDeleteTypeConfirm(null)}>Cancel</button>
              <button className="ad-btn-danger" onClick={handleDeleteType}>Delete Type</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit User Modal ── */}
      {showModal && (
        <div className="ad-modal-overlay" onClick={closeModal}>
          <div className="ad-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-head">
              <h2>{modalMode === "create" ? "Create New User" : "Edit User"}</h2>
              <button className="ad-modal-close" onClick={closeModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="ad-modal-form">
              <div className="ad-modal-row">
                <div className="ad-modal-field">
                  <label htmlFor="firstName">First Name *</label>
                  <input id="firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                </div>
                <div className="ad-modal-field">
                  <label htmlFor="middleName">Middle Name</label>
                  <input id="middleName" name="middleName" value={formData.middleName} onChange={handleInputChange} />
                </div>
              </div>

              <div className="ad-modal-row">
                <div className="ad-modal-field">
                  <label htmlFor="lastName">Last Name *</label>
                  <input id="lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
                </div>
                <div className="ad-modal-field">
                  <label htmlFor="occupation">Occupation</label>
                  <input id="occupation" name="occupation" value={formData.occupation} onChange={handleInputChange} />
                </div>
              </div>

              <div className="ad-modal-field">
                <label htmlFor="email">Email *</label>
                <input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
              </div>

              <div className="ad-modal-row">
                <div className="ad-modal-field">
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
                <div className="ad-modal-field">
                  <label htmlFor="role">Role *</label>
                  <select id="role" name="role" value={formData.role} onChange={handleInputChange}>
                    <option value="ROLE_USER">User</option>
                    <option value="ROLE_ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <div className="ad-modal-field">
                <label htmlFor="monthlySalary">Monthly Salary</label>
                <input id="monthlySalary" name="monthlySalary" type="number" step="0.01" value={formData.monthlySalary} onChange={handleInputChange} />
              </div>

              <div className="ad-modal-actions">
                <button type="button" className="ad-btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="ad-btn-submit" disabled={submitting}>
                  {submitting ? <span className="ad-spinner-sm" /> : modalMode === "create" ? "Create User" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add / Edit Type Modal ── */}
      {showTypeModal && (
        <div className="ad-modal-overlay" onClick={closeTypeModal}>
          <div className="ad-modal-box ad-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-head">
              <h2>{typeModalMode === "add" ? "Add Category Type" : "Edit Category Type"}</h2>
              <button className="ad-modal-close" onClick={closeTypeModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <form onSubmit={handleTypeSubmit} className="ad-modal-form">
              <div className="ad-modal-field">
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

              <div className="ad-modal-actions">
                <button type="button" className="ad-btn-cancel" onClick={closeTypeModal}>Cancel</button>
                <button type="submit" className="ad-btn-submit ad-btn-submit-purple" disabled={typeSubmitting}>
                  {typeSubmitting ? <span className="ad-spinner-sm" /> : typeModalMode === "add" ? "Add Type" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create / Edit Group Modal ── */}
      {showGroupModal && (
        <div className="ad-modal-overlay" onClick={closeGroupModal}>
          <div className="ad-modal-box ad-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-head">
              <h2>{groupModalMode === "create" ? "Create Group" : "Edit Group"}</h2>
              <button className="ad-modal-close" onClick={closeGroupModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <form onSubmit={handleGroupSubmit} className="ad-modal-form">
              <div className="ad-modal-field">
                <label htmlFor="groupName">Group name *</label>
                <input
                  id="groupName"
                  type="text"
                  placeholder="e.g. Investor, Saver, Family"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="ad-modal-field">
                <label htmlFor="groupDescription">Description (optional)</label>
                <textarea
                  id="groupDescription"
                  placeholder="What is this group for?"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="ad-modal-actions">
                <button type="button" className="ad-btn-cancel" onClick={closeGroupModal}>Cancel</button>
                <button type="submit" className="ad-btn-submit" disabled={groupSubmitting}>
                  {groupSubmitting ? <span className="ad-spinner-sm" /> : groupModalMode === "create" ? "Create Group" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Group Confirmation Modal ── */}
      {deleteGroupConfirm !== null && (
        <div className="ad-modal-overlay" onClick={() => setDeleteGroupConfirm(null)}>
          <div className="ad-modal-box ad-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-warn">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h2>Delete Group</h2>
            <p>Are you sure you want to delete <strong>&ldquo;{deleteGroupConfirm.name}&rdquo;</strong>?</p>
            <p className="ad-modal-warn-text">All {deleteGroupConfirm.memberCount} member(s) will be detached from this group, but their personal savings will remain untouched.</p>
            <div className="ad-modal-actions ad-modal-actions-center">
              <button className="ad-btn-cancel" onClick={() => setDeleteGroupConfirm(null)}>Cancel</button>
              <button className="ad-btn-danger" onClick={handleDeleteGroup}>Delete Group</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign / Change Group Modal ── */}
      {assignModalUser !== null && (() => {
        const currentUser = users.find((u) => u.id === assignModalUser.id) || assignModalUser;
        const userGroups = currentUser.groups
          ? groups.filter((g) => currentUser.groups.some((ug) => ug.id === g.id))
          : groups.filter((g) => currentUser.groupId === g.id);
        const userGroupIds = new Set(userGroups.map((g) => g.id));
        const availableGroups = groups.filter((g) => !userGroupIds.has(g.id));
        return (
          <div className="ad-modal-overlay" onClick={closeAssignGroupModal}>
            <div className="ad-modal-box ad-modal-narrow" onClick={(e) => e.stopPropagation()}>
              <div className="ad-modal-head">
                <h2>Manage groups</h2>
                <button className="ad-modal-close" onClick={closeAssignGroupModal}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div className="ad-modal-form">
                <p className="ad-modal-subtitle">
                  Manage groups for <strong>{assignModalUser.firstName} {assignModalUser.lastName}</strong>.
                </p>

                {userGroups.length > 0 && (
                  <div className="ad-modal-field">
                    <label>Current groups</label>
                    <div className="ad-assign-group-list">
                      {userGroups.map((g) => (
                        <div key={g.id} className="ad-assign-group-item">
                          <span className="ad-group-pill">{g.name}</span>
                          <button
                            type="button"
                            className="ad-assign-group-remove"
                            disabled={assignSubmitting}
                            onClick={() => handleRemoveFromGroup(g.id, g.name)}
                            title={`Remove from ${g.name}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userGroups.length === 0 && (
                  <p className="ad-modal-warn-text">Not in any group yet.</p>
                )}

                <form onSubmit={handleAddToGroup} className="ad-modal-form">
                  <div className="ad-modal-field">
                    <label htmlFor="assignGroupSelect">Add to group</label>
                    <select
                      id="assignGroupSelect"
                      value={assignSelectedGroupId}
                      onChange={(e) => setAssignSelectedGroupId(e.target.value)}
                    >
                      <option value="">— Select a group —</option>
                      {availableGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  {availableGroups.length === 0 && groups.length > 0 && (
                    <p className="ad-modal-warn-text">Already in all groups.</p>
                  )}
                  {groups.length === 0 && (
                    <p className="ad-modal-warn-text">No groups exist yet. Create one in the Groups tab first.</p>
                  )}
                  <div className="ad-modal-actions">
                    <button type="button" className="ad-btn-cancel" onClick={closeAssignGroupModal}>Close</button>
                    <button type="submit" className="ad-btn-submit" disabled={assignSubmitting || !assignSelectedGroupId}>
                      {assignSubmitting ? <span className="ad-spinner-sm" /> : "Add to Group"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
