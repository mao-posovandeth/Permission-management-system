import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "../styles/Login.css";

const GRID_COLS = 12;
const GRID_ROWS = 4;
const WAVE_LENGTH = GRID_COLS + GRID_ROWS + 1; // just past the farthest corner so the sweep never goes fully dark before wrapping

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const navigate = useNavigate();

  // Forgot password modal state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState(null); // "success" | "error" | null
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    setLoginError("");
    if (!email || !password) {
      setLoginError("Please fill all fields.");
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/login`, {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user_id", res.data.user_id);
      localStorage.setItem("student_name", res.data.name);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("group_name", res.data.group_name);

      const role = res.data.role.trim().toLowerCase();

      if (role === "student") {
        navigate("/student-dashboard");
      } else if (role === "lecturer") {
        navigate("/lecturer-dashboard");
      } else if (role === "admin") {
        navigate("/admin-dashboard");
      } else {
        setLoginError("Unknown role: " + role);
      }
    } catch (err) {
      console.log(err);
      setLoginError("Invalid email or password.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  const openForgotModal = () => {
    setForgotEmail(email); // prefill with whatever they already typed into the login email field
    setForgotStatus(null);
    setForgotMessage("");
    setIsForgotOpen(true);
  };

  const closeForgotModal = () => {
    setIsForgotOpen(false);
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail) {
      setForgotStatus("error");
      setForgotMessage("Please enter your email.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/forgot-password`, {
        email: forgotEmail,
      });
      setForgotStatus("success");
      setForgotMessage(res.data.message);
    } catch (err) {
      setForgotStatus("error");
      setForgotMessage(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotKeyDown = (e) => {
    if (e.key === "Enter") {
      handleForgotSubmit();
    }
  };

  return (
    <div className="login-container">
      <div className="left-panel">
        <div className="brand">
          <h1>
            Permission
            <br />
            Request
            <span className="accent">.</span>
          </h1>
          <p>
            Smart permission management for students, lecturers, and
            administrators.
          </p>
          <div className="features">
            <div className="feature-item">
              <span className="feature-dot"></span>
              <p>Student request tracking</p>
            </div>
            <div className="feature-item">
              <span className="feature-dot"></span>
              <p>Fast lecturer approvals</p>
            </div>
            <div className="feature-item">
              <span className="feature-dot"></span>
              <p>Modern admin dashboard</p>
            </div>
          </div>
        </div>

        <AccessGrid />
      </div>

      <div className="right-panel">
        <div className="login-card">
          <span className="eyebrow">PERMISSION REQUEST</span>
          <h2>Sign in.</h2>
          <span className="subtitle">Enter your credentials to continue.</span>

          <div className="input-group">
            <label>EMAIL</label>
            <input
              type="email"
              placeholder="admin@test.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="input-group">
            <label>PASSWORD</label>
            <div className="input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <div className="helper-row">
            <button type="button" className="forgot-link-btn" onClick={openForgotModal}>
              Forgot password?
            </button>
          </div>

          {loginError && (
            <div className="forgot-message error">✕ {loginError}</div>
          )}

          <button type="button" className="login-btn" onClick={handleLogin}>
            SIGN IN
          </button>
        </div>
      </div>

      {isForgotOpen && (
        <div className="forgot-overlay" onClick={closeForgotModal}>
          <div className="forgot-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="forgot-close-btn"
              onClick={closeForgotModal}
              aria-label="Close"
            >
              ✕
            </button>

            <span className="eyebrow">PERMISSION REQUEST</span>
            <h2>Reset password.</h2>
            <span className="subtitle">
              Enter your email and we'll send you a link to reset your password.
            </span>

            <div className="input-group">
              <label>EMAIL</label>
              <input
                type="email"
                placeholder="admin@test.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                onKeyDown={handleForgotKeyDown}
                autoFocus
              />
            </div>

            {forgotMessage && (
              <div className={`forgot-message ${forgotStatus}`}>
                {forgotStatus === "success" ? "✓" : "✕"} {forgotMessage}
              </div>
            )}

            <button
              type="button"
              className="login-btn"
              onClick={handleForgotSubmit}
              disabled={forgotLoading}
            >
              {forgotLoading ? "SENDING…" : "SEND RESET LINK"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Access grid signature: nodes light up in a diagonal sweep, like
// permissions clearing one tile at a time. Pure CSS-class toggling
// driven by a single requestAnimationFrame-style interval, no DOM
// node creation/removal so React stays in control of the markup.
function AccessGrid() {
  const totalNodes = GRID_COLS * GRID_ROWS;
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setFrame((f) => (f + 1) % WAVE_LENGTH);
    }, 90);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="access-grid-wrap">
      <div className="grid-label">ACCESS GRANTED — VERIFYING</div>
      <div className="access-grid">
        {Array.from({ length: totalNodes }).map((_, i) => {
          const row = Math.floor(i / GRID_COLS);
          const col = i % GRID_COLS;
          const wavePos = row + col;
          const distance = Math.abs(frame - wavePos);
          const lit = distance < 3;
          return <div key={i} className={`node ${lit ? "lit" : ""}`} />;
        })}
      </div>
    </div>
  );
}

export default Login;