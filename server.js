const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { middleware: globalConfigMiddleware } = require("./middleware");

loadEnvFile();

const port = Number(process.env.PORT || 3000);
const publicRoot = __dirname;
const dataDirectory = path.join(__dirname, "data");
const casesFile = path.join(dataDirectory, "cases.json");
const sessions = new Map();
const loginAttempts = new Map();
const sessionMaxAge = 8 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";
const adminUsername = process.env.ADMIN_USERNAME || "Administrador";

ensureCasesFile();

const server = http.createServer(async (request, response) => {
  try {
    await routeRequest(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Erro interno do servidor." });
  }
});

server.listen(port, () => {
  console.log(`Chalfun rodando em http://localhost:${port}`);
});

async function routeRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/welcome" && request.method === "GET") {
    try {
      const greeting = await globalConfigMiddleware();
      return sendJson(response, 200, greeting);
    } catch (error) {
      console.error("Falha ao ler o Global Config:", error.message);
      return sendJson(response, 503, { error: "Global Config indisponível." });
    }
  }

  if (requestUrl.pathname === "/api/admin/login" && request.method === "POST") {
    return login(request, response);
  }
  if (requestUrl.pathname === "/api/admin/logout" && request.method === "POST") {
    return logout(request, response);
  }
  if (requestUrl.pathname === "/api/admin/session" && request.method === "GET") {
    return sessionStatus(request, response);
  }
  if (requestUrl.pathname === "/api/cases" && request.method === "GET") {
    return sendJson(response, 200, readCases());
  }
  if (requestUrl.pathname === "/api/cases" && request.method === "POST") {
    return createCase(request, response);
  }
  if (requestUrl.pathname.startsWith("/api/cases/") && request.method === "DELETE") {
    return deleteCase(request, response, requestUrl.pathname.slice("/api/cases/".length));
  }
  if (requestUrl.pathname.startsWith("/api/")) {
    return sendJson(response, 404, { error: "Endpoint não encontrado." });
  }

  return serveStatic(requestUrl.pathname, response);
}

async function login(request, response) {
  const address = request.socket.remoteAddress || "unknown";
  if (isRateLimited(address)) {
    return sendJson(response, 429, { error: "Muitas tentativas. Aguarde alguns minutos." });
  }

  const body = await readJson(request);
  const username = String(body.username || "");
  const password = String(body.password || "");
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!passwordHash || username !== adminUsername || !verifyPassword(password, passwordHash)) {
    registerFailedAttempt(address);
    return sendJson(response, 401, { error: "Login ou senha incorretos." });
  }

  loginAttempts.delete(address);
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, Date.now() + sessionMaxAge);
  response.setHeader("Set-Cookie", cookieHeader("chalfun_session", token, sessionMaxAge));
  return sendJson(response, 200, { authenticated: true });
}

function logout(request, response) {
  const token = readCookie(request, "chalfun_session");
  if (token) sessions.delete(token);
  response.setHeader("Set-Cookie", cookieHeader("chalfun_session", "", 0));
  return sendJson(response, 200, { authenticated: false });
}

function sessionStatus(request, response) {
  return sendJson(response, 200, { authenticated: isAuthenticated(request) });
}

async function createCase(request, response) {
  if (!isAuthenticated(request)) return sendJson(response, 401, { error: "Não autenticado." });
  const body = await readJson(request);
  const item = {
    id: crypto.randomUUID(),
    tag: normalizeText(body.tag, 60).toUpperCase(),
    title: normalizeText(body.title, 120),
    subtitle: normalizeText(body.subtitle, 120),
    description: normalizeText(body.description, 600)
  };

  if (Object.values(item).some((value) => !value) || Object.values(item).some(containsHtml)) {
    return sendJson(response, 400, { error: "Preencha os campos com texto simples." });
  }

  const cases = readCases();
  cases.push(item);
  writeCases(cases);
  return sendJson(response, 201, item);
}

function deleteCase(request, response, id) {
  if (!isAuthenticated(request)) return sendJson(response, 401, { error: "Não autenticado." });
  const cases = readCases();
  const remainingCases = cases.filter((item) => item.id !== id);
  if (remainingCases.length === cases.length) return sendJson(response, 404, { error: "Case não encontrado." });
  writeCases(remainingCases);
  return sendJson(response, 200, { deleted: true });
}

function isAuthenticated(request) {
  const token = readCookie(request, "chalfun_session");
  const expiresAt = token && sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function verifyPassword(password, encodedHash) {
  try {
    const [, n, r, p, saltEncoded, hashEncoded] = encodedHash.split("$");
    const salt = Buffer.from(saltEncoded, "base64url");
    const expected = Buffer.from(hashEncoded, "base64url");
    const actual = crypto.scryptSync(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function cookieHeader(name, value, maxAge) {
  const secure = isProduction ? "; Secure" : "";
  return `${name}=${value}; Max-Age=${Math.floor(maxAge / 1000)}; Path=/; HttpOnly; SameSite=Strict${secure}`;
}

function readCookie(request, name) {
  const cookies = String(request.headers.cookie || "").split(";");
  const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(name.length + 1)) : "";
}

function isRateLimited(address) {
  const attempt = loginAttempts.get(address);
  return Boolean(attempt && attempt.blockedUntil > Date.now());
}

function registerFailedAttempt(address) {
  const current = loginAttempts.get(address) || { count: 0, blockedUntil: 0 };
  current.count += 1;
  if (current.count >= 5) current.blockedUntil = Date.now() + 5 * 60 * 1000;
  loginAttempts.set(address, current);
}

function normalizeText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function containsHtml(value) {
  return /<\/?[a-z][^>]*>/i.test(value);
}

function readCases() {
  try {
    const cases = JSON.parse(fs.readFileSync(casesFile, "utf8"));
    return Array.isArray(cases) ? cases : [];
  } catch {
    return [];
  }
}

function writeCases(cases) {
  fs.writeFileSync(casesFile, JSON.stringify(cases, null, 2), "utf8");
}

function ensureCasesFile() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  if (!fs.existsSync(casesFile)) writeCases([]);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100_000) request.destroy(new Error("Payload muito grande."));
    });
    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
    request.on("error", reject);
  });
}

function serveStatic(requestPath, response) {
  const requestedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.resolve(publicRoot, `.${requestedPath}`);
  if (!filePath.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendText(response, 404, "Não encontrado.");
  }
  const contentTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webmanifest": "application/manifest+json" };
  response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(response);
}

function sendJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(body);
}

function sendText(response, status, body) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

function loadEnvFile() {
  for (const fileName of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, fileName);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}
