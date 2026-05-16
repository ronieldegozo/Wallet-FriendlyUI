import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFromToken } from "../../services/tokenUtils";
import {
  getAllSavings,
  deposit,
  withdraw,
  getTransactionHistory,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../services/savingsService";
import { updateUser } from "../../services/userService";
import { changePassword } from "../../services/authService";
import { getCategoryTypes } from "../../services/categoryTypesService";
import { getMyGroupSummary } from "../../services/groupService";
import { subscribeToPush } from "../../services/pushService";
import ThemeToggle from "../../components/ThemeToggle";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import "./Dashboard.css";

/* ── Utility helpers ── */
function formatAmountDisplay(value) {
  if (!value) return "";
  const raw = value.replace(/,/g, "");
  const parts = raw.split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
}

function parseRawAmount(value) {
  return value.replace(/,/g, "");
}

function formatDatePH(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtCurrency(n) {
  return "₱" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PIE_COLORS = ["#22c55e","#60a5fa","#f59e0b","#c084fc","#f87171","#2dd4bf","#fb923c","#818cf8"];

const QUOTE_API_URL = "https://dummyjson.com/quotes/random";

/* ── Greeting based on time of day ── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUserFromToken();
  const userId = user?.id;

  const fullName = user ? `${user.firstName} ${user.lastName}` : "User";
  const initials = user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : "U";

  /* ── Data state ── */
  const [savings, setSavings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ── Sidebar / View ── */
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false); // kept for compatibility (mobile menu)

  /* ── Profile menu (avatar dropdown) ── */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  /* ── Deposit / Withdraw modal ── */
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("deposit");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [withdrawDate, setWithdrawDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [txError, setTxError] = useState("");

  /* ── Dynamic category types ── */
  const [availableTypes, setAvailableTypes] = useState([]);

  /* ── Category modal (create & edit) ── */
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [catModalMode, setCatModalMode] = useState("create");
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [catName, setCatName] = useState("");
  const [catAmount, setCatAmount] = useState("");
  const [catType, setCatType] = useState("savings");
  const [catGoalDeadline, setCatGoalDeadline] = useState("");
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [catError, setCatError] = useState("");

  /* ── Delete category confirmation ── */
  const [deleteCatConfirm, setDeleteCatConfirm] = useState(null);
  const [deleteCatError, setDeleteCatError] = useState("");

  /* ── Profile edit modal ── */
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({ firstName: "", middleName: "", lastName: "", occupation: "", email: "", monthlySalary: "" });
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState("");

  /* ── Change password modal ── */
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  /* ── Financial Tip (fetched from API, auto-dismiss after 30s) ── */
  const [dailyTip, setDailyTip] = useState(null);
  const [showTip, setShowTip] = useState(true);

  /* ── Transaction filters ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  /* ── Group state — only populated when the user belongs to a group. */
  const [groupSummary, setGroupSummary] = useState(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState("");

  /* ── Data-freshness tracking — used to skip duplicate refetches when the
       user briefly alt-tabs back to the page. The previous implementation
       called the API on every focus / visibilitychange event, which made
       Render's free-tier backend look like it was hammering itself. We now
       only refetch when the data is older than this threshold. */
  const lastLoadedAtRef = useRef(0);
  const DATA_TTL_MS = 60_000; // 60s; tweak if you want more/less aggressive caching

  /* ── Effects ── */
  useEffect(() => {
    loadCategoryTypes();
    if (userId) loadData();
    fetch(QUOTE_API_URL)
      .then((res) => res.json())
      .then((data) => setDailyTip({ quote: data.quote, author: data.author }))
      .catch(() => setDailyTip(null));
  }, [userId]);

  async function loadCategoryTypes() {
    try {
      const types = await getCategoryTypes();
      setAvailableTypes(types);
    } catch {
      // Silent fail — modal will show "no types available" if list is empty.
      setAvailableTypes([]);
    }
  }

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 4000); return () => clearTimeout(t); }
  }, [success]);

  useEffect(() => {
    if (showTip) { const t = setTimeout(() => setShowTip(false), 30000); return () => clearTimeout(t); }
  }, [showTip]);

  /* Refresh data when the tab regains focus — but ONLY if our cached data is
     stale (older than DATA_TTL_MS). This avoids the previous behaviour where
     a quick alt-tab back to the page fired a full re-fetch every single time,
     which felt sluggish and put unnecessary load on the backend. */
  useEffect(() => {
    function maybeRefresh() {
      if (document.visibilityState !== "visible") return;
      const stale = Date.now() - lastLoadedAtRef.current > DATA_TTL_MS;
      if (!stale) return;
      loadCategoryTypes();
      if (userId) loadData();
    }
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* Close avatar menu on outside click */
  useEffect(() => {
    function handleClick(e) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  /* ── Push notification state ── */
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted" && "PushManager" in window) {
      navigator.serviceWorker?.ready?.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => { if (sub) setPushEnabled(true); })
      );
    }
  }, []);

  async function handleEnableNotifications() {
    if (!userId || pushLoading) return;
    setPushLoading(true);
    const result = await subscribeToPush(userId);
    setPushEnabled(result);
    setPushLoading(false);
    if (result) setSuccess("Notifications enabled! You'll be notified on deposits & withdrawals.");
    else setError("Could not enable notifications. Please allow notifications in your browser settings.");
  }

  async function loadData() {
    setLoading(true); setError("");
    try {
      const [savingsRes, txRes] = await Promise.all([getAllSavings(), getTransactionHistory(userId)]);
      const myData = (savingsRes.data || []).find((u) => u.id === userId);
      setSavings(myData || null);
      setTransactions(txRes.data || []);
      lastLoadedAtRef.current = Date.now();

      // Group summary is only meaningful if this user is in a group. We hit
      // /me/summary unconditionally — the backend returns 404 (mapped to null
      // in the service) for users without a group, so we just clear the state.
      try {
        setGroupLoading(true);
        setGroupError("");
        const summary = await getMyGroupSummary();
        setGroupSummary(summary);
      } catch (groupErr) {
        setGroupError(groupErr.message);
        setGroupSummary(null);
      } finally {
        setGroupLoading(false);
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  /* ── Deposit / Withdraw ── */
  function openModal(type) { setModalType(type); setSelectedCategory(""); setAmount(""); setNote(""); setWithdrawDate(""); setTxError(""); setShowModal(true); }
  function closeModal() { setShowModal(false); setTxError(""); }
  async function handleSubmit(e) {
    e.preventDefault(); if (!selectedCategory) return; setSubmitting(true); setTxError("");
    try {
      const rawAmount = parseRawAmount(amount);
      if (modalType === "deposit") { await deposit(selectedCategory, userId, rawAmount, note); setSuccess("Deposit successful!"); }
      else { await withdraw(userId, selectedCategory, rawAmount, withdrawDate, note); setSuccess("Withdrawal successful!"); }
      closeModal(); loadData();
    } catch (err) { setTxError(err.message); } finally { setSubmitting(false); }
  }

  /* ── Category CRUD ── */
  async function openCategoryModal() {
    setCatModalMode("create");
    setEditingCategoryId(null);
    setCatError("");
    setCatName("");
    setCatAmount("");
    setCatGoalDeadline("");
    setShowCategoryModal(true);
    try {
      const t = await getCategoryTypes();
      setAvailableTypes(t);
      setCatType(t.length > 0 ? t[0].id : "");
    } catch (err) {
      setCatError(err.message);
    }
  }
  async function openEditCategoryModal(cat) {
    setCatModalMode("edit");
    setCatError("");
    setEditingCategoryId(cat.category_id);
    setCatName(cat.name || "");
    setCatAmount(cat.amount ? formatAmountDisplay(String(cat.amount)) : "");
    setCatGoalDeadline(cat.goalDeadline || "");
    setShowCategoryModal(true);
    try {
      const t = await getCategoryTypes();
      setAvailableTypes(t);
      setCatType(cat.type || (t.length > 0 ? t[0].id : ""));
    } catch (err) {
      setCatError(err.message);
    }
  }
  function closeCategoryModal() { setShowCategoryModal(false); setEditingCategoryId(null); setCatError(""); }
  async function handleCategorySubmit(e) {
    e.preventDefault(); setCatSubmitting(true); setCatError("");
    try {
      const rawAmt = parseRawAmount(catAmount);
      const deadline = catGoalDeadline || null;
      if (catModalMode === "create") { await createCategory(userId, catName, rawAmt, catType, deadline); setSuccess("Category created!"); }
      else { await updateCategory(userId, editingCategoryId, catName, rawAmt, catType, deadline); setSuccess("Category updated!"); }
      closeCategoryModal(); loadData();
    } catch (err) { setCatError(err.message); } finally { setCatSubmitting(false); }
  }
  async function handleDeleteCategory() {
    if (!deleteCatConfirm) return; setDeleteCatError("");
    try { await deleteCategory(userId, deleteCatConfirm.category_id); setSuccess("Category deleted!"); setDeleteCatConfirm(null); loadData(); }
    catch (err) { setDeleteCatError(err.message); }
  }

  /* ── Profile ── */
  function openProfileModal() { setProfileError(""); setProfileData({ firstName: savings?.firstName || user?.firstName || "", middleName: savings?.middleName || "", lastName: savings?.lastName || user?.lastName || "", occupation: savings?.occupation || "", email: savings?.email || user?.email || "", monthlySalary: savings?.monthlySalary != null ? formatAmountDisplay(String(savings.monthlySalary)) : "" }); setShowProfileModal(true); }
  function closeProfileModal() { setShowProfileModal(false); setProfileError(""); }
  function handleProfileChange(e) { const { name, value } = e.target; if (name === "monthlySalary") { const raw = value.replace(/[^0-9.]/g, ""); const parts = raw.split("."); const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw; setProfileData((p) => ({ ...p, [name]: formatAmountDisplay(cleaned) })); } else { setProfileData((p) => ({ ...p, [name]: value })); } }
  async function handleProfileSubmit(e) {
    e.preventDefault(); setProfileSubmitting(true); setProfileError("");
    try { await updateUser(userId, { firstName: profileData.firstName, middleName: profileData.middleName, lastName: profileData.lastName, occupation: profileData.occupation, email: profileData.email, monthlySalary: Number(parseRawAmount(profileData.monthlySalary)) || 0 }); setSuccess("Profile updated!"); closeProfileModal(); loadData(); }
    catch (err) { setProfileError(err.message); } finally { setProfileSubmitting(false); }
  }

  /* ── Password ── */
  function openPasswordModal() { setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" }); setPasswordError(""); setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false); setShowPasswordModal(true); }
  function closePasswordModal() { setShowPasswordModal(false); setPasswordError(""); }
  function handlePasswordChange(e) { const { name, value } = e.target; setPasswordData((p) => ({ ...p, [name]: value })); }
  async function handlePasswordSubmit(e) {
    e.preventDefault(); setPasswordError("");
    if (passwordData.newPassword !== passwordData.confirmPassword) { setPasswordError("New password and confirm password do not match."); return; }
    setPasswordSubmitting(true);
    try { await changePassword(passwordData.currentPassword, passwordData.newPassword, passwordData.confirmPassword); setSuccess("Password changed!"); closePasswordModal(); }
    catch (err) { setPasswordError(err.message); } finally { setPasswordSubmitting(false); }
  }

  function handleLogout() { localStorage.removeItem("token"); localStorage.removeItem("userId"); navigate("/"); }

  /* ── Derived ── */
  const categories = savings?.categories || [];
  const totalSavings = categories.reduce((s, c) => s + (c.amount || 0), 0);
  const totalDeposited = savings?.depositedAmountSubtotal || 0;
  const totalWithdrawn = transactions.filter(t => t.transactionType === "WITHDRAWAL").reduce((s, t) => s + Number(t.withdrawalAmount || 0), 0);

  /* ── Filtered transactions ── */
  const filteredTransactions = transactions.filter((tx) => {
    if (filterType !== "all" && tx.transactionType !== filterType) return false;
    if (filterCategory !== "all" && tx.categoryName !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const isD = tx.transactionType === "DEPOSIT";
      const amt = Number(isD ? tx.amount : tx.withdrawalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (!(isD ? "deposit" : "withdrawal").includes(q) && !(tx.categoryName || "").toLowerCase().includes(q) && !amt.includes(q) && !(tx.note || "").toLowerCase().includes(q) && !formatDatePH(tx.dateTime).toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const txCategoryNames = [...new Set(transactions.map((tx) => tx.categoryName).filter(Boolean))];

  /* ── Chart data ── */
  const savingsTrendData = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      if (!tx.dateTime) return;
      const month = tx.dateTime.substring(0, 7); // "YYYY-MM"
      if (!map[month]) map[month] = { deposits: 0, withdrawals: 0 };
      if (tx.transactionType === "DEPOSIT") map[month].deposits += Number(tx.amount || 0);
      else map[month].withdrawals += Number(tx.withdrawalAmount || 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => {
      const [y, mo] = m.split("-");
      const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      return { month: label, Deposits: v.deposits, Withdrawals: v.withdrawals };
    });
  }, [transactions]);

  const categoryPieData = useMemo(() => {
    return categories.map((c) => ({ name: c.name, value: c.amount || 0 })).filter((c) => c.value > 0);
  }, [categories]);

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  function getCategoryByName(name) {
    return categories.find((c) => c.name === name) || null;
  }

  /** Resolve a SavingsCategory.type slug to its friendly label, falling back to the slug. */
  function getTypeLabel(slug) {
    if (!slug) return "";
    const t = availableTypes.find((x) => x.id === slug);
    return t ? t.label : slug;
  }

  /* ── Export CSV ── */
  function exportTransactionsCSV() {
    if (filteredTransactions.length === 0) return;
    const headers = ["Type", "Category", "Amount (₱)", "Note", "Date & Time", "Goal (₱)", "Saved (₱)", "Remaining (₱)", "Progress (%)", "Goal Reached"];
    const rows = filteredTransactions.map((tx) => {
      const isD = tx.transactionType === "DEPOSIT"; const amt = isD ? tx.amount : tx.withdrawalAmount;
      const cat = getCategoryByName(tx.categoryName);
      const goal = cat?.amount || 0;
      const saved = cat?.savingsCurrentAmount || 0;
      const remaining = Math.max(goal - saved, 0);
      const pct = goal > 0 ? Math.min((saved / goal) * 100, 100) : 0;
      const reached = pct >= 100 ? "Yes" : "No";
      return [isD ? "Deposit" : "Withdrawal", tx.categoryName || "", `${isD ? "+" : "-"}${Number(amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, tx.note || "", formatDatePH(tx.dateTime), Number(goal).toLocaleString(undefined, { minimumFractionDigits: 2 }), Number(saved).toLocaleString(undefined, { minimumFractionDigits: 2 }), Number(remaining).toLocaleString(undefined, { minimumFractionDigits: 2 }), pct.toFixed(0), reached];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transaction-history-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  /* helper to switch view & close sidebar on mobile */
  function goTo(view) { setActiveView(view); setSidebarOpen(false); }

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="db-shell">

      {/* ═════════════════ TOP NAV ═════════════════ */}
      <header className="db-nav">
        <div className="db-nav-inner">
          <div className="db-nav-brand">
            <div className="db-nav-logo">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <span className="db-nav-name">Wallet Friendly</span>
          </div>

          <nav className="db-nav-pills" aria-label="Primary">
            <button className={`db-pill ${activeView === "dashboard" ? "db-pill-active" : ""}`} onClick={() => goTo("dashboard")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              <span>Overview</span>
            </button>
            <button className={`db-pill ${activeView === "categories" ? "db-pill-active" : ""}`} onClick={() => goTo("categories")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>
              <span>Categories</span>
              {categories.length > 0 && <span className="db-pill-count">{categories.length}</span>}
            </button>
            <button className={`db-pill ${activeView === "history" ? "db-pill-active" : ""}`} onClick={() => goTo("history")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <span>History</span>
              {transactions.length > 0 && <span className="db-pill-count">{transactions.length}</span>}
            </button>
            {(savings?.groupName || groupSummary) && (
              <button className={`db-pill ${activeView === "group" ? "db-pill-active" : ""}`} onClick={() => goTo("group")}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                <span>Group</span>
                {groupSummary?.memberCount > 0 && <span className="db-pill-count">{groupSummary.memberCount}</span>}
              </button>
            )}
          </nav>

          <div className="db-nav-actions">
            {!pushEnabled ? (
              <button className="db-icon-btn" onClick={handleEnableNotifications} disabled={pushLoading} title="Enable push notifications">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </button>
            ) : (
              <span className="db-icon-btn db-icon-btn-on" title="Notifications enabled">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </span>
            )}
            <ThemeToggle />

            <div className="db-avatar-wrap" ref={menuRef}>
              <button className="db-avatar-btn" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="true" aria-expanded={menuOpen}>
                <span className="db-avatar-circle">{initials}</span>
                <span className="db-avatar-name">{fullName}</span>
                <svg className={`db-avatar-caret ${menuOpen ? "is-open" : ""}`} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>

              {menuOpen && (
                <div className="db-menu" role="menu">
                  <div className="db-menu-head">
                    <div className="db-menu-avatar">{initials}</div>
                    <div className="db-menu-id">
                      <span className="db-menu-name">{fullName}</span>
                      <span className="db-menu-email">{user?.email || ""}</span>
                    </div>
                  </div>
                  <button className="db-menu-item" onClick={() => { setMenuOpen(false); openProfileModal(); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Edit profile
                  </button>
                  <button className="db-menu-item" onClick={() => { setMenuOpen(false); openPasswordModal(); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    Change password
                  </button>
                  {user?.roles?.includes("ROLE_ADMIN") && (
                    <button className="db-menu-item" onClick={() => { setMenuOpen(false); navigate("/admin"); }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></svg>
                      Admin panel
                    </button>
                  )}
                  <div className="db-menu-divider" />
                  <button className="db-menu-item db-menu-item-danger" onClick={handleLogout}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile pill row (visible under brand on small screens) */}
        <nav className="db-nav-pills-mobile" aria-label="Primary mobile">
          <button className={`db-pill ${activeView === "dashboard" ? "db-pill-active" : ""}`} onClick={() => goTo("dashboard")}>Overview</button>
          <button className={`db-pill ${activeView === "categories" ? "db-pill-active" : ""}`} onClick={() => goTo("categories")}>Categories</button>
          <button className={`db-pill ${activeView === "history" ? "db-pill-active" : ""}`} onClick={() => goTo("history")}>History</button>
          {(savings?.groupName || groupSummary) && (
            <button className={`db-pill ${activeView === "group" ? "db-pill-active" : ""}`} onClick={() => goTo("group")}>Group</button>
          )}
        </nav>
      </header>

      {/* ═════════════════ MAIN ═════════════════ */}
      <main className="db-main">

        {/* Toasts */}
        {success && <div className="db-toast db-toast-success"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>{success}</div>}
        {error && <div className="db-toast db-toast-error"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{error}</div>}

        {loading ? (
          <div className="db-loading">
            <div className="db-spinner-lg" />
            <p>Loading your savings…</p>
          </div>
        ) : (
          <>

          {/* ════════ OVERVIEW VIEW ════════ */}
          {activeView === "dashboard" && (
            <>
              {/* HERO BANNER ===== */}
              <section className="db-hero">
                <div className="db-hero-text">
                  <span className="db-hero-eyebrow">{getGreeting()}</span>
                  <h1>Hello, {user?.firstName || "User"}.</h1>
                  <p>Here&apos;s a snapshot of your savings activity today.</p>
                </div>
                <div className="db-hero-actions">
                  <button className="db-action db-action-primary" onClick={() => openModal("deposit")} disabled={categories.length === 0}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Deposit
                  </button>
                  <button className="db-action db-action-secondary" onClick={() => openModal("withdraw")} disabled={categories.length === 0}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Withdraw
                  </button>
                  <button className="db-action db-action-ghost" onClick={openCategoryModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    New Category
                  </button>
                </div>
              </section>

              {/* TIP BANNER ===== */}
              {showTip && dailyTip && (
                <div className="db-tip">
                  <div className="db-tip-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></svg>
                  </div>
                  <div className="db-tip-content">
                    <span className="db-tip-label">Financial Tip</span>
                    <span className="db-tip-text">&ldquo;{dailyTip.quote}&rdquo;</span>
                    <span className="db-tip-author">— {dailyTip.author}</span>
                  </div>
                  <button className="db-tip-close" onClick={() => setShowTip(false)} title="Dismiss">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              )}

              {/* BENTO GRID ===== */}
              <section className="db-bento">
                {/* Big stat — Targeted Savings (sum of all category goal amounts) */}
                <div className="db-bento-card db-bento-savings">
                  <span className="db-bento-label">Targeted Savings</span>
                  <span className="db-bento-value">{fmtCurrency(totalSavings)}</span>
                  <span className="db-bento-sublabel">Combined goal across all your categories</span>
                  <div className="db-bento-meta">
                    <span className="db-bento-meta-pos">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                      Deposited {fmtCurrency(totalDeposited)}
                    </span>
                    <span className="db-bento-meta-neg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>
                      Withdrawn {fmtCurrency(totalWithdrawn)}
                    </span>
                  </div>
                  <div className="db-bento-orb" />
                </div>

                {/* Small stats */}
                <div className="db-bento-card db-bento-mini">
                  <div className="db-bento-mini-icon db-mini-blue">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                  </div>
                  <span className="db-bento-mini-label">Deposited</span>
                  <span className="db-bento-mini-value">{fmtCurrency(totalDeposited)}</span>
                </div>

                <div className="db-bento-card db-bento-mini">
                  <div className="db-bento-mini-icon db-mini-amber">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>
                  </div>
                  <span className="db-bento-mini-label">Withdrawn</span>
                  <span className="db-bento-mini-value">{fmtCurrency(totalWithdrawn)}</span>
                </div>

                <div className="db-bento-card db-bento-mini">
                  <div className="db-bento-mini-icon db-mini-purple">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>
                  </div>
                  <span className="db-bento-mini-label">Categories</span>
                  <span className="db-bento-mini-value">{categories.length}</span>
                </div>

                {/* Trend chart */}
                <div className="db-bento-card db-bento-trend">
                  <div className="db-bento-card-head">
                    <h3>Savings Trend</h3>
                    <span className="db-bento-card-sub">Monthly flow</span>
                  </div>
                  {savingsTrendData.length === 0 ? (
                    <p className="db-chart-empty">No transaction data yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={savingsTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12, color: "var(--text-primary)" }} formatter={(v) => fmtCurrency(v)} />
                        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }} />
                        <Line type="monotone" dataKey="Deposits" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e", strokeWidth: 2, stroke: "var(--bg-elevated)" }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Withdrawals" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "var(--bg-elevated)" }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Pie chart */}
                <div className="db-bento-card db-bento-pie">
                  <div className="db-bento-card-head">
                    <h3>By Category</h3>
                    <span className="db-bento-card-sub">Goal allocation</span>
                  </div>
                  {categoryPieData.length === 0 ? (
                    <p className="db-chart-empty">No categories yet.</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={categoryPieData} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={75} paddingAngle={3}>
                            {categoryPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-color)", borderRadius: 12, color: "var(--text-primary)" }} formatter={(v) => fmtCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="db-pie-legend">
                        {categoryPieData.map((c, i) => (
                          <div key={c.name} className="db-pie-legend-item">
                            <span className="db-pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span>{c.name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Recent transactions */}
                <div className="db-bento-card db-bento-recent">
                  <div className="db-bento-card-head">
                    <h3>Recent Transactions</h3>
                    {transactions.length > 0 && <button className="db-link-btn" onClick={() => goTo("history")}>View all →</button>}
                  </div>
                  {recentTransactions.length === 0 ? (
                    <p className="db-chart-empty">No transactions yet.</p>
                  ) : (
                    <div className="db-recent-list">
                      {recentTransactions.map((tx, idx) => {
                        const isD = tx.transactionType === "DEPOSIT";
                        const amt = isD ? tx.amount : tx.withdrawalAmount;
                        return (
                          <div className="db-recent-row" key={tx.id ?? idx}>
                            <div className={`db-recent-icon ${isD ? "db-ri-dep" : "db-ri-with"}`}>
                              {isD
                                ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                            </div>
                            <div className="db-recent-info">
                              <span className="db-recent-cat">{tx.categoryName || "—"}</span>
                              <span className="db-recent-date">{formatDatePH(tx.dateTime)}</span>
                            </div>
                            <span className={`db-recent-amount ${isD ? "db-amt-pos" : "db-amt-neg"}`}>
                              {isD ? "+" : "-"}{fmtCurrency(amt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </section>
            </>
          )}

          {/* ════════ CATEGORIES VIEW ════════ */}
          {activeView === "categories" && (
            <section className="db-section">
              <div className="db-section-head">
                <div>
                  <span className="db-section-eyebrow">Savings</span>
                  <h2>Your Categories</h2>
                  <p>{categories.length} categor{categories.length !== 1 ? "ies" : "y"} · keep building your goals.</p>
                </div>
                <button className="db-action db-action-primary" onClick={openCategoryModal}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  New Category
                </button>
              </div>

              {categories.length === 0 ? (
                <div className="db-empty">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                  <p>No categories yet</p>
                  <span>Create your first category to start saving!</span>
                </div>
              ) : (
                <div className="db-cat-grid">
                  {categories.map((cat) => {
                    const goal = cat.amount || 0;
                    const current = cat.savingsCurrentAmount || 0;
                    const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
                    const goalReached = pct >= 100;
                    const progressClass = goalReached ? "db-prog-green" : pct >= 50 ? "db-prog-blue" : "db-prog-orange";
                    const daysLeft = cat.goalDeadline ? Math.ceil((new Date(cat.goalDeadline) - new Date()) / 86400000) : null;

                    return (
                      <article className="db-cat-card" key={cat.category_id}>
                        <header className="db-cat-head">
                          <div className="db-cat-title">
                            <span className="db-cat-name">{cat.name}</span>
                            {cat.type && <span className="db-cat-tag">{getTypeLabel(cat.type)}</span>}
                          </div>
                          <div className="db-cat-icons">
                            <button className="db-icon-mini" title="Edit" onClick={() => openEditCategoryModal(cat)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            </button>
                            <button className="db-icon-mini db-icon-mini-danger" title="Delete" onClick={() => { setDeleteCatError(""); setDeleteCatConfirm(cat); }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                            </button>
                          </div>
                        </header>

                        {goalReached && <div className="db-cat-reached">Goal reached!</div>}

                        <div className="db-cat-amounts">
                          <div>
                            <span className="db-cat-num-label">Saved</span>
                            <span className="db-cat-num-value">{fmtCurrency(current)}</span>
                          </div>
                          <span className="db-cat-num-sep">/</span>
                          <div>
                            <span className="db-cat-num-label">Goal</span>
                            <span className="db-cat-num-value db-cat-num-goal">{fmtCurrency(goal)}</span>
                          </div>
                        </div>

                        <div className="db-cat-bar">
                          <div className={`db-cat-bar-fill ${progressClass}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="db-cat-bar-meta">
                          <span>{pct.toFixed(0)}% funded</span>
                          <span>Remaining {fmtCurrency(Math.max(goal - current, 0))}</span>
                        </div>

                        {cat.goalDeadline && (
                          <div className="db-cat-deadline">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            {daysLeft > 0
                              ? `${new Date(cat.goalDeadline).toLocaleDateString("en-US", { month: "short", year: "numeric" })} · ~${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`
                              : daysLeft === 0
                                ? "Deadline is today!"
                                : `Deadline passed (${new Date(cat.goalDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`}
                          </div>
                        )}

                        <footer className="db-cat-foot">
                          <button className="db-cat-btn db-cat-btn-dep" onClick={() => { setSelectedCategory(cat.category_id); setModalType("deposit"); setAmount(""); setNote(""); setTxError(""); setShowModal(true); }}>Deposit</button>
                          <button className="db-cat-btn db-cat-btn-with" onClick={() => { setSelectedCategory(cat.category_id); setModalType("withdraw"); setAmount(""); setNote(""); setWithdrawDate(""); setTxError(""); setShowModal(true); }}>Withdraw</button>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ════════ HISTORY VIEW ════════ */}
          {activeView === "history" && (
            <section className="db-section">
              <div className="db-section-head">
                <div>
                  <span className="db-section-eyebrow">Activity</span>
                  <h2>Transaction History</h2>
                  <p>{transactions.length} total transaction{transactions.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="db-empty">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                  <p>No transactions yet</p>
                  <span>Make a deposit or withdrawal to see your history here.</span>
                </div>
              ) : (
                <>
                  <div className="db-filter-bar">
                    <div className="db-filter-search">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                      <input type="text" placeholder="Search transactions…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                      {searchQuery && (
                        <button className="db-filter-clear" onClick={() => setSearchQuery("")}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      )}
                    </div>
                    <div className="db-filter-selects">
                      <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                        <option value="all">All Types</option>
                        <option value="DEPOSIT">Deposit</option>
                        <option value="WITHDRAWAL">Withdrawal</option>
                      </select>
                      <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                        <option value="all">All Categories</option>
                        {txCategoryNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="db-filter-summary">
                    <span>
                      Showing {filteredTransactions.length} of {transactions.length}
                      {(searchQuery || filterType !== "all" || filterCategory !== "all") && (
                        <button className="db-filter-reset" onClick={() => { setSearchQuery(""); setFilterType("all"); setFilterCategory("all"); }}>Clear filters</button>
                      )}
                    </span>
                    <button className="db-export-btn" onClick={exportTransactionsCSV} disabled={filteredTransactions.length === 0}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                      Export CSV
                    </button>
                  </div>

                  {filteredTransactions.length === 0 ? (
                    <div className="db-empty"><p>No transactions match your filters.</p></div>
                  ) : (
                    <div className="db-tx-wrapper">
                      <table className="db-tx-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>Goal Progress</th>
                            <th>Note</th>
                            <th>Date &amp; Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTransactions.map((tx, idx) => {
                            const isD = tx.transactionType === "DEPOSIT"; const amt = isD ? tx.amount : tx.withdrawalAmount;
                            const cat = getCategoryByName(tx.categoryName);
                            const goal = cat?.amount || 0;
                            const saved = cat?.savingsCurrentAmount || 0;
                            const pct = goal > 0 ? Math.min((saved / goal) * 100, 100) : 0;
                            const goalReached = pct >= 100;
                            const progressClass = goalReached ? "db-prog-green" : pct >= 50 ? "db-prog-blue" : "db-prog-orange";
                            return (
                              <tr key={tx.id ?? idx}>
                                <td><span className={`db-tx-badge ${isD ? "db-tx-dep" : "db-tx-with"}`}>{isD ? "Deposit" : "Withdrawal"}</span></td>
                                <td>{tx.categoryName || "—"}</td>
                                <td className={isD ? "db-amt-pos" : "db-amt-neg"}>{isD ? "+" : "-"}{fmtCurrency(amt)}</td>
                                <td className="db-tx-goal-cell">
                                  {goal > 0 ? (
                                    <div className="db-tx-goal">
                                      <div className="db-tx-bar"><div className={`db-cat-bar-fill ${progressClass}`} style={{ width: `${pct}%` }} /></div>
                                      <span className="db-tx-pct">{pct.toFixed(0)}%</span>
                                      {goalReached && <span className="db-tx-reached">Reached</span>}
                                    </div>
                                  ) : <span className="db-tx-no-goal">—</span>}
                                </td>
                                <td>{tx.note || "—"}</td>
                                <td className="db-tx-date">{formatDatePH(tx.dateTime)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ════════ GROUP VIEW ════════ */}
          {activeView === "group" && (
            <section className="db-section">
              <div className="db-section-head">
                <div>
                  <span className="db-section-eyebrow">Team savings</span>
                  <h2>{groupSummary?.groupName || savings?.groupName || "Your group"}</h2>
                  <p>
                    {groupSummary
                      ? `${groupSummary.memberCount} member${groupSummary.memberCount !== 1 ? "s" : ""} · combined savings activity`
                      : groupLoading
                        ? "Loading group summary…"
                        : "You belong to a group. Combined totals load when ready."}
                  </p>
                  {groupSummary?.description && (
                    <p className="db-group-desc">{groupSummary.description}</p>
                  )}
                </div>
              </div>

              {groupError && (
                <div className="db-toast db-toast-error" style={{ position: "static", marginBottom: 16 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {groupError}
                </div>
              )}

              {groupLoading && !groupSummary ? (
                <div className="db-loading"><div className="db-spinner-lg" /><p>Loading group…</p></div>
              ) : !groupSummary ? (
                <div className="db-empty">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                  <p>No group data available</p>
                  <span>Ask your administrator to assign you to a group.</span>
                </div>
              ) : (
                <>
                  {/* Combined stat cards */}
                  <div className="db-group-stats">
                    <div className="db-group-stat db-group-stat-primary">
                      <span className="db-group-stat-label">Group Targeted Savings</span>
                      <span className="db-group-stat-value">{fmtCurrency(groupSummary.totalTargetedAmount)}</span>
                      <span className="db-group-stat-sub">Combined goals across {groupSummary.memberCount} member{groupSummary.memberCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="db-group-stat">
                      <div className="db-group-stat-icon db-mini-blue">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                      </div>
                      <span className="db-group-stat-label">Total Deposited</span>
                      <span className="db-group-stat-value">{fmtCurrency(groupSummary.totalDepositedAmount)}</span>
                    </div>
                    <div className="db-group-stat">
                      <div className="db-group-stat-icon db-mini-amber">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>
                      </div>
                      <span className="db-group-stat-label">Total Withdrawn</span>
                      <span className="db-group-stat-value">{fmtCurrency(groupSummary.totalWithdrawnAmount)}</span>
                    </div>
                    <div className="db-group-stat">
                      <div className="db-group-stat-icon db-mini-purple">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>
                      </div>
                      <span className="db-group-stat-label">Categories</span>
                      <span className="db-group-stat-value">{groupSummary.totalCategoryCount}</span>
                    </div>
                    <div className="db-group-stat">
                      <div className="db-group-stat-icon db-mini-blue">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      </div>
                      <span className="db-group-stat-label">Transactions</span>
                      <span className="db-group-stat-value">{groupSummary.totalTransactionCount}</span>
                    </div>
                    {groupSummary.sharedCategories?.length > 0 && (
                      <div className="db-group-stat">
                        <div className="db-group-stat-icon db-mini-purple">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                        </div>
                        <span className="db-group-stat-label">Shared categories</span>
                        <span className="db-group-stat-value">{groupSummary.sharedCategories.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Members breakdown */}
                  <div className="db-group-section-title">
                    <h3>Members</h3>
                    <span>{groupSummary.members.length} {groupSummary.members.length === 1 ? "person" : "people"}</span>
                  </div>
                  <div className="db-group-members">
                    {groupSummary.members.map((m) => {
                      const initialsM = `${(m.firstName?.[0] || "").toUpperCase()}${(m.lastName?.[0] || "").toUpperCase()}`;
                      const target = m.targetedAmount || 0;
                      const deposited = m.depositedAmount || 0;
                      const pct = target > 0 ? Math.min((deposited / target) * 100, 100) : 0;
                      const me = m.id === userId;
                      return (
                        <article className={`db-group-member-card ${me ? "db-group-member-me" : ""}`} key={m.id}>
                          <div className="db-group-member-head">
                            <span className="db-group-member-avatar">{initialsM || "?"}</span>
                            <div className="db-group-member-id">
                              <span className="db-group-member-name">
                                {m.firstName} {m.lastName}
                                {me && <span className="db-group-member-you">You</span>}
                              </span>
                              <span className="db-group-member-email">{m.email}</span>
                            </div>
                          </div>
                          <dl className="db-group-member-stats">
                            <div>
                              <dt>Targeted</dt>
                              <dd>{fmtCurrency(target)}</dd>
                            </div>
                            <div>
                              <dt>Deposited</dt>
                              <dd>{fmtCurrency(deposited)}</dd>
                            </div>
                            <div>
                              <dt>Withdrawn</dt>
                              <dd>{fmtCurrency(m.withdrawnAmount)}</dd>
                            </div>
                            <div>
                              <dt>Categories</dt>
                              <dd>{m.categoryCount}</dd>
                            </div>
                          </dl>
                          {target > 0 && (
                            <>
                              <div className="db-cat-bar">
                                <div className={`db-cat-bar-fill ${pct >= 100 ? "db-prog-green" : pct >= 50 ? "db-prog-blue" : "db-prog-orange"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="db-cat-bar-meta">
                                <span>{pct.toFixed(0)}% funded</span>
                                <span>Remaining {fmtCurrency(Math.max(target - deposited, 0))}</span>
                              </div>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>

                  {/* Shared categories — categories tracked by 2+ members */}
                  {groupSummary.sharedCategories?.length > 0 && (
                    <>
                      <div className="db-group-section-title">
                        <h3>Shared Categories</h3>
                        <span>
                          {groupSummary.sharedCategories.length} {groupSummary.sharedCategories.length === 1 ? "category" : "categories"} tracked together
                        </span>
                      </div>
                      <p className="db-group-shared-hint">
                        Categories with the same name across members are combined here so the whole group can track progress against shared goals.
                      </p>
                      <div className="db-group-shared-grid">
                        {groupSummary.sharedCategories.map((sc) => {
                          const target = sc.totalTargetedAmount || 0;
                          const deposited = sc.totalDepositedAmount || 0;
                          const withdrawn = sc.totalWithdrawnAmount || 0;
                          const pct = target > 0 ? Math.min((deposited / target) * 100, 100) : 0;
                          const reached = pct >= 100;
                          const progressClass = reached ? "db-prog-green" : pct >= 50 ? "db-prog-blue" : "db-prog-orange";
                          return (
                            <article className="db-group-shared-card" key={sc.name}>
                              <header className="db-group-shared-head">
                                <div className="db-group-shared-titles">
                                  <span className="db-group-shared-name">{sc.name}</span>
                                  {sc.type && <span className="db-cat-tag">{getTypeLabel(sc.type)}</span>}
                                </div>
                                <span className="db-group-shared-count">
                                  {sc.contributorCount} {sc.contributorCount === 1 ? "member" : "members"}
                                </span>
                              </header>

                              {reached && <div className="db-cat-reached">Goal reached!</div>}

                              <div className="db-cat-amounts">
                                <div>
                                  <span className="db-cat-num-label">Combined saved</span>
                                  <span className="db-cat-num-value">{fmtCurrency(deposited)}</span>
                                </div>
                                <span className="db-cat-num-sep">/</span>
                                <div>
                                  <span className="db-cat-num-label">Combined goal</span>
                                  <span className="db-cat-num-value db-cat-num-goal">{fmtCurrency(target)}</span>
                                </div>
                              </div>

                              {target > 0 && (
                                <>
                                  <div className="db-cat-bar">
                                    <div className={`db-cat-bar-fill ${progressClass}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <div className="db-cat-bar-meta">
                                    <span>{pct.toFixed(0)}% funded</span>
                                    <span>Remaining {fmtCurrency(Math.max(target - deposited, 0))}</span>
                                  </div>
                                </>
                              )}

                              {withdrawn > 0 && (
                                <div className="db-group-shared-extra">
                                  <span>Combined withdrawn</span>
                                  <span className="db-amt-neg">-{fmtCurrency(withdrawn)}</span>
                                </div>
                              )}

                              <div className="db-group-shared-contributors">
                                <span className="db-group-shared-contributors-label">Contributors</span>
                                <ul>
                                  {sc.contributors
                                    .slice()
                                    .sort((a, b) => (b.depositedAmount || 0) - (a.depositedAmount || 0))
                                    .map((c) => {
                                      const cInitials = `${(c.firstName?.[0] || "").toUpperCase()}${(c.lastName?.[0] || "").toUpperCase()}`;
                                      const me = c.userId === userId;
                                      const cTarget = c.targetedAmount || 0;
                                      const cDeposited = c.depositedAmount || 0;
                                      const cPct = cTarget > 0 ? Math.min((cDeposited / cTarget) * 100, 100) : 0;
                                      return (
                                        <li key={`${c.userId}-${c.categoryId}`}>
                                          <span className="db-group-shared-contrib-avatar">{cInitials || "?"}</span>
                                          <div className="db-group-shared-contrib-id">
                                            <span className="db-group-shared-contrib-name">
                                              {c.firstName} {c.lastName}
                                              {me && <span className="db-group-member-you">You</span>}
                                            </span>
                                            <span className="db-group-shared-contrib-meta">
                                              Saved {fmtCurrency(cDeposited)} of {fmtCurrency(cTarget)}
                                              {cTarget > 0 && ` · ${cPct.toFixed(0)}%`}
                                            </span>
                                          </div>
                                        </li>
                                      );
                                    })}
                                </ul>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Combined transaction history */}
                  <div className="db-group-section-title">
                    <h3>Combined Transaction History</h3>
                    <span>{groupSummary.transactions.length} total</span>
                  </div>
                  {groupSummary.transactions.length === 0 ? (
                    <div className="db-empty">
                      <p>No group transactions yet</p>
                      <span>Once members start saving, their activity will appear here.</span>
                    </div>
                  ) : (
                    <div className="db-tx-wrapper">
                      <table className="db-tx-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Member</th>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>Note</th>
                            <th>Date &amp; Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupSummary.transactions.map((tx, idx) => {
                            const isD = tx.transactionType === "DEPOSIT";
                            const amt = isD ? tx.amount : tx.withdrawalAmount;
                            const member = groupSummary.members.find((m) => m.id === tx.userId);
                            const memberName = member ? `${member.firstName} ${member.lastName}` : "—";
                            return (
                              <tr key={`${tx.transactionType}-${tx.id ?? idx}`}>
                                <td><span className={`db-tx-badge ${isD ? "db-tx-dep" : "db-tx-with"}`}>{isD ? "Deposit" : "Withdrawal"}</span></td>
                                <td>{memberName}</td>
                                <td>{tx.categoryName || "—"}</td>
                                <td className={isD ? "db-amt-pos" : "db-amt-neg"}>{isD ? "+" : "-"}{fmtCurrency(amt)}</td>
                                <td>{tx.note || "—"}</td>
                                <td className="db-tx-date">{formatDatePH(tx.dateTime)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          </>
        )}
      </main>

      {/* ══════ ALL MODALS (preserved) ══════ */}

      {/* Category Create/Edit */}
      {showCategoryModal && (
        <div className="db-modal-overlay" onClick={closeCategoryModal}>
          <div className="db-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-head">
              <h2>{catModalMode === "create" ? "Create Savings Category" : "Edit Category"}</h2>
              <button className="db-modal-close" onClick={closeCategoryModal}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            {catError && (
              <div className="db-modal-err">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>{catError}</span>
              </div>
            )}
            <form onSubmit={handleCategorySubmit} className="db-modal-form">
              <div className="db-modal-field"><label htmlFor="catName">Category Name *</label><input id="catName" type="text" placeholder="e.g. House, Emergency Fund" value={catName} onChange={(e) => setCatName(e.target.value)} required /></div>
              <div className="db-modal-field"><label htmlFor="catType">Type</label><select id="catType" value={catType} onChange={(e) => setCatType(e.target.value)}>{availableTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
              <div className="db-modal-field"><label htmlFor="catAmount">Goal Amount (₱)</label><input id="catAmount" type="text" inputMode="decimal" placeholder="0.00" value={catAmount} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const parts = raw.split("."); const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw; setCatAmount(formatAmountDisplay(cleaned)); }} /></div>
              <div className="db-modal-field"><label htmlFor="catGoalDeadline">Target Date (optional)</label><input id="catGoalDeadline" type="date" value={catGoalDeadline} onChange={(e) => setCatGoalDeadline(e.target.value)} min={new Date().toISOString().split("T")[0]} /></div>
              <div className="db-modal-actions">
                <button type="button" className="db-btn-cancel" onClick={closeCategoryModal}>Cancel</button>
                <button type="submit" className="db-btn-submit" disabled={catSubmitting}>{catSubmitting ? <span className="db-spinner-sm" /> : catModalMode === "create" ? "Create Category" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category */}
      {deleteCatConfirm && (
        <div className="db-modal-overlay" onClick={() => { setDeleteCatConfirm(null); setDeleteCatError(""); }}>
          <div className="db-modal-box db-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-warn">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <h2>Delete Category</h2>
            {deleteCatError && (
              <div className="db-modal-err">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>{deleteCatError}</span>
              </div>
            )}
            <p>Are you sure you want to delete <strong>&ldquo;{deleteCatConfirm.name}&rdquo;</strong>?</p>
            <p className="db-modal-warn-text">This will permanently remove this category and all its data.</p>
            <div className="db-modal-actions db-modal-actions-center">
              <button className="db-btn-cancel" onClick={() => { setDeleteCatConfirm(null); setDeleteCatError(""); }}>Cancel</button>
              <button className="db-btn-danger" onClick={handleDeleteCategory}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Edit */}
      {showProfileModal && (
        <div className="db-modal-overlay" onClick={closeProfileModal}>
          <div className="db-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-head"><h2>Edit My Profile</h2><button className="db-modal-close" onClick={closeProfileModal}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div>
            {profileError && <div className="db-modal-err"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg><span>{profileError}</span></div>}
            <form onSubmit={handleProfileSubmit} className="db-modal-form">
              <div className="db-modal-row">
                <div className="db-modal-field"><label htmlFor="profFN">First Name *</label><input id="profFN" name="firstName" value={profileData.firstName} onChange={handleProfileChange} required /></div>
                <div className="db-modal-field"><label htmlFor="profMN">Middle Name</label><input id="profMN" name="middleName" value={profileData.middleName} onChange={handleProfileChange} /></div>
              </div>
              <div className="db-modal-row">
                <div className="db-modal-field"><label htmlFor="profLN">Last Name *</label><input id="profLN" name="lastName" value={profileData.lastName} onChange={handleProfileChange} required /></div>
                <div className="db-modal-field"><label htmlFor="profOcc">Occupation</label><input id="profOcc" name="occupation" value={profileData.occupation} onChange={handleProfileChange} /></div>
              </div>
              <div className="db-modal-field"><label htmlFor="profEmail">Email *</label><input id="profEmail" name="email" type="email" value={profileData.email} onChange={handleProfileChange} required /></div>
              <div className="db-modal-field"><label htmlFor="profSalary">Monthly Salary (₱)</label><input id="profSalary" name="monthlySalary" type="text" inputMode="decimal" placeholder="0.00" value={profileData.monthlySalary} onChange={handleProfileChange} /></div>
              <div className="db-modal-actions">
                <button type="button" className="db-btn-cancel" onClick={closeProfileModal}>Cancel</button>
                <button type="submit" className="db-btn-submit" disabled={profileSubmitting}>{profileSubmitting ? <span className="db-spinner-sm" /> : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password */}
      {showPasswordModal && (
        <div className="db-modal-overlay" onClick={closePasswordModal}>
          <div className="db-modal-box db-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-head"><h2>Change Password</h2><button className="db-modal-close" onClick={closePasswordModal}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div>
            {passwordError && <div className="db-modal-err"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg><span>{passwordError}</span></div>}
            <form onSubmit={handlePasswordSubmit} className="db-modal-form">
              {[["currentPassword","Current Password *",showCurrentPw,setShowCurrentPw,"Enter current password"],["newPassword","New Password *",showNewPw,setShowNewPw,"At least 6 characters"],["confirmPassword","Confirm New Password *",showConfirmPw,setShowConfirmPw,"Re-enter new password"]].map(([field,label,show,setShow,ph]) => (
                <div className="db-modal-field" key={field}>
                  <label>{label}</label>
                  <div className="db-pw-wrap">
                    <input name={field} type={show ? "text" : "password"} placeholder={ph} value={passwordData[field]} onChange={handlePasswordChange} required minLength={field !== "currentPassword" ? 6 : undefined} />
                    <button type="button" className="db-pw-toggle" onClick={() => setShow(!show)} tabIndex={-1}>
                      {show
                        ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
                    </button>
                  </div>
                </div>
              ))}
              {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && <div className="db-pw-mismatch">Passwords do not match</div>}
              <div className="db-modal-actions">
                <button type="button" className="db-btn-cancel" onClick={closePasswordModal}>Cancel</button>
                <button type="submit" className="db-btn-submit" disabled={passwordSubmitting || (passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword)}>{passwordSubmitting ? <span className="db-spinner-sm" /> : "Change Password"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit / Withdraw */}
      {showModal && (
        <div className="db-modal-overlay" onClick={closeModal}>
          <div className="db-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-head"><h2>{modalType === "deposit" ? "Deposit to Savings" : "Withdraw from Savings"}</h2><button className="db-modal-close" onClick={closeModal}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div>
            {txError && <div className="db-modal-err"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg><span>{txError}</span></div>}
            <form onSubmit={handleSubmit} className="db-modal-form">
              <div className="db-modal-field">
                <label htmlFor="category">Category</label>
                <select id="category" value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setWithdrawDate(""); }} required>
                  <option value="">Select a category</option>
                  {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name} — {fmtCurrency(c.amount)}</option>)}
                </select>
              </div>
              <div className="db-modal-field">
                <label htmlFor="amount">Amount (₱)</label>
                <input id="amount" type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const parts = raw.split("."); const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw; setAmount(formatAmountDisplay(cleaned)); }} required />
              </div>
              {modalType === "withdraw" && (() => {
                const byDate = {};
                if (selectedCategory) {
                  transactions.filter((tx) => tx.transactionType === "DEPOSIT" && String(tx.categoryId) === String(selectedCategory) && tx.dateTime).forEach((tx) => { const dk = tx.dateTime.split("T")[0]; byDate[dk] = (byDate[dk] || 0) + Number(tx.amount || 0); });
                }
                const dates = Object.keys(byDate).sort();
                return (
                  <div className="db-modal-field">
                    <label htmlFor="withdrawDate">Deposit Date *</label>
                    {dates.length === 0
                      ? <p className="db-modal-hint">{selectedCategory ? "No deposit dates found." : "Select a category first."}</p>
                      : <select id="withdrawDate" value={withdrawDate} onChange={(e) => setWithdrawDate(e.target.value)} required>
                          <option value="">Select a deposit date</option>
                          {dates.map((d) => { const dt = new Date(d + "T00:00:00"); const lbl = dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" }); return <option key={d} value={d}>{lbl} — {fmtCurrency(byDate[d])}</option>; })}
                        </select>}
                  </div>
                );
              })()}
              <div className="db-modal-field"><label htmlFor="note">Note (optional)</label><input id="note" type="text" placeholder="e.g. Monthly savings" value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <div className="db-modal-actions">
                <button type="button" className="db-btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className={`db-btn-submit ${modalType === "withdraw" ? "db-btn-submit-amber" : ""}`} disabled={submitting}>{submitting ? <span className="db-spinner-sm" /> : modalType === "deposit" ? "Confirm Deposit" : "Confirm Withdrawal"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
