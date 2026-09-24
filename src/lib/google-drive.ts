import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import type { Product } from "./catalog";

export const DRIVE_CONFIG = {
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  oAuthClientId: firebaseConfig.oAuthClientId,
  appName: "KasımOğulları Toptan",
  driveFolderName: "KasimOgullari-Depo-Verileri",
};

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
] as const;

// 1. Firebase App & Auth initialization
function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
    apiKey: DRIVE_CONFIG.apiKey,
    authDomain: DRIVE_CONFIG.authDomain,
    projectId: DRIVE_CONFIG.projectId,
    storageBucket: DRIVE_CONFIG.storageBucket,
    messagingSenderId: DRIVE_CONFIG.messagingSenderId,
    appId: DRIVE_CONFIG.appId,
  });
}

function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

// 2. In-Memory Token & State Cache (Crucial per security guidelines: never stored in localStorage)
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;
let isSigningIn = false;
let cachedFolderId: string | null = null;

export type DriveUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export type DriveFileItem = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
};

export type DriveSyncSummary = {
  fileId: string;
  fileName: string;
  webViewLink?: string;
  itemCount: number;
  syncedAt: string;
};

export type DriveCatalogSyncData = {
  version: string;
  syncedAt: string;
  syncedBy: string | null;
  totalProducts: number;
  products: Product[];
};

export type DriveOrderItem = {
  id: string;
  product_name: string;
  unit: string;
  quantity: number;
};

export type DriveOrder = {
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
  order_items: DriveOrderItem[];
};

export type DriveOrdersSyncData = {
  version: string;
  syncedAt: string;
  syncedBy: string | null;
  totalOrders: number;
  orders: DriveOrder[];
};

/**
 * Initialize Google Drive Auth listener
 */
export function initGoogleDriveAuth(
  onSuccess?: (user: DriveUser, token: string) => void,
  onFailure?: () => void,
): () => void {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      cachedUser = user;
      if (cachedAccessToken) {
        onSuccess?.(formatUser(user), cachedAccessToken);
      } else if (!isSigningIn) {
        onFailure?.();
      }
    } else {
      cachedAccessToken = null;
      cachedUser = null;
      cachedFolderId = null;
      onFailure?.();
    }
  });
}

function formatUser(user: User): DriveUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

/**
 * Trigger Google Sign In popup with Google Drive scopes and OAuth Client ID
 */
