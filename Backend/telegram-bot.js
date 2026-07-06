// ============================================================
//  TELEGRAM BOT
//  - Sends notifications to lecturers when a student submits a request
//  - Handles Accept/Reject taps from inside Telegram
//
//  BEFORE USING:
//    1. Replace TELEGRAM_BOT_TOKEN with the token from @BotFather
//    2. Replace PUBLIC_BASE_URL with your ngrok URL (or deployed URL)
//    3. Run once (with ngrok running):  node set-telegram-webhook.js
// ============================================================

// >>> These come from your .env file (never commit .env to GitHub) <<<
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PUBLIC_BASE_URL = process.env.TELEGRAM_PUBLIC_URL;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

const API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Tracks lecturers who tapped Reject and are waiting to type a reason.
// Key: chat_id (Telegram user), Value: { request_id, message_id, expires }
const pendingRejects = new Map();
const REJECT_TIMEOUT_MS = 5 * 60 * 1000; // 5 min to type a reason

// -------- Helpers -----------------------------------------------------------
async function tgCall(method, body) {
  try {
    const res = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.log("Telegram API error:", err.message);
    return { ok: false };
  }
}

function linkForLecturer(lecturerId) {
  return `https://t.me/${BOT_USERNAME}?start=LEC${lecturerId}`;
}

// -------- Public API --------------------------------------------------------

// Called once at startup to register your webhook with Telegram
async function setWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("Telegram: no TELEGRAM_BOT_TOKEN in .env — bot is disabled.");
    return;
  }
  if (!PUBLIC_BASE_URL) {
    console.log("Telegram: no TELEGRAM_PUBLIC_URL in .env — bot is disabled.");
    return;
  }
  const url = `${PUBLIC_BASE_URL}/telegram/webhook`;
  const res = await tgCall("setWebhook", { url });
  console.log("Telegram webhook →", url, res.ok ? "OK" : `FAILED (${res.description || "unknown"})`);
}

