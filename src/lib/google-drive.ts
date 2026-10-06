import type { Product } from "./catalog";

export interface DriveUser {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number | string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface DriveOrder {
  id: string;
  created_at: string;
  archived_at: string | null;
  status: string;
  full_name: string;
  business_name: string;
  district: string;
  phone: string;
  address: string;
  note: string;
  order_items: {
    id: string;
    product_name: string;
    unit: string;
    quantity: number;
  }[];
}

export const DRIVE_CONFIG = {
  appName: "KasımOğulları Toptan",
  driveFolderName: "KasimOgullari-Depo-Verileri",
};

export const DRIVE_SCOPES = [] as const;

// In-Memory & Local Backup Registry
const BACKUP_STORAGE_KEY = "kasimogullari_backup_registry";

function getLocalBackups(): DriveFileItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalBackupItem(item: DriveFileItem) {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalBackups();
    const updated = [item, ...list.filter((b) => b.id !== item.id)];
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

/**
 * Downloads a text/JSON file directly to the client browser
 */
function downloadFileToClient(fileName: string, content: string, mimeType = "application/json") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Firebase-free connection handler
 */
export async function connectGoogleDrive(): Promise<DriveUser> {
  const user: DriveUser = {
    displayName: "KasımOğulları Yönetici",
    email: "yonetim@kasimogullari.com",
    photoURL: null,
  };
  return user;
}

export async function disconnectGoogleDrive(): Promise<void> {
  // Safe no-op
}

export function initGoogleDriveAuth(callback: (user: DriveUser | null) => void): () => void {
  callback({
    displayName: "KasımOğulları Yönetici",
    email: "yonetim@kasimogullari.com",
    photoURL: null,
  });
  return () => {};
}

export function isDriveConnected(): boolean {
  return true;
}

export function getDriveUser(): DriveUser | null {
  return {
    displayName: "KasımOğulları Yönetici",
    email: "yonetim@kasimogullari.com",
    photoURL: null,
  };
}

export async function getOrCreateAppFolder(): Promise<string> {
  return "kasimogullari-yerel-yedek";
}

export async function listAppFiles(): Promise<DriveFileItem[]> {
  return getLocalBackups();
}

/**
 * Dışa aktarma: Tüm ürün kataloğunu anında JSON olarak indirir ve yerel kayda ekler.
 */
export async function syncProductCatalogToDrive(products: Product[]): Promise<DriveFileItem> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `kasimogullari_katalog_${timestamp}.json`;
  const content = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      app: "KasımOğulları Toptan",
      total_products: products.length,
      products,
    },
    null,
    2,
  );

  downloadFileToClient(fileName, content);

  const fileItem: DriveFileItem = {
    id: `backup-${Date.now()}`,
    name: fileName,
    mimeType: "application/json",
    size: `${(content.length / 1024).toFixed(1)} KB`,
    createdTime: new Date().toISOString(),
    modifiedTime: new Date().toISOString(),
  };

  saveLocalBackupItem(fileItem);
  return fileItem;
}

/**
 * Dışa aktarma: Siparişleri anında JSON olarak indirir.
 */
export async function syncOrdersToDrive(orders: DriveOrder[]): Promise<DriveFileItem> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `kasimogullari_siparisler_${timestamp}.json`;
  const content = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      app: "KasımOğulları Toptan",
      total_orders: orders.length,
      orders,
    },
    null,
    2,
  );

  downloadFileToClient(fileName, content);

  const fileItem: DriveFileItem = {
    id: `backup-orders-${Date.now()}`,
    name: fileName,
    mimeType: "application/json",
    size: `${(content.length / 1024).toFixed(1)} KB`,
    createdTime: new Date().toISOString(),
    modifiedTime: new Date().toISOString(),
  };

  saveLocalBackupItem(fileItem);
  return fileItem;
}

/**
 * Tüm sistemi (katalog ve siparişler) tek seferde yedekler
 */
export async function syncAllToGoogleDrive(
  products: Product[],
  orders: DriveOrder[],
): Promise<{ catalogFile: DriveFileItem; ordersFile: DriveFileItem }> {
  const catalogFile = await syncProductCatalogToDrive(products);
  const ordersFile = await syncOrdersToDrive(orders);
  return { catalogFile, ordersFile };
}

export async function readProductCatalogFromDrive(
  _fileId: string,
): Promise<{ products: Product[]; timestamp?: string }> {
  return { products: [] };
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalBackups().filter((b) => b.id !== fileId);
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
