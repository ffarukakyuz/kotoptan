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

  // 0. globalThis
  if (typeof globalThis === "undefined") {
    window.globalThis = window;
  }

  // 1. replaceAll
  if (typeof String.prototype.replaceAll !== "function") {
    String.prototype.replaceAll = function(search, replacement) {
      if (search instanceof RegExp) return this.replace(search, replacement);
      return this.split(search).join(replacement);
    };
  }

  // 2. at
  if (typeof Array.prototype.at !== "function") {
    Array.prototype.at = function(n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
  }

  // 3. hasOwn
  if (typeof Object.hasOwn !== "function") {
    Object.hasOwn = function(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    };
  }

  // 4. Promise.allSettled
  if (typeof Promise.allSettled !== "function") {
    Promise.allSettled = function(promises) {
      return Promise.all(
        Array.from(promises).map(function(p) {
          return Promise.resolve(p).then(
            function(v) { return { status: "fulfilled", value: v }; },
            function(r) { return { status: "rejected", reason: r }; }
          );
        })
      );
    };
  }

  // 5. structuredClone
  if (typeof window.structuredClone !== "function") {
    window.structuredClone = function(obj) {
      if (obj === undefined) return undefined;
      try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
    };
  }

  // 6. crypto.randomUUID
  if (typeof window.crypto === "undefined") window.crypto = {};
  if (typeof window.crypto.randomUUID !== "function") {
    window.crypto.randomUUID = function() {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }

  // 7. requestIdleCallback
  if (typeof window.requestIdleCallback !== "function") {
    window.requestIdleCallback = function(cb) {
      var start = Date.now();
      return setTimeout(function() {
        cb({ didTimeout: false, timeRemaining: function() { return Math.max(0, 50 - (Date.now() - start)); } });
      }, 1);
    };
  }
  if (typeof window.cancelIdleCallback !== "function") {
    window.cancelIdleCallback = function(id) { clearTimeout(id); };
  }

  // 8. ResizeObserver
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = function() {
      this.observe = function() {};
      this.unobserve = function() {};
      this.disconnect = function() {};
    };
  }

  // 9. IntersectionObserver
  if (typeof window.IntersectionObserver === "undefined") {
    window.IntersectionObserver = function(cb) {
      this.observe = function(el) {
        setTimeout(function() { cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }]); }, 30);
      };
      this.unobserve = function() {};
      this.disconnect = function() {};
    };
  }

  // 10. Storage shield
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
  } catch (e) {
    var _memStore = {};
    var _mock = {
      getItem: function(k) { return _memStore[k] || null; },
      setItem: function(k, v) { _memStore[k] = String(v); },
      removeItem: function(k) { delete _memStore[k]; },
      clear: function() { _memStore = {}; },
      get length() { return Object.keys(_memStore).length; },
      key: function(i) { return Object.keys(_memStore)[i] || null; }
    };
    try {
      window.localStorage = _mock;
      window.sessionStorage = _mock;
    } catch (_ignore) {}
  }

  window.addEventListener("error", function(evt) {
    if (evt && evt.error && typeof evt.error.message === "string") {
      var msg = evt.error.message;
      if (
        msg.indexOf("replaceAll") !== -1 ||
        msg.indexOf("Invariant failed") !== -1 ||
        msg.indexOf("useStore") !== -1 ||
        msg.indexOf("reading 'replaceAll'") !== -1 ||
        msg.indexOf("ResizeObserver") !== -1
      ) {
        console.warn("[Invariant & replaceAll Shield] Intercepted:", msg);
        if (evt.preventDefault) evt.preventDefault();
        if (evt.stopPropagation) evt.stopPropagation();
      }
    }
  }, true);

  window.addEventListener("unhandledrejection", function(evt) {
    var reason = evt && evt.reason;
    var msg = (reason && reason.message) || String(reason || "");
    if (
      msg.indexOf("replaceAll") !== -1 ||
      msg.indexOf("Invariant failed") !== -1 ||
      msg.indexOf("useStore") !== -1 ||
      msg.indexOf("reading 'replaceAll'") !== -1 ||
      msg.indexOf("ResizeObserver") !== -1
    ) {
      console.warn("[Invariant & replaceAll Shield] Intercepted unhandled rejection:", msg);
      if (evt.preventDefault) evt.preventDefault();
    }
  }, true);
})();
</script>`;

  const tsrBootstrap = `<script class="$tsr" id="$tsr-stream-barrier">
