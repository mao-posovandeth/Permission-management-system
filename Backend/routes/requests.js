import express from "express";
import db from "../db.js";
import upload from "../middleware/upload.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { notifyLecturer, renotifyLecturer } from "../telegram-bot.js";

const router = express.Router();

// SUBJECTS ROUTE
router.get("/subjects", (req, res) => {
  db.query("SELECT * FROM subjects", (err, result) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json(result);
  });
});

// REQUEST SUBMISSION — now accepts multipart/form-data so the student can attach a proof photo
router.post("/request", upload.single("proof_image"), (req, res) => {
  const {
    student_id, student_name, group_name,
    reason, request_date, subject_name, class_time, term,
  } = req.body;

  // If a file was uploaded, store its URL path; otherwise null
  const proof_image_url = req.file ? `/uploads/${req.file.filename}` : null;

  const sql = `
    INSERT INTO requests
      (student_id, student_name, group_name, reason, request_date,
       subject_name, class_time, status, status_viewed, proof_image_url, term)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    student_id, student_name, group_name, reason, request_date,
    subject_name, class_time, "Pending", 0, proof_image_url, term || "Term 1",
  ], (err, result) => {
    if (err) { console.log("Database Error:", err); return res.status(500).json("Database Error"); }
    // Fire Telegram notification to the assigned lecturer(s) — don't block the response
    notifyLecturer(db, {
      request_id: result.insertId,
      student_name, group_name, subject_name, class_time,
      request_date, reason, proof_image_url, term: term || "Term 1",
    });
    res.json("Request Submitted Successfully");
  });
});

// UPDATE REQUEST (student editing a pending request)
router.put("/request/:id", upload.single("proof_image"), (req, res) => {
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

    // Re-notify the lecturer on Telegram: delete the old message(s) and send a fresh one
    db.query("SELECT * FROM requests WHERE request_id = ?", [req.params.id], (selErr, rows) => {
      if (selErr || !rows.length) return;
      renotifyLecturer(db, rows[0]);
    });
  });
});

// GET ALL REQUESTS (lecturer view)
router.get("/requests", authenticateToken, requireRole("lecturer", "admin"), (req, res) => {
  db.query("SELECT * FROM requests ORDER BY created_at DESC", (err, result) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json(result);
  });
});

// UPDATE STATUS — now also accepts an optional reject_reason from the lecturer
router.put("/request-status", authenticateToken, requireRole("lecturer", "admin"), (req, res) => {
  const { id, status, reject_reason } = req.body;
  const sql = "UPDATE requests SET status = ?, reject_reason = ? WHERE request_id = ?";

  db.query(sql, [status, reject_reason || null, id], (err) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json("Status Updated Successfully");
  });
});

// GET STUDENT REQUESTS
router.get("/student-requests/:studentId", (req, res) => {
  db.query("SELECT * FROM requests WHERE student_id = ?", [req.params.studentId], (err, result) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json(result);
  });
});

// DELETE REQUEST
router.delete("/delete-request/:id", authenticateToken, requireRole("admin"), (req, res) => {
  db.query("DELETE FROM requests WHERE request_id = ?", [req.params.id], (err, result) => {
    if (err) { console.log("Delete Error:", err); return res.status(500).json("Delete Failed"); }
    if (result.affectedRows === 0) return res.status(404).json("Request Not Found");
    res.json("Request Deleted Successfully");
  });
});

// MARK NOTIFICATIONS VIEWED
router.put("/requests/mark-viewed/:studentId", (req, res) => {
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
router.put("/update-password/:studentId", (req, res) => {
  const { password } = req.body;
  db.query("UPDATE users SET password = ? WHERE user_id = ?", [password, req.params.studentId], (err) => {
    if (err) { console.log(err); return res.status(500).json("Database Error"); }
    res.json({ message: "Password updated" });
  });
});

export default router;
