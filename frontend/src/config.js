import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Attaches the JWT issued at login so role-gated routes (see authenticateToken
// + requireRole in Backend/server.js) can verify who's calling. The token's
// signature is checked server-side, so the client can't forge a role by
// editing localStorage the way a plain x-user-id header could be spoofed.
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});
