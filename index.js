import "dotenv/config";
import http from "node:http";
import nodemailer from "nodemailer";

const port = Number(process.env.API_PORT || 3001);
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
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

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000)
        request.destroy(new Error("Request body too large"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

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

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return sendJson(response, 204, {});
  if (request.method !== "POST" || request.url !== "/api/contact")
    return sendJson(response, 404, { message: "Route not found." });

  try {
    const payload = JSON.parse(await readBody(request));
    const validationError = validate(payload);
    if (validationError)
      return sendJson(response, 400, { message: validationError });
    if (missingEnv.length)
      return sendJson(response, 503, {
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

    sendJson(response, 200, { message: "Your inquiry was sent successfully." });
  } catch (error) {
    console.error("Contact form error:", error);
    sendJson(response, 500, {
      message: "We could not send your inquiry. Please try again.",
    });
  }
});

server.listen(port, () =>
  console.log(`LUMEN mail API listening on http://localhost:${port}`),
);
