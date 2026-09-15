const auth = require("../_lib/auth");
const store = require("../_lib/store");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return auth.sendJson(response, 405, { error: "Método não permitido." });
  const data = await store.readAdminData();
  return auth.sendJson(response, 200, { authenticated: auth.isAuthenticated(request, data.passwordHash) });
};
