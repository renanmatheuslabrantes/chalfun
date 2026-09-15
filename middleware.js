const { get } = require("@vercel/global-config");

async function middleware() {
  const greeting = await get("greeting");
  return greeting;
}

module.exports = { middleware };
