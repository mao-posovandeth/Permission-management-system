import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import db from "../db.js";
import transporter from "../mailer.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../middleware/auth.js";

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// LOGIN ROUTE
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = `
    SELECT u.user_id, u.name, u.email, u.password, u.role, g.group_name
    FROM users u
    LEFT JOIN student_groups sg ON u.user_id = sg.student_id
    LEFT JOIN groups_table g ON sg.group_id = g.group_id
    WHERE u.email = ?
  `;

  db.query(sql, [email], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json("Database Error");
    }
    if (result.length === 0) return res.status(401).json("Email not found");
    if (result[0].password !== password) return res.status(401).json("Wrong Password");

    const token = jwt.sign(
      { user_id: result[0].user_id, role: result[0].role, name: result[0].name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: "Login Success",
      token,
      user_id: result[0].user_id,
      name: result[0].name,
      role: result[0].role,
      group_name: result[0].group_name || "Unassigned",
    });
  });
});

// FORGOT PASSWORD ROUTE
router.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  const sql = "SELECT user_id, name FROM users WHERE email = ?";
  db.query(sql, [email], (err, result) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Database error." }); }
    if (result.length === 0) return res.status(404).json({ message: "No account found with that email." });

    const userId = result[0].user_id;
    const userName = result[0].name;
    const token = crypto.randomBytes(32).toString("hex");

    const insertSql = `INSERT INTO password_resets (user_id, token, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`;

    db.query(insertSql, [userId, token], (insertErr) => {
      if (insertErr) { console.log(insertErr); return res.status(500).json({ message: "Database error." }); }

      const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
      transporter.sendMail(
        {
          from: "onboarding@resend.dev",
          to: email,
          subject: "Reset your password — Permission Request",
          html: `<p>Hi ${userName},</p>
            <p>We received a request to reset your password. Click the link below to choose a new one:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
        }
      ).then(() => {
          res.json({ message: "A password reset link has been sent to your email." });
        }).catch((mailErr) => {
          console.log("Email send error:", mailErr);
          return res.status(500).json({ message: "Failed to send reset email. Please try again." });
        }
      );
    });
  });
});

// RESET PASSWORD ROUTE
router.post("/reset-password", (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: "Token and new password are required." });

  db.query("SELECT reset_id, user_id, used, expires_at FROM password_resets WHERE token = ?", [token], (err, result) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Database error." }); }
    if (result.length === 0) return res.status(400).json({ message: "Invalid reset link. Please request a new one." });

    const reset = result[0];
    if (reset.used) return res.status(400).json({ message: "This reset link has already been used." });
    if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ message: "This reset link has expired." });

    db.query("UPDATE users SET password = ? WHERE user_id = ?", [newPassword, reset.user_id], (updateErr) => {
      if (updateErr) { console.log(updateErr); return res.status(500).json({ message: "Database error." }); }
      db.query("UPDATE password_resets SET used = 1 WHERE reset_id = ?", [reset.reset_id], (markErr) => {
        if (markErr) console.log("Failed to mark token used:", markErr);
        res.json({ message: "Password updated successfully. You can now sign in." });
      });
    });
  });
});

export default router;
