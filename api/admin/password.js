const crypto = require("node:crypto");
const auth = require("../_lib/auth");
const store = require("../_lib/store");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return auth.sendJson(response, 405, { error: "Método não permitido." });
  const data = await store.readAdminData();
  if (!auth.isAuthenticated(request, data.passwordHash)) return auth.sendJson(response, 401, { error: "Não autenticado." });

  try {
    const body = await auth.readJson(request);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");
    if (!auth.verifyPassword(currentPassword, data.passwordHash)) {
      return auth.sendJson(response, 400, { error: "A senha atual está incorreta." });
    }
    if (newPassword.length < 12) {
      return auth.sendJson(response, 400, { error: "A nova senha deve ter pelo menos 12 caracteres." });
    }
    if (newPassword !== confirmPassword) {
      return auth.sendJson(response, 400, { error: "A confirmação da nova senha não coincide." });
    }

    data.passwordHash = createPasswordHash(newPassword);
    await store.writeAdminData(data);
    auth.clearSession(request, response);
    return auth.sendJson(response, 200, { changed: true });
  } catch {
    return auth.sendJson(response, 400, { error: "Não foi possível alterar a senha." });
  }
};

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
