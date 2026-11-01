import {
  getAllCatalogProducts,
  getPermanentlyDeletedIds,
  getPermanentlyDeletedNames,
  getProductOverrides,
  getCustomProducts,
} from "./custom-products";
import type { Product } from "./catalog";

export interface GitHubSyncResult {
  ok: boolean;
  commitHash?: string;
  error?: string;
  logs: string[];
  lastSyncedAt: string;
}

/**
 * Mevcut tüm katalog ürünlerini (fotoğraflar, düzenlemeler, silinenler filtrelenmiş halde)
 * temiz TypeScript formatında string olarak üretir.
 */
export function generateProductsTsSource(products: Product[]): string {
  const serialized = JSON.stringify(products, null, 2);
  return `import type { Product } from "@/lib/catalog";

/**
 * Canlı siteden (https://kotoptan.pages.dev) ve Yönetim Panelinden
 * senkronize edilmiş gerçek toptan ürün kataloğu.
 * Toplam ürün sayısı: ${products.length}
 * Senkronizasyon tarihi: ${new Date().toISOString()}
 */
export const FALLBACK_PRODUCTS: Product[] = ${serialized};
`;
}

/**
 * Kalıcı olarak silinen ürünlerin JSON dosya içeriğini üretir
 */
export function generatePermanentlyDeletedJson(): string {
  const deletedIds = Array.from(getPermanentlyDeletedIds() || []);
  const deletedNames = Array.from(getPermanentlyDeletedNames() || []);
  return JSON.stringify(
    {
      deletedIds,
      deletedNames,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

/**
 * Tarayıcıdaki tüm özel katalog verisini (overrides, silinenler, eklenenler)
 * JSON formatında dışa aktarır (Yedekleme veya kopyalama için).
 */
export function exportCatalogDataJSON(): string {
  const allProducts = getAllCatalogProducts();
  const overrides = getProductOverrides();
  const customProducts = getCustomProducts();
  const deletedIds = Array.from(getPermanentlyDeletedIds() || []);
  const deletedNames = Array.from(getPermanentlyDeletedNames() || []);

  const exportObj = {
    exportedAt: new Date().toISOString(),
    totalActiveProducts: allProducts.length,
    overridesCount: Object.keys(overrides).length,
    deletedCount: deletedIds.length,
    allProducts,
    overrides,
    customProducts,
    permanentlyDeleted: {
      deletedIds,
      deletedNames,
    },
  };

  return JSON.stringify(exportObj, null, 2);
}

/**
 * Dışarıdan verilen JSON verisini içe aktararak yerel katalog durumunu günceller.
 */
export function importCatalogDataJSON(jsonStr: string): {
  ok: boolean;
  count: number;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== "object") {
      return { ok: false, count: 0, error: "Geçersiz JSON formatı." };
    }

    if (data.overrides && typeof data.overrides === "object") {
      localStorage.setItem("ko_product_overrides_v2", JSON.stringify(data.overrides));
    }

    if (Array.isArray(data.customProducts)) {
      localStorage.setItem("custom_added_products", JSON.stringify(data.customProducts));
    }

    if (data.permanentlyDeleted && typeof data.permanentlyDeleted === "object") {
      const ids = Array.isArray(data.permanentlyDeleted.deletedIds)
        ? data.permanentlyDeleted.deletedIds
        : [];
      const names = Array.isArray(data.permanentlyDeleted.deletedNames)
        ? data.permanentlyDeleted.deletedNames
        : [];
      localStorage.setItem("ko_permanently_deleted_products_v2", JSON.stringify(ids));
      localStorage.setItem("ko_permanently_deleted_names_v2", JSON.stringify(names));
    }

    window.dispatchEvent(new Event("catalog_updated"));
    window.dispatchEvent(new Event("storage"));

    const count = Array.isArray(data.allProducts)
      ? data.allProducts.length
      : getAllCatalogProducts()?.length || 0;
    return { ok: true, count };
  } catch (err) {
    return {
      ok: false,
      count: 0,
      error: err instanceof Error ? err.message : "JSON ayrıştırma hatası",
    };
  }
}

/**
 * Tarayıcıdan bir dosya olarak JSON yedeğini indirtir
 */
export function downloadCatalogBackupFile(): void {
  const jsonContent = exportCatalogDataJSON();
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `kotoptan-katalog-yedek-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * GitHub REST API üzerinden tarayıcıdan doğrudan git commit & push işlemini gerçekleştirir.
 * Bu sayede Cloudflare Pages veya statik ortamda bile git CLI olmadan gerçek commit atılır.
 */
export async function pushCatalogDirectlyToGitHub(options: {
  token: string;
  repo?: string;
  branch?: string;
  commitMessage?: string;
  onProgress?: (msg: string) => void;
}): Promise<GitHubSyncResult> {
  const logs: string[] = [];
  const addLog = (msg: string) => {
    logs.push(msg);
    options.onProgress?.(msg);
  };

  const token = options.token.trim();
  const repo = (options.repo || "ffarukakyuz/kotoptan").trim();
  const branch = (options.branch || "main").trim();
  const commitMsg = (
    options.commitMessage ||
    "Katalog güncellemesi: Güncellenen ürün fotoğrafları ve silinen ürünler"
  ).trim();

  if (!token) {
    const err = "GitHub Personal Access Token (PAT) girilmedi.";
    addLog(`❌ ${err}`);
    return { ok: false, error: err, logs, lastSyncedAt: new Date().toISOString() };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  try {
    addLog(`🔍 GitHub deposu kontrol ediliyor (${repo}, dal: ${branch})...`);

    // 1. Get HEAD reference
    const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, {
      headers,
    });

    if (!refRes.ok) {
      if (refRes.status === 401 || refRes.status === 403) {
        throw new Error(
          "GitHub Token yetkisi yetersiz veya süresi dolmuş. Lütfen 'repo' yetkili bir Token kullanın.",
        );
      }
      if (refRes.status === 404) {
        throw new Error(`Belirtilen dal (${branch}) veya depo (${repo}) bulunamadı.`);
      }
      throw new Error(`GitHub API hatası (HTTP ${refRes.status})`);
    }

    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;
    addLog(`✅ Mevcut HEAD commit bulundu: ${latestCommitSha.slice(0, 7)}`);

    // 2. Get the commit to find base tree
    const commitRes = await fetch(
      `https://api.github.com/repos/${repo}/git/commits/${latestCommitSha}`,
      {
        headers,
      },
    );
    if (!commitRes.ok) {
      throw new Error("Mevcut commit ağacı okunamadı.");
    }
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Prepare file contents from active catalog
    addLog("📦 Tarayıcıdaki ürün fotoğrafları, düzenlemeler ve silinen ürünler derleniyor...");
    const activeProducts = getAllCatalogProducts();
    addLog(`ℹ️ Toplam ${activeProducts.length} aktif ürün derlendi.`);

    const productsTsContent = generateProductsTsSource(activeProducts);
    const permanentlyDeletedContent = generatePermanentlyDeletedJson();

    // 4. Create new tree
    addLog("🌲 GitHub üzerinde yeni dosya ağacı (Git Tree) oluşturuluyor...");
    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [
          {
            path: "src/data/products.ts",
            mode: "100644",
            type: "blob",
            content: productsTsContent,
          },
          {
            path: "src/data/permanently-deleted.json",
            mode: "100644",
            type: "blob",
            content: permanentlyDeletedContent,
          },
        ],
      }),
    });

    if (!treeRes.ok) {
      const errJson = await treeRes.json().catch(() => ({}));
      throw new Error(`Git Tree oluşturulamadı: ${errJson.message || treeRes.statusText}`);
    }

    const treeData = await treeRes.json();
    const newTreeSha = treeData.sha;
    addLog(`✅ Yeni dosya ağacı hazırlandı: ${newTreeSha.slice(0, 7)}`);

    // 5. Create new commit
    addLog(`📝 Yeni commit kaydediliyor: "${commitMsg}"...`);
    const newCommitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: commitMsg,
        tree: newTreeSha,
        parents: [latestCommitSha],
      }),
    });

    if (!newCommitRes.ok) {
      const errJson = await newCommitRes.json().catch(() => ({}));
      throw new Error(`Commit oluşturulamadı: ${errJson.message || newCommitRes.statusText}`);
    }

    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;
    addLog(`✅ Yeni commit oluşturuldu: ${newCommitSha.slice(0, 7)}`);

    // 6. Update branch ref (push)
    addLog(`🚀 GitHub dalı güncelleniyor (git push origin ${branch})...`);
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          sha: newCommitSha,
          force: false,
        }),
      },
    );

    if (!updateRefRes.ok) {
      const errJson = await updateRefRes.json().catch(() => ({}));
      throw new Error(
        `Dal referansı güncellenemedi: ${errJson.message || updateRefRes.statusText}`,
      );
    }

    const now = new Date().toISOString();
    addLog(
      `🎉 Başarılı! Tüm ürün fotoğrafları ve katalog güncellemeleri GitHub (${repo}) ana dalına push edildi.`,
    );
    addLog(`🌐 Cloudflare Pages otomatik dağıtımı tetiklendi (kotoptan.pages.dev).`);

    return {
      ok: true,
      commitHash: newCommitSha.slice(0, 7),
      logs,
      lastSyncedAt: now,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "GitHub eşitleme hatası";
    addLog(`❌ Hata: ${errorMsg}`);
    return {
      ok: false,
      error: errorMsg,
      logs,
      lastSyncedAt: new Date().toISOString(),
    };
  }
}
