import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const assetDirs = [
  path.join(rootDir, "src/assets/products"),
  path.join(rootDir, "src/assets/products/types"),
];

const publicProductsDir = path.join(rootDir, "public/products");
const publicL5eDir = path.join(rootDir, "public/__l5e/assets-v1");
const publicSrcAssetsImagesDir = path.join(rootDir, "public/src/assets/images");

fs.mkdirSync(publicProductsDir, { recursive: true });
fs.mkdirSync(publicL5eDir, { recursive: true });
fs.mkdirSync(publicSrcAssetsImagesDir, { recursive: true });

// Copy Dalan soap image to public directories
const dalanSoapSrc = path.join(
  rootDir,
  "src/assets/images/dalan_gliserinli_sabun_1790110969698.jpg",
);
if (fs.existsSync(dalanSoapSrc)) {
  fs.copyFileSync(
    dalanSoapSrc,
    path.join(publicProductsDir, "dalan_gliserinli_sabun_1790110969698.jpg"),
  );
  fs.copyFileSync(
    dalanSoapSrc,
    path.join(publicSrcAssetsImagesDir, "dalan_gliserinli_sabun_1790110969698.jpg"),
  );
  console.log("Copied Dalan soap image to public/");
}

const previewHosts = [
  "https://dfe059c8-1284-481c-be64-b6fbbb9d793b.lovableproject.com",
  "https://id-preview--dfe059c8-1284-481c-be64-b6fbbb9d793b.lovable.app",
];

async function downloadWithFallback(assetUrl) {
  for (const host of previewHosts) {
    const fullUrl = `${host}${assetUrl}`;
    try {
      const res = await fetch(fullUrl);
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch {
      // try next host
    }
  }
  throw new Error(`Failed to download ${assetUrl} from all hosts`);
}

async function run() {
  const jsonFiles = [];

  for (const dir of assetDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith(".asset.json")) {
        jsonFiles.push(path.join(dir, file));
      }
    }
  }

  console.log(`Found ${jsonFiles.length} asset metadata files. Starting download...`);

  let successCount = 0;
  let failCount = 0;
  const imageMap = {};

  for (const jsonPath of jsonFiles) {
    try {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const data = JSON.parse(raw);
      const { asset_id, original_filename, url } = data;

      if (!original_filename || !asset_id) continue;

      const destFile = path.join(publicProductsDir, original_filename);
      const destL5eDir = path.join(publicL5eDir, asset_id);
      fs.mkdirSync(destL5eDir, { recursive: true });
      const destL5eFile = path.join(destL5eDir, original_filename);

      imageMap[url] = `/products/${original_filename}`;
      imageMap[original_filename] = `/products/${original_filename}`;

      // If already downloaded and has content, skip network download
      if (fs.existsSync(destFile) && fs.statSync(destFile).size > 1000) {
        if (!fs.existsSync(destL5eFile)) {
          fs.copyFileSync(destFile, destL5eFile);
        }
        successCount++;
        continue;
      }

      console.log(`Downloading: ${original_filename}...`);
      const buffer = await downloadWithFallback(url);
      const nodeBuf = Buffer.from(buffer);

      fs.writeFileSync(destFile, nodeBuf);
      fs.writeFileSync(destL5eFile, nodeBuf);

      successCount++;
    } catch (err) {
      console.error(`Error downloading ${jsonPath}:`, err.message);
      failCount++;
    }
  }

  console.log(`\nCompleted! Successfully downloaded ${successCount} images. Failed: ${failCount}`);

  // Generate image mapping TypeScript module
  const mapContent = `// Auto-generated product image mapping for production & local hosting
export const PRODUCT_IMAGE_MAP: Record<string, string> = ${JSON.stringify(imageMap, null, 2)};

export function getPublicProductImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Clean up whitespace
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Base64 data URLs work anywhere
  if (trimmed.startsWith("data:")) return trimmed;

  // Direct public path
  if (trimmed.startsWith("/products/")) return trimmed;

  // Check direct mapping
  if (PRODUCT_IMAGE_MAP[trimmed]) {
    return PRODUCT_IMAGE_MAP[trimmed];
  }

  // If URL contains /__l5e/assets-v1/...
  if (trimmed.includes("/__l5e/assets-v1/")) {
    const filename = trimmed.split("/").pop();
    if (filename && PRODUCT_IMAGE_MAP[filename]) {
      return PRODUCT_IMAGE_MAP[filename];
    }
    if (filename) {
      return "/products/" + filename;
    }
    return trimmed;
  }

  // If local /src/assets/images/...
  if (trimmed.includes("/src/assets/images/")) {
    const filename = trimmed.split("/").pop();
    return filename ? "/products/" + filename : trimmed;
  }

  return trimmed;
}
`;

  fs.writeFileSync(path.join(rootDir, "src/lib/product-image-map.ts"), mapContent, "utf-8");
  console.log("Generated src/lib/product-image-map.ts mapping module.");
}

run();
