import express from "express";
import db from "../db.js";
import { handleWebhook, linkForLecturer, BOT_USERNAME } from "../telegram-bot.js";

const router = express.Router();

// ============================================================
//  TELEGRAM
// ============================================================
// Endpoint Telegram calls when the lecturer taps Accept/Reject or sends /start
router.post("/telegram/webhook", (req, res) => {
  handleWebhook(db, req.body, res);
});

// Admin/lecturer can look up their linking URL to open in Telegram
router.get("/telegram/link/:lecturerId", (req, res) => {
  res.json({ url: linkForLecturer(req.params.lecturerId), bot_username: BOT_USERNAME });
});

export default router;