export async function connectGoogleDrive(): Promise<{ user: DriveUser; token: string }> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();

  DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));

  // Configure OAuth client parameters
  provider.setCustomParameters({
    prompt: "consent",
    access_type: "online",
  });

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error("Google Drive erişim belirteci (access token) alınamadı.");
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return {
      user: formatUser(result.user),
      token: cachedAccessToken,
    };
  } catch (error) {
    console.error("Google Drive connection error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Disconnect Google Drive
 */
export async function disconnectGoogleDrive(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
  cachedFolderId = null;
}

/**
 * Returns current access token
 */
export function getDriveAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Returns currently connected Google Drive user
 */
export function getDriveUser(): DriveUser | null {
  return cachedUser ? formatUser(cachedUser) : null;
}

/**
 * Checks if user is authenticated with Google Drive
 */
export function isDriveConnected(): boolean {
  return Boolean(cachedAccessToken && cachedUser);
}

// -------------------------------------------------------------
// Google Drive API v3 Core Operations
// -------------------------------------------------------------

async function driveFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error("Google Drive oturumu açık değil. Lütfen önce Google ile bağlanın.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error("Google Drive oturum süresi doldu. Lütfen tekrar bağlanın.");
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Google Drive API Hatası (${res.status}): ${errorText || res.statusText}`);
  }

  return res;
}

/**
 * Find or create the dedicated app folder in Google Drive
 */
export async function getOrCreateAppFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const folderName = DRIVE_CONFIG.driveFolderName;
  const query = encodeURIComponent(
    `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`;

  const response = await driveFetch(searchUrl);
  const data = (await response.json()) as { files?: Array<{ id: string; name: string }> };

  if (data.files && data.files.length > 0 && data.files[0]?.id) {
    cachedFolderId = data.files[0].id;
    return cachedFolderId;
  }

  // Create folder if it does not exist
  const createUrl = "https://www.googleapis.com/drive/v3/files";
  const createResponse = await driveFetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      description:
        "KasımOğulları Toptan ürün katalogları ve sipariş verileri senkronizasyon klasörü",
    }),
  });

  const newFolder = (await createResponse.json()) as { id: string };
  cachedFolderId = newFolder.id;
  return cachedFolderId;
}

/**
 * List files stored in the application Google Drive folder
 */
export async function listAppFiles(): Promise<DriveFileItem[]> {
  const folderId = await getOrCreateAppFolder();
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)&orderBy=modifiedTime desc`;

  const response = await driveFetch(url);
  const data = (await response.json()) as { files?: DriveFileItem[] };
  return data.files ?? [];
}

/**
 * Upload or update a file in Google Drive multipart
 */
async function uploadOrUpdateFile(
  fileName: string,
  content: string,
  mimeType: string,
  options?: { overwriteExisting?: boolean; description?: string },
): Promise<DriveFileItem> {
  const folderId = await getOrCreateAppFolder();

  let existingFileId: string | null = null;
  if (options?.overwriteExisting !== false) {
    const query = encodeURIComponent(
      `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    );
    const searchRes = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    );
    const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
    if (searchData.files && searchData.files.length > 0 && searchData.files[0]?.id) {
      existingFileId = searchData.files[0].id;
    }
  }

  const boundary = "-------KasimOgullariDriveBoundary" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType,
    description:
      options?.description || `KasımOğulları Toptan Otomatik Senkronizasyon: ${fileName}`,
  };

  if (!existingFileId) {
    metadata["parents"] = [folderId];
  }

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    content +
    closeDelimiter;

  const uploadUrl = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink`;

  const method = existingFileId ? "PATCH" : "POST";

  const response = await driveFetch(uploadUrl, {
    method,
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  return (await response.json()) as DriveFileItem;
}

/**
 * Download text content of a file from Google Drive
 */
export async function downloadFileContent(fileId: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await driveFetch(url);
  return await response.text();
}

/**
 * Delete a file from Google Drive (MUST be called only after user confirmation dialog)
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  await driveFetch(url, { method: "DELETE" });
}

// -------------------------------------------------------------
// Product Catalog Sync Functions
// -------------------------------------------------------------

/**
 * Syncs the current product catalog to Google Drive
 */
export async function syncProductCatalogToDrive(
  products: Product[],
  options: { createTimestampBackup?: boolean } = { createTimestampBackup: true },
): Promise<DriveSyncSummary> {
  if (!isDriveConnected()) {
    throw new Error("Google Drive bağlı değil. Lütfen önce Google hesabınızı bağlayın.");
  }

  const syncedAt = new Date().toISOString();
  const user = getDriveUser();

  const payload: DriveCatalogSyncData = {
    version: "1.0",
    syncedAt,
    syncedBy: user?.email || "yonetici",
    totalProducts: products.length,
    products,
  };

  const jsonContent = JSON.stringify(payload, null, 2);

  // 1. Update main sync file (always the authoritative current catalog in Drive)
  const mainFile = await uploadOrUpdateFile(
    "urun-katalogu-sync.json",
    jsonContent,
    "application/json",
    {
      overwriteExisting: true,
      description: `KasımOğulları Güncel Ürün Kataloğu (${products.length} ürün) - Son güncelleme: ${new Date().toLocaleString("tr-TR")}`,
    },
  );

  // 2. Also export human-readable CSV for opening in Google Sheets
  try {
    const csvContent = generateProductCatalogCSV(products);
    await uploadOrUpdateFile("urun-katalogu-tablo.csv", csvContent, "text/csv", {
      overwriteExisting: true,
      description: `KasımOğulları Ürün Listesi CSV (Google E-Tablolar ile açılabilir)`,
    });
  } catch (err) {
    console.warn("CSV export failed, JSON sync succeeded:", err);
  }

  // 3. Optional timestamped backup file
  if (options.createTimestampBackup) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const backupFileName = `urun-katalogu-yedek-${dateStr}.json`;
    await uploadOrUpdateFile(backupFileName, jsonContent, "application/json", {
      overwriteExisting: true,
      description: `KasımOğulları Ürün Kataloğu Arşiv Yedeği (${dateStr})`,
    });
  }

  return {
    fileId: mainFile.id,
    fileName: mainFile.name,
    webViewLink: mainFile.webViewLink,
    itemCount: products.length,
    syncedAt,
  };
}

/**
 * Reads the product catalog from Google Drive
 */
export async function readProductCatalogFromDrive(): Promise<DriveCatalogSyncData> {
  if (!isDriveConnected()) {
    throw new Error("Google Drive bağlı değil.");
  }

  const folderId = await getOrCreateAppFolder();
  const query = encodeURIComponent(
    `'${folderId}' in parents and name = 'urun-katalogu-sync.json' and trashed = false`,
  );
  const searchRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
  );
  const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };

  if (!searchData.files || searchData.files.length === 0 || !searchData.files[0]?.id) {
    throw new Error(
      "Google Drive klasöründe kayıtlı ürün kataloğu ('urun-katalogu-sync.json') bulunamadı.",
    );
  }

  const content = await downloadFileContent(searchData.files[0].id);
  const parsed = JSON.parse(content) as DriveCatalogSyncData;

  if (!parsed || !Array.isArray(parsed.products)) {
    throw new Error("Google Drive'daki ürün kataloğu dosyası geçersiz veya bozuk formatta.");
  }

  return parsed;
}

// -------------------------------------------------------------
// User Orders Sync Functions
// -------------------------------------------------------------

/**
 * Syncs user orders to Google Drive
 */
export async function syncOrdersToDrive(
  orders: DriveOrder[],
  options: { createTimestampBackup?: boolean } = { createTimestampBackup: true },
): Promise<DriveSyncSummary> {
  if (!isDriveConnected()) {
    throw new Error("Google Drive bağlı değil. Lütfen önce Google hesabınızı bağlayın.");
  }

  const syncedAt = new Date().toISOString();
  const user = getDriveUser();

  const payload: DriveOrdersSyncData = {
    version: "1.0",
    syncedAt,
    syncedBy: user?.email || "yonetici",
    totalOrders: orders.length,
    orders,
  };

  const jsonContent = JSON.stringify(payload, null, 2);

  // 1. Update main sync file
  const mainFile = await uploadOrUpdateFile(
    "siparisler-sync.json",
    jsonContent,
    "application/json",
    {
      overwriteExisting: true,
      description: `KasımOğulları Sipariş Verileri (${orders.length} sipariş) - Son güncelleme: ${new Date().toLocaleString("tr-TR")}`,
    },
  );

  // 2. Export human-readable CSV for opening in Google Sheets / Excel
  try {
    const csvContent = generateOrdersCSV(orders);
    await uploadOrUpdateFile("siparisler-tablo.csv", csvContent, "text/csv", {
      overwriteExisting: true,
      description: `KasımOğulları Siparişler Tablosu CSV (Google E-Tablolar ile açılabilir)`,
    });
  } catch (err) {
    console.warn("Orders CSV export warning:", err);
  }

  // 3. Optional timestamped backup
  if (options.createTimestampBackup) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const backupFileName = `siparisler-yedek-${dateStr}.json`;
    await uploadOrUpdateFile(backupFileName, jsonContent, "application/json", {
      overwriteExisting: true,
      description: `KasımOğulları Sipariş Arşiv Yedeği (${dateStr})`,
    });
  }

  return {
    fileId: mainFile.id,
    fileName: mainFile.name,
    webViewLink: mainFile.webViewLink,
    itemCount: orders.length,
    syncedAt,
  };
}

/**
 * Reads synced orders from Google Drive
 */
export async function readOrdersFromDrive(): Promise<DriveOrdersSyncData> {
  if (!isDriveConnected()) {
    throw new Error("Google Drive bağlı değil.");
  }

  const folderId = await getOrCreateAppFolder();
  const query = encodeURIComponent(
    `'${folderId}' in parents and name = 'siparisler-sync.json' and trashed = false`,
  );
  const searchRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
  );
  const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };

  if (!searchData.files || searchData.files.length === 0 || !searchData.files[0]?.id) {
    throw new Error(
      "Google Drive klasöründe kayıtlı sipariş verisi ('siparisler-sync.json') bulunamadı.",
    );
  }

  const content = await downloadFileContent(searchData.files[0].id);
  const parsed = JSON.parse(content) as DriveOrdersSyncData;

  if (!parsed || !Array.isArray(parsed.orders)) {
    throw new Error("Google Drive'daki sipariş verisi geçersiz veya bozuk formatta.");
  }

  return parsed;
}

