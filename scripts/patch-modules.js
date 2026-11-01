import fs from "fs";
import path from "path";

function patchTanStack(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      patchTanStack(full);
    } else if (/\.(js|mjs|ts)$/.test(item.name)) {
      try {
        let content = fs.readFileSync(full, "utf8");
        let changed = false;
        if (content.includes("id.replaceAll(")) {
          content = content.replace(/id\.replaceAll\(/g, '(id || "").replaceAll(');
          changed = true;
        }
        if (content.includes("segment.replaceAll(")) {
          content = content.replace(/segment\.replaceAll\(/g, '(segment || "").replaceAll(');
          changed = true;
        }
        if (changed) {
          fs.writeFileSync(full, content, "utf8");
          console.log(`[patch-modules] Patched: ${full}`);
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

console.log("[patch-modules] Checking and patching node_modules/@tanstack...");
patchTanStack("node_modules/@tanstack");
console.log("[patch-modules] Done.");
