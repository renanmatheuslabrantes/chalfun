const auth = require("../_lib/auth");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return auth.sendJson(response, 405, { error: "Método não permitido." });
  const address = request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown";
  if (auth.isRateLimited(address)) return auth.sendJson(response, 429, { error: "Muitas tentativas. Aguarde alguns minutos." });

  try {
    const body = await auth.readJson(request);
    const valid = String(body.username || "") === auth.adminUsername
      && process.env.ADMIN_PASSWORD_HASH
      && auth.verifyPassword(String(body.password || ""), process.env.ADMIN_PASSWORD_HASH);
    if (!valid) {
      auth.registerFailedAttempt(address);
      return auth.sendJson(response, 401, { error: "Login ou senha incorretos." });
    }
    auth.resetAttempts(address);
    auth.createSession(response);
    return auth.sendJson(response, 200, { authenticated: true });
  } catch {
    return auth.sendJson(response, 400, { error: "Dados de login inválidos." });
  }
};
