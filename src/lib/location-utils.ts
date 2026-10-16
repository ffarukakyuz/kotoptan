import { DISTRICTS, districtLabel } from "./catalog";

export { districtLabel };

export interface GeoLocation {
  lat: number;
  lng: number;
}

/**
 * Bitlis ili sınırları (Güneybatı: [38.00, 41.50], Kuzeydoğu: [39.15, 43.15])
 * Kapsadığı ilçeler: Tatvan, Bitlis, Ahlat, Adilcevaz, Güroymak, Hizan
 */
export const BITLIS_BOUNDS = {
  minLat: 38.0,
  maxLat: 39.15,
  minLng: 41.5,
  maxLng: 43.15,
};

/**
 * Leaflet için Bitlis ili LatLngBounds formatı
 */
export const BITLIS_LEAFLET_BOUNDS: [[number, number], [number, number]] = [
  [38.0, 41.5], // Güneybatı
  [39.15, 43.15], // Kuzeydoğu
];

export const BITLIS_CENTER_COORDS = {
  lat: 38.49895,
  lng: 42.27963, // Aydınlar Mahallesi, İstiklal Caddesi, Tatvan, Bitlis (KasımOğulları Ana Depo)
};

export const DEPOT_LOCATION = {
  name: "KasımOğulları Ana Depo",
  address: "Aydınlar Mahallesi, İstiklal Caddesi, Tatvan, Bitlis",
  coords: BITLIS_CENTER_COORDS,
};

export const BITLIS_DISTRICT_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  tatvan: { lat: 38.49895, lng: 42.27963, name: "Tatvan" },
  bitlis: { lat: 38.401, lng: 42.11, name: "Bitlis" },
  ahlat: { lat: 38.752, lng: 42.48, name: "Ahlat" },
  adilcevaz: { lat: 38.804, lng: 42.729, name: "Adilcevaz" },
  guroymak: { lat: 38.552, lng: 42.022, name: "Güroymak" },
  hizan: { lat: 38.225, lng: 42.422, name: "Hizan" },
};

/**
 * Van Gölü'nün derin açık su kütlesinde (kıyıdan kilometrelerce uzakta, açık gölde) olup olmadığını denetler.
 * Kıyı şeridi, sahil yolları, iskeleler, sahil parkları, balıkçı barınakları, plajlar ve göle sıfır
 * tüm işletmeler (Tatvan, Ahlat, Adilcevaz sahil kordonu vb.) KESİNLİKLE göl sayılmaz ve serbestçe seçilebilir.
 */
export function isInLakeVan(lat: number, lng: number): boolean {
  // Tatvan sahil şeridi (Sahil Parkı, İskele, Feribot Limanı, Sahil Yolu, Yaşam Parkı: lng <= 42.345 karadır)
  // Yalnızca Tatvan körfezinin açık derin sularına (lng > 42.365) girildiyse göl kabul et
  if (lat >= 38.48 && lat <= 38.54) {
    return lng > 42.365;
  }

  // Ahlat sahil şeridi (Ahlat İskelesi, sahil kordonu, kale sahili, çay bahçeleri: lng <= 42.545 karadır)
  if (lat >= 38.71 && lat <= 38.78) {
    return lng > 42.55;
  }

  // Adilcevaz sahil şeridi (Sahil kordonu, belediye plajı, su sporları, liman: lng <= 42.765 karadır)
  if (lat >= 38.78 && lat <= 38.84) {
    return lng > 42.775;
  }

  // Tatvan ile Ahlat arasındaki batı sahil şeridi (Kıyıdüzü, Balaban, D965 karayolu ve sahil yerleşimleri: lng <= 42.42 karadır)
  if (lat > 38.54 && lat < 38.71) {
    return lng >= 42.45 && lng <= 43.15;
  }

  // Güney sahil şeridi (D300 karayolu ve Reşadiye kıyı hattı: lat <= 38.47 karadır)
  if (lat < 38.48 && lng <= 42.55) {
    return false;
  }

  return false;
}

/**
 * Eğer koordinat Van Gölü'nün açık sularının ortasındaysa en yakın sahil şeridine çeker
 */
export function adjustIfInLakeVan(lat: number, lng: number): { lat: number; lng: number } {
  if (!isInLakeVan(lat, lng)) return { lat, lng };
  // Tatvan bölgesindeyse Tatvan sahil kordonuna çek
  if (lat >= 38.48 && lat <= 38.54) {
    return { lat, lng: 42.315 };
  }
  // Ahlat bölgesindeyse Ahlat sahil kordonuna çek
  if (lat >= 38.71 && lat <= 38.78) {
    return { lat, lng: 42.52 };
  }
  // Adilcevaz bölgesindeyse Adilcevaz sahil kordonuna çek
  if (lat >= 38.78 && lat <= 38.84) {
    return { lat: Math.max(lat, 38.803), lng: 42.74 };
  }
  // Orta açık göl için en yakın batı sahil şeridine al
  return { lat, lng: 42.36 };
}

