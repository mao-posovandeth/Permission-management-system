import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Home, ClipboardList, BarChart3, Bell, User, HelpCircle, LogOut,
  Menu, Calendar, Clock, CheckCircle2, XCircle, Hourglass,
  FileText, RefreshCw, Search, BookOpen, Image as ImageIcon,
  PartyPopper, ChevronDown, ChevronLeft, ChevronRight,
  AlertTriangle, X, Check, Hand
} from "lucide-react";
import "../styles/LecturerDashboard.css";

function LecturerDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [requests, setRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lecturerName, setLecturerName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Group tab for Requests page (1–4, or "all")
  const [activeGroup, setActiveGroup] = useState("all");
  // Pagination per group
  const [groupPages, setGroupPages] = useState({ all: 1, 1: 1, 2: 1, 3: 1, 4: 1 });
  const ITEMS_PER_PAGE = 3;

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  // Photo lightbox
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Which student's grouped card is expanded (only one open at a time)
  const [expandedStudent, setExpandedStudent] = useState(null);

  // Dashboard sort + auto-refresh
  const [dashboardSort, setDashboardSort] = useState("newest");
  const autoRefreshRef = useRef(null);

  // This lecturer's assigned (subject + group) pairs — they only see matching requests
  const assignmentsRef = useRef([]);

  useEffect(() => {
    const name = localStorage.getItem("student_name");
    const role = localStorage.getItem("role");
    if (!name || role !== "lecturer") {
      localStorage.clear();
      navigate("/login");
      return;
    }
    setLecturerName(name);
    loadAssignmentsThenRequests();
    autoRefreshRef.current = setInterval(fetchRequests, 30000);
    return () => clearInterval(autoRefreshRef.current);
  }, [navigate]);

  // Load this lecturer's assignments first, then load (and filter) the requests
  const loadAssignmentsThenRequests = async () => {
    const lecturerId = localStorage.getItem("user_id");
    try {
      const res = await axios.get(`http://localhost:5000/lecturer-assignments/${lecturerId}`);
      assignmentsRef.current = res.data || [];
    } catch {
      assignmentsRef.current = [];
    }
    fetchRequests();
  };

  // A request is visible only if its subject AND group match one of the lecturer's assignments
  const matchesAssignment = (req) => {
    const list = assignmentsRef.current;
    if (!list || list.length === 0) return false;
    return list.some(a => a.subject_name === req.subject_name && a.group_name === req.group_name);
  };

  const fetchRequests = async () => {
    try {
      const res = await axios.get("http://localhost:5000/requests");
      const onlyMine = (res.data || []).filter(matchesAssignment);
      setRequests(onlyMine);
    } catch (err) {
      showToast("Failed to load requests", "#ef4444");
    }
  };

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

  const handleAccept = async (id) => {
    try {
      await axios.put("http://localhost:5000/request-status", { id, status: "Accepted" });
      showToast("Request accepted!", "#059669");
      fetchRequests();
    } catch {
      showToast("Failed to update status", "#ef4444");
    }
  };

  const openRejectModal = (id) => {
    setRejectTargetId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      showToast("Please enter a reason for rejection", "#ef4444");
      return;
    }
    setRejectLoading(true);
    try {
      await axios.put("http://localhost:5000/request-status", {
        id: rejectTargetId,
        status: "Rejected",
        reject_reason: rejectReason.trim(),
      });
      showToast("Request rejected.", "#e11d48");
      setRejectModalOpen(false);
      fetchRequests();
    } catch {
      showToast("Failed to update status", "#ef4444");
    } finally {
      setRejectLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Student Name", "Student ID", "Group", "Subject", "Class Time", "Date", "Reason", "Status", "Rejection Reason"];
    const rows = requests.map(r => [
      r.student_name, r.student_id, r.group_name, r.subject_name,
      r.class_time, r.request_date ? new Date(r.request_date).toLocaleDateString("en-GB") : "",
      `"${(r.reason || "").replace(/"/g, '""')}"`,
      r.status,
      `"${(r.reject_reason || "").replace(/"/g, '""')}"`
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requests.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported to CSV!", "#059669");
  };

  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const handleLogout = () => setIsLogoutOpen(true);
  const confirmLogout = () => { localStorage.clear(); navigate("/login"); };

  const counts = {
    total: requests.length,
    pending: requests.filter(r => r.status?.toLowerCase() === "pending").length,
    accepted: requests.filter(r => ["accepted", "accept", "approved"].includes(r.status?.toLowerCase())).length,
    rejected: requests.filter(r => ["rejected", "reject"].includes(r.status?.toLowerCase())).length,
  };

  // Absence limit: each subject has ~16 sessions; over 20% approved absences fails the class.
  // Warn the lecturer when a student is near (3 = 19%) or over (4+ = 25%+) for a subject.
  const ABSENCE_TOTAL_SESSIONS = 16;
  const getAbsenceInfo = (sid, subject) => {
    const approved = requests.filter(
      (r) => r.student_id === sid && r.subject_name === subject && ["approved", "accept", "accepted"].includes(r.status?.toLowerCase())
    ).length;
    const percent = Math.round((approved / ABSENCE_TOTAL_SESSIONS) * 100);
    let status = "ok";
    if (approved >= 4) status = "over";
    else if (approved === 3) status = "near";
    return { approved, total: ABSENCE_TOTAL_SESSIONS, percent, status };
  };

  // Per-student absence summary for the Absence Tracker page
  const studentsAbsence = groupByStudent(requests).map((g) => {
    const subjects = [...new Set(g.requests.map((r) => r.subject_name))].map((subject) => ({
      subject,
      ...getAbsenceInfo(g.studentId, subject),
    }));
    return { studentId: g.studentId, studentName: g.studentName, groupName: g.groupName, subjects };
  });

  // Groups available
  const groupNames = ["SE Group 1", "SE Group 2", "SE Group 3", "SE Group 4"];

  // Requests filtered by group tab + search + status
  const getGroupRequests = (groupLabel) => {
    return requests.filter(r => {
      const matchGroup = groupLabel === "all" || r.group_name === groupLabel;
      const matchSearch =
        !searchTerm ||
        r.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.student_id?.toString().includes(searchTerm);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && r.status?.toLowerCase() === "pending") ||
        (statusFilter === "accepted" && ["accepted", "accept", "approved"].includes(r.status?.toLowerCase())) ||
        (statusFilter === "rejected" && ["rejected", "reject"].includes(r.status?.toLowerCase()));
      return matchGroup && matchSearch && matchStatus;
    });
  };

  const currentGroupKey = activeGroup;
  const allFiltered = getGroupRequests(activeGroup === "all" ? "all" : groupNames[activeGroup - 1]);
  const currentPage = groupPages[currentGroupKey] || 1;
  const totalPages = Math.max(1, Math.ceil(allFiltered.length / ITEMS_PER_PAGE));
  const paginatedRequests = allFiltered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const setPage = (page) => {
    setGroupPages(prev => ({ ...prev, [currentGroupKey]: page }));
  };

  // Donut chart
  const DonutChart = () => {
    const total = counts.total || 1;
    const accepted = counts.accepted;
    const pending = counts.pending;
    const rejected = counts.rejected;
    const r = 54;
    const circ = 2 * Math.PI * r;
    const accAngle = (accepted / total) * circ;
    const pendAngle = (pending / total) * circ;
    const rejAngle = (rejected / total) * circ;
    return (
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="#10b981" strokeWidth="16"
          strokeDasharray={`${accAngle} ${circ}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f59e0b" strokeWidth="16"
          strokeDasharray={`${pendAngle} ${circ}`} strokeDashoffset={circ * 0.25 - accAngle} strokeLinecap="round" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f43f5e" strokeWidth="16"
          strokeDasharray={`${rejAngle} ${circ}`} strokeDashoffset={circ * 0.25 - accAngle - pendAngle} strokeLinecap="round" />
        <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0f172a">{counts.total}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="600">total</text>
      </svg>
    );
  };

  const recentActivity = [...requests]
    .filter(r => ["accepted", "accept", "approved", "rejected", "reject"].includes(r.status?.toLowerCase()))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  const dashboardPending = [...requests]
    .filter(r => r.status?.toLowerCase() === "pending")
    .sort((a, b) => dashboardSort === "newest"
      ? new Date(b.created_at || 0) - new Date(a.created_at || 0)
      : new Date(a.created_at || 0) - new Date(b.created_at || 0));

  const initials = lecturerName
    ? lecturerName.split(" ").map(n => n[0]).join("").toUpperCase()
    : "LC";

  return (
    <div className="dashboard-container">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div>
          <div className="brand-header">
            <h2 className="logo-main">UNIVERSITY</h2>
            <p className="logo-sub">PERMISSION SYSTEM</p>
          </div>
          <ul className="menu">
            <li className={activeMenu === "dashboard" ? "active" : ""}
              onClick={() => { setActiveMenu("dashboard"); setSidebarOpen(false); }}>
              <span className="icon"><Home size={18} /></span> Dashboard
            </li>
            <li className={activeMenu === "requests" ? "active" : ""}
              onClick={() => { setActiveMenu("requests"); fetchRequests(); setSidebarOpen(false); }}>
              <span className="icon"><ClipboardList size={18} /></span> Requests
              {counts.pending > 0 && <span className="badge">{counts.pending}</span>}
            </li>
            <li className={activeMenu === "absence" ? "active" : ""}
              onClick={() => { setActiveMenu("absence"); fetchRequests(); setSidebarOpen(false); }}>
              <span className="icon"><BarChart3 size={18} /></span> Absence Tracker
            </li>
            <li className={activeMenu === "profile" ? "active" : ""}
              onClick={() => { setActiveMenu("profile"); setSidebarOpen(false); }}>
              <span className="icon"><User size={18} /></span> Profile
            </li>
            <li className={activeMenu === "help" ? "active" : ""}
              onClick={() => { setActiveMenu("help"); setSidebarOpen(false); }}>
              <span className="icon"><HelpCircle size={18} /></span> Help & Support
            </li>
          </ul>
        </div>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <span className="icon"><LogOut size={18} /></span> Logout
          </button>
          <div className="profile-tag">
            <div className="avatar-circle">{initials}</div>
            <div>
              <p className="profile-title">{lecturerName || "Lecturer"}</p>
              <p className="profile-sub">Lecturer</p>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
         <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} style={{ marginLeft: "-230px" }}>
  <Menu size={22} />
</button>
<div className="header-title-block">
  <h1>
                {activeMenu === "dashboard" ? (
                  <>
                    Welcome back, {lecturerName || "Lecturer"}{" "}
                    <Hand size={22} color="#f59e0b" style={{ display: "inline-block", verticalAlign: "middle", marginLeft: "4px" }} />
                  </>
                )
                  : activeMenu === "requests" ? "Student Requests"
                  : activeMenu === "absence" ? "Absence Tracker"
                  : activeMenu === "profile" ? "Your Profile"
                  : "Help & Support"}
              </h1>
              <p className={activeMenu === "help" ? "help-subtitle" : ""}>
                {activeMenu === "dashboard" && <span>Lecturer Dashboard</span>}
                {activeMenu === "requests" && <span>Review and respond to student requests</span>}
                {activeMenu === "absence" && <span>Track student absences against the 20% limit</span>}
                {activeMenu === "profile" && <span>Lecturer</span>}
                {activeMenu === "help" && "Find answers to common questions"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {activeMenu === "dashboard" && (
              <button className="export-csv-btn" onClick={handleExportCSV}>Export CSV</button>
            )}
            <button className="notif-bell" onClick={() => { setActiveMenu("requests"); fetchRequests(); }}>
              <Bell size={20} />{counts.pending > 0 && <span className="bell-dot"></span>}
            </button>
          </div>
        </div>

        {activeMenu === "dashboard" && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon bg-blue"><Calendar size={22} /></div>
                <div>
                  <span className="stat-label">Total Requests</span>
                  <p className="stat-value">{counts.total}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-amber"><Hourglass size={22} /></div>
                <div>
                  <span className="stat-label">Pending</span>
                  <p className="stat-value text-amber">{counts.pending}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-emerald"><CheckCircle2 size={22} /></div>
                <div>
                  <span className="stat-label">Accepted</span>
                  <p className="stat-value text-emerald">{counts.accepted}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-rose"><XCircle size={22} /></div>
                <div>
                  <span className="stat-label">Rejected</span>
                  <p className="stat-value text-rose">{counts.rejected}</p>
                </div>
              </div>
            </div>

            <div className="dash-two-col">
              <div className="requests-section">
                <div className="section-header-row">
                  <div className="card-header-title">
                    <span><Hourglass size={20} /></span>
                    <h2>Pending Requests</h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                    <select className="sort-select" value={dashboardSort} onChange={e => setDashboardSort(e.target.value)}>
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                    {counts.pending > 3 && (
                      <button className="view-all-link" onClick={() => { setActiveMenu("requests"); setStatusFilter("pending"); }}>
                        View all {counts.pending} →
                      </button>
                    )}
                  </div>
                </div>
                {dashboardPending.length > 0 ? (
                  <div className="lec-request-list">
                    {groupByStudent(dashboardPending).slice(0, 3).map((g) => (
                      <StudentRequestGroup key={g.studentId}
                        studentName={g.studentName} studentId={g.studentId} groupName={g.groupName}
                        requests={g.requests}
                        isOpen={expandedStudent === g.studentId}
                        onToggle={() => setExpandedStudent(expandedStudent === g.studentId ? null : g.studentId)}
                        getAbsenceInfo={getAbsenceInfo}
                        onAccept={handleAccept}
                        onReject={openRejectModal}
                        onViewPhoto={(url) => setLightboxUrl(url)} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-log-state">
                    <p style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <PartyPopper size={16} /> No pending requests right now.
                    </p>
                  </div>
                )}
              </div>

              <div className="dash-right-col">
                <div className="requests-section breakdown-card">
                  <div className="card-header-title" style={{ marginBottom: "20px" }}>
                    <h2>Breakdown</h2>
                  </div>
                  <div className="donut-center"><DonutChart /></div>
                  <div className="breakdown-legend">
                    <div className="legend-row">
                      <span><span className="legend-dot dot-green"></span>Accepted</span>
                      <span className="legend-val text-emerald">{counts.accepted} ({counts.total ? Math.round(counts.accepted / counts.total * 100) : 0}%)</span>
                    </div>
                    <div className="legend-row">
                      <span><span className="legend-dot dot-amber"></span>Pending</span>
                      <span className="legend-val text-amber">{counts.pending} ({counts.total ? Math.round(counts.pending / counts.total * 100) : 0}%)</span>
                    </div>
                    <div className="legend-row">
                      <span><span className="legend-dot dot-rose"></span>Rejected</span>
                      <span className="legend-val text-rose">{counts.rejected} ({counts.total ? Math.round(counts.rejected / counts.total * 100) : 0}%)</span>
                    </div>
                  </div>
                </div>

                <div className="requests-section activity-card">
                  <div className="card-header-title" style={{ marginBottom: "16px" }}><h2>Recent Activity</h2></div>
                  {recentActivity.length > 0 ? (
                    <div className="activity-list">
                      {recentActivity.map(r => {
                        const isAcc = ["accepted", "accept", "approved"].includes(r.status?.toLowerCase());
                        return (
                          <div key={r.request_id} className="activity-row">
                            <div className={`activity-icon-badge ${isAcc ? "act-green" : "act-rose"}`}>
                              {isAcc ? <Check size={14} /> : <X size={14} />}
                            </div>
                            <div className="activity-meta">
                              <span className="activity-action">{isAcc ? "Accepted" : "Rejected"} — {r.student_name}</span>
                              <span className="activity-sub">{r.subject_name} · {r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-log-state"><p>No activity yet.</p></div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeMenu === "requests" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="requests-section">
              <div className="section-header-row">
                <div className="card-header-title"><span><ClipboardList size={20} /></span><h2>All Student Requests</h2></div>
                <button className="view-all-link" onClick={fetchRequests} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
              <div className="view-dashboard-bar">
                <div className="search-input-wrapper">
                  <span className="search-icon"><Search size={16} /></span>
                  <input type="text" placeholder="Search by name, ID or subject..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  {searchTerm && (
                    <button className="search-fetch-btn" onClick={() => setSearchTerm("")} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <div className="filter-pill-container">
                  {["all", "pending", "accepted", "rejected"].map(s => (
                    <button key={s} className={`filter-pill ${s !== "all" ? `pill-${s}` : ""} ${statusFilter === s ? "active" : ""}`}
                      onClick={() => { setStatusFilter(s); setPage(1); }}
                      style={s !== "all" ? { display: "inline-flex", alignItems: "center", gap: "6px" } : {}}>
                      {s === "all" && `All (${counts.total})`}
                      {s === "pending" && (<><Hourglass size={14} /> Pending ({counts.pending})</>)}
                      {s === "accepted" && (<><CheckCircle2 size={14} /> Accepted ({counts.accepted})</>)}
                      {s === "rejected" && (<><XCircle size={14} /> Rejected ({counts.rejected})</>)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="group-tabs">
                <button className={`group-tab ${activeGroup === "all" ? "group-tab-active" : ""}`}
                  onClick={() => { setActiveGroup("all"); setGroupPages(p => ({ ...p, all: 1 })); }}>All Groups</button>
                {[1, 2, 3, 4].map(g => (
                  <button key={g} className={`group-tab ${activeGroup === g ? "group-tab-active" : ""}`}
                    onClick={() => { setActiveGroup(g); setGroupPages(p => ({ ...p, [g]: 1 })); }}>Group {g}</button>
                ))}
              </div>
              {paginatedRequests.length > 0 ? (
                <div className="lec-request-list">
                  {groupByStudent(paginatedRequests).map((g) => (
                    <StudentRequestGroup key={g.studentId}
                      studentName={g.studentName} studentId={g.studentId} groupName={g.groupName}
                      requests={g.requests}
                      isOpen={expandedStudent === g.studentId}
                      onToggle={() => setExpandedStudent(expandedStudent === g.studentId ? null : g.studentId)}
                        getAbsenceInfo={getAbsenceInfo}
                      onAccept={handleAccept}
                      onReject={openRejectModal}
                      onViewPhoto={(url) => setLightboxUrl(url)} />
                  ))}
                </div>
              ) : (
                <div className="empty-log-state"><p>No requests match your filter.</p></div>
              )}
              {totalPages > 1 && (
                <div className="pagination-row">
                  <span className="pagination-info">
                    Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, allFiltered.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, allFiltered.length)} of {allFiltered.length} requests
                  </span>
                  <div className="pagination-btns">
                    <button className="page-btn page-btn-nav" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <ChevronLeft size={14} /> Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} className={`page-btn ${p === currentPage ? "page-btn-active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                    ))}
                    <button className="page-btn page-btn-nav" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeMenu === "absence" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="requests-section">
              <div className="section-header-row">
                <div className="card-header-title"><span><BarChart3 size={20} /></span><h2>Absence Tracker</h2></div>
                <button className="view-all-link" onClick={fetchRequests} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
              <p className="lec-absence-note">
                Approved absences per subject, counted against the 20% limit
                ({Math.floor(ABSENCE_TOTAL_SESSIONS * 0.2)} of {ABSENCE_TOTAL_SESSIONS} sessions).
                A student who goes over 20% has failed that class. Only students in your assigned classes are shown.
              </p>
              {studentsAbsence.length > 0 ? (
                <div className="lec-absence-list">
                  {studentsAbsence.map((s) => (
                    <div key={s.studentId} className="lec-absence-student">
                      <div className="lec-absence-student-head">
                        <div className="lec-student-meta">
                          <div className="lec-avatar">{s.studentName?.[0]?.toUpperCase() || "?"}</div>
                          <div>
                            <strong className="lec-student-name">{s.studentName}</strong>
                            <span className="lec-student-sub">ID: {s.studentId} · {s.groupName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="lec-absence-subjects">
                        {s.subjects.map((sub) => (
                          <div key={sub.subject} className="lec-absence-subject-row">
                            <span className="lec-absence-subject-name">{sub.subject}</span>
                            <div className="lec-absence-bar-track">
                              <div className={`lec-absence-bar-fill fill-${sub.status}`} style={{ width: `${Math.min(sub.percent, 100)}%` }} />
                              <div className="lec-absence-bar-mark" style={{ left: "20%" }} />
                            </div>
                            <span className={`lec-absence-badge ${sub.status}`}>
                              {sub.approved}/{sub.total} ({sub.percent}%)
                              {sub.status === "over" && <span className="lec-absence-tag"> · Failed</span>}
                              {sub.status === "near" && <span className="lec-absence-tag"> · Near</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-log-state"><p>No students to track yet.</p></div>
              )}
            </div>
          </div>
        )}

        {activeMenu === "profile" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="profile-container">
              <div className="profile-header-card">
                <div className="profile-banner">
                  <div className="profile-banner-dots" />
                </div>
                <div className="profile-hero-body">
                  <div className="profile-avatar-large">{initials}</div>
                  <div className="profile-hero-text">
                    <h1 className="profile-display-name">{lecturerName}</h1>
                    <span className="student-badge">Lecturer</span>
                  </div>
                </div>
                <div className="profile-stats-strip">
                  <div className="profile-stat-item">
                    <span className="profile-stat-num amber">{counts.pending}</span>
                    <span className="profile-stat-label">Pending</span>
                  </div>
                  <div className="profile-stat-item">
                    <span className="profile-stat-num green">{counts.accepted}</span>
                    <span className="profile-stat-label">Accepted</span>
                  </div>
                  <div className="profile-stat-item">
                    <span className="profile-stat-num rose">{counts.rejected}</span>
                    <span className="profile-stat-label">Rejected</span>
                  </div>
                </div>
              </div>
              <div className="profile-grid">
                <div className="info-card">
                  <h3 className="info-card-title">Information</h3>
                  <div className="info-row"><span>Full Name</span><strong>{lecturerName}</strong></div>
                  <div className="info-row"><span>Role</span><strong>Lecturer</strong></div>
                  <div className="info-row"><span>Total Handled</span><strong>{counts.accepted + counts.rejected}</strong></div>
                </div>
                <div className="info-card">
                  <h3 className="info-card-title">Activity Summary</h3>
                  <div className="info-row"><span>Pending Review</span><span className="val-amber">{counts.pending}</span></div>
                  <div className="info-row"><span>Accepted</span><span className="val-green">{counts.accepted}</span></div>
                  <div className="info-row"><span>Rejected</span><span className="val-rose">{counts.rejected}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeMenu === "help" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="requests-section">
              <div className="card-header-title"><span><HelpCircle size={20} /></span><h2>Help & Support</h2></div>
              <div className="lec-help-grid">
                {[
                  { q: "How do I accept a request?", a: "Go to Requests, find the student request and click the green Accept button. The student will be notified automatically." },
                  { q: "Can I reject with a reason?", a: "Yes — clicking Reject opens a dialog where you must enter a reason. The student will see this reason alongside their rejected status." },
                  { q: "Can I view the student's proof photo?", a: "Yes — if a student attached a photo, a 'View Proof Photo' button appears on the request card." },
                  { q: "How do I find a specific student?", a: "Use the search bar on the Requests page. You can search by student name, student ID, or subject name." },
                  { q: "Why do I only see some requests?", a: "You only see requests for the subjects and groups assigned to you. Requests for classes you don't teach are handled by their own lecturer." },
                  { q: "Can I export request data?", a: "Yes — click the Export CSV button at the top of the Dashboard to download all requests as a spreadsheet." },
                ].map((item, i) => (
                  <div key={i} className="lec-help-item">
                    <strong>{item.q}</strong>
                    <p>{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LOGOUT MODAL */}
      {isLogoutOpen && (
        <div className="lo-overlay" onClick={() => setIsLogoutOpen(false)}>
          <div className="lo-card" onClick={e => e.stopPropagation()}>
            <div className="lo-icon"><LogOut size={24} /></div>
            <h3 className="lo-title">Log out?</h3>
            <p className="lo-sub">You'll need to sign in again to access your dashboard.</p>
            <div className="lo-actions">
              <button className="lo-stay" onClick={() => setIsLogoutOpen(false)}>Stay Logged In</button>
              <button className="lo-confirm" onClick={confirmLogout}>Log Out</button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalOpen && (
        <div className="modal-overlay" onClick={() => setRejectModalOpen(false)}>
          <div className="modal-content lec-reject-modal" onClick={e => e.stopPropagation()}>
            <h3>Reject Request</h3>
            <p className="lec-reject-subtitle">Please provide a reason — the student will see this alongside their rejected status.</p>
            <div className="input-block" style={{ marginTop: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Reason for rejection <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea className="lec-reject-textarea"
                placeholder="e.g. Insufficient documentation, please resubmit with a valid medical certificate."
                value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4} autoFocus />
            </div>
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn-cancel" onClick={() => setRejectModalOpen(false)}>Cancel</button>
              <button className="lec-btn-reject" onClick={handleRejectSubmit} disabled={rejectLoading}>
                {rejectLoading ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO LIGHTBOX */}
      {lightboxUrl && (
        <div className="lec-lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <div className="lec-lightbox-box" onClick={e => e.stopPropagation()}>
            <button className="lec-lightbox-close" onClick={() => setLightboxUrl(null)}><X size={16} /></button>
            <img src={`http://localhost:5000${lightboxUrl}`} alt="Proof" />
          </div>
        </div>
      )}
    </div>
  );
}

// Groups a flat list of requests into one entry per student
function groupByStudent(list) {
  const map = {};
  list.forEach((r) => {
    const key = r.student_id ?? r.student_name;
    if (!map[key]) {
      map[key] = { studentId: r.student_id, studentName: r.student_name, groupName: r.group_name, requests: [] };
    }
    map[key].requests.push(r);
  });
  return Object.values(map);
}

// One card per student, with each of their requests listed inside (each with its own Accept/Reject)
function StudentRequestGroup({ studentName, studentId, groupName, requests, isOpen, onToggle, getAbsenceInfo, onAccept, onReject, onViewPhoto }) {
  const pendingCount = requests.filter((r) => r.status?.toLowerCase() === "pending").length;
  // Check every subject this student has — flag the header if any is near/over the limit
  const subjectStatuses = [...new Set(requests.map((r) => r.subject_name))].map((s) => (getAbsenceInfo ? getAbsenceInfo(studentId, s).status : "ok"));
  const hasOver = subjectStatuses.includes("over");
  const hasNear = subjectStatuses.includes("near");
  return (
    <div className={`lec-group-card ${isOpen ? "lec-group-open" : ""}`}>
      <button type="button" className="lec-group-header" onClick={onToggle}>
        <div className="lec-student-meta">
          <div className="lec-avatar">{studentName?.[0]?.toUpperCase() || "?"}</div>
          <div>
            <strong className="lec-student-name">{studentName}</strong>
            <span className="lec-student-sub">ID: {studentId} · {groupName}</span>
          </div>
        </div>
        <div className="lec-group-header-right">
          {hasOver && <span className="lec-risk-flag over" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> At risk · Failed</span>}
          {!hasOver && hasNear && <span className="lec-risk-flag near" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> At risk</span>}
          {pendingCount > 0 && <span className="lec-group-pending-pill">{pendingCount} pending</span>}
          <span className="lec-group-count">{requests.length} request{requests.length > 1 ? "s" : ""}</span>
          <span className={`lec-group-chevron ${isOpen ? "open" : ""}`}><ChevronDown size={16} /></span>
        </div>
      </button>
      {isOpen && (
      <div className="lec-group-body">
        {requests.map((req) => {
          const isPending = req.status?.toLowerCase() === "pending";
          const isRejected = ["rejected", "reject"].includes(req.status?.toLowerCase());
          const statusClass = isPending ? "pending"
            : ["accepted", "accept", "approved"].includes(req.status?.toLowerCase()) ? "accepted"
            : "rejected";
          const info = getAbsenceInfo ? getAbsenceInfo(studentId, req.subject_name) : null;
          return (
            <div key={req.request_id} className="lec-group-request">
              <div className="lec-group-request-top">
                <div className="lec-detail-row"><span><BookOpen size={14} /></span><span><strong>{req.subject_name}</strong> — {req.class_time}</span></div>
                <span className={`lec-status-pill ${statusClass}`}>{req.status || "Pending"}</span>
              </div>
              <div className="lec-detail-row"><span><Calendar size={14} /></span><span>{req.request_date ? new Date(req.request_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span></div>
              <div className="lec-detail-row"><span><FileText size={14} /></span><span className="lec-reason-text">{req.reason}</span></div>
              {info && (
                <div className={`lec-absence-badge ${info.status}`} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <BarChart3 size={12} /> Approved absences: <strong>{info.approved}/{info.total}</strong> ({info.percent}%)
                  {info.status === "over" && <span className="lec-absence-tag"> · Failed</span>}
                  {info.status === "near" && <span className="lec-absence-tag"> · Near limit</span>}
                </div>
              )}
              {isRejected && req.reject_reason && (
                <div className="lec-reject-reason-display" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <AlertTriangle size={14} /><span>Rejection reason:</span> {req.reject_reason}
                </div>
              )}
              {info && info.status === "near" && (
                <div className="lec-absence-warn near" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={14} /> One more approval fails this class (limit is 20%).
                </div>
              )}
              {info && info.status === "over" && (
                <div className="lec-absence-warn over" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <XCircle size={14} /> This student is over the 20% limit and has failed this class.
                </div>
              )}
              {(req.proof_image_url || isPending) && (
                <div className="lec-group-request-actions">
                  {req.proof_image_url && (
                    <button className="lec-photo-btn" onClick={() => onViewPhoto(req.proof_image_url)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <ImageIcon size={14} /> View Proof
                    </button>
                  )}
                  {isPending && (
                    <div className="lec-action-btns">
                      <button className="lec-btn-accept" onClick={() => onAccept(req.request_id)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Check size={14} /> Accept
                      </button>
                      <button className="lec-btn-reject-trigger" onClick={() => onReject(req.request_id)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <X size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function RequestCard({ req, onAccept, onReject, onViewPhoto }) {
  const isPending = req.status?.toLowerCase() === "pending";
  const isRejected = ["rejected", "reject"].includes(req.status?.toLowerCase());
  const statusClass = isPending ? "pending"
    : ["accepted", "accept", "approved"].includes(req.status?.toLowerCase()) ? "accepted"
    : "rejected";

  return (
    <div className="lec-request-card">
      <div className="lec-request-card-top">
        <div className="lec-student-meta">
          <div className="lec-avatar">{req.student_name?.[0]?.toUpperCase() || "?"}</div>
          <div>
            <strong className="lec-student-name">{req.student_name}</strong>
            <span className="lec-student-sub">ID: {req.student_id} · {req.group_name}</span>
          </div>
        </div>
        <span className={`lec-status-pill ${statusClass}`}>{req.status || "Pending"}</span>
      </div>
      <div className="lec-request-details">
        <div className="lec-detail-row"><span><BookOpen size={14} /></span><span><strong>{req.subject_name}</strong> — {req.class_time}</span></div>
        <div className="lec-detail-row"><span><Calendar size={14} /></span><span>{req.request_date ? new Date(req.request_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span></div>
        <div className="lec-detail-row"><span><FileText size={14} /></span><span className="lec-reason-text">{req.reason}</span></div>
        {isRejected && req.reject_reason && (
          <div className="lec-reject-reason-display" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <AlertTriangle size={14} /><span>Rejection reason:</span> {req.reject_reason}
          </div>
        )}
      </div>
      <div className="lec-request-card-footer">
        {req.proof_image_url && (
          <button className="lec-photo-btn" onClick={() => onViewPhoto(req.proof_image_url)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <ImageIcon size={14} /> View Proof
          </button>
        )}
        {isPending && (
          <div className="lec-action-btns">
            <button className="lec-btn-accept" onClick={onAccept} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Check size={14} /> Accept
            </button>
            <button className="lec-btn-reject-trigger" onClick={onReject} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <X size={14} /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LecturerDashboard;