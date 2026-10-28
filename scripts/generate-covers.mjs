import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const sharp = require("sharp");
const output = new URL("../backend/src/main/resources/demo-covers/", import.meta.url);
await mkdir(output, { recursive: true });
for (const name of ["postcard", "avatar", "life"]) {
  const source = await readFile(new URL(`../assets/covers/${name}.svg`, import.meta.url));
  await sharp(source).png().toFile(fileURLToPath(new URL(`${name}.png`, output)));
  console.log(`Generated ${name}.png`);
}
