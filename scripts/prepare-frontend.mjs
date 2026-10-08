import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [distArgument, sourceArgument] = process.argv.slice(2);
if (!distArgument || !sourceArgument) {
  console.error("Usage: node scripts/prepare-frontend.mjs <upstream-dist> <upstream-source-root>");
  process.exit(2);
}

const dist = path.resolve(distArgument);
const source = path.resolve(sourceArgument);
const transparent = path.join(projectRoot, "public", "transparent.png");

// Replace—not redistribute—the four upstream project logos identified as no-reuse.
// Transparent placeholders keep the game usable without adding a proxy mark to its screen.
for (const relative of ["logo128.png", "logo512.png", "images/logo.png", "images/logo_fake.png"]) {
  const target = path.join(dist, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(transparent, target);
}

// The video is also explicitly no-reuse. The source patch keeps the loading UI usable without it.
await rm(path.join(dist, "images", "intro_dark.mp4"), { force: true });

// Do not claim the upstream canonical host or use the upstream logo as a social preview.
const htmlPath = path.join(dist, "index.html");
let html = await readFile(htmlPath, "utf8");
html = html.replace(/\s*<link\s+rel="canonical"[^>]*>\s*/gi, "\n");
html = html.replace(/\s*<meta\s+property="(?:og:image|twitter:image|og:url|twitter:url)"[^>]*>\s*/gi, "\n");
html = html.replace(/\s*<link\s+rel="(?:apple-touch-icon|shortcut icon|icon)"[^>]*>\s*/gi, "\n");
html = html.replace("</head>", '  <link rel="icon" type="image/png" href="./logo512.png" />\n</head>');
await writeFile(htmlPath, html);

const notices = path.join(dist, "notices");
await mkdir(notices, { recursive: true });
await cp(path.join(projectRoot, "docs", "UPSTREAM_NOTICE.md"), path.join(dist, "UPSTREAM_NOTICE.md"));
await cp(path.join(source, "LICENSE"), path.join(dist, "LICENSE.txt"));
await cp(path.join(source, "CREDITS.md"), path.join(dist, "CREDITS.md"));
for (const [from, to] of [
  [path.join(source, "locales", "LICENSE"), path.join(notices, "locales-LICENSE")],
  [path.join(source, "locales", "README.md"), path.join(notices, "locales-README.md")],
]) {
  await cp(from, to);
}

// Keep the asset repository's own licensing explanation with the distributed assets.
await cp(path.join(source, "assets", "README.md"), path.join(notices, "assets-README.md"));

// Preserve every asset-level REUSE record alongside the built files.
async function copyReuseFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const sourcePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await copyReuseFiles(sourcePath);
    } else if (entry.isFile() && entry.name === "REUSE.toml") {
      const relative = path.relative(path.join(source, "assets"), sourcePath);
      const destination = path.join(notices, "assets", relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(sourcePath, destination);
    }
  }
}
await copyReuseFiles(path.join(source, "assets"));

console.log(`Prepared local frontend at ${dist}`);