/**
 * Koordinatlara en yakın Bitlis ilçesini mesafe kareleri üzerinden hatasız belirler.
 */
export function findNearestBitlisDistrict(
  lat: number,
  lng: number,
): { value: string; label: string } {
  let closestKey = "tatvan";
  let minDistance = Infinity;

  for (const [key, d] of Object.entries(BITLIS_DISTRICT_COORDS)) {
    const dLat = lat - d.lat;
    const dLng = lng - d.lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      closestKey = key;
    }
  }

  const label = BITLIS_DISTRICT_COORDS[closestKey]?.name || "Tatvan";
  return { value: closestKey, label };
}

/**
 * Verilen koordinatın Bitlis ili sınırları içerisinde olup olmadığını kontrol eder.
 */
export function isWithinBitlis(lat: number, lng: number): boolean {
  return (
    lat >= BITLIS_BOUNDS.minLat &&
    lat <= BITLIS_BOUNDS.maxLat &&
    lng >= BITLIS_BOUNDS.minLng &&
    lng <= BITLIS_BOUNDS.maxLng
  );
}

/**
 * Koordinatı Bitlis sınırlarına kilitler / sınırlar.
 * Göle sıfır işletmeler ve sahil şeridindeki noktalar KESİNLİKLE engellenmez.
 */
export function clampToBitlis(
  lat: number,
  lng: number,
): {
  lat: number;
  lng: number;
  isClamped: boolean;
  isOutsideBitlis: boolean;
  isInLake: boolean;
} {
  let finalLat = lat;
  let finalLng = lng;
  const isOutsideBitlis = !isWithinBitlis(lat, lng);
  let isInLake = false;

  if (isOutsideBitlis) {
    finalLat = Math.min(Math.max(lat, BITLIS_BOUNDS.minLat), BITLIS_BOUNDS.maxLat);
    finalLng = Math.min(Math.max(lng, BITLIS_BOUNDS.minLng), BITLIS_BOUNDS.maxLng);
  }

  if (isInLakeVan(finalLat, finalLng)) {
    isInLake = true;
    const adjusted = adjustIfInLakeVan(finalLat, finalLng);
    finalLat = adjusted.lat;
    finalLng = adjusted.lng;
  }

  return {
    lat: finalLat,
    lng: finalLng,
    isClamped: isOutsideBitlis || isInLake,
    isOutsideBitlis,
    isInLake,
  };
}

export interface ReverseGeocodeResult {
  formattedAddress: string;
  matchedDistrictValue?: string;
  districtLabel?: string;
  city?: string;
  district?: string;
  neighbourhood?: string;
  road?: string;
  houseNumber?: string;
  postalCode?: string;
  raw?: Record<string, unknown>;
}

export const USER_DEFAULT_LOCATION_KEY = "ko_user_default_location";

export interface UserSavedLocation {
  lat: number;
  lng: number;
  address: string;
  district?: string;
  city?: string;
  neighbourhood?: string;
  road?: string;
  houseNumber?: string;
  updatedAt?: string;
}

export function saveUserDefaultLocation(loc: UserSavedLocation): void {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      ...loc,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(USER_DEFAULT_LOCATION_KEY, JSON.stringify(payload));
    localStorage.setItem("ko_last_registered_location", JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("kotoptan:location-updated", { detail: payload }));
  } catch (err) {
    console.warn("Could not save default location:", err);
  }
}

export function getUserDefaultLocation(): UserSavedLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(USER_DEFAULT_LOCATION_KEY) ||
      localStorage.getItem("ko_last_registered_location");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as UserSavedLocation) : null;
  } catch {
    return null;
  }
}

/**
 * Metin içerisinden enlem ve boylam koordinatlarını ayrıştırır.
 * Desteklenen formatlar:
 * - "38.502123, 42.285456"
 * - "(📍 Konum: 38.502123, 42.285456)"
 * - "GPS: 38.502123, 42.285456"
 */
