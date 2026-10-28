import { cp, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const standalone = new URL("../.next/standalone/", import.meta.url);
await access(new URL("server.js", standalone));
await cp(new URL("../public", import.meta.url), new URL("public", standalone), { recursive: true });
await cp(new URL("../.next/static", import.meta.url), new URL(".next/static", standalone), { recursive: true });
process.env.PORT ??= "3001";
process.env.HOSTNAME ??= "127.0.0.1";
await import(fileURLToPath(new URL("server.js", standalone)));
