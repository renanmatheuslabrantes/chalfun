const { get, put } = require("@vercel/blob");

const pathname = "private/admin.json";

async function readAdminData() {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result) return { passwordHash: process.env.ADMIN_PASSWORD_HASH || "", cases: [] };
  const body = await new Response(result.stream).text();
  const data = JSON.parse(body);
  return {
    passwordHash: String(data.passwordHash || process.env.ADMIN_PASSWORD_HASH || ""),
    cases: Array.isArray(data.cases) ? data.cases : []
  };
}

async function writeAdminData(data) {
  await put(pathname, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
}

module.exports = { readAdminData, writeAdminData };