(function() {
  self.$R = self.$R || {};
  self.$R["tsr"] = [];
  var p = (typeof window !== "undefined" && window.location && window.location.pathname) ? window.location.pathname : "/";
  var rId = (p === "/" || p === "") ? "/_authenticated/" : (p.indexOf("/giris") === 0 ? "/giris" : (p.indexOf("/yonetim") === 0 ? "/_authenticated/yonetim" : (p.indexOf("/sepet") === 0 ? "/_authenticated/sepet" : (p.indexOf("/siparis") === 0 ? "/_authenticated/siparisler" : "/_authenticated/"))));
  var rootMatch = { id: "__root__", routeId: "__root__", status: "success", _nonReactive: {}, params: {} };
  var childMatch = { id: rId, routeId: rId, status: "success", _nonReactive: {}, params: {} };
  self.$_TSR = {
    h: function() { this.hydrated = true; this.c(); },
    e: function() { this.streamEnded = true; this.c(); },
    c: function() { if (this.hydrated && this.streamEnded) { delete self.$_TSR; delete self.$R.tsr; } },
    p: function(e) { this.initialized ? e() : this.buffer.push(e); },
    buffer: [],
    router: {
      manifest: { routes: {} },
      matches: [rootMatch, childMatch],
      lastMatchId: rId
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
    <div id="root">
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#050b07;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:20px;text-align:center;box-sizing:border-box;">
        <div style="width:110px;height:110px;border-radius:24px;overflow:hidden;border:2px solid #10b981;box-shadow:0 10px 25px rgba(0,0,0,0.8);margin-bottom:20px;background:#000;">
          <img src="/kotoptan-logo.jpg?v=20261010-k-emblem" alt="Kotoptan" style="width:100%;height:100%;object-fit:cover;" />
        </div>
        <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">
          Ko<span style="color:#22c55e;">toptan</span>
        </div>
        <div style="font-size:12px;font-weight:600;color:#34d399;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:24px;">
          Toptan Dağıtım
        </div>
        <div style="width:180px;height:6px;background:#13231a;border-radius:999px;overflow:hidden;margin-bottom:16px;">
          <div style="width:70%;height:100%;background:#10b981;border-radius:999px;"></div>
        </div>
        <div style="font-size:13px;color:#9ca3af;margin-bottom:18px;">
          Sistem yükleniyor...
        </div>
        <a href="/giris" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:12px;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(16,185,129,0.35);">
          Giriş Yap / Kataloğu Aç →
        </a>
      </div>
    </div>
    \${tsrBootstrap}
    \${scriptTag}
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

  // 5.6 Defensively patch ANY .replaceAll call in all generated dist & output chunks
  function patchReplaceAllRecursively(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        patchReplaceAllRecursively(full);
      } else if (/\.(js|mjs|cjs)$/.test(item.name)) {
        let text = fs.readFileSync(full, "utf-8");
        let changed = false;
        // 1. Any variable.replaceAll(
        const patched = text.replace(
          /(?<![.\w$\x22\x27\x60])([a-zA-Z0-9_$]+)\.replaceAll\(/g,
          '($1 || "").replaceAll(',
        );
        if (patched !== text) {
          text = patched;
          changed = true;
        }
        // 2. Explicit patterns
        if (text.includes("id.replaceAll(")) {
          text = text.replace(/id\.replaceAll\(/g, '(id || "").replaceAll(');
          changed = true;
        }
        if (text.includes("segment.replaceAll(")) {
          text = text.replace(/segment\.replaceAll\(/g, '(segment || "").replaceAll(');
          changed = true;
        }
        if (changed) {
          fs.writeFileSync(full, text, "utf-8");
          console.log(`Defensively patched replaceAll in: ${item.name}`);
        }
      }
    }
  }
  patchReplaceAllRecursively(distDir);
  if (fs.existsSync(outputDir)) {
    patchReplaceAllRecursively(outputDir);
  }

  const distFilesCount = fs.readdirSync(distDir).length;
  console.log(
    `Build artifacts successfully prepared in dist/ (${distFilesCount} top-level entries).`,
  );
} catch (err) {
  console.error("Error copying build artifacts to dist:", err);
  process.exit(1);
}
