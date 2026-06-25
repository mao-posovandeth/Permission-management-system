import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/StudentDashboard.css";

function StudentDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [reason, setReason] = useState("");
  const [requestDate, setRequestDate] = useState("");
  
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Proof photo lightbox state (student side)
  const [proofLightboxUrl, setProofLightboxUrl] = useState(null);
  const [proofLightboxMeta, setProofLightboxMeta] = useState(null);

  // Added state for Help & Support FAQ accordion
  const [openFaqId, setOpenFaqId] = useState("f1");
  const [faqSearchTerm, setFaqSearchTerm] = useState("");

  const faqs = [
    {
      id: "f1",
      question: "How do I check the status of my request?",
      answer: "You can check the status of any request by going to the \"View Status\" page from the sidebar. All your requests and their current progress will be listed there."
    },
    {
      id: "f2",
      question: "How long does it take to get a response?",
      answer: "Most requests are reviewed within 24 hours. You'll receive a notification as soon as your lecturer or admin responds."
    },
    {
      id: "f3",
      question: "Can I update my request after submitting?",
      answer: "Yes, as long as the request is still pending. Go to \"View Status\", find the request, and click the Edit button to make changes."
    },
    {
      id: "f4",
      question: "What if I can't access my student account?",
      answer: "You can reset your password from the Profile page. If you're still locked out, submit a support ticket below and our admin team will help you regain access."
    },
    {
      id: "f5",
      question: "Who should I contact for technical issues?",
      answer: "For technical issues with the platform itself, submit a support ticket through the Contact Admin section below and our team will assist you."
    }
  ];

  const quickHelpItems = [
    { title: "Request Issues", desc: "Get help with your request related problems.", icon: "📄", bg: "bg-blue" },
    { title: "Account Problems", desc: "Resolve login or account access issues.", icon: "👤", bg: "bg-purple" },
    { title: "Password Reset", desc: "Reset or update your account password.", icon: "🔒", bg: "bg-amber" },
    { title: "System Guide", desc: "Learn how to use the system effectively.", icon: "📘", bg: "bg-blue" }
  ];

  const filteredFaqs = faqs.filter((f) => f.question.toLowerCase().includes(faqSearchTerm.toLowerCase()));

  const matrixClasses = {
    Monday: [
      { id: "m1", time: "8:30 AM - 11:00 AM", teacher: "Ronan", subject: "Database" },
      { id: "m2", time: "1:00 PM - 4:30 PM", teacher: "Donal", subject: "React" }
    ],
    Tuesday: [
      { id: "t1", time: "9:30 AM - 11:00 AM", teacher: "Kim", subject: "Software" },
      { id: "t2", time: "1:50 PM - 5:00 PM", teacher: "Madman", subject: "Visual Art" }
    ],
    Wednesday: [
      { id: "w1", time: "10:00 AM - 12:00 PM", teacher: "Ivy", subject: "AI" },
      { id: "w2", time: "3:00 PM - 6:00 PM", teacher: "Security", subject: "Security" }
    ],
    Thursday: [
      { id: "th1", time: "1:00 PM - 3:00 PM", teacher: "Leo", subject: "Research", isSeminar: true }
    ],
    Friday: [
      { id: "f1", isLazy: true }
    ]
  };

  useEffect(() => {
    const storedId = localStorage.getItem("user_id");
    const storedName = localStorage.getItem("student_name");
    const role = localStorage.getItem("role");

    if (!storedId || role !== "student") {
      localStorage.clear();
      navigate("/login");
      return;
    }

    setStudentId(storedId);
    setSearchDashboardId(storedId); 
    setStudentName(storedName || "");

    axios.get(`http://localhost:5000/student-requests/${storedId}`)
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
      await axios.put(`http://localhost:5000/update-password/${studentId}`, { password: newPassword });
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
    if (!studentId || !studentName || !reason || !requestDate || selectedSubjects.length === 0) {
      showToast("Please fill all fields and select at least one class", "#ef4444");
      return;
    }

    const groupName = localStorage.getItem("group_name");

    if (editingRequestId) {
      try {
        const formData = new FormData();
        formData.append("reason", reason);
        formData.append("request_date", requestDate);
        formData.append("subject_name", selectedSubjects[0]);
        formData.append("class_time", selectedTimes[0]);
        if (proofImage) formData.append("proof_image", proofImage);

        await axios.put(`http://localhost:5000/request/${editingRequestId}`, formData, {
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
        const formData = new FormData();
        formData.append("student_id", studentId.trim());
        formData.append("student_name", studentName);
        formData.append("group_name", groupName);
        formData.append("reason", reason);
        formData.append("request_date", requestDate);
        formData.append("subject_name", selectedSubjects[i]);
        formData.append("class_time", selectedTimes[i]);
        // Only attach photo to the first subject — avoids duplicate uploads for multi-select
        if (proofImage && i === 0) formData.append("proof_image", proofImage);

        try {
          await axios.post("http://localhost:5000/request", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          successCount++;
        } catch (err) {
          console.log(err);
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
      await axios.put(`http://localhost:5000/requests/mark-viewed/${studentId}`);
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
    setRequestDate(req.request_date ? req.request_date.split("T")[0] : "");
    setSelectedSubjects([req.subject_name]);
    setSelectedTimes([req.class_time]);
    if (req.proof_image_url) {
      setImagePreview(`http://localhost:5000${req.proof_image_url}`);
    } else {
      setImagePreview("");
    }
    setActiveMenu("dashboard");
    showToast("Loaded request details into editor form", "#d97706");
  };

  const resetForm = () => {
    setEditingRequestId(null);
    setReason("");
    setRequestDate("");
    setSelectedSubjects([]);
    setSelectedTimes([]);
    setProofImage(null);
    setImagePreview("");
  };

  const syncLogs = async (silent = false) => {
    const targetId = searchDashboardId.trim() || studentId;
    if (!targetId) return;
    try {
      const res = await axios.get(`http://localhost:5000/student-requests/${targetId}`);
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

  const initials = studentName ? studentName.split(" ").map(n => n[0]).join("").toUpperCase() : "ST";

  return (
    <div className="dashboard-container">
      {/* Mobile sidebar overlay backdrop */}
      {isMobileSidebarOpen && (
        <div className="mobile-sidebar-backdrop" onClick={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className={`sidebar ${isMobileSidebarOpen ? "sidebar-mobile-open" : ""}`}>
        <div>
          {/* Close button — only visible on mobile when sidebar is open */}
          <button
            className="sidebar-close-btn"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
          <div className="brand-header">
            <h2 className="logo-main">UNIVERSITY</h2>
            <p className="logo-sub">PERMISSION SYSTEM</p>
          </div>
          <ul className="menu">
            <li className={activeMenu === "dashboard" ? "active" : ""} onClick={() => setActiveMenu("dashboard")}>
              <span className="icon">🏠</span> Dashboard
            </li>
            <li className={activeMenu === "view-status" ? "active" : ""} onClick={() => { setActiveMenu("view-status"); syncLogs(); }}>
              <span className="icon">📋</span> View Status
            </li>
            <li className={activeMenu === "notifications" ? "active" : ""} onClick={() => { setActiveMenu("notifications"); syncLogs(true); }}>
              <span className="icon">🔔</span> Notifications <span className="badge">{unviewedCount}</span>
            </li>
            <li className={activeMenu === "profile" ? "active" : ""} onClick={() => setActiveMenu("profile")}>
              <span className="icon">👤</span> Profile
            </li>
            <li className={activeMenu === "help" ? "active" : ""} onClick={() => setActiveMenu("help")}>
              <span className="icon">❓</span> Help & Support
            </li>
          </ul>
        </div>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}><span className="icon">🚪</span> Logout</button>
          <div className="profile-tag">
            <div className="avatar-circle">{initials}</div>
            <div>
              <p className="profile-title">{studentName || "Student"}</p>
              <p className="profile-sub">{localStorage.getItem("group_name") || "Group 1"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button className="hamburger-btn" onClick={() => setIsMobileSidebarOpen(true)}>
              ☰
            </button>
            <div>
            <h1>{activeMenu === "dashboard" ? `Welcome back, ${studentName || "Student"} 👋` : activeMenu === "profile" ? "Your Profile" : activeMenu === "help" ? "Help & Support" : "Your Requests Log"}</h1>
            {activeMenu === "help" ? (
              <p className="help-subtitle">Find answers to common questions or contact our support team.</p>
            ) : (
              <p>Group: <span>{localStorage.getItem("group_name") || "Group 1"}</span></p>
            )}
          </div>
          </div>
          <button className="notif-bell" onClick={() => { setActiveMenu("notifications"); syncLogs(true); }}>
            🔔{unviewedCount > 0 && <span className="bell-dot"></span>}
          </button>
        </div>

        {activeMenu === "dashboard" && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon bg-blue">📅</div>
                <div>
                  <span className="stat-label">Total Requests</span>
                  <p className="stat-value">{counts.total}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-amber">⏳</div>
                <div>
                  <span className="stat-label">Pending</span>
                  <p className="stat-value text-amber">{counts.pending}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-emerald">✅</div>
                <div>
                  <span className="stat-label">Approved</span>
                  <p className="stat-value text-emerald">{counts.approved}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-rose">❌</div>
                <div>
                  <span className="stat-label">Rejected</span>
                  <p className="stat-value text-rose">{counts.rejected}</p>
                </div>
              </div>
            </div>

            <div className="single-column-workspace">
              <div className="form-card">
                <div className="card-header-title">
                  <span>{editingRequestId ? "✏️" : "📝"}</span>
                  <h2>{editingRequestId ? "Edit Permission Request" : "New Permission Request"}</h2>
                </div>
                <div className="form-fields">
                  <div className="input-block">
                    <label>Student ID</label>
                    <input type="text" value={studentId} disabled style={{ background: "#f3f4f6", cursor: "not-allowed" }} />
                  </div>
                  <div className="input-block">
                    <label>Student Name</label>
                    <input type="text" value={studentName} disabled style={{ background: "#f3f4f6", cursor: "not-allowed" }} />
                  </div>
                  <div className="input-block">
                    <label>Select Classes {editingRequestId ? "(Single Swap Mode)" : "(Multi-Select)"}</label>
                    <button type="button" className="matrix-trigger-btn" onClick={() => setIsMatrixOpen(true)}>
                      <span className={selectedSubjects.length > 0 ? "filled-text" : "placeholder-text"}>
                        {selectedSubjects.length > 0 ? `Selected: ${selectedSubjects.join(", ")}` : "Choose classes..."}
                      </span>
                      <span className="arrow-indicator">▶</span>
                    </button>
                  </div>
                  <div className="input-block">
                    <label>Reason</label>
                    <textarea placeholder="Enter reason for request" value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                  <div className="input-block">
                    <label>Date</label>
                    <input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
                  </div>
                  <div className="input-block">
                    <label>Upload Photo Proof(OPTIONAL)</label>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="file-uploader-input" />
                    {imagePreview && (
                      <div className="image-preview-box">
                        <img src={imagePreview} alt="Proof preview" />
                      </div>
                    )}
                  </div>
                  <div className="form-action-buttons">
                    <button className="submit-btn" onClick={handleSubmit}>
                      {editingRequestId ? "Save Changes ✨" : "Submit All Requests 🚀"}
                    </button>
                    {editingRequestId && (
                      <button className="cancel-edit-btn" onClick={resetForm}>Cancel Edit</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeMenu === "view-status" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="requests-section">
              <div className="section-header-row">
                <div className="card-header-title">
                  <span>🗂️</span>
                  <h2>Your Requests Logs</h2>
                </div>
                <button className="view-all-link" onClick={syncLogs}>🔄 Refresh Logs</button>
              </div>
              <div className="view-dashboard-bar">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input type="text" placeholder="Enter student ID to view dashboard logs..." value={searchDashboardId} onChange={(e) => setSearchDashboardId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && syncLogs()} />
                  <button className="search-fetch-btn" onClick={syncLogs}>View Logs</button>
                </div>
                <div className="filter-pill-container">
                  <button className={`filter-pill ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>All ({counts.total})</button>
                  <button className={`filter-pill pill-pending ${statusFilter === "pending" ? "active" : ""}`} onClick={() => setStatusFilter("pending")}>⏳ Pending ({counts.pending})</button>
                  <button className={`filter-pill pill-approved ${statusFilter === "approved" ? "active" : ""}`} onClick={() => setStatusFilter("approved")}>✅ Approved ({counts.approved})</button>
                  <button className={`filter-pill pill-rejected ${statusFilter === "rejected" ? "active" : ""}`} onClick={() => setStatusFilter("rejected")}>❌ Rejected ({counts.rejected})</button>
                </div>
              </div>
              <div className="accordion-list">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => {
                  const isDayOpen = activeDay === day;
                  const dayRequests = getRequestsForDay(day);
                  return (
                    <div key={day} className="accordion-item">
                      <button type="button" className="accordion-trigger" onClick={() => setActiveDay(isDayOpen ? "" : day)}>
                        <span>{day} Classes</span>
                        <span className="day-count-badge">{dayRequests.length} filed</span>
                        <span className={`accordion-arrow ${isDayOpen ? "rotated" : ""}`}>▲</span>
                      </button>
                      {isDayOpen && (
                        <div className="accordion-content">
                          {dayRequests.length > 0 ? (
                            dayRequests.map((request, idx) => (
                              <div key={idx} className="itemized-log-card">
                                <div className="log-details">
                                  <div className="log-row">🕒 <strong>{request.class_time}</strong></div>
                                  <div className="log-row">📖 Subject: <strong>{request.subject_name}</strong></div>
                                  <div className="log-row">📝 Reason: <em>{request.reason}</em></div>
                                  {request.proof_image_url && (
                                    <div className="attached-proof-thumbnail">
                                      <button
                                        className="proof-open-btn"
                                        onClick={() => {
                                          setProofLightboxUrl(request.proof_image_url);
                                          setProofLightboxMeta({ subject: request.subject_name, date: request.request_date?.split("T")[0], time: request.class_time });
                                        }}
                                      >
                                        🖼️ View Proof Photo
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="status-and-actions">
                                  <span className={`status-pill ${request.status?.toLowerCase() || "pending"}`}>{request.status || "Pending"}</span>
                                  {(request.status?.toLowerCase() === "pending") && (
                                    <button className="row-edit-action-btn" onClick={() => handleEditClick(request)}>✏️ Edit</button>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="empty-log-state">
                              <p>{day === "Thursday" || day === "Friday" ? "🎉 No classes!" : "No verification requests filed for this day."}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeMenu === "notifications" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="requests-section">
              <div className="section-header-row">
                <div className="card-header-title">
                  <span>🔔</span>
                  <h2>Your Notifications</h2>
                </div>
                {requests.filter(r => r.status_viewed === 0).length > 0 && (
                  <button className="notif-clear-btn" onClick={handleDeleteAllPending}>
                    🗑️ Clear All
                  </button>
                )}
              </div>

              {requests.filter(r => r.status_viewed === 0).length > 0 ? (
                <div className="notif-list">
                  {requests.filter(r => r.status_viewed === 0).map((req, idx) => {
                    const status = req.status?.toLowerCase();
                    const isAccepted = ["accepted", "accept", "approved"].includes(status);
                    const isRejected = ["rejected", "reject"].includes(status);
                    const type = isAccepted ? "accepted" : isRejected ? "rejected" : "pending";
                    const icons = { accepted: "✅", rejected: "❌", pending: "⏳" };
                    const labels = { accepted: "Accepted", rejected: "Rejected", pending: "Pending" };
                    return (
                      <div key={idx} className={`notif-card notif-${type}`}>
                        <div className={`notif-icon-badge notif-badge-${type}`}>
                          {icons[type]}
                        </div>
                        <div className="notif-body">
                          <div className="notif-top-row">
                            <span className="notif-subject">{req.subject_name}</span>
                            <span className={`notif-status-chip chip-${type}`}>{labels[type]}</span>
                          </div>
                          <p className="notif-description">
                            {isAccepted && "Your permission request has been approved by your lecturer."}
                            {isRejected && "Your permission request was not approved."}
                            {!isAccepted && !isRejected && "Your request is waiting for lecturer review."}
                          </p>
                          {isRejected && req.reject_reason && (
                            <div className="notif-reject-reason">
                              <span className="notif-reject-label">⚠️ Reason</span>
                              <p>{req.reject_reason}</p>
                            </div>
                          )}
                          <div className="notif-meta-row">
                            <span>📅 {req.request_date?.split("T")[0]}</span>
                            <span>🕒 {req.class_time}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="notif-empty">
                  <div className="notif-empty-icon">🔔</div>
                  <p className="notif-empty-title">You're all caught up!</p>
                  <p className="notif-empty-sub">No new notifications at this time.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeMenu === "profile" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="profile-container">
              {/* Hero banner card */}
              <div className="profile-header-card">
                <div className="profile-banner">
                  <div className="profile-banner-dots" />
                </div>
                <div className="profile-hero-body">
                  <div className="profile-avatar-large">{initials}</div>
                  <div className="profile-hero-text">
                    <h1 className="profile-display-name">{studentName}</h1>
                    <span className="student-badge">Student</span>
                  </div>
                </div>
                <div className="profile-stats-strip">
                  <div className="profile-stat-item">
                    <span className="profile-stat-num">{counts.total}</span>
                    <span className="profile-stat-label">Total</span>
                  </div>
                  <div className="profile-stat-item">
                    <span className="profile-stat-num amber">{requests.filter(r => r.status?.toLowerCase() === "pending").length}</span>
                    <span className="profile-stat-label">Pending</span>
                  </div>
                  <div className="profile-stat-item">
                    <span className="profile-stat-num green">{counts.approved}</span>
                    <span className="profile-stat-label">Approved</span>
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
                  <div className="info-row">
                    <span>Student Name</span> <strong>{studentName}</strong>
                  </div>
                  <div className="info-row">
                    <span>Student ID</span> <strong>{studentId}</strong>
                  </div>
                  <div className="info-row">
                    <span>Group</span> <strong>{localStorage.getItem("group_name") || "N/A"}</strong>
                  </div>
                </div>

                <div className="info-card">
                  <h3 className="info-card-title">Account Security</h3>
                  <div className="info-row">
                    <span>Password</span>
                    <span className="password-strength-pill">●●●●●●●● Strong</span>
                  </div>
                  <button className="password-change-btn" onClick={() => setIsPasswordModalOpen(true)}>
                    🔒 Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeMenu === "help" && (
          <div className="single-column-workspace" style={{ marginTop: "32px" }}>
            <div className="help-layout">
              <div className="help-main-column">
                <div className="help-card">
                  <div className="help-card-header">
                    <div className="card-header-title" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
                      <span>❓</span>
                      <h2>Frequently Asked Questions</h2>
                    </div>
                    <div className="faq-search-wrapper">
                      <span className="search-icon">🔍</span>
                      <input
                        type="text"
                        placeholder="Search FAQs..."
                        value={faqSearchTerm}
                        onChange={(e) => setFaqSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="faq-list">
                    {filteredFaqs.length > 0 ? (
                      filteredFaqs.map((faq) => {
                        const isOpen = openFaqId === faq.id;
                        return (
                          <div key={faq.id} className="faq-item">
                            <button type="button" className="faq-question" onClick={() => setOpenFaqId(isOpen ? null : faq.id)}>
                              <span>{faq.question}</span>
                              <span className={`faq-chevron ${isOpen ? "open" : ""}`}>▾</span>
                            </button>
                            {isOpen && (
                              <div className="faq-answer">
                                <p>{faq.answer}</p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty-log-state"><p>No FAQs match your search.</p></div>
                    )}
                  </div>
                </div>

                <div className="help-contact-grid">
                  <div className="contact-card">
                    <div className="contact-card-header">
                      <div className="contact-icon bg-blue">✉️</div>
                      <div>
                        <h3>Contact Lecturer</h3>
                        <p>Get in touch with your lecturer for academic support.</p>
                      </div>
                    </div>
                    <div className="contact-action-row" onClick={() => showToast("Opening your email client...", "#2563eb")}>
                      <span className="contact-action-icon">📧</span>
                      <div>
                        <strong>Email Lecturer</strong>
                        <p>Send an email to your lecturer</p>
                      </div>
                      <span className="contact-action-arrow">›</span>
                    </div>
                    <div className="contact-action-row" onClick={() => showToast("Opening message portal...", "#2563eb")}>
                      <span className="contact-action-icon">💬</span>
                      <div>
                        <strong>Message Lecturer</strong>
                        <p>Send a message via the portal</p>
                      </div>
                      <span className="contact-action-arrow">›</span>
                    </div>
                  </div>

                  <div className="contact-card">
                    <div className="contact-card-header">
                      <div className="contact-icon bg-emerald">🛡️</div>
                      <div>
                        <h3>Contact Admin</h3>
                        <p>Need help with administrative or general enquiries?</p>
                      </div>
                    </div>
                    <div className="contact-ticket-row">
                      <span className="contact-action-icon">🎫</span>
                      <div>
                        <strong>Submit a Support Ticket</strong>
                        <p>Our admin team will assist you as soon as possible.</p>
                      </div>
                      <button className="create-ticket-btn" onClick={() => showToast("Support ticket submitted!", "#059669")}>Create Ticket</button>
                    </div>
                  </div>
                </div>

                <div className="quick-help-section">
                  <h3 className="quick-help-title">Quick Help</h3>
                  <div className="quick-help-grid">
                    {quickHelpItems.map((item) => (
                      <div key={item.title} className="quick-help-card">
                        <div className={`quick-help-icon ${item.bg}`}>{item.icon}</div>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.desc}</p>
                        </div>
                        <span className="quick-help-arrow">›</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="help-sidebar-column">
                <div className="help-side-card">
                  <h4 className="help-side-title">Support Status</h4>
                  <div className="status-line">
                    <span className="status-dot"></span>
                    <strong>All Systems Operational</strong>
                  </div>
                  <p className="help-side-note">All services are running smoothly.</p>
                  <p className="help-side-meta">Last updated: Today, 9:15 AM</p>
                </div>

                <div className="help-side-card contact-support-card">
                  <div className="contact-support-icon">🎧</div>
                  <strong>Still need help?</strong>
                  <p>Our support team is here to assist you.</p>
                  <button className="contact-support-btn" onClick={() => showToast("Connecting you to support...", "#2563eb")}>Contact Support</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {isLogoutOpen && (
        <div className="lo-overlay" onClick={() => setIsLogoutOpen(false)}>
          <div className="lo-card" onClick={e => e.stopPropagation()}>
            <div className="lo-icon">🚪</div>
            <h3 className="lo-title">Log out?</h3>
            <p className="lo-sub">You'll need to sign in again to access your dashboard.</p>
            <div className="lo-actions">
              <button className="lo-stay" onClick={() => setIsLogoutOpen(false)}>Stay Logged In</button>
              <button className="lo-confirm" onClick={confirmLogout}>Log Out</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Notifications Confirmation Modal */}
      {isClearAllOpen && (
        <div className="lo-overlay" onClick={() => setIsClearAllOpen(false)}>
          <div className="lo-card" onClick={e => e.stopPropagation()}>
            <div className="lo-icon" style={{ background: "#eff6ff" }}>🗑️</div>
            <h3 className="lo-title">Clear all notifications?</h3>
            <p className="lo-sub">This will mark all current notifications as read. You can't undo this.</p>
            <div className="lo-actions">
              <button className="lo-stay" onClick={() => setIsClearAllOpen(false)}>Cancel</button>
              <button className="lo-confirm" onClick={confirmClearAll}>Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Photo Lightbox */}
      {proofLightboxUrl && (
        <div className="proof-lightbox-overlay" onClick={() => setProofLightboxUrl(null)}>
          <div className="proof-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <button className="proof-lightbox-close" onClick={() => setProofLightboxUrl(null)}>✕</button>
            <div className="proof-lightbox-img-area">
              <img src={`http://localhost:5000${proofLightboxUrl}`} alt="Proof" />
            </div>
            <div className="proof-lightbox-body">
              <h3 className="proof-lightbox-title">{proofLightboxMeta?.subject} — Proof</h3>
              <div className="proof-lightbox-meta">
                <span className="proof-lightbox-chip">📎 Submitted Proof</span>
                <span className="proof-lightbox-date">📅 {proofLightboxMeta?.date} · {proofLightboxMeta?.time}</span>
              </div>
              <a
                href={`http://localhost:5000${proofLightboxUrl}`}
                target="_blank"
                rel="noreferrer"
                className="proof-lightbox-download"
              >
                ↗ Open full image in new tab
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modern Password Modal */}
      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Change Password</h3>
            <input type="password" placeholder="Enter new password" onChange={(e) => setNewPassword(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setIsPasswordModalOpen(false)}>Cancel</button>
              <button className="btn-update" onClick={handleActualPasswordUpdate}>Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Class Selection Matrix */}
      {isMatrixOpen && (
        <div className="modal-overlay">
          <div className="modal-window">
            <div className="modal-header">
              <div>
                <h3>Select Class Matrix</h3>
                <p>You can check multiple classes across different days before hitting Done!</p>
              </div>
              <button className="close-modal-btn" onClick={() => setIsMatrixOpen(false)}>✕</button>
            </div>
            <div className="modal-grid-container">
              <div className="matrix-columns-grid">
                {Object.keys(matrixClasses).map((day) => (
                  <div key={day} className="matrix-day-column">
                    <h4 className="column-day-title">{day}</h4>
                    <div className="column-cards-list">
                      {matrixClasses[day].map((cls, idx) => {
                        if (cls.isLazy) {
                          return (
                            <div key={idx} className="lazy-day-card">
                              <span>No Classes</span>
                              <small>Free Day</small>
                            </div>
                          );
                        }
                        const isSelected = selectedSubjects.includes(cls.subject);
                        return (
                          <div key={cls.id || idx} onClick={() => handleSelectFromMatrix(cls)} className={`matrix-class-card ${isSelected ? "selected" : ""} ${cls.isSeminar ? "seminar" : ""}`} style={{ backgroundColor: isSelected ? "#e0f2fe" : "", borderColor: isSelected ? "#2563eb" : "" }}>
                            <div className="card-top-info">
                              <span className="class-time-text" style={{ color: isSelected ? "#1e3a8a" : "" }}>{cls.time}</span>
                              <div className="custom-checkbox-circle">{isSelected && <span className="checkbox-check">✓</span>}</div>
                            </div>
                            <p className="class-teacher-text" style={{ color: isSelected ? "#1e3a8a" : "" }}>by teacher {cls.teacher}</p>
                            <div className="card-bottom-subject"><span style={{ color: isSelected ? "#1d4ed8" : "" }}>{cls.subject}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-done-btn" onClick={() => setIsMatrixOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;