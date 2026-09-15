import { get } from "@vercel/global-config";

export const config = { matcher: "/welcome", runtime: "nodejs" };

export async function middleware() {
  const greeting = await get("greeting");
  return new Response(JSON.stringify(greeting), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
