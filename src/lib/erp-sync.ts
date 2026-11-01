import type { Product } from "./catalog";
import { formatUnitLabel } from "./catalog";
import { saveCustomProduct, getCustomProducts } from "./custom-products";

/**
 * ERP 12 SQL Veritabanı Tablo Yapısı
 * ERP 12 (ve uyumlu ticari otomasyonlar: Mikro, Akınsoft, Vega, Logo SQL)
 * standart Stok Kartları ve Bakiye alanları.
 */
export interface ERP12ProductRow {
  /** Stok Kodu veya Barkod (ERP 12: STOK_KODU / BARKOD) */
  STOK_KODU: string;
  /** Stok Adı (ERP 12: STOK_ADI / MALIN_CINSI) */
  STOK_ADI: string;
  /** Ana Grup / Kategori (ERP 12: ANA_GRUP / GRUP_KODU / KATEGORI) */
  ANA_GRUP?: string;
  /** Birim (ERP 12: BIRIM / BIRIM1: Koli, Paket, Çuval, Adet, KG) */
  BIRIM?: string;
  /** Depo Kalan Bakiye / Miktar (ERP 12: BAKIYE / KALAN_MIKTAR / STOK_MIKTARI) */
  BAKIYE?: number | string;
  /** Koli İçi / Ambalaj Bilgisi (ERP 12: KOLI_ICI / PAYDA / ACIKLAMA) */
  KOLI_ICI?: string | number;
  /** Ürün Açıklaması (ERP 12: ACIKLAMA / OZEL_KOD1) */
  ACIKLAMA?: string;
  /** Aktif/Pasif Durumu (ERP 12: AKTIF / PASIF / DURUM: 1=Aktif, 0=Pasif) */
  AKTIF?: boolean | number | string;
  /** Barkod Numarası */
  BARKOD?: string;
  /** Resim URL veya Dosya Adı */
  RESIM_URL?: string;
}

export interface ERP12SyncStatus {
  connected: boolean;
  lastSyncAt: string | null;
  totalSyncedProducts: number;
  inStockCount: number;
  outOfStockCount: number;
  source: string;
  lastSyncMessage?: string;
}

const ERP_SYNC_STORAGE_KEY = "kotoptan_erp12_sync_status";
const ERP_MAPPINGS_STORAGE_KEY = "kotoptan_erp12_last_dataset";

/**
 * ERP 12 Grup Kodlarını Sitedeki Standart 4 Kategoriye Eşler:
 * "gida" | "bakliyat" | "temizlik" | "kisisel"
 */
export function mapERP12Category(rawGroup?: string): "gida" | "bakliyat" | "temizlik" | "kisisel" {
  if (!rawGroup) return "gida";
  const normalized = rawGroup.toLowerCase().trim();

  if (
    normalized.includes("temiz") ||
    normalized.includes("deterjan") ||
    normalized.includes("camasir") ||
    normalized.includes("bulasik") ||
    normalized.includes("yuzey") ||
    normalized.includes("sabun") ||
    normalized.includes("kagit") ||
    normalized.includes("havlu") ||
    normalized.includes("pecete")
  ) {
    return "temizlik";
  }

  if (
    normalized.includes("bakliyat") ||
    normalized.includes("pirinc") ||
    normalized.includes("mercimek") ||
    normalized.includes("bulgur") ||
    normalized.includes("fasulye") ||
    normalized.includes("nohut") ||
    normalized.includes("bugday")
  ) {
    return "bakliyat";
  }

  if (
    normalized.includes("kisisel") ||
    normalized.includes("kozmetik") ||
    normalized.includes("bebek") ||
    normalized.includes("bezi") ||
    normalized.includes("sampuan") ||
    normalized.includes("dis") ||
    normalized.includes("kolonya")
  ) {
    return "kisisel";
  }

  return "gida";
}

