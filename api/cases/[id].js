const auth = require("../_lib/auth");
const store = require("../_lib/store");

module.exports = async function handler(request, response) {
  if (request.method !== "DELETE") return auth.sendJson(response, 405, { error: "Método não permitido." });
  const data = await store.readAdminData();
  if (!auth.isAuthenticated(request, data.passwordHash)) return auth.sendJson(response, 401, { error: "Não autenticado." });
  const id = String(request.query.id || "");
  const index = data.cases.findIndex((item) => item.id === id);
  if (index === -1) return auth.sendJson(response, 404, { error: "Case não encontrado." });
  data.cases.splice(index, 1);
  await store.writeAdminData(data);
  return auth.sendJson(response, 200, { deleted: true });
};
