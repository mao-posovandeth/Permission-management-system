import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/AdminDashboard.css";

const API = "http://localhost:5000";

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminName, setAdminName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Requests view
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeGroup, setActiveGroup] = useState("all");
  const [page, setPageState] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // Manage Users
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ user_id: "", name: "", email: "", password: "", role: "student", group_name: "SE Group 1" });
  const [deleteUserId, setDeleteUserId] = useState(null);

  // Settings (persisted in localStorage)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("admin_settings");
    return saved ? JSON.parse(saved) : { autoRefresh: true, compactCards: false, confirmActions: true };
  });

  const autoRefreshRef = useRef(null);

  const groupNames = ["SE Group 1", "SE Group 2", "SE Group 3", "SE Group 4"];

  useEffect(() => {
    const name = localStorage.getItem("student_name");
    const role = localStorage.getItem("role");
    if (!name || role !== "admin") {
      localStorage.clear();
      navigate("/login");
      return;
    }
    setAdminName(name);
    fetchRequests();
    fetchUsers();
  }, [navigate]);

  useEffect(() => {
    if (settings.autoRefresh) {
      autoRefreshRef.current = setInterval(fetchRequests, 30000);
    }
    return () => clearInterval(autoRefreshRef.current);
  }, [settings.autoRefresh]);

  useEffect(() => {
    localStorage.setItem("admin_settings", JSON.stringify(settings));
  }, [settings]);

  const showToast = (message, color) => {
    const old = document.getElementById("toast");
    if (old) old.remove();
    const toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "app-toast";
    toast.innerText = message;
    toast.style.background = color;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("app-toast-visible"));
    setTimeout(() => {
      toast.classList.remove("app-toast-visible");
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  };

  /* ===================== DATA FETCHING ===================== */
  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API}/requests`);
      setRequests(res.data || []);
    } catch (err) {
      console.log(err);
      showToast("Failed to load requests", "#ef4444");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data || []);
    } catch (err) {
      console.log(err);
      // Don't toast on first load if endpoint missing — just log
    }
  };

  /* ===================== REQUEST ACTIONS ===================== */
  const updateStatus = async (requestId, status) => {
    try {
      await axios.put(`${API}/request-status`, { id: requestId, status });
      showToast(`Request ${status.toLowerCase()}`, status === "Accepted" ? "#059669" : "#e11d48");
      fetchRequests();
    } catch (err) {
      console.log(err);
      showToast("Update failed", "#ef4444");
    }
  };

  const confirmDelete = async () => {
    const id = deleteTargetId;
    setDeleteTargetId(null);
    try {
      await axios.delete(`${API}/delete-request/${id}`);
      showToast("Request deleted", "#2563eb");
      fetchRequests();
    } catch (err) {
      console.log(err);
      showToast("Delete failed", "#ef4444");
    }
  };

  /* ===================== BULK ACTIONS ===================== */
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllVisible = () => {
    const visibleIds = paginatedRequests.map(r => r.request_id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const bulkUpdate = async (status) => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map(id => axios.put(`${API}/request-status`, { id, status })));
      showToast(`${selectedIds.length} request(s) ${status.toLowerCase()}`, status === "Accepted" ? "#059669" : "#e11d48");
      setSelectedIds([]);
      fetchRequests();
    } catch (err) {
      console.log(err);
      showToast("Bulk action failed", "#ef4444");
    }
  };

  /* ===================== USER ACTIONS ===================== */
  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({ user_id: "", name: "", email: "", password: "", role: "student", group_name: "SE Group 1" });
    setUserModalOpen(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      user_id: user.user_id || "",
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "student",
      group_name: user.group_name || "SE Group 1",
    });
    setUserModalOpen(true);
  };

  const saveUser = async () => {
    if (!userForm.name || !userForm.email) {
      showToast("Name and email are required", "#ef4444");
      return;
    }
    if (!editingUser && !userForm.user_id) {
      showToast("User ID is required for new users", "#ef4444");
      return;
    }
    if (!editingUser && !userForm.password) {
      showToast("Password is required for new users", "#ef4444");
      return;
    }
    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.user_id}`, userForm);
        showToast("User updated", "#059669");
      } else {
        await axios.post(`${API}/users`, userForm);
        showToast("User created", "#059669");
      }
      setUserModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.log(err);
      showToast(err.response?.data?.message || "Failed to save user", "#ef4444");
    }
  };

  const confirmDeleteUser = async () => {
    const id = deleteUserId;
    setDeleteUserId(null);
    try {
      await axios.delete(`${API}/users/${id}`);
      showToast("User deleted", "#2563eb");
      fetchUsers();
    } catch (err) {
      console.log(err);
      showToast("Failed to delete user", "#ef4444");
    }
  };

  const handleLogout = () => setIsLogoutOpen(true);
  const confirmLogout = () => { localStorage.clear(); navigate("/login"); };

  const handleExportCSV = () => {
    const headers = ["Student Name", "Student ID", "Group", "Subject", "Class Time", "Date", "Reason", "Status"];
    const rows = requests.map(r => [
      r.student_name, r.student_id, r.group_name, r.subject_name,
      r.class_time, r.request_date ? new Date(r.request_date).toLocaleDateString("en-GB") : "",
      `"${(r.reason || "").replace(/"/g, '""')}"`, r.status
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "all-requests.csv"; a.click();
    URL.revokeObjectURL(url);
    showToast("Exported to CSV!", "#059669");
  };

  /* ===================== DERIVED DATA ===================== */
  const counts = {
    total: requests.length,
    pending: requests.filter(r => r.status?.toLowerCase() === "pending").length,
    accepted: requests.filter(r => ["accepted", "accept", "approved"].includes(r.status?.toLowerCase())).length,
    rejected: requests.filter(r => ["rejected", "reject"].includes(r.status?.toLowerCase())).length,
  };

  const userCounts = {
    total: users.length,
    students: users.filter(u => u.role?.toLowerCase() === "student").length,
    lecturers: users.filter(u => u.role?.toLowerCase() === "lecturer").length,
    admins: users.filter(u => u.role?.toLowerCase() === "admin").length,
  };

  const getFilteredRequests = () => {
    return requests.filter(r => {
      const groupLabel = activeGroup === "all" ? "all" : groupNames[activeGroup - 1];
      const matchGroup = groupLabel === "all" || r.group_name === groupLabel;
      const matchSearch = !searchTerm ||
        r.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.student_id?.toString().includes(searchTerm);
      const matchStatus = statusFilter === "all" ||
        (statusFilter === "pending" && r.status?.toLowerCase() === "pending") ||
        (statusFilter === "accepted" && ["accepted", "accept", "approved"].includes(r.status?.toLowerCase())) ||
        (statusFilter === "rejected" && ["rejected", "reject"].includes(r.status?.toLowerCase()));
      return matchGroup && matchSearch && matchStatus;
    });
  };

  const allFiltered = getFilteredRequests();
  const totalPages = Math.max(1, Math.ceil(allFiltered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRequests = allFiltered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const setPage = (p) => setPageState(Math.max(1, Math.min(p, totalPages)));

  const filteredUsers = users.filter(u => {
    const matchSearch = !userSearch ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase());
    const matchRole = userRoleFilter === "all" || u.role?.toLowerCase() === userRoleFilter;
    return matchSearch && matchRole;
  });

  const recentActivity = [...requests]
    .filter(r => ["accepted", "accept", "approved", "rejected", "reject"].includes(r.status?.toLowerCase()))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 6);

  const dashboardPending = requests.filter(r => r.status?.toLowerCase() === "pending");
  const initials = adminName ? adminName.split(" ").map(n => n[0]).join("").toUpperCase() : "AD";

  /* ===================== CHARTS ===================== */
  const DonutChart = () => {
    const total = counts.total || 1;
    const r = 54, circ = 2 * Math.PI * r;
    const acc = (counts.accepted / total) * circ;
    const pend = (counts.pending / total) * circ;
    const rej = (counts.rejected / total) * circ;
    return (
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="#10b981" strokeWidth="16" strokeDasharray={`${acc} ${circ}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f59e0b" strokeWidth="16" strokeDasharray={`${pend} ${circ}`} strokeDashoffset={circ * 0.25 - acc} strokeLinecap="round" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f43f5e" strokeWidth="16" strokeDasharray={`${rej} ${circ}`} strokeDashoffset={circ * 0.25 - acc - pend} strokeLinecap="round" />
        <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0f172a">{counts.total}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="600">total</text>
      </svg>
    );
  };

  // Bar chart: requests per group
  const GroupBarChart = () => {
    const data = groupNames.map(g => ({
      label: g.replace("SE Group ", "G"),
      value: requests.filter(r => r.group_name === g).length,
    }));
    const max = Math.max(...data.map(d => d.value), 1);
    const barW = 48, gap = 32, chartH = 160;
    return (
      <svg width="100%" height={chartH + 40} viewBox={`0 0 ${data.length * (barW + gap)} ${chartH + 40}`} preserveAspectRatio="xMidYMid meet">
        {data.map((d, i) => {
          const h = (d.value / max) * chartH;
          const x = i * (barW + gap) + gap / 2;
          return (
            <g key={i}>
              <rect x={x} y={chartH - h} width={barW} height={h} rx="8" fill="#3b82f6" opacity={d.value ? 1 : 0.25} />
              <text x={x + barW / 2} y={chartH - h - 8} textAnchor="middle" fontSize="14" fontWeight="800" fill="#0f172a">{d.value}</text>
              <text x={x + barW / 2} y={chartH + 24} textAnchor="middle" fontSize="13" fontWeight="600" fill="#94a3b8">{d.label}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  // Bar chart: status totals
  const StatusBarChart = () => {
    const data = [
      { label: "Pending", value: counts.pending, color: "#f59e0b" },
      { label: "Accepted", value: counts.accepted, color: "#10b981" },
      { label: "Rejected", value: counts.rejected, color: "#f43f5e" },
    ];
    const max = Math.max(...data.map(d => d.value), 1);
    return (
      <div className="hbar-chart">
        {data.map((d, i) => (
          <div key={i} className="hbar-row">
            <span className="hbar-label">{d.label}</span>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
            </div>
            <span className="hbar-value">{d.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const roleBadgeClass = (role) => {
    const r = role?.toLowerCase();
    if (r === "admin") return "role-admin";
    if (r === "lecturer") return "role-lecturer";
    return "role-student";
  };

  return (
    <div className="dashboard-container">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div>
          <div className="brand-header">
            <h2 className="logo-main">UNIVERSITY</h2>
            <p className="logo-sub">ADMIN PANEL</p>
          </div>
          <ul className="menu">
            <li className={activeMenu === "dashboard" ? "active" : ""} onClick={() => { setActiveMenu("dashboard"); setSidebarOpen(false); }}>
              <span className="icon">🏠</span> Dashboard
            </li>
            <li className={activeMenu === "requests" ? "active" : ""} onClick={() => { setActiveMenu("requests"); fetchRequests(); setSidebarOpen(false); }}>
              <span className="icon">📋</span> All Requests
              {counts.pending > 0 && <span className="badge">{counts.pending}</span>}
            </li>
            <li className={activeMenu === "users" ? "active" : ""} onClick={() => { setActiveMenu("users"); fetchUsers(); setSidebarOpen(false); }}>
              <span className="icon">👥</span> Manage Users
            </li>
            <li className={activeMenu === "analytics" ? "active" : ""} onClick={() => { setActiveMenu("analytics"); setSidebarOpen(false); }}>
              <span className="icon">📊</span> Analytics
            </li>
            <li className={activeMenu === "activity" ? "active" : ""} onClick={() => { setActiveMenu("activity"); setSidebarOpen(false); }}>
              <span className="icon">🕓</span> Activity Log
            </li>
            <li className={activeMenu === "settings" ? "active" : ""} onClick={() => { setActiveMenu("settings"); setSidebarOpen(false); }}>
              <span className="icon">⚙️</span> Settings
            </li>
            <li className={activeMenu === "profile" ? "active" : ""} onClick={() => { setActiveMenu("profile"); setSidebarOpen(false); }}>
              <span className="icon">👤</span> Profile
            </li>
          </ul>
        </div>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}><span className="icon">🚪</span> Logout</button>
          <div className="profile-tag">
            <div className="avatar-circle">{initials}</div>
            <div>
              <p className="profile-title">{adminName || "Admin"}</p>
              <p className="profile-sub">Administrator</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main-content">
        <div className="top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <div>
              <h1>
                {activeMenu === "dashboard" && `Welcome back, ${adminName || "Admin"} 👋`}
                {activeMenu === "requests" && "All Student Requests"}
                {activeMenu === "users" && "Manage Users"}
                {activeMenu === "analytics" && "Analytics"}
                {activeMenu === "activity" && "Activity Log"}
                {activeMenu === "settings" && "Settings"}
                {activeMenu === "profile" && "Your Profile"}
              </h1>
              <p>
                {activeMenu === "dashboard" && <span>Admin Dashboard</span>}
                {activeMenu === "requests" && <span>Manage all permission requests</span>}
                {activeMenu === "users" && <span>Students, lecturers & admins</span>}
                {activeMenu === "analytics" && <span>System insights</span>}
                {activeMenu === "activity" && <span>Recent decisions</span>}
                {activeMenu === "settings" && <span>Admin preferences</span>}
                {activeMenu === "profile" && <span>Administrator</span>}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {activeMenu === "dashboard" && <button className="export-csv-btn" onClick={handleExportCSV}>Export CSV</button>}
            {activeMenu === "users" && <button className="export-csv-btn" onClick={openAddUser}>+ Add User</button>}
            <button className="notif-bell" onClick={() => { setActiveMenu("requests"); fetchRequests(); }}>
              🔔{counts.pending > 0 && <span className="bell-dot"></span>}
            </button>
          </div>
        </div>

        {/* DASHBOARD */}
        {activeMenu === "dashboard" && (
          <>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-icon bg-blue">📅</div><div><span className="stat-label">Total Requests</span><p className="stat-value">{counts.total}</p></div></div>
              <div className="stat-card"><div className="stat-icon bg-amber">⏳</div><div><span className="stat-label">Pending</span><p className="stat-value text-amber">{counts.pending}</p></div></div>
              <div className="stat-card"><div className="stat-icon bg-emerald">✅</div><div><span className="stat-label">Accepted</span><p className="stat-value text-emerald">{counts.accepted}</p></div></div>
              <div className="stat-card"><div className="stat-icon bg-rose">❌</div><div><span className="stat-label">Rejected</span><p className="stat-value text-rose">{counts.rejected}</p></div></div>
            </div>

            <div className="dash-two-col">
              <div className="requests-section">
                <div className="section-header-row">
                  <div className="card-header-title"><span>⏳</span><h2>Pending Requests</h2></div>
                  {counts.pending > 3 && <button className="view-all-link" onClick={() => { setActiveMenu("requests"); setStatusFilter("pending"); }}>View all {counts.pending} →</button>}
                </div>
                {dashboardPending.length > 0 ? (
                  <div className="lec-request-list">
                    {dashboardPending.slice(0, 3).map(req => (
                      <AdminRequestCard key={req.request_id} req={req} compact={settings.compactCards}
                        onAccept={() => updateStatus(req.request_id, "Accepted")}
                        onReject={() => updateStatus(req.request_id, "Rejected")}
                        onDelete={() => setDeleteTargetId(req.request_id)} />
                    ))}
                  </div>
                ) : <div className="empty-log-state"><p>🎉 No pending requests right now.</p></div>}
              </div>

              <div className="dash-right-col">
                <div className="requests-section breakdown-card">
                  <div className="card-header-title" style={{ marginBottom: "20px" }}><h2>Breakdown</h2></div>
                  <div className="donut-center"><DonutChart /></div>
                  <div className="breakdown-legend">
                    <div className="legend-row"><span><span className="legend-dot dot-green"></span>Accepted</span><span className="legend-val text-emerald">{counts.accepted}</span></div>
                    <div className="legend-row"><span><span className="legend-dot dot-amber"></span>Pending</span><span className="legend-val text-amber">{counts.pending}</span></div>
                    <div className="legend-row"><span><span className="legend-dot dot-rose"></span>Rejected</span><span className="legend-val text-rose">{counts.rejected}</span></div>
                  </div>
                </div>
                <div className="requests-section activity-card">
                  <div className="card-header-title" style={{ marginBottom: "16px" }}><h2>Recent Activity</h2></div>
                  {recentActivity.length > 0 ? (
                    <div className="activity-list">
                      {recentActivity.slice(0, 5).map(r => {
                        const isAcc = ["accepted", "accept", "approved"].includes(r.status?.toLowerCase());
                        return (
                          <div key={r.request_id} className="activity-row">
                            <div className={`activity-icon-badge ${isAcc ? "act-green" : "act-rose"}`}>{isAcc ? "✓" : "✕"}</div>
                            <div className="activity-meta">
                              <span className="activity-action">{isAcc ? "Accepted" : "Rejected"} — {r.student_name}</span>
                              <span className="activity-sub">{r.subject_name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="empty-log-state"><p>No activity yet.</p></div>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ALL REQUESTS */}
        {activeMenu === "requests" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="requests-section">
              <div className="section-header-row">
                <div className="card-header-title"><span>📋</span><h2>All Student Requests</h2></div>
                <button className="view-all-link" onClick={fetchRequests}>🔄 Refresh</button>
              </div>

              <div className="view-dashboard-bar">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input type="text" placeholder="Search by name, ID or subject..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} />
                  {searchTerm && <button className="search-fetch-btn" onClick={() => setSearchTerm("")}>✕ Clear</button>}
                </div>
                <div className="filter-pill-container">
                  {["all", "pending", "accepted", "rejected"].map(s => (
                    <button key={s} className={`filter-pill ${s !== "all" ? `pill-${s}` : ""} ${statusFilter === s ? "active" : ""}`} onClick={() => { setStatusFilter(s); setPage(1); }}>
                      {s === "all" && `All (${counts.total})`}
                      {s === "pending" && `⏳ Pending (${counts.pending})`}
                      {s === "accepted" && `✅ Accepted (${counts.accepted})`}
                      {s === "rejected" && `❌ Rejected (${counts.rejected})`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="group-tabs">
                <button className={`group-tab ${activeGroup === "all" ? "group-tab-active" : ""}`} onClick={() => { setActiveGroup("all"); setPage(1); }}>All Groups</button>
                {[1, 2, 3, 4].map(g => (
                  <button key={g} className={`group-tab ${activeGroup === g ? "group-tab-active" : ""}`} onClick={() => { setActiveGroup(g); setPage(1); }}>Group {g}</button>
                ))}
              </div>

              {/* Bulk action bar */}
              {paginatedRequests.length > 0 && (
                <div className="bulk-bar">
                  <label className="bulk-check-all">
                    <input type="checkbox"
                      checked={paginatedRequests.every(r => selectedIds.includes(r.request_id))}
                      onChange={selectAllVisible} />
                    Select all on page
                  </label>
                  {selectedIds.length > 0 && (
                    <div className="bulk-actions">
                      <span className="bulk-count">{selectedIds.length} selected</span>
                      <button className="bulk-btn bulk-accept" onClick={() => bulkUpdate("Accepted")}>✓ Accept</button>
                      <button className="bulk-btn bulk-reject" onClick={() => bulkUpdate("Rejected")}>✕ Reject</button>
                      <button className="bulk-btn bulk-clear" onClick={() => setSelectedIds([])}>Clear</button>
                    </div>
                  )}
                </div>
              )}

              {paginatedRequests.length > 0 ? (
                <div className="admin-request-grid">
                  {paginatedRequests.map(req => (
                    <AdminRequestCard key={req.request_id} req={req} compact={settings.compactCards}
                      selectable selected={selectedIds.includes(req.request_id)}
                      onToggleSelect={() => toggleSelect(req.request_id)}
                      onAccept={() => updateStatus(req.request_id, "Accepted")}
                      onReject={() => updateStatus(req.request_id, "Rejected")}
                      onDelete={() => setDeleteTargetId(req.request_id)} />
                  ))}
                </div>
              ) : <div className="empty-log-state"><p>No requests match your filter.</p></div>}

              {totalPages > 1 && (
                <div className="pagination-row">
                  <span className="pagination-info">Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, allFiltered.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, allFiltered.length)} of {allFiltered.length}</span>
                  <div className="pagination-btns">
                    <button className="page-btn page-btn-nav" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>← Prev</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} className={`page-btn ${p === currentPage ? "page-btn-active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                    ))}
                    <button className="page-btn page-btn-nav" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>Next →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MANAGE USERS */}
        {activeMenu === "users" && (
          <>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-icon bg-blue">👥</div><div><span className="stat-label">Total Users</span><p className="stat-value">{userCounts.total}</p></div></div>
              <div className="stat-card"><div className="stat-icon bg-emerald">🎓</div><div><span className="stat-label">Students</span><p className="stat-value text-emerald">{userCounts.students}</p></div></div>
              <div className="stat-card"><div className="stat-icon bg-amber">👨‍🏫</div><div><span className="stat-label">Lecturers</span><p className="stat-value text-amber">{userCounts.lecturers}</p></div></div>
              <div className="stat-card"><div className="stat-icon bg-rose">🛡️</div><div><span className="stat-label">Admins</span><p className="stat-value text-rose">{userCounts.admins}</p></div></div>
            </div>

            <div className="single-column-workspace">
              <div className="requests-section">
                <div className="section-header-row">
                  <div className="card-header-title"><span>👥</span><h2>All Users</h2></div>
                  <button className="view-all-link" onClick={openAddUser}>+ Add User</button>
                </div>

                <div className="view-dashboard-bar">
                  <div className="search-input-wrapper">
                    <span className="search-icon">🔍</span>
                    <input type="text" placeholder="Search by name or email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                    {userSearch && <button className="search-fetch-btn" onClick={() => setUserSearch("")}>✕ Clear</button>}
                  </div>
                  <div className="filter-pill-container">
                    {["all", "student", "lecturer", "admin"].map(r => (
                      <button key={r} className={`filter-pill ${userRoleFilter === r ? "active" : ""}`} onClick={() => setUserRoleFilter(r)}>
                        {r === "all" ? `All (${userCounts.total})` : r.charAt(0).toUpperCase() + r.slice(1) + "s"}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredUsers.length > 0 ? (
                  <div className="user-table">
                    <div className="user-table-head">
                      <span>User</span><span>Email</span><span>Role</span><span>Group</span><span>Actions</span>
                    </div>
                    {filteredUsers.map(u => (
                      <div key={u.user_id} className="user-row">
                        <div className="user-cell user-name-cell">
                          <div className="user-avatar">{u.name?.[0]?.toUpperCase() || "?"}</div>
                          <div>
                            <strong>{u.name}</strong>
                            <span className="user-id-sub">ID: {u.user_id}</span>
                          </div>
                        </div>
                        <div className="user-cell user-email">{u.email}</div>
                        <div className="user-cell"><span className={`role-pill ${roleBadgeClass(u.role)}`}>{u.role}</span></div>
                        <div className="user-cell user-group">{u.role?.toLowerCase() === "student" ? (u.group_name || "—") : "—"}</div>
                        <div className="user-cell user-actions">
                          <button className="user-edit-btn" onClick={() => openEditUser(u)}>✏️ Edit</button>
                          <button className="user-delete-btn" onClick={() => setDeleteUserId(u.user_id)}>🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-log-state">
                    <p>{users.length === 0 ? "No users loaded. Make sure the /users endpoint exists on your backend." : "No users match your filter."}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ANALYTICS */}
        {activeMenu === "analytics" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="analytics-grid">
              <div className="requests-section">
                <div className="card-header-title"><span>📊</span><h2>Requests by Group</h2></div>
                <GroupBarChart />
              </div>
              <div className="requests-section">
                <div className="card-header-title"><span>📈</span><h2>Status Overview</h2></div>
                <StatusBarChart />
                <div className="analytics-summary">
                  <div className="summary-item"><span className="summary-num">{counts.total ? Math.round(counts.accepted / counts.total * 100) : 0}%</span><span className="summary-label">Acceptance Rate</span></div>
                  <div className="summary-item"><span className="summary-num">{counts.total}</span><span className="summary-label">Total Processed</span></div>
                  <div className="summary-item"><span className="summary-num">{counts.pending}</span><span className="summary-label">Awaiting Review</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY LOG */}
        {activeMenu === "activity" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="requests-section">
              <div className="section-header-row">
                <div className="card-header-title"><span>🕓</span><h2>Decision Activity Log</h2></div>
                <button className="view-all-link" onClick={fetchRequests}>🔄 Refresh</button>
              </div>
              {recentActivity.length > 0 ? (
                <div className="timeline">
                  {[...requests]
                    .filter(r => ["accepted", "accept", "approved", "rejected", "reject"].includes(r.status?.toLowerCase()))
                    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                    .map(r => {
                      const isAcc = ["accepted", "accept", "approved"].includes(r.status?.toLowerCase());
                      return (
                        <div key={r.request_id} className="timeline-row">
                          <div className={`timeline-dot ${isAcc ? "tl-green" : "tl-rose"}`}>{isAcc ? "✓" : "✕"}</div>
                          <div className="timeline-body">
                            <div className="timeline-top">
                              <strong>{r.student_name}</strong>
                              <span className={`lec-status-pill ${isAcc ? "accepted" : "rejected"}`}>{r.status}</span>
                            </div>
                            <span className="timeline-sub">{r.subject_name} · {r.group_name} · {r.class_time}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : <div className="empty-log-state"><p>No decisions logged yet.</p></div>}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeMenu === "settings" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="requests-section" style={{ maxWidth: "640px" }}>
              <div className="card-header-title"><span>⚙️</span><h2>Admin Preferences</h2></div>
              <div className="settings-list">
                <SettingToggle label="Auto-refresh requests" desc="Reload requests every 30 seconds automatically."
                  on={settings.autoRefresh} onToggle={() => setSettings(s => ({ ...s, autoRefresh: !s.autoRefresh }))} />
                <SettingToggle label="Compact request cards" desc="Show denser cards to fit more on screen."
                  on={settings.compactCards} onToggle={() => setSettings(s => ({ ...s, compactCards: !s.compactCards }))} />
                <SettingToggle label="Confirm before actions" desc="Ask for confirmation on delete actions."
                  on={settings.confirmActions} onToggle={() => setSettings(s => ({ ...s, confirmActions: !s.confirmActions }))} />
              </div>
              <p className="settings-note">Preferences are saved on this device.</p>
            </div>
          </div>
        )}

        {/* PROFILE */}
        {activeMenu === "profile" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="profile-container">
              <div className="profile-header-card">
                <div className="profile-banner"><div className="profile-banner-dots" /></div>
                <div className="profile-hero-body">
                  <div className="profile-avatar-large">{initials}</div>
                  <div className="profile-hero-text">
                    <h1 className="profile-display-name">{adminName}</h1>
                    <span className="student-badge">Administrator</span>
                  </div>
                </div>
                <div className="profile-stats-strip">
                  <div className="profile-stat-item"><span className="profile-stat-num">{counts.total}</span><span className="profile-stat-label">Requests</span></div>
                  <div className="profile-stat-item"><span className="profile-stat-num">{userCounts.total}</span><span className="profile-stat-label">Users</span></div>
                  <div className="profile-stat-item"><span className="profile-stat-num green">{counts.accepted}</span><span className="profile-stat-label">Accepted</span></div>
                  <div className="profile-stat-item"><span className="profile-stat-num rose">{counts.rejected}</span><span className="profile-stat-label">Rejected</span></div>
                </div>
              </div>
              <div className="profile-grid">
                <div className="info-card">
                  <h3 className="info-card-title">Information</h3>
                  <div className="info-row"><span>Full Name</span><strong>{adminName}</strong></div>
                  <div className="info-row"><span>Role</span><strong>Administrator</strong></div>
                  <div className="info-row"><span>Users Managed</span><strong>{userCounts.total}</strong></div>
                </div>
                <div className="info-card">
                  <h3 className="info-card-title">System Summary</h3>
                  <div className="info-row"><span>Pending Review</span><span className="val-amber">{counts.pending}</span></div>
                  <div className="info-row"><span>Accepted</span><span className="val-green">{counts.accepted}</span></div>
                  <div className="info-row"><span>Rejected</span><span className="val-rose">{counts.rejected}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* USER ADD/EDIT MODAL */}
      {userModalOpen && (
        <div className="modal-overlay" onClick={() => setUserModalOpen(false)}>
          <div className="user-modal" onClick={e => e.stopPropagation()}>
            <div className="user-modal-head">
              <h3>{editingUser ? "Edit User" : "Add New User"}</h3>
              <button className="close-modal-btn" onClick={() => setUserModalOpen(false)}>✕</button>
            </div>
            <div className="user-modal-body">
              {!editingUser && (
                <div className="user-field">
                  <label>User ID</label>
                  <input type="text" value={userForm.user_id} onChange={e => setUserForm({ ...userForm, user_id: e.target.value })} placeholder="e.g. 260101" />
                </div>
              )}
              {editingUser && (
                <div className="user-field">
                  <label>User ID <span className="optional-hint">(can't be changed)</span></label>
                  <input type="text" value={userForm.user_id} disabled style={{ background: "#f1f5f9", cursor: "not-allowed", color: "#94a3b8" }} />
                </div>
              )}
              <div className="user-field">
                <label>Full Name</label>
                <input type="text" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} placeholder="e.g. Ly Heng" />
              </div>
              <div className="user-field">
                <label>Email</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="e.g. student@test.com" />
              </div>
              <div className="user-field">
                <label>Password {editingUser && <span className="optional-hint">(leave blank to keep current)</span>}</label>
                <input type="text" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder={editingUser ? "••••••••" : "Set a password"} />
              </div>
              <div className="user-field">
                <label>Role</label>
                <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {userForm.role === "student" && (
                <div className="user-field">
                  <label>Group</label>
                  <select value={userForm.group_name} onChange={e => setUserForm({ ...userForm, group_name: e.target.value })}>
                    {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="user-modal-foot">
              <button className="btn-cancel" onClick={() => setUserModalOpen(false)}>Cancel</button>
              <button className="btn-save" onClick={saveUser}>{editingUser ? "Save Changes" : "Create User"}</button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT MODAL */}
      {isLogoutOpen && (
        <div className="lo-overlay" onClick={() => setIsLogoutOpen(false)}>
          <div className="lo-card" onClick={e => e.stopPropagation()}>
            <div className="lo-icon">🚪</div>
            <h3 className="lo-title">Log out?</h3>
            <p className="lo-sub">You'll need to sign in again to access the admin panel.</p>
            <div className="lo-actions">
              <button className="lo-stay" onClick={() => setIsLogoutOpen(false)}>Stay Logged In</button>
              <button className="lo-confirm" onClick={confirmLogout}>Log Out</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE REQUEST MODAL */}
      {deleteTargetId && (
        <div className="lo-overlay" onClick={() => setDeleteTargetId(null)}>
          <div className="lo-card" onClick={e => e.stopPropagation()}>
            <div className="lo-icon">🗑️</div>
            <h3 className="lo-title">Delete request?</h3>
            <p className="lo-sub">This permanently removes the request from the system. You can't undo this.</p>
            <div className="lo-actions">
              <button className="lo-stay" onClick={() => setDeleteTargetId(null)}>Cancel</button>
              <button className="lo-confirm" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE USER MODAL */}
      {deleteUserId && (
        <div className="lo-overlay" onClick={() => setDeleteUserId(null)}>
          <div className="lo-card" onClick={e => e.stopPropagation()}>
            <div className="lo-icon">🗑️</div>
            <h3 className="lo-title">Delete user?</h3>
            <p className="lo-sub">This permanently removes the user account. You can't undo this.</p>
            <div className="lo-actions">
              <button className="lo-stay" onClick={() => setDeleteUserId(null)}>Cancel</button>
              <button className="lo-confirm" onClick={confirmDeleteUser}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingToggle({ label, desc, on, onToggle }) {
  return (
    <div className="setting-item">
      <div className="setting-text">
        <strong>{label}</strong>
        <span>{desc}</span>
      </div>
      <button className={`toggle-switch ${on ? "toggle-on" : ""}`} onClick={onToggle}>
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

function AdminRequestCard({ req, onAccept, onReject, onDelete, compact, selectable, selected, onToggleSelect }) {
  const isPending = req.status?.toLowerCase() === "pending";
  const statusClass = isPending ? "pending"
    : ["accepted", "accept", "approved"].includes(req.status?.toLowerCase()) ? "accepted" : "rejected";

  return (
    <div className={`lec-request-card ${compact ? "card-compact" : ""} ${selected ? "card-selected" : ""}`}>
      <div className="lec-request-card-top">
        <div className="lec-student-meta">
          {selectable && (
            <input type="checkbox" className="card-checkbox" checked={selected} onChange={onToggleSelect} />
          )}
          <div className="lec-avatar">{req.student_name?.[0]?.toUpperCase() || "?"}</div>
          <div>
            <strong className="lec-student-name">{req.student_name}</strong>
            <span className="lec-student-sub">ID: {req.student_id} · {req.group_name}</span>
          </div>
        </div>
        <span className={`lec-status-pill ${statusClass}`}>{req.status || "Pending"}</span>
      </div>
      <div className="lec-request-details">
        <div className="lec-detail-row"><span>📖</span><span><strong>{req.subject_name}</strong> — {req.class_time}</span></div>
        <div className="lec-detail-row"><span>📅</span><span>{req.request_date ? new Date(req.request_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span></div>
        {!compact && <div className="lec-detail-row"><span>📝</span><span className="lec-reason-text">{req.reason}</span></div>}
      </div>
      <div className="lec-request-card-footer">
        <div className="admin-action-btns">
          {isPending && (
            <>
              <button className="lec-btn-accept" onClick={onAccept}>✓ Accept</button>
              <button className="lec-btn-reject-trigger" onClick={onReject}>✕ Reject</button>
            </>
          )}
          <button className="admin-btn-delete" onClick={onDelete}>🗑️ Delete</button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;