const crypto = require("node:crypto");

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Uso: node scripts/generate-password-hash.js \"uma-senha-com-12-ou-mais-caracteres\"");
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
console.log(`ADMIN_PASSWORD_HASH=scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`);
