# Chalfun Consultoria

Site estático servido por um backend Node.js com painel administrativo protegido.

## Estrutura

- `public/`: página pública, estilos e assets do site.
- `src/`: servidor local e integrações usadas fora das rotas da Vercel.
- `api/`: funções serverless da Vercel.
- `data/`: dados locais usados pelo servidor de desenvolvimento.
- `scripts/`: scripts auxiliares de manutenção.

## Configuração local

Requer Node.js 18 ou mais recente.

1. Gere um hash para a senha administrativa:

   ```powershell
   node scripts/generate-password-hash.js "use-uma-senha-forte-com-12-caracteres"
   ```

2. Crie um arquivo `.env` com o resultado gerado:

   ```env
   PORT=3000
   NODE_ENV=development
   ADMIN_USERNAME=Administrador
   ADMIN_PASSWORD_HASH=scrypt$...
   ```

3. Inicie o servidor:

   ```powershell
   npm start
   ```

Abra `http://localhost:3000`. Em produção, use HTTPS e defina `NODE_ENV=production` para ativar o atributo `Secure` do cookie.

A senha nunca é enviada ao frontend nem armazenada no navegador. O backend usa `scrypt`, sessão em cookie `HttpOnly` e limitação de tentativas de login. Os cases ficam em `data/cases.json`, que está ignorado pelo Git.

## Global Config

As variáveis da Vercel podem ser sincronizadas com:

```powershell
npx vercel env pull
npm install @vercel/global-config
```

O middleware em `middleware.js` lê a chave `greeting` do Global Config. Com o servidor iniciado, consulte `http://localhost:3000/welcome` para receber esse valor em JSON.
