import express from "express";
import db from "../db.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

/* ==========================================================================
   ADMIN — MANAGE USERS
   Your groups are normalized: users <-> student_groups <-> groups_table.
   These endpoints read/write group_name through that link, just like /login.
   ========================================================================== */

// GET ALL USERS (with their group name if they're a student)
router.get("/users", authenticateToken, requireRole("admin"), (req, res) => {
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
router.post("/users", authenticateToken, requireRole("admin"), (req, res) => {
  const { user_id, name, email, password, role, group_name, assignments } = req.body;
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
    } else if (role.toLowerCase() === "lecturer" && Array.isArray(assignments) && assignments.length > 0) {
      // Save what a lecturer teaches so their dashboard filters correctly
      const values = assignments
        .filter(a => a && a.subject_name && a.group_name)
        .map(a => [user_id, a.subject_name, a.group_name]);
      if (values.length === 0) return res.json({ message: "User created" });
      db.query("INSERT INTO lecturer_assignments (lecturer_id, subject_name, group_name) VALUES ?", [values], (aErr) => {
        if (aErr) console.log(aErr);
        res.json({ message: "User created" });
      });
    } else {
      res.json({ message: "User created" });
    }
  });
});

// EDIT USER (optionally change password, and re-link group for students)
router.put("/users/:id", authenticateToken, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const { name, email, password, role, group_name, assignments } = req.body;

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
    } else if (role && role.toLowerCase() === "lecturer") {
      // Replace assignments: wipe old ones, insert new (only if any were provided)
      db.query("DELETE FROM lecturer_assignments WHERE lecturer_id=?", [id], () => {
        if (!Array.isArray(assignments) || assignments.length === 0) {
          return res.json({ message: "User updated" });
        }
        const values = assignments
          .filter(a => a && a.subject_name && a.group_name)
          .map(a => [id, a.subject_name, a.group_name]);
        if (values.length === 0) return res.json({ message: "User updated" });
        db.query("INSERT INTO lecturer_assignments (lecturer_id, subject_name, group_name) VALUES ?", [values], (aErr) => {
          if (aErr) console.log(aErr);
          res.json({ message: "User updated" });
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
router.delete("/users/:id", authenticateToken, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM student_groups WHERE student_id=?", [id], () => {
    db.query("DELETE FROM users WHERE user_id=?", [id], (err, result) => {
      if (err) { console.log(err); return res.status(500).json({ message: "Failed to delete user" }); }
      if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });
      res.json({ message: "User deleted" });
    });
  });
});

// Fetch a lecturer's assignments so admin's Edit form can preload them
router.get("/users/:id/assignments", authenticateToken, requireRole("admin"), (req, res) => {
  db.query("SELECT subject_name, group_name FROM lecturer_assignments WHERE lecturer_id = ?", [req.params.id], (err, rows) => {
    if (err) { console.log(err); return res.status(500).json([]); }
    res.json(rows);
  });
});

// ============================================================
//  LECTURER ASSIGNMENTS — which (subject + group) pairs a lecturer teaches
//  The lecturer dashboard uses this to show only their own requests.
// ============================================================
router.get("/lecturer-assignments/:lecturerId", (req, res) => {
  const sql = "SELECT subject_name, group_name FROM lecturer_assignments WHERE lecturer_id = ?";
  db.query(sql, [req.params.lecturerId], (err, results) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Failed to fetch assignments" }); }
    res.json(results);
  });
});

export default router;
