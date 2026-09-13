import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();
const port = Number(process.env.API_PORT || 3001);
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: allowedOrigin,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(express.json({ limit: "100kb" }));

const requiredEnv = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "CONTACT_EMAIL",
];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length)
  console.warn(`Missing mail environment variables: ${missingEnv.join(", ")}`);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const allowedServices = new Set([
  "Website",
  "Web Application",
  "E-Commerce",
  "UI/UX",
  "Landing Page",
  "Maintenance",
  "Other",
]);

function clean(value, maxLength = 5000) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function validate(payload) {
  const name = clean(payload.name, 120);
  const email = clean(payload.email, 180);
  const service = clean(payload.service, 80);
  const description = clean(payload.description, 5000);
  if (!name) return "Please enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Please enter a valid email.";
  if (!allowedServices.has(service)) return "Please select a valid service.";
  if (!description) return "Please tell us about your project.";
  return null;
}

app.post("/api/contact", async (req, res) => {
  try {
    const payload = req.body || {};
    const validationError = validate(payload);
    if (validationError)
      return res.status(400).json({ message: validationError });
    if (missingEnv.length)
      return res.status(503).json({
        message: "Email service is not configured yet.",
      });

    const name = clean(payload.name, 120);
    const email = clean(payload.email, 180);
    const company = clean(payload.company, 180) || "Not provided";
    const phone = clean(payload.phone, 80) || "Not provided";
    const service = clean(payload.service, 80);
    const budget = clean(payload.budget, 80) || "Not provided";
    const timeline = clean(payload.timeline, 80) || "Not provided";
    const description = clean(payload.description, 5000);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.CONTACT_EMAIL,
      replyTo: email,
      subject: `New LUMEN project inquiry: ${service}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company}`,
        `Phone: ${phone}`,
        `Service: ${service}`,
        `Budget: ${budget}`,
        `Timeline: ${timeline}`,
        "",
        "Project description:",
        description,
      ].join("\n"),
    });

    return res.status(200).json({ message: "Your inquiry was sent successfully." });
  } catch (error) {
    console.error("Contact form error:", error);
    return res.status(500).json({
      message: "We could not send your inquiry. Please try again.",
    });
  }
});

app.listen(port, () =>
  console.log(`LUMEN mail API listening on http://localhost:${port}`),
);