import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config";
import "../styles/LecturerDashboard.css";

import LecturerSidebar from "../components/lecturer/LecturerSidebar";
import LecturerTopHeader from "../components/lecturer/LecturerTopHeader";
import {
  LecturerOverviewView, LecturerRequestsView, LecturerAbsenceView,
  LecturerProfileView, LecturerHelpView,
} from "../components/lecturer/LecturerViews";
import { LecturerConfirmModals } from "../components/lecturer/LecturerModals";
import { groupByStudent } from "../components/lecturer/LecturerStudentGroup";

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
  // Term tab (Requests + Absence Tracker)
  const [activeTerm, setActiveTerm] = useState("Term 1");

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
    const token = localStorage.getItem("token");
    if (!name || !token || role !== "lecturer") {
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
      const res = await axios.get(`${API_BASE_URL}/lecturer-assignments/${lecturerId}`);
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
      const res = await axios.get(`${API_BASE_URL}/requests`);
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
      await axios.put(`${API_BASE_URL}/request-status`, { id, status: "Accepted" });
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
      await axios.put(`${API_BASE_URL}/request-status`, {
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

  // Absence limit: each subject has ~16 sessions; missing 8 or more approved absences fails the class.
  // Warn the lecturer when a student is near (one below) or over the threshold for a subject.
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

  // Per-student absence summary for the Absence Tracker page (term filtered)
  const absenceSource = requests.filter((r) => (r.term || "Term 1") === activeTerm);
  const studentsAbsence = groupByStudent(absenceSource).map((g) => {
    const subjects = [...new Set(g.requests.map((r) => r.subject_name))].map((subject) => ({
      subject,
      ...getAbsenceInfo(g.studentId, subject),
    }));
    return { studentId: g.studentId, studentName: g.studentName, groupName: g.groupName, subjects };
  });

  // Groups available
  const groupNames = ["SE Group 1", "SE Group 2", "SE Group 3", "SE Group 4"];

  // Requests filtered by term + group tab + search + status
  const getGroupRequests = (groupLabel) => {
    return requests.filter(r => {
      const matchTerm = (r.term || "Term 1") === activeTerm;
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
      return matchTerm && matchGroup && matchSearch && matchStatus;
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
      <LecturerSidebar
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        activeMenu={activeMenu} setActiveMenu={setActiveMenu}
        counts={counts} lecturerName={lecturerName} initials={initials}
        onLogout={handleLogout} fetchRequests={fetchRequests}
      />

      <div className="main-content">
        <LecturerTopHeader
          activeMenu={activeMenu} setActiveMenu={setActiveMenu} setSidebarOpen={setSidebarOpen}
          lecturerName={lecturerName} counts={counts}
          onExportCSV={handleExportCSV} fetchRequests={fetchRequests}
          absenceThresholdPercent={Math.round((ABSENCE_FAIL_THRESHOLD / ABSENCE_TOTAL_SESSIONS) * 100)}
        />

        {activeMenu === "dashboard" && (
          <LecturerOverviewView
            counts={counts} dashboardSort={dashboardSort} setDashboardSort={setDashboardSort}
            dashboardPending={dashboardPending}
            expandedStudent={expandedStudent} setExpandedStudent={setExpandedStudent}
            getAbsenceInfo={getAbsenceInfo}
            onAccept={handleAccept} onReject={openRejectModal}
            setLightboxUrl={setLightboxUrl}
            setActiveMenu={setActiveMenu} setStatusFilter={setStatusFilter}
            recentActivity={recentActivity}
          />
        )}

        {activeMenu === "requests" && (
          <LecturerRequestsView
            termTabs={termTabs}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            activeGroup={activeGroup} setActiveGroup={setActiveGroup} setGroupPages={setGroupPages}
            counts={counts} paginatedRequests={paginatedRequests}
            expandedStudent={expandedStudent} setExpandedStudent={setExpandedStudent}
            getAbsenceInfo={getAbsenceInfo}
            onAccept={handleAccept} onReject={openRejectModal}
            setLightboxUrl={setLightboxUrl} setPage={setPage}
            currentPage={currentPage} totalPages={totalPages} allFiltered={allFiltered} ITEMS_PER_PAGE={ITEMS_PER_PAGE}
          />
        )}

        {activeMenu === "absence" && (
          <LecturerAbsenceView
            termTabs={termTabs}
            studentsAbsence={studentsAbsence} fetchRequests={fetchRequests}
            ABSENCE_TOTAL_SESSIONS={ABSENCE_TOTAL_SESSIONS} ABSENCE_FAIL_THRESHOLD={ABSENCE_FAIL_THRESHOLD}
          />
        )}

        {activeMenu === "profile" && (
          <LecturerProfileView lecturerName={lecturerName} initials={initials} counts={counts} />
        )}

        {activeMenu === "help" && <LecturerHelpView />}
      </div>

      <LecturerConfirmModals
        isLogoutOpen={isLogoutOpen} setIsLogoutOpen={setIsLogoutOpen} confirmLogout={confirmLogout}
        rejectModalOpen={rejectModalOpen} setRejectModalOpen={setRejectModalOpen}
        rejectReason={rejectReason} setRejectReason={setRejectReason}
        rejectLoading={rejectLoading} handleRejectSubmit={handleRejectSubmit}
        lightboxUrl={lightboxUrl} setLightboxUrl={setLightboxUrl}
      />
    </div>
  );
}

export default LecturerDashboard;
