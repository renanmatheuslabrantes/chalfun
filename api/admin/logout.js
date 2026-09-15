const auth = require("../_lib/auth");

module.exports = function handler(request, response) {
  if (request.method !== "POST") return auth.sendJson(response, 405, { error: "Método não permitido." });
  auth.clearSession(request, response);
  return auth.sendJson(response, 200, { authenticated: false });
};
