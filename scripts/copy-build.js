import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, ".output");
const outputPublicDir = path.join(outputDir, "public");
const distDir = path.join(rootDir, "dist");

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  console.log("Preparing dist artifacts from .output...");
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 1. Copy public assets into dist/
  if (fs.existsSync(outputPublicDir)) {
    copyDirRecursive(outputPublicDir, distDir);
    console.log("Copied .output/public into dist/");
  }

  // 1.5 Ensure public/ folder assets (products, icons, _redirects, etc.) are directly copied to dist/ and .output/public
  const staticPublicDir = path.join(rootDir, "public");
  if (fs.existsSync(staticPublicDir)) {
    copyDirRecursive(staticPublicDir, distDir);
    if (fs.existsSync(outputPublicDir)) {
      copyDirRecursive(staticPublicDir, outputPublicDir);
    }
    console.log("Copied public/ assets directly into dist/ and .output/public");
  }

  // 2. Also keep a copy of .output inside dist/.output
  const distOutputDir = path.join(distDir, ".output");
  if (fs.existsSync(outputDir)) {
    copyDirRecursive(outputDir, distOutputDir);
    console.log("Copied .output into dist/.output");
  }

  // 2.5 Ensure public/_headers is always placed in dist/_headers and .output/public/_headers
  const headersSource = path.join(staticPublicDir, "_headers");
  if (fs.existsSync(headersSource)) {
    fs.copyFileSync(headersSource, path.join(distDir, "_headers"));
    if (fs.existsSync(outputPublicDir)) {
      fs.copyFileSync(headersSource, path.join(outputPublicDir, "_headers"));
    }
    console.log("Enforced Cloudflare Pages _headers in dist/ and .output/public");
  }

  // 3. Ensure dist/index.html exists and includes anti-cache meta tags for static hosts / preview
  const distIndexPath = path.join(distDir, "index.html");
  let scriptTag = "";
  let styleTag = "";

  const assetsDir = path.join(distDir, "assets");
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    const jsEntry = assetFiles.find((f) => f.startsWith("index-") && f.endsWith(".js"));
    const cssEntry = assetFiles.find((f) => f.endsWith(".css"));

    if (cssEntry) {
      styleTag = `<link rel="stylesheet" href="/assets/${cssEntry}">`;
    }
    if (jsEntry) {
      scriptTag = `<script type="module" src="/assets/${jsEntry}"></script>`;
    }
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>KasımOğulları Toptan</title>
    <meta name="description" content="KasımOğulları şirketimizin ürünlerini inceleyin, sepete ekleyin ve sipariş talebinizi iletin." />
    <link rel="icon" type="image/png" href="/favicon.png?v=20261010-k" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20261010-k" />
    <link rel="manifest" href="/manifest.webmanifest?v=20261010-k" />
    ${styleTag}
  </head>
  <body>
    <div id="root"></div>
    ${scriptTag}
  </body>
</html>
`;
  fs.writeFileSync(distIndexPath, htmlContent, "utf-8");
  console.log("Updated dist/index.html with anti-cache headers");

  const distFilesCount = fs.readdirSync(distDir).length;
  console.log(
    `Build artifacts successfully prepared in dist/ (${distFilesCount} top-level entries).`,
  );
} catch (err) {
  console.error("Error copying build artifacts to dist:", err);
  process.exit(1);
}