// -------------------------------------------------------------
// Combined Full Sync Function
// -------------------------------------------------------------

export type FullSyncResult = {
  catalog: DriveSyncSummary;
  orders: DriveSyncSummary;
  folderUrl: string;
};

/**
 * Sync both product catalog and orders to Google Drive in one operation
 */
export async function syncAllToGoogleDrive(
  products: Product[],
  orders: DriveOrder[],
): Promise<FullSyncResult> {
  const folderId = await getOrCreateAppFolder();
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

  const catalogResult = await syncProductCatalogToDrive(products);
  const ordersResult = await syncOrdersToDrive(orders);

  return {
    catalog: catalogResult,
    orders: ordersResult,
    folderUrl,
  };
}

// -------------------------------------------------------------
// CSV Format Helpers (with UTF-8 BOM for Excel/Sheets compatibility)
// -------------------------------------------------------------

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function generateProductCatalogCSV(products: Product[]): string {
  // UTF-8 BOM ensures Turkish characters render properly in Excel & Google Sheets
  const BOM = "\uFEFF";
  const header = ["ID", "Ürün Adı", "Kategori", "Birim", "Koli İçi / Açıklama", "Durum"];
  const rows = products.map((p) => [
    escapeCSV(p.id),
    escapeCSV(p.name),
    escapeCSV(p.category),
    escapeCSV(p.unit),
    escapeCSV(p.description),
    escapeCSV(p.is_active ? "Aktif" : "Pasif"),
  ]);

  return BOM + [header.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function generateOrdersCSV(orders: DriveOrder[]): string {
  const BOM = "\uFEFF";
  const header = [
    "Sipariş ID",
    "Tarih",
    "Durum",
    "Müşteri Adı",
    "İşletme Adı",
    "İlçe",
    "Telefon",
    "Adres",
    "Sipariş Kalemleri",
    "Toplam Kalem Sayısı",
    "Sipariş Notu",
  ];

  const rows = orders.map((o) => {
    const itemsSummary = (o.order_items || [])
      .map((item) => `${item.product_name} (${item.quantity} ${item.unit})`)
      .join(", ");

    const totalQty = (o.order_items || []).reduce((acc, curr) => acc + (curr.quantity || 0), 0);

    return [
      escapeCSV(o.id),
      escapeCSV(new Date(o.created_at).toLocaleString("tr-TR")),
      escapeCSV(o.status),
      escapeCSV(o.full_name),
      escapeCSV(o.business_name || ""),
      escapeCSV(o.district),
      escapeCSV(o.phone),
      escapeCSV(o.address),
      escapeCSV(itemsSummary),
      escapeCSV(totalQty),
      escapeCSV(o.note || ""),
    ];
  });

  return BOM + [header.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}
