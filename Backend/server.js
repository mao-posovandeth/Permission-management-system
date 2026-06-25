import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";
import transporter from "./mailer.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_URL = "http://localhost:5173";

// Multer config — saves uploaded proof photos to /uploads on disk
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

app.use(cors());
app.use(express.json());

// Serve uploaded photos as static files so the lecturer can view them
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("Backend Running");
});

// LOGIN ROUTE
app.post("/login", (req, res) => {
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

    res.json({
      message: "Login Success",
      user_id: result[0].user_id,
      name: result[0].name,
      role: result[0].role,
      group_name: result[0].group_name || "Unassigned",
    });
  });
});

// FORGOT PASSWORD ROUTE
app.post("/forgot-password", (req, res) => {
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
          from: process.env.GMAIL_USER,
          to: email,
          subject: "Reset your password — Permission Request",
          html: `<p>Hi ${userName},</p>
            <p>We received a request to reset your password. Click the link below to choose a new one:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
        },
        (mailErr) => {
          if (mailErr) {
            console.log("Email send error:", mailErr);
            return res.status(500).json({ message: "Failed to send reset email. Please try again." });
          }
          res.json({ message: "A password reset link has been sent to your email." });
        }
      );
    });
  });
});

// RESET PASSWORD ROUTE
app.post("/reset-password", (req, res) => {
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

// SUBJECTS ROUTE
app.get("/subjects", (req, res) => {
  db.query("SELECT * FROM subjects", (err, result) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json(result);
  });
});

// REQUEST SUBMISSION — now accepts multipart/form-data so the student can attach a proof photo
app.post("/request", upload.single("proof_image"), (req, res) => {
  const {
    student_id, student_name, group_name,
    reason, request_date, subject_name, class_time,
  } = req.body;

  // If a file was uploaded, store its URL path; otherwise null
  const proof_image_url = req.file ? `/uploads/${req.file.filename}` : null;

  const sql = `
    INSERT INTO requests
      (student_id, student_name, group_name, reason, request_date,
       subject_name, class_time, status, status_viewed, proof_image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    student_id, student_name, group_name, reason, request_date,
    subject_name, class_time, "Pending", 0, proof_image_url,
  ], (err) => {
    if (err) { console.log("Database Error:", err); return res.status(500).json("Database Error"); }
    res.json("Request Submitted Successfully");
  });
});

// UPDATE REQUEST (student editing a pending request)
app.put("/request/:id", upload.single("proof_image"), (req, res) => {
  const { reason, request_date, subject_name, class_time } = req.body;
  const proof_image_url = req.file ? `/uploads/${req.file.filename}` : null;

  let sql, params;
  if (proof_image_url) {
    sql = "UPDATE requests SET reason=?, request_date=?, subject_name=?, class_time=?, proof_image_url=? WHERE request_id=?";
    params = [reason, request_date, subject_name, class_time, proof_image_url, req.params.id];
  } else {
    sql = "UPDATE requests SET reason=?, request_date=?, subject_name=?, class_time=? WHERE request_id=?";
    params = [reason, request_date, subject_name, class_time, req.params.id];
  }

  db.query(sql, params, (err) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json("Request Updated Successfully");
  });
});

// GET ALL REQUESTS (lecturer view)
app.get("/requests", (req, res) => {
  db.query("SELECT * FROM requests ORDER BY created_at DESC", (err, result) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json(result);
  });
});

// UPDATE STATUS — now also accepts an optional reject_reason from the lecturer
app.put("/request-status", (req, res) => {
  const { id, status, reject_reason } = req.body;
  const sql = "UPDATE requests SET status = ?, reject_reason = ? WHERE request_id = ?";

  db.query(sql, [status, reject_reason || null, id], (err) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json("Status Updated Successfully");
  });
});

// GET STUDENT REQUESTS
app.get("/student-requests/:studentId", (req, res) => {
  db.query("SELECT * FROM requests WHERE student_id = ?", [req.params.studentId], (err, result) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json(result);
  });
});

// DELETE REQUEST
app.delete("/delete-request/:id", (req, res) => {
  db.query("DELETE FROM requests WHERE request_id = ?", [req.params.id], (err, result) => {
    if (err) { console.log("Delete Error:", err); return res.status(500).json("Delete Failed"); }
    if (result.affectedRows === 0) return res.status(404).json("Request Not Found");
    res.json("Request Deleted Successfully");
  });
});