/**
 * ERP 12 Birimlerini Sitedeki Standart Birimlere Eşler:
 * "koli" | "paket" | "çuval" | "adet"
 */
export function mapERP12Unit(rawUnit?: string): "koli" | "paket" | "çuval" | "adet" {
  if (!rawUnit) return "adet";
  const normalized = rawUnit.toLowerCase().trim();
  if (normalized.includes("koli") || normalized.includes("kl")) return "koli";
  if (normalized.includes("paket") || normalized.includes("pkt")) return "paket";
  if (normalized.includes("cuval") || normalized.includes("çuval") || normalized.includes("çvl"))
    return "çuval";
  return "adet";
}

/**
 * ERP 12 Satırını Standart Kotoptan Ürün Nesnesine Dönüştürür
 */
export function convertERP12RowToProduct(row: ERP12ProductRow): Product {
  const id = String(row.STOK_KODU || row.BARKOD || `erp-${Date.now()}`).trim();
  const name = String(row.STOK_ADI || "").trim();
  const category = mapERP12Category(row.ANA_GRUP);
  const unit = mapERP12Unit(row.BIRIM);

  // Bakiye kontrolü (Eğer bakiye > 0 ise stokta var)
  let inStock = true;
  if (row.BAKIYE !== undefined && row.BAKIYE !== null && row.BAKIYE !== "") {
    const num =
      typeof row.BAKIYE === "number"
        ? row.BAKIYE
        : parseFloat(String(row.BAKIYE).replace(",", "."));
    inStock = !isNaN(num) && num > 0;
  }

  // Aktif/Pasif kontrolü
  let isActive = true;
  if (row.AKTIF !== undefined && row.AKTIF !== null) {
    if (typeof row.AKTIF === "boolean") isActive = row.AKTIF;
    else if (typeof row.AKTIF === "number") isActive = row.AKTIF === 1;
    else if (typeof row.AKTIF === "string") {
      const lower = row.AKTIF.toLowerCase();
      isActive = lower === "1" || lower === "true" || lower === "aktif" || lower === "a";
    }
  }

  // Ambalaj ve Koli İçi Açıklamasını Derle
  let description = row.ACIKLAMA ? String(row.ACIKLAMA).trim() : "";
  if (row.KOLI_ICI) {
    const koliStr = `${row.KOLI_ICI} Adet / Koli`;
    if (!description.toLowerCase().includes("koli")) {
      description = description ? `${description} (${koliStr})` : koliStr;
    }
  }
  if (!inStock && !description.includes("[TÜKENDİ]")) {
    description = description ? `${description} [TÜKENDİ]` : "[TÜKENDİ]";
  }

  return {
    id,
    name,
    category,
    unit,
    description,
    image_url: row.RESIM_URL || null,
    is_active: isActive,
    in_stock: inStock,
  };
}

/**
 * ERP 12 SQL Dump veya JSON verisini işleyip yerel ve sunucu kataloğuna senkronize eder
 */