export function extractCoordinates(text?: string | null): GeoLocation | null {
  if (!text) return null;

  // Regex for latitude, longitude
  const match = text.match(/(-?\d{1,2}\.\d{3,9})\s*,\s*(-?\d{1,3}\.\d{3,9})/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * OpenStreetMap Nominatim servisi ile enlem/boylamı insan tarafından okunabilir
 * İl, İlçe, Mahalle ve Sokak adresine çevirir.
 */
export async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=tr`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let addr: Record<string, any> = {};

  try {
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "tr, tr-TR;q=0.9",
      },
    });

    if (response.ok) {
      data = await response.json();
      addr = data.address || {};
    }
  } catch (err) {
    console.warn("Nominatim adres servisi uyarısı:", err);
  }

  const normalizeTr = (str?: string | null) =>
    String(str || "")
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .trim();

  // Nominatim adres verilerinden ilçe adını içeren tüm aday alanları topla
  const candidateDistrictTexts = [
    addr.county,
    addr.town,
    addr.district,
    addr.suburb,
    addr.city_district,
    addr.municipality,
    addr.village,
    addr.state_district,
    data.name,
    data.display_name,
  ]
    .filter(Boolean)
    .join(" ");

  const normCandidate = normalizeTr(candidateDistrictTexts);

  // Belirli ilçe anahtar kelimelerini öncelikli olarak tara (Tatvan, Ahlat, Adilcevaz, Güroymak, Hizan, Bitlis)
  let matchedDistrictValue: string | undefined;
  let matchedDistrictLabel: string | undefined;

  const districtChecks: Array<{ value: string; label: string; keywords: string[] }> = [
    { value: "tatvan", label: "Tatvan", keywords: ["tatvan"] },
    { value: "ahlat", label: "Ahlat", keywords: ["ahlat"] },
    { value: "adilcevaz", label: "Adilcevaz", keywords: ["adilcevaz"] },
    {
      value: "guroymak",
      label: "Güroymak",
      keywords: ["guroymak", "güroymak", "norşin", "norsin"],
    },
    { value: "hizan", label: "Hizan", keywords: ["hizan"] },
    { value: "bitlis", label: "Bitlis", keywords: ["merkez", "bitlis merkez", "bitlis"] },
  ];

  for (const item of districtChecks) {
    if (item.keywords.some((kw) => normCandidate.includes(kw))) {
      matchedDistrictValue = item.value;
      matchedDistrictLabel = item.label;
      break;
    }
  }

  // Eğer metinden net ilçe çıkarılamadıysa, koordinat mesafesi ile kesin ilçeyi bul (Bitlis'e genelleme yapmaz)
  if (!matchedDistrictValue || !matchedDistrictLabel) {
    const nearest = findNearestBitlisDistrict(lat, lng);
    matchedDistrictValue = nearest.value;
    matchedDistrictLabel = nearest.label;
  }

  const neighbourhood = String(addr.neighbourhood || addr.quarter || addr.suburb || "").trim();
  const road = String(addr.road || addr.street || addr.pedestrian || "").trim();
  const houseNumber = String(addr.house_number || "").trim();

  // Türkçe açık ve anlaşılır adres satırı oluştur
  const parts: string[] = [];
  if (neighbourhood) {
    parts.push(
      neighbourhood.toLowerCase().includes("mah") ? neighbourhood : `${neighbourhood} Mah.`,
    );
  }
  if (road) {
    parts.push(houseNumber ? `${road} No: ${houseNumber}` : road);
  }
  if (matchedDistrictLabel) {
    parts.push(matchedDistrictLabel);
  }
  parts.push("Bitlis");

  let formattedAddress = parts.join(", ");
  if (!formattedAddress && data.display_name) {
    formattedAddress = String(data.display_name);
  }
  if (!formattedAddress) {
    formattedAddress = `${matchedDistrictLabel}, Bitlis`;
  }

  return {
    formattedAddress,
    matchedDistrictValue,
    districtLabel: matchedDistrictLabel,
    city: "Bitlis",
    district: matchedDistrictLabel,
    neighbourhood,
    road,
    houseNumber,
    raw: data,
  };
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  coordinates: [number, number][]; // [lat, lng] çiftleri
  summary?: string;
}

/**
 * Ücretsiz OSRM (Open Source Routing Machine) API servisi ile
 * iki nokta arasında sürüş/yol rotası ve mesafe/süre hesaplar.
 */
export async function fetchOSRMRoute(
  start: GeoLocation,
  end: GeoLocation,
): Promise<RouteResult | null> {
  try {
    // OSRM koordinat formatı: lon,lat;lon,lat
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes || !data.routes[0]) return null;

    const route = data.routes[0];
    const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
    const durationMinutes = Math.max(1, Math.round(route.duration / 60));

    // GeoJSON [lng, lat] formatını Leaflet [lat, lng] formatına çevir
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]],
    );

    return {
      distanceKm,
      durationMinutes,
      coordinates,
      summary: `${distanceKm} km • ~${durationMinutes} dk sürüş`,
    };
  } catch (err) {
    console.warn("OSRM Rota alma hatası:", err);
    return null;
  }
}

/**
 * OpenStreetMap pin ve rota bağlantıları
 */
export function getOSMNavigationUrl(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${startLat}%2C${startLng}%3B${endLat}%2C${endLng}`;
}

export function getOSMMapPinUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

/**
 * Google Maps rota / doğrudan pin konumu linki üretir.
 */
export function getGoogleMapsNavigationUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function getGoogleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