// Called from server.js when a student submits a permission request
async function notifyLecturer(db, request) {
  if (!TELEGRAM_BOT_TOKEN) return; // bot disabled, silently skip
  // Look up which lecturer teaches this subject (any group) and grab their chat_id
  const sql = `
    SELECT DISTINCT u.user_id, u.telegram_chat_id
    FROM lecturer_assignments la
    JOIN users u ON u.user_id = la.lecturer_id
    WHERE la.subject_name = ? AND u.telegram_chat_id IS NOT NULL
  `;
  db.query(sql, [request.subject_name], async (err, rows) => {
    if (err) { console.log("notifyLecturer DB error:", err); return; }
    if (!rows || rows.length === 0) return; // no linked lecturer for this class

    const dateStr = request.request_date
      ? new Date(request.request_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "—";

    const text =
      `📋 *New Permission Request*\n\n` +
      `👤 *Student:* ${escapeMd(request.student_name)}\n` +
      `🎓 *Group:* ${escapeMd(request.group_name)}\n` +
      `📖 *Subject:* ${escapeMd(request.subject_name)} — ${escapeMd(request.class_time || "")}\n` +
      `📅 *Date:* ${escapeMd(dateStr)}\n` +
      `📝 *Reason:* ${escapeMd(request.reason || "")}`;

    const reply_markup = {
      inline_keyboard: [[
        { text: "✅ Accept", callback_data: `accept:${request.request_id}` },
        { text: "❌ Reject", callback_data: `reject:${request.request_id}` },
      ]],
    };

    // If a proof photo was uploaded, send it with the message. Otherwise text-only.
    const photoUrl = request.proof_image_url
      ? `${PUBLIC_BASE_URL}${request.proof_image_url}`
      : null;

    for (const row of rows) {
      if (photoUrl) {
        await tgCall("sendPhoto", {
          chat_id: row.telegram_chat_id,
          photo: photoUrl,
          caption: text,
          parse_mode: "Markdown",
          reply_markup,
        });
      } else {
        await tgCall("sendMessage", {
          chat_id: row.telegram_chat_id,
          text,
          parse_mode: "Markdown",
          reply_markup,
        });
      }
    }
  });
}

// Escape special Markdown chars so weird student names/reasons don't break formatting
function escapeMd(s) {
  return String(s || "").replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

// Webhook handler — Telegram POSTs updates here (called by server.js route)
async function handleWebhook(db, update, res) {
  try {
    // A. A regular message (used for the /start LEC123 linking step, and typed reject reasons)
    if (update.message) {
      const msg = update.message;
      const chat_id = msg.chat.id;
      const text = msg.text || "";

      // A0. Are we waiting for this lecturer to type a rejection reason?
      const pending = pendingRejects.get(String(chat_id));
      if (pending) {
        // Handle /cancel
        if (text.trim().toLowerCase() === "/cancel") {
          pendingRejects.delete(String(chat_id));
          tgCall("sendMessage", { chat_id, text: "❌ Rejection cancelled. The request is still Pending." });
          return res.sendStatus(200);
        }
        // Expired?
        if (Date.now() > pending.expires) {
          pendingRejects.delete(String(chat_id));
          tgCall("sendMessage", { chat_id, text: "⏰ That took too long — tap Reject on the request again to try once more." });
          return res.sendStatus(200);
        }
        // Ignore anything that starts with / (other commands)
        if (text.startsWith("/")) {
          tgCall("sendMessage", { chat_id, text: "Please type the reason as a plain message, or send /cancel." });
          return res.sendStatus(200);
        }

        const reason = text.trim();
        db.query(
          "UPDATE requests SET status = 'Rejected', reject_reason = ?, status_viewed = 0 WHERE request_id = ?",
          [reason, pending.request_id],
          (err) => {
            if (err) {
              tgCall("sendMessage", { chat_id, text: "❌ Failed to save. Please try again." });
              return;
            }
            pendingRejects.delete(String(chat_id));
            // Replace the original request's buttons with a confirmation label
            tgCall("editMessageReplyMarkup", {
              chat_id,
              message_id: pending.message_id,
              reply_markup: { inline_keyboard: [[{ text: "❌ Rejected — reason sent", callback_data: "done" }]] },
            });
            tgCall("sendMessage", {
              chat_id,
              text: `✅ Rejection sent to the student with your reason:\n\n_"${escapeMd(reason)}"_`,
              parse_mode: "Markdown",
            });
          }
        );
        return res.sendStatus(200);
      }

      if (text.startsWith("/start")) {
        // Text looks like "/start LEC100201"
        const parts = text.split(/\s+/);
        const payload = parts[1] || "";
        if (payload.startsWith("LEC")) {
          const lecturerId = payload.slice(3);
          // Only allow linking if that user exists and is a lecturer
          db.query("SELECT user_id, name, role FROM users WHERE user_id = ?", [lecturerId], (err, rows) => {
            if (err || rows.length === 0 || rows[0].role.toLowerCase() !== "lecturer") {
              tgCall("sendMessage", { chat_id, text: "❌ Sorry, that link is invalid or not a lecturer account." });
              return;
            }
            db.query("UPDATE users SET telegram_chat_id = ? WHERE user_id = ?", [chat_id, lecturerId], (uErr) => {
              if (uErr) {
                tgCall("sendMessage", { chat_id, text: "❌ Something went wrong saving your Telegram." });
                return;
              }
              tgCall("sendMessage", {
                chat_id,
                text: `✅ Hi ${rows[0].name}! Your Telegram is now linked to your lecturer account.\n\n` +
                      `You'll get a notification here whenever a student submits a permission request for one of your classes.`,
              });
            });
          });
        } else {
          tgCall("sendMessage", {
            chat_id,
            text: "👋 Hi! This bot notifies lecturers about student permission requests.\n\n" +
                  "Ask your admin for your personal linking link — it looks like:\n" +
                  `https://t.me/${BOT_USERNAME}?start=LEC<your_id>`,
          });
        }
      }
    }

    // B. A tap on an inline button (Accept / Reject)
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || "";
      const [action, requestId] = data.split(":");
      const chat_id = cb.message.chat.id;
      const message_id = cb.message.message_id;

      if (action === "accept") {
        db.query(
          "UPDATE requests SET status = 'Accepted', status_viewed = 0 WHERE request_id = ?",
          [requestId],
          (err) => {
            if (err) {
              tgCall("answerCallbackQuery", { callback_query_id: cb.id, text: "❌ Failed to update", show_alert: true });
              return;
            }
            tgCall("editMessageReplyMarkup", {
              chat_id, message_id,
              reply_markup: { inline_keyboard: [[{ text: "✅ Accepted — updated", callback_data: "done" }]] },
            });
            tgCall("answerCallbackQuery", { callback_query_id: cb.id, text: "Request accepted" });
          }
        );
      } else if (action === "reject") {
        // Remember which request this lecturer is rejecting, then ask for the reason
        pendingRejects.set(String(chat_id), {
          request_id: requestId,
          message_id,
          expires: Date.now() + REJECT_TIMEOUT_MS,
        });
        tgCall("answerCallbackQuery", { callback_query_id: cb.id, text: "" });
        tgCall("sendMessage", {
          chat_id,
          text: "✏️ *Please type your reason for rejecting this request:*\n\n" +
                "Your next message will be sent to the student along with the rejection. Type `/cancel` to cancel.",
          parse_mode: "Markdown",
        });
      } else {
        tgCall("answerCallbackQuery", { callback_query_id: cb.id, text: "" });
      }
    }
  } catch (err) {
    console.log("handleWebhook error:", err);
  }
  res.sendStatus(200); // always acknowledge Telegram
}

export { setWebhook, notifyLecturer, handleWebhook, linkForLecturer, BOT_USERNAME };