// MARK NOTIFICATIONS VIEWED
app.put("/requests/mark-viewed/:studentId", (req, res) => {
  db.query(
    "UPDATE requests SET status_viewed = 1 WHERE student_id = ? AND status IN ('Accepted', 'Rejected')",
    [req.params.studentId],
    (err) => {
      if (err) { console.log("Update Error:", err); return res.status(500).json("Database Error"); }
      res.json({ message: "Cleared all pending" });
    }
  );
});

// UPDATE PASSWORD (from student profile page)
app.put("/update-password/:studentId", (req, res) => {
  const { password } = req.body;
  db.query("UPDATE users SET password = ? WHERE user_id = ?", [password, req.params.studentId], (err) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json({ message: "Password updated" });
  });
});

/* ==========================================================================
   ADMIN — MANAGE USERS
   Your groups are normalized: users <-> student_groups <-> groups_table.
   These endpoints read/write group_name through that link, just like /login.
   ========================================================================== */

// GET ALL USERS (with their group name if they're a student)
app.get("/users", (req, res) => {
  const sql = `
    SELECT u.user_id, u.name, u.email, u.role, g.group_name
    FROM users u
    LEFT JOIN student_groups sg ON u.user_id = sg.student_id
    LEFT JOIN groups_table g ON sg.group_id = g.group_id
    ORDER BY u.user_id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Failed to fetch users" }); }
    res.json(results);
  });
});

// ADD NEW USER (and link to a group if they're a student)
app.post("/users", (req, res) => {
  const { user_id, name, email, password, role, group_name } = req.body;
  if (!user_id || !name || !email || !password || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const insertUser = "INSERT INTO users (user_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)";
  db.query(insertUser, [user_id, name, email, password, role], (err) => {
    if (err) {
      console.log(err);
      if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "User ID or email already exists" });
      return res.status(500).json({ message: "Failed to create user" });
    }

    // Only students get linked to a group
    if (role.toLowerCase() === "student" && group_name) {
      const findGroup = "SELECT group_id FROM groups_table WHERE group_name = ?";
      db.query(findGroup, [group_name], (gErr, gRes) => {
        if (gErr) { console.log(gErr); return res.json({ message: "User created (group link failed)" }); }
        if (gRes.length === 0) return res.json({ message: "User created (group not found)" });

        const link = "INSERT INTO student_groups (student_id, group_id) VALUES (?, ?)";
        db.query(link, [user_id, gRes[0].group_id], (lErr) => {
          if (lErr) console.log(lErr);
          res.json({ message: "User created" });
        });
      });
    } else {
      res.json({ message: "User created" });
    }
  });
});

// EDIT USER (optionally change password, and re-link group for students)
app.put("/users/:id", (req, res) => {
  const { id } = req.params;
  const { name, email, password, role, group_name } = req.body;

  // Build the user update — skip password if left blank so it stays unchanged
  let sql, params;
  if (password && password.trim() !== "") {
    sql = "UPDATE users SET name=?, email=?, password=?, role=? WHERE user_id=?";
    params = [name, email, password, role, id];
  } else {
    sql = "UPDATE users SET name=?, email=?, role=? WHERE user_id=?";
    params = [name, email, role, id];
  }

  db.query(sql, params, (err) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Failed to update user" }); }

    // Re-link group only for students
    if (role && role.toLowerCase() === "student" && group_name) {
      const findGroup = "SELECT group_id FROM groups_table WHERE group_name = ?";
      db.query(findGroup, [group_name], (gErr, gRes) => {
        if (gErr || gRes.length === 0) return res.json({ message: "User updated" });
        const groupId = gRes[0].group_id;

        // Remove old mapping, then insert the new one
        db.query("DELETE FROM student_groups WHERE student_id=?", [id], () => {
          db.query("INSERT INTO student_groups (student_id, group_id) VALUES (?, ?)", [id, groupId], (lErr) => {
            if (lErr) console.log(lErr);
            res.json({ message: "User updated" });
          });
        });
      });
    } else {
      // If they're no longer a student, clear any group mapping
      db.query("DELETE FROM student_groups WHERE student_id=?", [id], () => {
        res.json({ message: "User updated" });
      });
    }
  });
});

// DELETE USER (clean up their group mapping first)
app.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM student_groups WHERE student_id=?", [id], () => {
    db.query("DELETE FROM users WHERE user_id=?", [id], (err, result) => {
      if (err) { console.log(err); return res.status(500).json({ message: "Failed to delete user" }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });
      res.json({ message: "User deleted" });
    });
  });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});