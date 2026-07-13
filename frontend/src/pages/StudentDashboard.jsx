import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config";
import "../styles/StudentDashboard.css";

import StudentSidebar from "../components/student/StudentSidebar";
import StudentTopHeader from "../components/student/StudentTopHeader";
import {
  StudentOverviewView, StudentViewStatusView, StudentAttendanceView,
  StudentNotificationsView, StudentProfileView, StudentHelpView,
} from "../components/student/StudentViews";
import { StudentModals } from "../components/student/StudentModals";

function StudentDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [reason, setReason] = useState("");
  const [selectedDates, setSelectedDates] = useState([]);

  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedTimes, setSelectedTimes] = useState([]);

  const [requests, setRequests] = useState([]);
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [activeDay, setActiveDay] = useState("");

  const [searchDashboardId, setSearchDashboardId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [proofImage, setProofImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [editingRequestId, setEditingRequestId] = useState(null);

  // Added state for password modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Logout confirmation modal
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // Clear-all notifications confirmation modal
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);

  // Mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Proof photo lightbox state (student side)
  const [proofLightboxUrl, setProofLightboxUrl] = useState(null);
  const [proofLightboxMeta, setProofLightboxMeta] = useState(null);

  // Added state for Help & Support FAQ accordion
  const [openFaqId, setOpenFaqId] = useState("f1");
  const [faqSearchTerm, setFaqSearchTerm] = useState("");

  // Term tab (visual only — same classes across all terms)
  const [activeTerm, setActiveTerm] = useState("Term 1");

  // Each term has its own timetable. Switching the term tab shows that term's classes
  // everywhere (Select Class Matrix, View Status, Attendance).
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
      Friday: [
        { id: "t1-f1", isLazy: true }
      ]
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
      Friday: [
        { id: "t2-f1", isLazy: true }
      ]
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
      Friday: [
        { id: "t3-f1", isLazy: true }
      ]
    }
  };

  // Classes for the currently selected term
  const matrixClasses = termTimetables[activeTerm] || termTimetables["Term 1"];

  // Attendance rule: a student may miss up to ABSENCE_FAIL_THRESHOLD - 1 sessions of a
  // subject. Missing ABSENCE_FAIL_THRESHOLD or more fails the class. Only approved absences count.
  const TOTAL_SESSIONS_PER_SUBJECT = 16;
  const ABSENCE_FAIL_THRESHOLD = 8;
  const ATTENDANCE_FAIL_PERCENT = Math.round((ABSENCE_FAIL_THRESHOLD / TOTAL_SESSIONS_PER_SUBJECT) * 100);
  const allowedAbsences = ABSENCE_FAIL_THRESHOLD - 1;

  useEffect(() => {
    const storedId = localStorage.getItem("user_id");
    const storedName = localStorage.getItem("student_name");
    const role = localStorage.getItem("role");
    const token = localStorage.getItem("token");

    if (!storedId || !token || role !== "student") {
      localStorage.clear();
      navigate("/login");
      return;
    }

    setStudentId(storedId);
    setSearchDashboardId(storedId);
    setStudentName(storedName || "");

    axios.get(`${API_BASE_URL}/student-requests/${storedId}`)
      .then((res) => {
        setRequests(res.data || []);
      })
      .catch((err) => {
        console.log(err);
      });
  }, [navigate]);

  const showToast = (message, color) => {
    const oldToast = document.getElementById("toast");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "app-toast";
    toast.innerText = message;
    toast.style.background = color;
    document.body.appendChild(toast);

    // trigger slide-in on next frame
    requestAnimationFrame(() => toast.classList.add("app-toast-visible"));

    setTimeout(() => {
      toast.classList.remove("app-toast-visible");
      setTimeout(() => toast.remove(), 250); // wait for slide-out to finish
    }, 2200);
  };

  const handleActualPasswordUpdate = async () => {
    if (!newPassword) return;
    try {
      await axios.put(`${API_BASE_URL}/update-password/${studentId}`, { password: newPassword });
      showToast("Password updated successfully!", "#059669");
      setIsPasswordModalOpen(false);
      setNewPassword("");
    } catch (err) {
      showToast("Failed to update password", "#ef4444");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!studentId || !studentName || !reason || selectedDates.length === 0 || selectedSubjects.length === 0) {
      showToast("Please fill all fields, pick at least one date and one class", "#ef4444");
      return;
    }

    const groupName = localStorage.getItem("group_name");

    if (editingRequestId) {
      try {
        const formData = new FormData();
        formData.append("reason", reason);
        formData.append("request_date", selectedDates[0]);
        formData.append("subject_name", selectedSubjects[0]);
        formData.append("class_time", selectedTimes[0]);
        if (proofImage) formData.append("proof_image", proofImage);

        await axios.put(`${API_BASE_URL}/request/${editingRequestId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        showToast("Request updated successfully!", "#2563eb");
        resetForm();
        syncLogs();
        setActiveMenu("view-status");
      } catch (err) {
        console.log(err);
        showToast("Failed to update request", "#ef4444");
      }
    } else {
      let successCount = 0;
      for (let i = 0; i < selectedSubjects.length; i++) {
        for (let j = 0; j < selectedDates.length; j++) {
          const formData = new FormData();
          formData.append("student_id", studentId.trim());
          formData.append("student_name", studentName);
          formData.append("group_name", groupName);
          formData.append("reason", reason);
          formData.append("request_date", selectedDates[j]);
          formData.append("subject_name", selectedSubjects[i]);
          formData.append("class_time", selectedTimes[i]);
          formData.append("term", activeTerm);
          if (proofImage) formData.append("proof_image", proofImage);

          try {
            await axios.post(`${API_BASE_URL}/request`, formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            successCount++;
          } catch (err) {
            console.log(err);
          }
        }
      }
      if (successCount > 0) {
        showToast(`Successfully submitted ${successCount} permission request(s)!`, "#2563eb");
        resetForm();
        syncLogs();
        setActiveMenu("view-status");
      } else {
        showToast("Request Submission Failed", "#ef4444");
      }
    }
  };

  const handleDeleteAllPending = () => setIsClearAllOpen(true);

  const confirmClearAll = async () => {
    setIsClearAllOpen(false);
    try {
      await axios.put(`${API_BASE_URL}/requests/mark-viewed/${studentId}`);
      showToast("Notifications cleared.", "#2563eb");
      syncLogs(true);
    } catch (err) {
      console.log(err);
      showToast("Failed to clear notifications", "#ef4444");
    }
  };

  const handleEditClick = (req) => {
    setEditingRequestId(req.request_id);
    setReason(req.reason);
    setSelectedDates(req.request_date ? [req.request_date.split("T")[0]] : []);
    setSelectedSubjects([req.subject_name]);
    setSelectedTimes([req.class_time]);
    if (req.proof_image_url) {
      setImagePreview(`${API_BASE_URL}${req.proof_image_url}`);
    } else {
      setImagePreview("");
    }
    setActiveMenu("dashboard");
    showToast("Loaded request details into editor form", "#d97706");
  };

  const resetForm = () => {
    setEditingRequestId(null);
    setReason("");
    setSelectedDates([]);
    setSelectedSubjects([]);
    setSelectedTimes([]);
    setProofImage(null);
    setImagePreview("");
  };

  const syncLogs = async (silent = false) => {
    const targetId = searchDashboardId.trim() || studentId;
    if (!targetId) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/student-requests/${targetId}`);
      setRequests(res.data || []);
      setSearchDashboardId(targetId);
      if (!silent) showToast(`Synced logs for ID: ${targetId}`, "#2563eb");
    } catch (err) {
      console.log(err);
      showToast("Failed to sync your logs", "#ef4444");
    }
  };

  const handleSelectFromMatrix = (cls) => {
    if (editingRequestId) {
      setSelectedSubjects([cls.subject]);
      setSelectedTimes([cls.time]);
      setIsMatrixOpen(false);
      return;
    }
    const index = selectedSubjects.indexOf(cls.subject);
    if (index > -1) {
      setSelectedSubjects(selectedSubjects.filter((_, i) => i !== index));
      setSelectedTimes(selectedTimes.filter((_, i) => i !== index));
    } else {
      setSelectedSubjects([...selectedSubjects, cls.subject]);
      setSelectedTimes([...selectedTimes, cls.time]);
    }
  };

  const getRequestsForDay = (dayName) => {
    const classesForDay = matrixClasses[dayName] || [];
    let filtered = requests.filter((req) =>
      classesForDay.some((c) => c.subject === req.subject_name)
    );
    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => {
        const status = req.status?.toLowerCase();
        if (statusFilter === "approved") return ["approved", "accept", "accepted"].includes(status);
        if (statusFilter === "rejected") return ["rejected", "reject"].includes(status);
        return status === statusFilter;
      });
    }
    return filtered;
  };

  const handleLogout = () => setIsLogoutOpen(true);
  const confirmLogout = () => { localStorage.clear(); navigate("/login"); };

  // unviewed = for the notification bell badge only
  const unviewedCount = requests.filter(r => r.status_viewed === 0).length;

  const counts = {
    total: requests.length,
    // actual pending requests (not yet accepted/rejected)
    pending: requests.filter(r => r.status?.toLowerCase() === "pending").length,
    approved: requests.filter((r) => ["approved", "accept", "accepted"].includes(r.status?.toLowerCase())).length,
    rejected: requests.filter((r) => ["rejected", "reject"].includes(r.status?.toLowerCase())).length
  };

  // Per-subject attendance: count approved absences and compare against ABSENCE_FAIL_THRESHOLD
  const attendanceData = Object.values(matrixClasses)
    .flat()
    .filter((c) => c.subject)
    .map((c) => {
      const approvedAbsences = requests.filter(
        (r) => r.subject_name === c.subject && ["approved", "accept", "accepted"].includes(r.status?.toLowerCase())
      ).length;
      const percent = Math.round((approvedAbsences / TOTAL_SESSIONS_PER_SUBJECT) * 100);
      return { subject: c.subject, teacher: c.teacher, approvedAbsences, percent, failed: approvedAbsences >= ABSENCE_FAIL_THRESHOLD };
    });

  const initials = studentName ? studentName.split(" ").map(n => n[0]).join("").toUpperCase() : "ST";

  // Reusable Term 1/2/3 tabs (visual only — does not change the data shown)
  const termTabs = (
    <div className="term-tabs">
      {["Term 1", "Term 2", "Term 3"].map((t) => (
        <button
          key={t}
          className={`term-tab ${activeTerm === t ? "term-tab-active" : ""}`}
          onClick={() => setActiveTerm(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <div className="dashboard-container">
      <StudentSidebar
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        activeMenu={activeMenu} setActiveMenu={setActiveMenu}
        unviewedCount={unviewedCount} studentName={studentName} initials={initials}
        onLogout={handleLogout} syncLogs={syncLogs}
      />

      <div className="main-content">
        <StudentTopHeader
          activeMenu={activeMenu} setSidebarOpen={setSidebarOpen}
          studentName={studentName} unviewedCount={unviewedCount}
          setActiveMenu={setActiveMenu} syncLogs={syncLogs}
        />

        {activeMenu === "dashboard" && (
          <StudentOverviewView
            counts={counts} editingRequestId={editingRequestId} studentId={studentId} studentName={studentName}
            selectedSubjects={selectedSubjects} setIsMatrixOpen={setIsMatrixOpen}
            reason={reason} setReason={setReason} selectedDates={selectedDates} setSelectedDates={setSelectedDates}
            imagePreview={imagePreview} handleFileChange={handleFileChange}
            handleSubmit={handleSubmit} resetForm={resetForm}
          />
        )}

        {activeMenu === "view-status" && (
          <StudentViewStatusView
            termTabs={termTabs} syncLogs={syncLogs} counts={counts}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            searchDashboardId={searchDashboardId} setSearchDashboardId={setSearchDashboardId}
            activeDay={activeDay} setActiveDay={setActiveDay}
            getRequestsForDay={getRequestsForDay} handleEditClick={handleEditClick}
            setProofLightboxUrl={setProofLightboxUrl} setProofLightboxMeta={setProofLightboxMeta}
          />
        )}

        {activeMenu === "attendance" && (
          <StudentAttendanceView
            termTabs={termTabs} syncLogs={syncLogs} attendanceData={attendanceData}
            ATTENDANCE_FAIL_PERCENT={ATTENDANCE_FAIL_PERCENT} allowedAbsences={allowedAbsences}
            TOTAL_SESSIONS_PER_SUBJECT={TOTAL_SESSIONS_PER_SUBJECT}
          />
        )}

        {activeMenu === "notifications" && (
          <StudentNotificationsView requests={requests} handleDeleteAllPending={handleDeleteAllPending} />
        )}

        {activeMenu === "profile" && (
          <StudentProfileView
            studentName={studentName} studentId={studentId} counts={counts} initials={initials}
            setIsPasswordModalOpen={setIsPasswordModalOpen}
          />
        )}

        {activeMenu === "help" && (
          <StudentHelpView
            faqSearchTerm={faqSearchTerm} setFaqSearchTerm={setFaqSearchTerm}
            openFaqId={openFaqId} setOpenFaqId={setOpenFaqId} showToast={showToast}
          />
        )}
      </div>

      <StudentModals
        isLogoutOpen={isLogoutOpen} setIsLogoutOpen={setIsLogoutOpen} confirmLogout={confirmLogout}
        isClearAllOpen={isClearAllOpen} setIsClearAllOpen={setIsClearAllOpen} confirmClearAll={confirmClearAll}
        proofLightboxUrl={proofLightboxUrl} setProofLightboxUrl={setProofLightboxUrl} proofLightboxMeta={proofLightboxMeta}
        isPasswordModalOpen={isPasswordModalOpen} setIsPasswordModalOpen={setIsPasswordModalOpen}
        setNewPassword={setNewPassword} handleActualPasswordUpdate={handleActualPasswordUpdate}
        isMatrixOpen={isMatrixOpen} setIsMatrixOpen={setIsMatrixOpen} termTabs={termTabs}
        matrixClasses={matrixClasses} selectedSubjects={selectedSubjects} handleSelectFromMatrix={handleSelectFromMatrix}
      />
    </div>
  );
}

export default StudentDashboard;
