const auth = require("../_lib/auth");

module.exports = function handler(request, response) {
  if (request.method !== "GET") return auth.sendJson(response, 405, { error: "Método não permitido." });
  return auth.sendJson(response, 200, { authenticated: auth.isAuthenticated(request) });
};
