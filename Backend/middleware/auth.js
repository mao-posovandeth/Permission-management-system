import jwt from "jsonwebtoken";

// ============================================================
//  ACCESS CONTROL — JWT authentication + role-gated routes
//  /login issues a signed JWT (user_id, role, name) on success. The client
//  sends it back as `Authorization: Bearer <token>` (attached once by
//  frontend/src/config.js). authenticateToken verifies the signature and
//  expiry and attaches the decoded, trustworthy identity to req.user —
//  requireRole then only has to check req.user.role, since it was already
//  cryptographically verified rather than re-trusted from a client header.
// ============================================================
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = "8h";

export function authenticateToken(req, res, next) {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing or invalid Authorization header" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    req.user = decoded; // { user_id, role, name }
    next();
  });
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}
