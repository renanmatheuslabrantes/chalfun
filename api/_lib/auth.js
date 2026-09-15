const crypto = require("node:crypto");

const attempts = globalThis.__chalfunLoginAttempts || new Map();
globalThis.__chalfunLoginAttempts = attempts;
const sessionMaxAge = 8 * 60 * 60 * 1000;

function parseCookies(request) {
  return String(request.headers.cookie || "").split(";").reduce((cookies, item) => {
    const separator = item.indexOf("=");
    if (separator === -1) return cookies;
    cookies[item.slice(0, separator).trim()] = decodeURIComponent(item.slice(separator + 1).trim());
    return cookies;
  }, {});
}

function isAuthenticated(request, passwordHash) {
  const token = parseCookies(request).chalfun_session;
  if (!token || !passwordHash) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !timingSafeSignature(payload, signature, passwordHash)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

function createSession(response, passwordHash) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + sessionMaxAge })).toString("base64url");
  const signature = crypto.createHmac("sha256", passwordHash).update(payload).digest("base64url");
  const token = `${payload}.${signature}`;
  response.setHeader("Set-Cookie", cookieHeader("chalfun_session", token, sessionMaxAge));
}

function clearSession(request, response) {
  response.setHeader("Set-Cookie", cookieHeader("chalfun_session", "", 0));
}

function timingSafeSignature(payload, signature, passwordHash) {
  const expected = crypto.createHmac("sha256", passwordHash).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function verifyPassword(password, encodedHash) {
  try {
    const [, n, r, p, saltEncoded, hashEncoded] = encodedHash.split("$");
    const salt = Buffer.from(saltEncoded, "base64url");
    const expected = Buffer.from(hashEncoded, "base64url");
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p)
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function isRateLimited(address) {
  const attempt = attempts.get(address);
  return Boolean(attempt && attempt.blockedUntil > Date.now());
}

function registerFailedAttempt(address) {
  const current = attempts.get(address) || { count: 0, blockedUntil: 0 };
  current.count += 1;
  if (current.count >= 5) current.blockedUntil = Date.now() + 5 * 60 * 1000;
  attempts.set(address, current);
}

function resetAttempts(address) {
  attempts.delete(address);
}

function cookieHeader(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${Math.floor(maxAge / 1000)}; Path=/; HttpOnly; SameSite=Strict; Secure`;
}

function sendJson(response, status, body) {
  response.status(status).setHeader("Cache-Control", "no-store").json(body);
}

async function readJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => { data += chunk; });
    request.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("JSON inválido.")); }
    });
    request.on("error", reject);
  });
}

module.exports = {
  adminUsername: process.env.ADMIN_USERNAME || "Administrador",
  createSession,
  clearSession,
  isAuthenticated,
  isRateLimited,
  readJson,
  registerFailedAttempt,
  resetAttempts,
  sendJson,
  verifyPassword
};
