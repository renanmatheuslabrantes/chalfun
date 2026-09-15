const crypto = require("node:crypto");
const auth = require("./_lib/auth");

const cases = globalThis.__chalfunCases || [];
globalThis.__chalfunCases = cases;

module.exports = async function handler(request, response) {
  if (request.method === "GET") return auth.sendJson(response, 200, cases);
  if (!auth.isAuthenticated(request)) return auth.sendJson(response, 401, { error: "Não autenticado." });

  if (request.method === "POST") {
    try {
      const body = await auth.readJson(request);
      const item = {
        id: crypto.randomUUID(),
        tag: normalizeText(body.tag, 60).toUpperCase(),
        title: normalizeText(body.title, 120),
        subtitle: normalizeText(body.subtitle, 120),
        description: normalizeText(body.description, 600)
      };
      if (Object.values(item).some((value) => !value) || Object.values(item).some(containsHtml)) {
        return auth.sendJson(response, 400, { error: "Preencha os campos com texto simples." });
      }
      cases.push(item);
      return auth.sendJson(response, 201, item);
    } catch {
      return auth.sendJson(response, 400, { error: "Dados do case inválidos." });
    }
  }

  return auth.sendJson(response, 405, { error: "Método não permitido." });
};

function normalizeText(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function containsHtml(value) {
  return /<\/?[a-z][^>]*>/i.test(value);
}
