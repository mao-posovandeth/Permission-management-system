import nodemailer from "nodemailer";

// Requires GMAIL_USER and GMAIL_APP_PASSWORD to be set as environment variables.
// Create a .env file in your project root (and add it to .gitignore):
//
//   GMAIL_USER=youraddress@gmail.com
//   GMAIL_APP_PASSWORD=your16characterapppassword
//
// The app password comes from your Google Account > Security > 2-Step Verification > App passwords.
// Your normal Gmail login password will NOT work here, Google blocks it for security.

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export default transporter;