export async function ingestERP12Data(
  data: ERP12ProductRow[] | string,
  options?: { sourceName?: string },
): Promise<{
  success: boolean;
  totalProcessed: number;
  updatedCount: number;
  inStockCount: number;
  outOfStockCount: number;
  products: Product[];
  message: string;
}> {
  let rows: ERP12ProductRow[] = [];

  if (typeof data === "string") {
    // JSON dize kontrolü
    const trimmed = data.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } catch (jsonErr) {
        throw new Error(
          `ERP 12 JSON parse hatası: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`,
        );
      }
    } else {
      // Basit SQL INSERT parser (Örn: INSERT INTO STOKLAR (...) VALUES (...))
      rows = parseERP12SqlDump(trimmed);
    }
  } else if (Array.isArray(data)) {
    rows = data;
  }

  if (rows.length === 0) {
    return {
      success: false,
      totalProcessed: 0,
      updatedCount: 0,
      inStockCount: 0,
      outOfStockCount: 0,
      products: [],
      message: "İşlenecek ERP 12 veri satırı bulunamadı.",
    };
  }

  const convertedProducts: Product[] = [];
  let inStockCount = 0;
  let outOfStockCount = 0;

  for (const row of rows) {
    if (!row || (!row.STOK_KODU && !row.STOK_ADI)) continue;
    const p = convertERP12RowToProduct(row);
    convertedProducts.push(p);

    if (p.in_stock) inStockCount++;
    else outOfStockCount++;

    // Tarayıcı yerel özel ürün deposuna kaydet
    try {
      saveCustomProduct(p);
    } catch (saveErr) {
      console.warn("[ERP12] Ürün kaydedilirken atlandı:", p.id, saveErr);
    }
  }

  // Sunucu API'sine de arka planda bildir (/api/erp-sync)
  try {
    await fetch("/api/erp-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: options?.sourceName || "ERP 12 SQL",
        products: convertedProducts,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {
      // Arka plan sunucu hatası yerel akışı engellemez
    });
  } catch {
    // ignore
  }

  // Durumu yerel depoya kaydet
  const status: ERP12SyncStatus = {
    connected: true,
    lastSyncAt: new Date().toISOString(),
    totalSyncedProducts: convertedProducts.length,
    inStockCount,
    outOfStockCount,
    source: options?.sourceName || "ERP 12 SQL Entegratörü",
    lastSyncMessage: `${convertedProducts.length} adet ERP 12 ürünü ve stok durumu başarıyla güncellendi.`,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ERP_SYNC_STORAGE_KEY, JSON.stringify(status));
      // Event fırlat: Tüm katalog ve canlı vitrin anında yeniden render olsun
      window.dispatchEvent(new CustomEvent("catalog_updated"));
      window.dispatchEvent(new CustomEvent("product_stock_status_changed"));
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    totalProcessed: rows.length,
    updatedCount: convertedProducts.length,
    inStockCount,
    outOfStockCount,
    products: convertedProducts,
    message: `${convertedProducts.length} ürün ERP 12 SQL veritabanından başarıyla aktarıldı.`,
  };
}

/**
 * SQL INSERT / SELECT satırlarını ayıklar (ERP 12 dump desteği)
 */
function parseERP12SqlDump(sql: string): ERP12ProductRow[] {
  const results: ERP12ProductRow[] = [];
  const lines = sql.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("--") || trimmed.startsWith("/*")) continue;

    // INSERT INTO STOK ... VALUES ('KOD', 'AD', 'GRUP', 'BIRIM', BAKIYE, 'KOLI_ICI')
    const match = trimmed.match(/VALUES\s*\((.*?)\)/i);
    if (match && match[1]) {
      const parts = match[1].split(",").map((p) => p.trim().replace(/^['"]|['"]$/g, ""));

      if (parts.length >= 2) {
        results.push({
          STOK_KODU: parts[0] || "",
          STOK_ADI: parts[1] || "",
          ANA_GRUP: parts[2] || "Gıda",
          BIRIM: parts[3] || "Adet",
          BAKIYE: parts[4] !== undefined ? parts[4] : 100,
          KOLI_ICI: parts[5] || "",
        });
      }
    }
  }

  return results;
}

/**
 * Son senkronizasyon durumunu döndürür
 */
export function getERP12SyncStatus(): ERP12SyncStatus {
  if (typeof window === "undefined") {
    return {
      connected: true,
      lastSyncAt: new Date().toISOString(),
      totalSyncedProducts: 0,
      inStockCount: 0,
      outOfStockCount: 0,
      source: "ERP 12 SQL",
    };
  }

  try {
    const raw = localStorage.getItem(ERP_SYNC_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  return {
    connected: false,
    lastSyncAt: null,
    totalSyncedProducts: 0,
    inStockCount: 0,
    outOfStockCount: 0,
    source: "ERP 12 SQL",
  };
}
