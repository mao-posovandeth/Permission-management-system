import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/AdminDashboard.css";
import { API_BASE_URL } from "../config";

import AdminSidebar from "../components/admin/AdminSidebar";
import AdminTopHeader from "../components/admin/AdminTopHeader";
import {
  AdminOverviewView, AdminRequestsView, AdminAbsenceView, AdminUsersView,
  AdminAnalyticsView, AdminActivityView, AdminSettingsView, AdminProfileView,
} from "../components/admin/AdminViews";
import { AdminUserModal, AdminLecturerMatrixModal, AdminConfirmModals } from "../components/admin/AdminModals";
import { groupByStudent } from "../components/admin/AdminStudentGroup";

const API = API_BASE_URL;

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

  // Grouped cards: which student is expanded (one at a time)
  const [expandedStudent, setExpandedStudent] = useState(null);
  // Photo proof lightbox
  const [lightboxUrl, setLightboxUrl] = useState(null);
  // Absence Tracker page group filter
  const [absenceGroup, setAbsenceGroup] = useState("all");
  // Term 1/2/3 tabs (visual — same data shown across all terms)
  const [activeTerm, setActiveTerm] = useState("Term 1");

  // Modals
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // Manage Users
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
 const [userForm, setUserForm] = useState({ user_id: "", name: "", email: "", password: "", role: "student", group_name: "SE Group 1", subjects: [], terms: [] });
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [isLecturerMatrixOpen, setIsLecturerMatrixOpen] = useState(false);
const [matrixActiveTerm, setMatrixActiveTerm] = useState("Term 1");
  // Settings (persisted in localStorage)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("admin_settings");
    return saved ? JSON.parse(saved) : { autoRefresh: true, compactCards: false, confirmActions: true };
  });

  const autoRefreshRef = useRef(null);

  const groupNames = ["SE Group 1", "SE Group 2", "SE Group 3", "SE Group 4"];
  const subjectNames = ["Database", "React", "Software", "Visual Art", "AI", "Security", "Research", "Networking", "Cloud Computing", "Mobile Dev", "UX Design", "Machine Learning", "Cryptography", "Tech Ethics", "DevOps", "Blockchain", "Data Science", "Game Dev", "IoT", "Big Data", "Capstone"];
  const termNames = ["Term 1", "Term 2", "Term 3"];
  const termTimetables = {
    "Term 1": {
      Monday: [
        { id: "t1-m1", time: "8:30 AM - 11:00 AM", teacher: "Ronan", subject: "Database" },
        { id: "t1-m2", time: "1:00 PM - 4:30 PM", teacher: "Donal", subject: "React" }
      ],
      Tuesday: [
        { id: "t1-t1", time: "9:30 AM - 11:00 AM", teacher: "Kim", subject: "Software" },
        { id: "t1-t2", time: "1:50 PM - 5:00 PM", teacher: "Madman", subject: "Visual Art" }
      ],
      Wednesday: [
        { id: "t1-w1", time: "10:00 AM - 12:00 PM", teacher: "Ivy", subject: "AI" },
        { id: "t1-w2", time: "3:00 PM - 6:00 PM", teacher: "Security", subject: "Security" }
      ],
      Thursday: [
        { id: "t1-th1", time: "1:00 PM - 3:00 PM", teacher: "Leo", subject: "Research", isSeminar: true }
      ],
      Friday: [{ id: "t1-f1", isLazy: true }]
    },
    "Term 2": {
      Monday: [
        { id: "t2-m1", time: "8:30 AM - 11:00 AM", teacher: "Alan", subject: "Networking" },
        { id: "t2-m2", time: "1:00 PM - 4:30 PM", teacher: "Grace", subject: "Cloud Computing" }
      ],
      Tuesday: [
        { id: "t2-t1", time: "9:30 AM - 11:00 AM", teacher: "Steve", subject: "Mobile Dev" },
        { id: "t2-t2", time: "1:50 PM - 5:00 PM", teacher: "Nina", subject: "UX Design" }
      ],
      Wednesday: [
        { id: "t2-w1", time: "10:00 AM - 12:00 PM", teacher: "Ivy", subject: "Machine Learning" },
        { id: "t2-w2", time: "3:00 PM - 6:00 PM", teacher: "Turing", subject: "Cryptography" }
      ],
      Thursday: [
        { id: "t2-th1", time: "1:00 PM - 3:00 PM", teacher: "Ada", subject: "Tech Ethics", isSeminar: true }
      ],
      Friday: [{ id: "t2-f1", isLazy: true }]
    },
    "Term 3": {
      Monday: [
        { id: "t3-m1", time: "8:30 AM - 11:00 AM", teacher: "Linus", subject: "DevOps" },
        { id: "t3-m2", time: "1:00 PM - 4:30 PM", teacher: "Hal", subject: "Blockchain" }
      ],
      Tuesday: [
        { id: "t3-t1", time: "9:30 AM - 11:00 AM", teacher: "Geoff", subject: "Data Science" },
        { id: "t3-t2", time: "1:50 PM - 5:00 PM", teacher: "Shigeru", subject: "Game Dev" }
      ],
      Wednesday: [
        { id: "t3-w1", time: "10:00 AM - 12:00 PM", teacher: "Nikola", subject: "IoT" },
        { id: "t3-w2", time: "3:00 PM - 6:00 PM", teacher: "Doug", subject: "Big Data" }
      ],
      Thursday: [
        { id: "t3-th1", time: "1:00 PM - 3:00 PM", teacher: "Leo", subject: "Capstone", isSeminar: true }
      ],
      Friday: [{ id: "t3-f1", isLazy: true }]
    }
  };
  useEffect(() => {
    const name = localStorage.getItem("student_name");
    const role = localStorage.getItem("role");
    const token = localStorage.getItem("token");
    if (!name || !token || role !== "admin") {
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

  /* ===================== USER ACTIONS ===================== */
  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({ user_id: "", name: "", email: "", password: "", role: "student", group_name: "SE Group 1", subjects: [], terms: [] });
    setUserModalOpen(true);
  };
  const handleToggleLecturerClass = (cls) => {
    setUserForm((prev) => {
      const has = prev.subjects.includes(cls.subject);
      const newSubjects = has
        ? prev.subjects.filter((s) => s !== cls.subject)
        : [...prev.subjects, cls.subject];
      const newTerms = termNames.filter((t) =>
        Object.values(termTimetables[t]).flat().some((c) => c.subject && newSubjects.includes(c.subject))
      );
      return { ...prev, subjects: newSubjects, terms: newTerms };
    });
  };
  const openEditUser = async (user) => {
    setEditingUser(user);
    let subjects = [];
    if (user.role?.toLowerCase() === "lecturer") {
      try {
        const res = await axios.get(`${API}/users/${user.user_id}/assignments`);
        subjects = [...new Set((res.data || []).map((a) => a.subject_name))];
      } catch (err) {
        console.log(err);
      }
    }
    const terms = termNames.filter((t) =>
      Object.values(termTimetables[t]).flat().some((c) => c.subject && subjects.includes(c.subject))
    );
    setUserForm({
      user_id: user.user_id || "",
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "student",
      group_name: user.group_name || "SE Group 1",
      subjects,
      terms,
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
      const payload = { ...userForm };
      if (userForm.role === "lecturer") {
        // Backend expects assignments as (subject, group) pairs.
        // Since this matrix only picks subjects, apply each selected
        // subject to every group so the lecturer sees requests from any group.
        payload.assignments = [];
        userForm.subjects.forEach((subj) => {
          groupNames.forEach((g) => {
            payload.assignments.push({ subject_name: subj, group_name: g });
          });
        });
      }
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.user_id}`, payload);
        showToast("User updated", "#059669");
      } else {
        await axios.post(`${API}/users`, payload);
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

  // Absence limit: each subject has ~16 sessions; missing 8 or more approved absences fails the class.
  const ABSENCE_TOTAL_SESSIONS = 16;
  const ABSENCE_FAIL_THRESHOLD = 8;
  const getAbsenceInfo = (sid, subject) => {
    const approved = requests.filter(
      (r) => r.student_id === sid && r.subject_name === subject && ["approved", "accept", "accepted"].includes(r.status?.toLowerCase())
    ).length;
    const percent = Math.round((approved / ABSENCE_TOTAL_SESSIONS) * 100);
    let status = "ok";
    if (approved >= ABSENCE_FAIL_THRESHOLD) status = "over";
    else if (approved === ABSENCE_FAIL_THRESHOLD - 1) status = "near";
    return { approved, total: ABSENCE_TOTAL_SESSIONS, percent, status };
  };

  // Per-student absence summary for the Absence Tracker page (term + group filtered)
  const absenceSource = requests.filter((r) => (r.term || "Term 1") === activeTerm);
  const studentsAbsence = groupByStudent(absenceSource).map((g) => {
    const subjects = [...new Set(g.requests.map((r) => r.subject_name))].map((subject) => ({
      subject,
      ...getAbsenceInfo(g.studentId, subject),
    }));
    return { studentId: g.studentId, studentName: g.studentName, groupName: g.groupName, subjects };
  });
  const visibleAbsence = absenceGroup === "all"
    ? studentsAbsence
    : studentsAbsence.filter((s) => s.groupName === groupNames[absenceGroup - 1]);

  const userCounts = {
    total: users.length,
    students: users.filter(u => u.role?.toLowerCase() === "student").length,
    lecturers: users.filter(u => u.role?.toLowerCase() === "lecturer").length,
    admins: users.filter(u => u.role?.toLowerCase() === "admin").length,
  };

  const getFilteredRequests = () => {
    return requests.filter(r => {
      const matchTerm = (r.term || "Term 1") === activeTerm;
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
      return matchTerm && matchGroup && matchSearch && matchStatus;
    });
  };

  const allFiltered = getFilteredRequests();
  const requestGroups = groupByStudent(allFiltered);

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

  const activityLog = [...requests]
    .filter(r => ["accepted", "accept", "approved", "rejected", "reject"].includes(r.status?.toLowerCase()))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const dashboardPending = requests.filter(r => r.status?.toLowerCase() === "pending");
  const initials = adminName ? adminName.split(" ").map(n => n[0]).join("").toUpperCase() : "AD";

  const toggleStudent = (sid) => setExpandedStudent(expandedStudent === sid ? null : sid);

  const termTabs = (
    <div className="term-tabs" style={{ marginBottom: "20px" }}>
      {["Term 1", "Term 2", "Term 3"].map((t) => (
        <button key={t} className={`term-tab ${activeTerm === t ? "term-tab-active" : ""}`} onClick={() => setActiveTerm(t)}>
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <div className="dashboard-container">
      <AdminSidebar
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        activeMenu={activeMenu} setActiveMenu={setActiveMenu}
        counts={counts} adminName={adminName} initials={initials}
        onLogout={handleLogout} fetchRequests={fetchRequests} fetchUsers={fetchUsers}
      />

      {/* MAIN */}
      <div className="main-content">
        <AdminTopHeader
          activeMenu={activeMenu} setActiveMenu={setActiveMenu} setSidebarOpen={setSidebarOpen}
          adminName={adminName} counts={counts}
          onExportCSV={handleExportCSV} onAddUser={openAddUser} fetchRequests={fetchRequests}
          absenceThresholdPercent={Math.round((ABSENCE_FAIL_THRESHOLD / ABSENCE_TOTAL_SESSIONS) * 100)}
        />

        {activeMenu === "dashboard" && (
          <AdminOverviewView
            counts={counts} dashboardPending={dashboardPending}
            expandedStudent={expandedStudent} toggleStudent={toggleStudent}
            getAbsenceInfo={getAbsenceInfo}
            onAccept={(id) => updateStatus(id, "Accepted")}
            onReject={(id) => updateStatus(id, "Rejected")}
            onDelete={(id) => setDeleteTargetId(id)}
            setLightboxUrl={setLightboxUrl}
            setActiveMenu={setActiveMenu} setStatusFilter={setStatusFilter}
            recentActivity={recentActivity}
          />
        )}

        {activeMenu === "requests" && (
          <AdminRequestsView
            termTabs={termTabs}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            activeGroup={activeGroup} setActiveGroup={setActiveGroup}
            counts={counts} requestGroups={requestGroups}
            expandedStudent={expandedStudent} toggleStudent={toggleStudent}
            getAbsenceInfo={getAbsenceInfo}
            onAccept={(id) => updateStatus(id, "Accepted")}
            onReject={(id) => updateStatus(id, "Rejected")}
            onDelete={(id) => setDeleteTargetId(id)}
            setLightboxUrl={setLightboxUrl}
            fetchRequests={fetchRequests}
          />
        )}

        {activeMenu === "absence" && (
          <AdminAbsenceView
            termTabs={termTabs}
            absenceGroup={absenceGroup} setAbsenceGroup={setAbsenceGroup}
            visibleAbsence={visibleAbsence} ABSENCE_TOTAL_SESSIONS={ABSENCE_TOTAL_SESSIONS}
            ABSENCE_FAIL_THRESHOLD={ABSENCE_FAIL_THRESHOLD}
            fetchRequests={fetchRequests}
          />
        )}

        {activeMenu === "users" && (
          <AdminUsersView
            userCounts={userCounts} userSearch={userSearch} setUserSearch={setUserSearch}
            userRoleFilter={userRoleFilter} setUserRoleFilter={setUserRoleFilter}
            filteredUsers={filteredUsers} users={users}
            openEditUser={openEditUser} setDeleteUserId={setDeleteUserId}
          />
        )}

        {activeMenu === "analytics" && (
          <AdminAnalyticsView requests={requests} groupNames={groupNames} counts={counts} />
        )}

        {activeMenu === "activity" && (
          <AdminActivityView activityLog={activityLog} fetchRequests={fetchRequests} />
        )}

        {activeMenu === "settings" && (
          <AdminSettingsView settings={settings} setSettings={setSettings} />
        )}

        {activeMenu === "profile" && (
          <AdminProfileView adminName={adminName} initials={initials} counts={counts} userCounts={userCounts} />
        )}
      </div>

      <AdminUserModal
        userModalOpen={userModalOpen} setUserModalOpen={setUserModalOpen}
        editingUser={editingUser} userForm={userForm} setUserForm={setUserForm}
        groupNames={groupNames} saveUser={saveUser}
        onOpenMatrix={() => setIsLecturerMatrixOpen(true)}
      />

      <AdminLecturerMatrixModal
        isLecturerMatrixOpen={isLecturerMatrixOpen} setIsLecturerMatrixOpen={setIsLecturerMatrixOpen}
        termNames={termNames} termTimetables={termTimetables}
        matrixActiveTerm={matrixActiveTerm} setMatrixActiveTerm={setMatrixActiveTerm}
        userForm={userForm} handleToggleLecturerClass={handleToggleLecturerClass}
      />

      <AdminConfirmModals
        lightboxUrl={lightboxUrl} setLightboxUrl={setLightboxUrl}
        isLogoutOpen={isLogoutOpen} setIsLogoutOpen={setIsLogoutOpen} confirmLogout={confirmLogout}
        deleteTargetId={deleteTargetId} setDeleteTargetId={setDeleteTargetId} confirmDelete={confirmDelete}
        deleteUserId={deleteUserId} setDeleteUserId={setDeleteUserId} confirmDeleteUser={confirmDeleteUser}
      />
    </div>
  );
}

export default AdminDashboard;
