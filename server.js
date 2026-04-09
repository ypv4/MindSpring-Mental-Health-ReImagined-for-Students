const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = process.cwd();
const MAX_BODY_SIZE = 1024 * 1024;

const submissions = [];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self' https: data:; script-src 'self' https:; style-src 'self' https: 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none';");
}

function sanitizePath(urlPath) {
  let decodedPath = "/";

  try {
    decodedPath = decodeURIComponent(urlPath || "/");
  } catch {
    return null;
  }

  const slashNormalized = decodedPath.replace(/\\/g, "/");
  if (slashNormalized === "/" || slashNormalized === "") {
    return "index.html";
  }

  
  let cleaned = slashNormalized.replace(/^\/+/, "");
  cleaned = cleaned.replace(/(^|\/)\.\.(?=\/|$)/g, "");

  if (cleaned === "") {
    return "index.html";
  }

  if (cleaned.endsWith("/")) {
    cleaned += "index.html";
  }

  
  if (!path.extname(cleaned)) {
    const knownPages = new Set(["index", "services", "about", "resources", "contact"]);
    const normalizedPage = cleaned.toLowerCase();
    if (knownPages.has(normalizedPage)) {
      cleaned = `${normalizedPage}.html`;
    }
  }

  return path.normalize(cleaned);
}

function resolveSafeFilePath(urlPath) {
  const requestPath = sanitizePath(urlPath);
  if (!requestPath) {
    return null;
  }

  const filePath = path.resolve(ROOT, requestPath);
  const relativePath = path.relative(ROOT, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

function serveFile(req, res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME[extension] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600"
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => sendJson(res, 500, { ok: false, errors: ["Unable to read file."] }));
  stream.pipe(res);
}

function validateSubmission(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return ["Invalid request body."];
  }

  if (!payload.fullName || String(payload.fullName).trim().length < 2) {
    errors.push("fullName is required.");
  }

  const email = String(payload.emailAddress || "").trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailPattern.test(email)) {
    errors.push("emailAddress must be a valid email.");
  }

  if (!payload.schoolName || String(payload.schoolName).trim().length < 2) {
    errors.push("schoolName is required.");
  }

  const allowedRoles = new Set(["student", "staff", "partner"]);
  if (!allowedRoles.has(String(payload.roleType || ""))) {
    errors.push("roleType must be one of: student, staff, partner.");
  }

  if (!payload.helpTopic || String(payload.helpTopic).trim().length < 12) {
    errors.push("helpTopic must be at least 12 characters.");
  }

  if (payload.consent !== true) {
    errors.push("consent must be true.");
  }

  return errors;
}

const server = http.createServer((req, res) => {
  applySecurityHeaders(res);

  if (req.method === "POST" && req.url === "/api/signup") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const errors = validateSubmission(payload);

        if (errors.length > 0) {
          sendJson(res, 400, { ok: false, errors });
          return;
        }

        const submission = {
          id: `ms_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          fullName: String(payload.fullName).trim(),
          emailAddress: String(payload.emailAddress).trim(),
          schoolName: String(payload.schoolName).trim(),
          roleType: String(payload.roleType),
          helpTopic: String(payload.helpTopic).trim(),
          consent: true,
          createdAt: new Date().toISOString()
        };

        submissions.push(submission);
        sendJson(res, 201, { ok: true, id: submission.id });
      } catch (error) {
        sendJson(res, 400, { ok: false, errors: ["Malformed JSON request body."] });
      }
    });

    req.on("error", () => {
      sendJson(res, 500, { ok: false, errors: ["Unexpected server error."] });
    });

    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, 200, { ok: true, submissions: submissions.length, timestamp: new Date().toISOString() });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { ok: false, errors: ["Method not allowed."] });
    return;
  }

  const filePath = resolveSafeFilePath(req.url.split("?")[0]);
  if (!filePath) {
    sendJson(res, 403, { ok: false, errors: ["Forbidden."] });
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr) {
      sendJson(res, 404, { ok: false, errors: ["Not found."] });
      return;
    }

    if (stat.isDirectory()) {
      const indexFilePath = path.join(filePath, "index.html");
      fs.stat(indexFilePath, (indexErr, indexStat) => {
        if (indexErr || !indexStat.isFile()) {
          sendJson(res, 404, { ok: false, errors: ["Not found."] });
          return;
        }

        serveFile(req, res, indexFilePath);
      });
      return;
    }

    if (!stat.isFile()) {
      sendJson(res, 404, { ok: false, errors: ["Not found."] });
      return;
    }

    serveFile(req, res, filePath);
  });
});

server.listen(PORT, () => {
  console.log(`MindSpring server running on http://localhost:${PORT}`);
});
