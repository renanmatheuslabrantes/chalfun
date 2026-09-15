import { get } from "@vercel/global-config";

export async function middleware() {
  return get("greeting");
}