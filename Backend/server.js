import "dotenv/config";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first"); // avoid ENETUNREACH on hosts without IPv6 egress (e.g. Gmail SMTP)
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { setWebhook } from "./telegram-bot.js";

import authRoutes from "./routes/auth.js";
import requestRoutes from "./routes/requests.js";
import userRoutes from "./routes/users.js";
import telegramRoutes from "./routes/telegram.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Serve uploaded photos as static files so the lecturer can view them
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("Backend Running");
});

app.use(authRoutes);
app.use(requestRoutes);
app.use(userRoutes);
app.use(telegramRoutes);

app.listen(5000, () => {
  console.log("Server running on port 5000");
  // Register the webhook with Telegram so it knows where to send updates
  setWebhook();
});
