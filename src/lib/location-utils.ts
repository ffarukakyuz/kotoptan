import { DISTRICTS } from "./catalog";

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface ReverseGeocodeResult {
  formattedAddress: string;
  matchedDistrictValue?: string;
  city?: string;
  district?: string;
  neighbourhood?: string;
  road?: string;
  raw?: Record<string, unknown>;
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

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "tr, tr-TR;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error("Adres servisi yanıt vermedi.");
  }

  const data = await response.json();
  const addr = data.address || {};

  const city = addr.city || addr.province || addr.state || "";
  const district =
    addr.town || addr.district || addr.county || addr.suburb || addr.city_district || "";
  const neighbourhood = addr.neighbourhood || addr.quarter || addr.suburb || "";
  const road = addr.road || addr.street || addr.pedestrian || "";
  const houseNumber = addr.house_number || "";

  // Türkçe adres satırı oluştur
  const parts: string[] = [];
  if (neighbourhood) {
    parts.push(
      neighbourhood.toLowerCase().includes("mah") ? neighbourhood : `${neighbourhood} Mah.`,
    );
  }
  if (road) {
    parts.push(houseNumber ? `${road} No: ${houseNumber}` : road);
  }
  if (district) {
    parts.push(district);
  }
  if (city && city !== district) {
    parts.push(city);
  }

  let formattedAddress = parts.join(", ");
  if (!formattedAddress && data.display_name) {
    formattedAddress = data.display_name;
  }

  // Katalogdaki ilçelerle eşleştirme (Ahlat, Adilcevaz, Bitlis, Güroymak, Hizan, Tatvan)
  let matchedDistrictValue: string | undefined;
  const normalizeTr = (str: string) =>
    str
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .trim();

  const districtNorm = normalizeTr(district);
  const cityNorm = normalizeTr(city);

  for (const d of DISTRICTS) {
    const dValNorm = normalizeTr(d.value);
    const dLabelNorm = normalizeTr(d.label);
    if (
      districtNorm.includes(dValNorm) ||
      districtNorm.includes(dLabelNorm) ||
      cityNorm.includes(dValNorm) ||
      cityNorm.includes(dLabelNorm)
    ) {
      matchedDistrictValue = d.value;
      break;
    }
  }

  return {
    formattedAddress,
    matchedDistrictValue,
    city,
    district,
    neighbourhood,
    road,
    raw: data,
  };
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
