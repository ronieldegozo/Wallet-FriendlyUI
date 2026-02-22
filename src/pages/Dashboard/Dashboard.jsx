import { useEffect, useState, useMemo } from "react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  /* ── Effects ── */
  useEffect(() => {
    setAvailableTypes(getCategoryTypes());
    if (userId) loadData();
    fetch(QUOTE_API_URL)
      .then((res) => res.json())
      .then((data) => setDailyTip({ quote: data.quote, author: data.author }))
      .catch(() => setDailyTip(null));
  }, [userId]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 4000); return () => clearTimeout(t); }
  }, [success]);

  useEffect(() => {
    if (showTip) { const t = setTimeout(() => setShowTip(false), 30000); return () => clearTimeout(t); }
  }, [showTip]);

  useEffect(() => {
    if (userId) subscribeToPush(userId);
  }, [userId]);

  async function loadData() {
    setLoading(true); setError("");
    try {
      const [savingsRes, txRes] = await Promise.all([getAllSavings(), getTransactionHistory(userId)]);
      const myData = (savingsRes.data || []).find((u) => u.id === userId);
      setSavings(myData || null);
      setTransactions(txRes.data || []);
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
  function openCategoryModal() { setCatModalMode("create"); setEditingCategoryId(null); setCatError(""); setCatName(""); setCatAmount(""); setCatGoalDeadline(""); const t = getCategoryTypes(); setAvailableTypes(t); setCatType(t.length > 0 ? t[0].id : ""); setShowCategoryModal(true); }
  function openEditCategoryModal(cat) { setCatModalMode("edit"); setCatError(""); setEditingCategoryId(cat.category_id); setCatName(cat.name || ""); setCatAmount(cat.amount ? formatAmountDisplay(String(cat.amount)) : ""); setCatGoalDeadline(cat.goalDeadline || ""); const t = getCategoryTypes(); setAvailableTypes(t); setCatType(cat.type || (t.length > 0 ? t[0].id : "")); setShowCategoryModal(true); }
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
    <div className={`dash-layout ${sidebarOpen ? "sidebar-open" : ""}`}>

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
            <span>Wallet Friendly</span>
          </div>

          <nav className="sidebar-nav">
            <button className={`nav-item ${activeView === "dashboard" ? "nav-active" : ""}`} onClick={() => goTo("dashboard")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              <span>Dashboard</span>
            </button>
            <button className={`nav-item ${activeView === "categories" ? "nav-active" : ""}`} onClick={() => goTo("categories")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>
              <span>Categories</span>
            </button>
            <button className={`nav-item ${activeView === "history" ? "nav-active" : ""}`} onClick={() => goTo("history")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <span>History</span>
            </button>

            <div className="nav-divider" />

            <button className={`nav-item ${activeView === "profile" ? "nav-active" : ""}`} onClick={() => { goTo("profile"); openProfileModal(); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              <span>Profile</span>
            </button>
            <button className="nav-item" onClick={() => { openPasswordModal(); setSidebarOpen(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              <span>Password</span>
            </button>

            {user?.roles?.includes("ROLE_ADMIN") && (
              <>
                <div className="nav-divider" />
                <button className="nav-item nav-admin" onClick={() => navigate("/admin")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                  <span>Admin Panel</span>
                </button>
              </>
            )}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <ThemeToggle />
          <button className="nav-item nav-logout" onClick={handleLogout}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Overlay for mobile sidebar ── */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Main Content ── */}
      <div className="dash-main">
        {/* ── Top bar ── */}
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
          </button>
          <div className="topbar-greeting">
            <h1>{getGreeting()}, {user?.firstName || "User"}</h1>
            <p>Here&apos;s your financial overview</p>
          </div>
          <button className="topbar-avatar" onClick={openProfileModal} title="Edit profile">
            <div className="avatar-circle">{initials}</div>
            <span className="avatar-name">{fullName}</span>
          </button>
        </header>

        {/* ── Messages ── */}
        <div className="dash-content">
          {success && <div className="toast toast-success"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>{success}</div>}
          {error && <div className="toast toast-error"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{error}</div>}

          {loading ? (
            <div className="dash-loading"><div className="spinner-lg" /><p>Loading your savings...</p></div>
          ) : (
            <>
              {/* ════════ DASHBOARD VIEW ════════ */}
              {activeView === "dashboard" && (
                <>
                  {/* ── Financial Tip ── */}
                  {showTip && dailyTip && (
                    <div className="tip-banner tip-fade">
                      <div className="tip-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></svg>
                      </div>
                      <div className="tip-content">
                        <span className="tip-label">Financial Tip</span>
                        <span className="tip-text">"{dailyTip.quote}"</span>
                        <span className="tip-author">— {dailyTip.author}</span>
                      </div>
                      <button className="tip-close" onClick={() => setShowTip(false)} title="Dismiss">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  )}

                  {/* ── Quick Actions ── */}
                  <div className="quick-actions">
                    <button className="qa-btn qa-deposit" onClick={() => openModal("deposit")} disabled={categories.length === 0}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      <span>Deposit</span>
                    </button>
                    <button className="qa-btn qa-withdraw" onClick={() => openModal("withdraw")} disabled={categories.length === 0}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      <span>Withdraw</span>
                    </button>
                    <button className="qa-btn qa-category" onClick={openCategoryModal}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><line x1="12" y1="12" x2="12" y2="18" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
                      <span>New Category</span>
                    </button>
                  </div>

                  {/* ── Summary Cards ── */}
                  <div className="stat-cards">
                    <div className="stat-card stat-green">
                      <div className="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg></div>
                      <div className="stat-info"><span className="stat-label">Total Savings</span><span className="stat-value">{fmtCurrency(totalSavings)}</span></div>
                    </div>
                    <div className="stat-card stat-blue">
                      <div className="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg></div>
                      <div className="stat-info"><span className="stat-label">Total Deposited</span><span className="stat-value">{fmtCurrency(totalDeposited)}</span></div>
                    </div>
                    <div className="stat-card stat-amber">
                      <div className="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg></div>
                      <div className="stat-info"><span className="stat-label">Total Withdrawn</span><span className="stat-value">{fmtCurrency(totalWithdrawn)}</span></div>
                    </div>
                    <div className="stat-card stat-purple">
                      <div className="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg></div>
                      <div className="stat-info"><span className="stat-label">Categories</span><span className="stat-value">{categories.length}</span></div>
                    </div>
                  </div>

                  {/* ── Charts Row ── */}
                  <div className="charts-row">
                    <div className="chart-card chart-wide">
                      <h3>Savings Trend</h3>
                      {savingsTrendData.length === 0 ? (
                        <p className="chart-empty">No transaction data yet.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart data={savingsTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, color: "var(--text-primary)" }} formatter={(v) => fmtCurrency(v)} />
                            <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }} />
                            <Line type="linear" dataKey="Deposits" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 5, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7 }} />
                            <Line type="linear" dataKey="Withdrawals" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 5, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    <div className="chart-card chart-narrow">
                      <h3>By Category</h3>
                      {categoryPieData.length === 0 ? (
                        <p className="chart-empty">No categories yet.</p>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie data={categoryPieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                                {categoryPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                              </Pie>
                              <Tooltip contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, color: "var(--text-primary)" }} formatter={(v) => fmtCurrency(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pie-legend">
                            {categoryPieData.map((c, i) => (
                              <div key={c.name} className="pie-legend-item"><span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span>{c.name}</span></div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── Recent Transactions ── */}
                  <div className="recent-section">
                    <div className="recent-header">
                      <h3>Recent Transactions</h3>
                      {transactions.length > 0 && <button className="link-btn" onClick={() => goTo("history")}>View all →</button>}
                    </div>
                    {recentTransactions.length === 0 ? (
                      <p className="chart-empty" style={{ padding: "2rem" }}>No transactions yet.</p>
                    ) : (
                      <div className="recent-list">
                        {recentTransactions.map((tx, idx) => {
                          const isD = tx.transactionType === "DEPOSIT";
                          const amt = isD ? tx.amount : tx.withdrawalAmount;
                          return (
                            <div className="recent-row" key={tx.id ?? idx}>
                              <div className={`recent-icon ${isD ? "ri-deposit" : "ri-withdraw"}`}>
                                {isD ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                     : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                              </div>
                              <div className="recent-info">
                                <span className="recent-cat">{tx.categoryName || "—"}</span>
                                <span className="recent-date">{formatDatePH(tx.dateTime)}</span>
                              </div>
                              <span className={`recent-amount ${isD ? "amount-green" : "amount-red"}`}>{isD ? "+" : "-"}{fmtCurrency(amt)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ════════ CATEGORIES VIEW ════════ */}
              {activeView === "categories" && (
                <div className="view-section">
                  <div className="view-header">
                    <div><h2>Savings Categories</h2><p className="view-sub">{categories.length} categor{categories.length !== 1 ? "ies" : "y"}</p></div>
                    <button className="qa-btn qa-category" onClick={openCategoryModal}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg><span>New Category</span></button>
                  </div>
                  {categories.length === 0 ? (
                    <div className="empty-state"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg><p>No categories yet</p><span>Create your first category to start saving!</span></div>
                  ) : (
                    <div className="categories-grid">
                      {categories.map((cat) => {
                        const goal = cat.amount || 0;
                        const current = cat.savingsCurrentAmount || 0;
                        const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
                        const goalReached = pct >= 100;
                        const progressColor = goalReached ? "progress-green" : pct >= 50 ? "progress-blue" : "progress-orange";
                        const daysLeft = cat.goalDeadline ? Math.ceil((new Date(cat.goalDeadline) - new Date()) / 86400000) : null;

                        return (
                          <div className="category-card" key={cat.category_id}>
                            <div className="cat-header">
                              <span className="cat-name">{cat.name}</span>
                              <div className="cat-header-right">
                                {goalReached && <span className="goal-reached-badge">Goal Reached!</span>}
                                {cat.type && <span className="cat-type">{cat.type}</span>}
                                <button className="cat-icon-btn cat-icon-edit" title="Edit" onClick={() => openEditCategoryModal(cat)}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </button>
                                <button className="cat-icon-btn cat-icon-delete" title="Delete" onClick={() => { setDeleteCatError(""); setDeleteCatConfirm(cat); }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                </button>
                              </div>
                            </div>

                            <div className="cat-goal-info">
                              <span className="cat-goal-label">Goal: {fmtCurrency(goal)}</span>
                              <span className="cat-goal-saved">Saved: {fmtCurrency(current)}</span>
                            </div>

                            <div className="goal-progress">
                              <div className="progress-bar-track">
                                <div className={`progress-bar-fill ${progressColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="progress-pct">{pct.toFixed(0)}%</span>
                            </div>

                            <div className="cat-remaining">
                              Remaining: {fmtCurrency(Math.max(goal - current, 0))}
                            </div>

                            {cat.goalDeadline && (
                              <div className="cat-deadline">
                                {daysLeft > 0
                                  ? `Target: ${new Date(cat.goalDeadline).toLocaleDateString("en-US", { month: "short", year: "numeric" })} · ~${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`
                                  : daysLeft === 0
                                    ? "Deadline is today!"
                                    : `Deadline passed (${new Date(cat.goalDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`}
                              </div>
                            )}

                            <div className="cat-actions">
                              <button className="cat-btn cat-btn-deposit" onClick={() => { setSelectedCategory(cat.category_id); setModalType("deposit"); setAmount(""); setNote(""); setTxError(""); setShowModal(true); }}>Deposit</button>
                              <button className="cat-btn cat-btn-withdraw" onClick={() => { setSelectedCategory(cat.category_id); setModalType("withdraw"); setAmount(""); setNote(""); setWithdrawDate(""); setTxError(""); setShowModal(true); }}>Withdraw</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ════════ HISTORY VIEW ════════ */}
              {activeView === "history" && (
                <div className="view-section">
                  <div className="view-header"><div><h2>Transaction History</h2><p className="view-sub">{transactions.length} total transaction{transactions.length !== 1 ? "s" : ""}</p></div></div>
                  {transactions.length === 0 ? (
                    <div className="empty-state"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg><p>No transactions yet</p><span>Make a deposit or withdrawal to see your history here.</span></div>
                  ) : (
                    <>
                      <div className="filter-bar">
                        <div className="filter-search"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                          <input type="text" placeholder="Search transactions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                          {searchQuery && <button className="filter-clear" onClick={() => setSearchQuery("")}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>}
                        </div>
                        <div className="filter-dropdowns">
                          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="all">All Types</option><option value="DEPOSIT">Deposit</option><option value="WITHDRAWAL">Withdrawal</option></select>
                          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}><option value="all">All Categories</option>{txCategoryNames.map((n) => <option key={n} value={n}>{n}</option>)}</select>
                        </div>
                      </div>
                      <div className="filter-count"><span>Showing {filteredTransactions.length} of {transactions.length}{(searchQuery || filterType !== "all" || filterCategory !== "all") && <button className="filter-reset" onClick={() => { setSearchQuery(""); setFilterType("all"); setFilterCategory("all"); }}>Clear filters</button>}</span>
                        <button className="btn-export" onClick={exportTransactionsCSV} disabled={filteredTransactions.length === 0}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>Export CSV</button>
                      </div>
                      {filteredTransactions.length === 0 ? <div className="empty-state" style={{ padding: "2rem" }}><p>No transactions match your filters.</p></div> : (
                        <div className="table-wrapper"><table className="tx-table"><thead><tr><th>Type</th><th>Category</th><th>Amount</th><th>Goal Progress</th><th>Note</th><th>Date & Time</th></tr></thead><tbody>
                          {filteredTransactions.map((tx, idx) => {
                            const isD = tx.transactionType === "DEPOSIT"; const amt = isD ? tx.amount : tx.withdrawalAmount;
                            const cat = getCategoryByName(tx.categoryName);
                            const goal = cat?.amount || 0;
                            const saved = cat?.savingsCurrentAmount || 0;
                            const pct = goal > 0 ? Math.min((saved / goal) * 100, 100) : 0;
                            const goalReached = pct >= 100;
                            const progressColor = goalReached ? "progress-green" : pct >= 50 ? "progress-blue" : "progress-orange";
                            return (
                            <tr key={tx.id ?? idx}>
                              <td><span className={`tx-badge ${isD ? "tx-deposit" : "tx-withdraw"}`}>{isD ? "Deposit" : "Withdrawal"}</span></td>
                              <td>{tx.categoryName || "—"}</td>
                              <td className={isD ? "amount-green" : "amount-red"}>{isD ? "+" : "-"}{fmtCurrency(amt)}</td>
                              <td className="tx-goal-cell">
                                {goal > 0 ? (
                                  <div className="tx-goal-progress">
                                    <div className="tx-progress-bar-track">
                                      <div className={`progress-bar-fill ${progressColor}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="tx-progress-label">{pct.toFixed(0)}%</span>
                                    {goalReached && <span className="tx-goal-reached">Reached</span>}
                                  </div>
                                ) : <span className="tx-no-goal">—</span>}
                              </td>
                              <td>{tx.note || "—"}</td>
                              <td className="tx-date">{formatDatePH(tx.dateTime)}</td>
                            </tr>
                          ); })}
                        </tbody></table></div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════ ALL MODALS (preserved) ══════ */}

      {/* Category Create/Edit */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={closeCategoryModal}><div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2>{catModalMode === "create" ? "Create Savings Category" : "Edit Category"}</h2><button className="modal-close" onClick={closeCategoryModal}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div>
          {catError && <div className="pw-error-banner"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg><span>{catError}</span></div>}
          <form onSubmit={handleCategorySubmit} className="modal-form">
            <div className="form-field"><label htmlFor="catName">Category Name *</label><input id="catName" type="text" placeholder="e.g. House, Emergency Fund" value={catName} onChange={(e) => setCatName(e.target.value)} required /></div>
            <div className="form-field"><label htmlFor="catType">Type</label><select id="catType" value={catType} onChange={(e) => setCatType(e.target.value)}>{availableTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
            <div className="form-field"><label htmlFor="catAmount">Goal Amount (₱)</label><input id="catAmount" type="text" inputMode="decimal" placeholder="0.00" value={catAmount} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const parts = raw.split("."); const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw; setCatAmount(formatAmountDisplay(cleaned)); }} /></div>
            <div className="form-field"><label htmlFor="catGoalDeadline">Target Date (optional)</label><input id="catGoalDeadline" type="date" value={catGoalDeadline} onChange={(e) => setCatGoalDeadline(e.target.value)} min={new Date().toISOString().split("T")[0]} /></div>
            <div className="modal-actions"><button type="button" className="btn-cancel" onClick={closeCategoryModal}>Cancel</button><button type="submit" className="btn-submit" disabled={catSubmitting}>{catSubmitting ? <span className="spinner-sm" /> : catModalMode === "create" ? "Create Category" : "Save Changes"}</button></div>
          </form>
        </div></div>
      )}

      {/* Delete Category */}
      {deleteCatConfirm && (
        <div className="modal-overlay" onClick={() => { setDeleteCatConfirm(null); setDeleteCatError(""); }}><div className="modal-box modal-sm" onClick={(e) => e.stopPropagation()}>
          <div className="delete-warning-icon"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></div>
          <h2>Delete Category</h2>
          {deleteCatError && <div className="pw-error-banner"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg><span>{deleteCatError}</span></div>}
          <p>Are you sure you want to delete <strong>&ldquo;{deleteCatConfirm.name}&rdquo;</strong>?</p>
          <p className="delete-warning-text">This will permanently remove this category and all its data.</p>
          <div className="modal-actions modal-actions-center"><button className="btn-cancel" onClick={() => { setDeleteCatConfirm(null); setDeleteCatError(""); }}>Cancel</button><button className="btn-danger" onClick={handleDeleteCategory}>Delete</button></div>
        </div></div>
      )}

      {/* Profile Edit */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={closeProfileModal}><div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2>Edit My Profile</h2><button className="modal-close" onClick={closeProfileModal}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div>
          {profileError && <div className="pw-error-banner"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg><span>{profileError}</span></div>}
          <form onSubmit={handleProfileSubmit} className="modal-form">
            <div className="form-row"><div className="form-field"><label htmlFor="profFN">First Name *</label><input id="profFN" name="firstName" value={profileData.firstName} onChange={handleProfileChange} required /></div><div className="form-field"><label htmlFor="profMN">Middle Name</label><input id="profMN" name="middleName" value={profileData.middleName} onChange={handleProfileChange} /></div></div>
            <div className="form-row"><div className="form-field"><label htmlFor="profLN">Last Name *</label><input id="profLN" name="lastName" value={profileData.lastName} onChange={handleProfileChange} required /></div><div className="form-field"><label htmlFor="profOcc">Occupation</label><input id="profOcc" name="occupation" value={profileData.occupation} onChange={handleProfileChange} /></div></div>
            <div className="form-field"><label htmlFor="profEmail">Email *</label><input id="profEmail" name="email" type="email" value={profileData.email} onChange={handleProfileChange} required /></div>
            <div className="form-field"><label htmlFor="profSalary">Monthly Salary (₱)</label><input id="profSalary" name="monthlySalary" type="text" inputMode="decimal" placeholder="0.00" value={profileData.monthlySalary} onChange={handleProfileChange} /></div>
            <div className="modal-actions"><button type="button" className="btn-cancel" onClick={closeProfileModal}>Cancel</button><button type="submit" className="btn-submit" disabled={profileSubmitting}>{profileSubmitting ? <span className="spinner-sm" /> : "Save Changes"}</button></div>
          </form>
        </div></div>
      )}

      {/* Change Password */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={closePasswordModal}><div className="modal-box modal-narrow" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2>Change Password</h2><button className="modal-close" onClick={closePasswordModal}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div>
          {passwordError && <div className="pw-error-banner"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg><span>{passwordError}</span></div>}
          <form onSubmit={handlePasswordSubmit} className="modal-form">
            {[["currentPassword","Current Password *",showCurrentPw,setShowCurrentPw,"Enter current password"],["newPassword","New Password *",showNewPw,setShowNewPw,"At least 6 characters"],["confirmPassword","Confirm New Password *",showConfirmPw,setShowConfirmPw,"Re-enter new password"]].map(([field,label,show,setShow,ph]) => (
              <div className="form-field" key={field}><label>{label}</label><div className="pw-input-wrapper"><input name={field} type={show ? "text" : "password"} placeholder={ph} value={passwordData[field]} onChange={handlePasswordChange} required minLength={field !== "currentPassword" ? 6 : undefined} /><button type="button" className="pw-toggle" onClick={() => setShow(!show)} tabIndex={-1}>{show ? <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}</button></div></div>
            ))}
            {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && <div className="pw-mismatch">Passwords do not match</div>}
            <div className="modal-actions"><button type="button" className="btn-cancel" onClick={closePasswordModal}>Cancel</button><button type="submit" className="btn-submit" disabled={passwordSubmitting || (passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword)}>{passwordSubmitting ? <span className="spinner-sm" /> : "Change Password"}</button></div>
          </form>
        </div></div>
      )}

      {/* Deposit / Withdraw */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}><div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2>{modalType === "deposit" ? "Deposit to Savings" : "Withdraw from Savings"}</h2><button className="modal-close" onClick={closeModal}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div>
          {txError && <div className="pw-error-banner"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg><span>{txError}</span></div>}
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-field"><label htmlFor="category">Category</label><select id="category" value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setWithdrawDate(""); }} required><option value="">Select a category</option>{categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name} — {fmtCurrency(c.amount)}</option>)}</select></div>
            <div className="form-field"><label htmlFor="amount">Amount (₱)</label><input id="amount" type="text" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); const parts = raw.split("."); const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw; setAmount(formatAmountDisplay(cleaned)); }} required /></div>
            {modalType === "withdraw" && (() => {
              const byDate = {}; if (selectedCategory) { transactions.filter((tx) => tx.transactionType === "DEPOSIT" && String(tx.categoryId) === String(selectedCategory) && tx.dateTime).forEach((tx) => { const dk = tx.dateTime.split("T")[0]; byDate[dk] = (byDate[dk] || 0) + Number(tx.amount || 0); }); }
              const dates = Object.keys(byDate).sort();
              return (<div className="form-field"><label htmlFor="withdrawDate">Deposit Date *</label>{dates.length === 0 ? <p className="no-dates-hint">{selectedCategory ? "No deposit dates found." : "Select a category first."}</p> : <select id="withdrawDate" value={withdrawDate} onChange={(e) => setWithdrawDate(e.target.value)} required><option value="">Select a deposit date</option>{dates.map((d) => { const dt = new Date(d + "T00:00:00"); const lbl = dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" }); return <option key={d} value={d}>{lbl} — {fmtCurrency(byDate[d])}</option>; })}</select>}</div>);
            })()}
            <div className="form-field"><label htmlFor="note">Note (optional)</label><input id="note" type="text" placeholder="e.g. Monthly savings" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="modal-actions"><button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button><button type="submit" className={`btn-submit ${modalType === "withdraw" ? "btn-submit-red" : ""}`} disabled={submitting}>{submitting ? <span className="spinner-sm" /> : modalType === "deposit" ? "Confirm Deposit" : "Confirm Withdrawal"}</button></div>
          </form>
        </div></div>
      )}
    </div>
  );
}
