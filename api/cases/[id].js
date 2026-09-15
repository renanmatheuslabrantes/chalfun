const auth = require("../_lib/auth");

const cases = globalThis.__chalfunCases || [];
globalThis.__chalfunCases = cases;

module.exports = function handler(request, response) {
  if (request.method !== "DELETE") return auth.sendJson(response, 405, { error: "Método não permitido." });
  if (!auth.isAuthenticated(request)) return auth.sendJson(response, 401, { error: "Não autenticado." });
  const id = String(request.query.id || "");
  const index = cases.findIndex((item) => item.id === id);
  if (index === -1) return auth.sendJson(response, 404, { error: "Case não encontrado." });
  cases.splice(index, 1);
  return auth.sendJson(response, 200, { deleted: true });
};
