// ResetPassword.jsx
// Place this in your src/pages/ folder
// Add this route in your App.jsx:  <Route path="/reset-password" element={<ResetPassword />} />

import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/ResetPassword.css";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState(null); // "success" | "error"
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!newPassword || !confirm) {
      setStatus("error");
      setMessage("Please fill in both fields.");
      return;
    }
    if (newPassword !== confirm) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }
    if (!token) {
      setStatus("error");
      setMessage("Invalid reset link. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/reset-password", {
        token,
        newPassword,
      });
      setStatus("success");
      setMessage(res.data.message);
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp-container">
      <div className="rp-card">
        <span className="rp-eyebrow">PERMISSION REQUEST</span>
        <h2 className="rp-title">Set new password.</h2>
        <span className="rp-subtitle">Choose a new password for your account.</span>

        <div className="rp-input-group">
          <label>NEW PASSWORD</label>
          <div className="rp-input-wrap">
            <input
              type={showNew ? "text" : "password"}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReset()}
            />
            <button
              type="button"
              className="rp-toggle"
              onClick={() => setShowNew((v) => !v)}
            >
              {showNew ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        <div className="rp-input-group">
          <label>CONFIRM PASSWORD</label>
          <div className="rp-input-wrap">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReset()}
            />
            <button
              type="button"
              className="rp-toggle"
              onClick={() => setShowConfirm((v) => !v)}
            >
              {showConfirm ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        {message && (
          <div className={`rp-message ${status}`}>
            {status === "success" ? "✓" : "✕"} {message}
            {status === "success" && (
              <span className="rp-redirect"> Redirecting to login…</span>
            )}
          </div>
        )}

        <button
          type="button"
          className="rp-btn"
          onClick={handleReset}
          disabled={loading}
        >
          {loading ? "UPDATING…" : "UPDATE PASSWORD"}
        </button>

        <button
          type="button"
          className="rp-back"
          onClick={() => navigate("/")}
        >
          ← Back to login
        </button>
      </div>
    </div>
  );
}

export default ResetPassword;