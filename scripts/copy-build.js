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

  // 3. Ensure Cloudflare Pages SPA fallback: write dist/_redirects
  const redirectsPath = path.join(distDir, "_redirects");
  const redirectsContent = "/* /index.html 200\n";
  fs.writeFileSync(redirectsPath, redirectsContent, "utf-8");
  if (fs.existsSync(outputPublicDir)) {
    fs.writeFileSync(path.join(outputPublicDir, "_redirects"), redirectsContent, "utf-8");
  }
  console.log("Enforced Cloudflare Pages _redirects SPA rule in dist/");

  // 4. Generate complete client SPA HTML with JS and CSS asset tags
  const assetsDir = path.join(distDir, "assets");
  let scriptTag = "";
  let styleTag = "";
  let jsEntryFile = "";
  let cssEntryFile = "";

  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    const jsEntry =
      assetFiles.find((f) => f.startsWith("index-") && f.endsWith(".js")) ||
      assetFiles.find((f) => f.startsWith("client-entry-") && f.endsWith(".js"));
    const cssEntry = assetFiles.find((f) => f.endsWith(".css"));

    if (cssEntry) {
      cssEntryFile = cssEntry;
      styleTag = `<link rel="stylesheet" href="/assets/${cssEntry}">`;
    }
    if (jsEntry) {
      jsEntryFile = jsEntry;
      scriptTag = `<script type="module" src="/assets/${jsEntry}"></script>`;
    }
  }

  const autoHealScript = `<script>
(function() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage) {
      var keys = [
        "ko_local_auth_session",
        "custom_added_products",
        "custom_product_overrides",
        "permanently_deleted_product_ids",
        "permanently_deleted_product_names",
        "custom_product_archived_status",
        "custom_product_stock_status",
        "ko_local_orders",
        "ko_order_status_overrides",
        "ko_deleted_order_ids"
      ];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        try {
          var raw = localStorage.getItem(k);
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed === null || typeof parsed === "undefined") {
              localStorage.removeItem(k);
            }
          }
        } catch (err) {
          try { localStorage.removeItem(k); } catch (e) {}
        }
      }
      for (var j = 0; j < localStorage.length; j++) {
        var itemKey = localStorage.key(j);
        if (itemKey && (itemKey.indexOf("depo-sepet-") === 0 || itemKey.indexOf("kotoptan_ai_chat_") === 0)) {
          try {
            var val = localStorage.getItem(itemKey);
            if (val) JSON.parse(val);
          } catch (e) {
            try { localStorage.removeItem(itemKey); } catch (e2) {}
          }
        }
      }
    }
  } catch (e) {}

  window.addEventListener("error", function(evt) {
    if (evt && evt.error && typeof evt.error.message === "string") {
      var msg = evt.error.message;
      if (msg.indexOf("Invariant failed") !== -1 || msg.indexOf("useStore") !== -1) {
        console.warn("[Invariant Shield] Intercepted:", msg);
        evt.preventDefault();
        evt.stopPropagation();
      }
    }
  }, true);
})();
</script>`;

  const tsrBootstrap = `<script class="$tsr" id="$tsr-stream-barrier">
(function() {
  self.$R = self.$R || {};
  self.$R["tsr"] = [];
  var rootMatch = { id: "__root__", routeId: "__root__", status: "success", _nonReactive: {} };
  var childMatch = { id: "/_authenticated/", routeId: "/_authenticated/", status: "success", _nonReactive: {} };
  self.$_TSR = {
    h: function() { this.hydrated = true; this.c(); },
    e: function() { this.streamEnded = true; this.c(); },
    c: function() { if (this.hydrated && this.streamEnded) { delete self.$_TSR; delete self.$R.tsr; } },
    p: function(e) { this.initialized ? e() : this.buffer.push(e); },
    buffer: [],
    router: {
      manifest: { routes: {} },
      matches: [rootMatch, childMatch],
      lastMatchId: "/_authenticated/"
    }
  };
  self.$_TSR.e();
})();
</script>`;

  const htmlContent = `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <meta name="theme-color" content="#060b08" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Kotoptan" />
    <meta name="format-detection" content="telephone=no" />
    <title>Kotoptan — Toptan Gıda ve Market Tüketim Malları Dağıtımı</title>
    <meta name="description" content="Kotoptan toptan gıda ve tüketim malları sipariş ve katalog yönetim platformu. Bitlis, Tatvan ve çevre ilçelere toptan gıda ve temizlik ürünleri dağıtımı." />
    <meta name="keywords" content="kotoptan, toptan gıda, toptan market, tatvan toptan, bitlis toptancı, gıda toptan, temizlik ürünleri toptan, bakliyat toptan, toptan satış" />
    <link rel="canonical" href="https://kotoptan.pages.dev/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kotoptan" />
    <meta property="og:url" content="https://kotoptan.pages.dev" />
    <meta property="og:title" content="Kotoptan — Toptan Gıda ve Market Tüketim Malları Dağıtımı" />
    <meta property="og:description" content="Kotoptan toptan gıda ve tüketim malları sipariş ve katalog yönetim platformu." />
    <meta property="og:image" content="https://kotoptan.pages.dev/kotoptan-logo-v2.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="tr_TR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Kotoptan — Toptan Gıda ve Market Tüketim Malları Dağıtımı" />
    <meta name="twitter:description" content="Kotoptan toptan gıda ve tüketim malları sipariş ve katalog yönetim platformu." />
    <meta name="twitter:image" content="https://kotoptan.pages.dev/kotoptan-logo-v2.jpg" />
    <link rel="icon" type="image/png" href="/favicon.png?v=20261010-k" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20261010-k" />
    <link rel="manifest" href="/manifest.webmanifest?v=20261010-k" />
    ${autoHealScript}
    ${styleTag}
  </head>
  <body>
    <div id="root"></div>
    ${tsrBootstrap}
    ${scriptTag}
  </body>
</html>
`;

  // Always write dist/index.html and dist/404.html to guarantee SPA loads
  const distIndexPath = path.join(distDir, "index.html");
  const dist404Path = path.join(distDir, "404.html");
  fs.writeFileSync(distIndexPath, htmlContent, "utf-8");
  fs.writeFileSync(dist404Path, htmlContent, "utf-8");
  if (fs.existsSync(outputPublicDir)) {
    fs.writeFileSync(path.join(outputPublicDir, "index.html"), htmlContent, "utf-8");
    fs.writeFileSync(path.join(outputPublicDir, "404.html"), htmlContent, "utf-8");
  }
  console.log(
    `Generated dist/index.html & dist/404.html with JS: ${jsEntryFile}, CSS: ${cssEntryFile}`,
  );

  // 5. Patch _worker.js renderer-template so worker returns working SSR or SPA HTML instead of blank template
  const workerRendererChunkPath = path.join(
    distDir,
    "_worker.js",
    "_chunks",
    "renderer-template.mjs",
  );
  if (fs.existsSync(workerRendererChunkPath)) {
    const escapedHtml = JSON.stringify(htmlContent);
    const patchedRendererCode = `import { i as HTTPResponse } from "../_libs/h3+rou3+srvx.mjs";
const fallbackHtml = ${escapedHtml};
const rendererTemplate = () => new HTTPResponse(fallbackHtml, { headers: { "content-type": "text/html; charset=utf-8" } });

async function renderIndexHTML(event) {
  const ssr = globalThis.__nitro_vite_envs__?.["ssr"];
  if (ssr && typeof ssr.fetch === "function") {
    try {
      const rawReq = event.web?.request || event.req?.raw || event.node?.req || event.req;
      if (rawReq) {
        const response = await ssr.fetch(rawReq);
        if (response && response.status && response.status < 500) {
          return response;
        }
      }
    } catch (ssrError) {
      console.warn("[Cloudflare Pages SSR Fallback to SPA HTML]:", ssrError);
    }
  }
  return rendererTemplate(event.req);
}

export { renderIndexHTML as default };
`;
    fs.writeFileSync(workerRendererChunkPath, patchedRendererCode, "utf-8");
    console.log(
      "Patched dist/_worker.js/_chunks/renderer-template.mjs with SSR dispatch and SPA fallback.",
    );
  }

  // 5.5 Polyfill jsxDEV on worker React chunks so SSR never throws "jsxDEV is not a function"
  const workerLibsDir = path.join(distDir, "_worker.js", "_libs");
  if (fs.existsSync(workerLibsDir)) {
    const libFiles = fs.readdirSync(workerLibsDir);
    for (const file of libFiles) {
      if (file.includes("react") && file.endsWith(".mjs")) {
        const filePath = path.join(workerLibsDir, file);
        let content = fs.readFileSync(filePath, "utf-8");
        if (
          content.includes("require_react_jsx_dev_runtime_production") &&
          !content.includes("jsxDEV")
        ) {
          content = content.replace(
            "module.exports = require_react_jsx_dev_runtime_production();",
            "const devProd = require_react_jsx_dev_runtime_production(); module.exports = { ...devProd, jsxDEV: (type, props, key) => (devProd.jsx || devProd.createElement || ((t, p) => ({ type: t, props: p })))(type, props, key) };",
          );
          fs.writeFileSync(filePath, content, "utf-8");
          console.log(`Patched jsxDEV in worker lib: ${file}`);
        }
      }
    }
  }

  const distFilesCount = fs.readdirSync(distDir).length;
  console.log(
    `Build artifacts successfully prepared in dist/ (${distFilesCount} top-level entries).`,
  );
} catch (err) {
  console.error("Error copying build artifacts to dist:", err);
  process.exit(1);
}
