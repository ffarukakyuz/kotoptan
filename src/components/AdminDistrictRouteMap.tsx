import { useEffect, useRef, useState, useMemo } from "react";
import {
  MapPin,
  Route as RouteIcon,
  Clock,
  Milestone,
  Maximize2,
  Minimize2,
  RefreshCw,
  Store,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BITLIS_CENTER_COORDS,
  BITLIS_LEAFLET_BOUNDS,
  BITLIS_DISTRICT_COORDS,
  extractCoordinates,
} from "@/lib/location-utils";
import { districtLabel } from "@/lib/catalog";
import type { RouteResult } from "@/lib/location-utils";

export interface RouteOrderStop {
  id: string;
  business_name: string;
  full_name: string;
  phone: string;
  address: string;
  district: string;
  status: string;
  coords: { lat: number; lng: number };
  distanceFromDepotKm: number;
  distanceFromPrevKm?: number;
  stopNumber: number;
  trafficSide: "right" | "left";
  trafficTag: string;
}

interface AdminDistrictRouteMapProps {
  orders: Array<{
    id: string;
    business_name: string;
    full_name: string;
    phone: string;
    address: string;
    district: string;
    status: string;
    note?: string;
  }>;
  selectedDistrict: string;
  onOrderClick?: (orderId: string) => void;
}

// Haversine mesafe hesaplayıcı (km)
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Türkiye Trafik Akışına Göre Rota Önceliklendirme (Right-Hand Traffic Routing):
 * Türkiye'de trafik sağdan akar. Sürücünün gidiş istikametinin sağında kalan teslimat
 * noktalarına doğrudan, karşı şeridi (trafiği) kesmeden ve bekleme yapmadan yanaşılabilir.
 * Karşı şeritte (solda) kalan teslimat noktaları ise U dönüşü veya rotanın devamındaki
 * dönüş ayağı dikkate alınarak sonraki sıraya yerleştirilir.
 */
export function computeOptimizedStops(
  orders: Array<{
    id: string;
    business_name: string;
    full_name: string;
    phone: string;
    address: string;
    district: string;
    status: string;
    note?: string;
  }>,
): RouteOrderStop[] {
  const depot = BITLIS_CENTER_COORDS; // 38.49895, 42.27963 (Tatvan Aydınlar Mah.)

  const parsedStops: Array<
    Omit<RouteOrderStop, "stopNumber" | "distanceFromPrevKm" | "trafficSide" | "trafficTag">
  > = orders.map((o) => {
    let coords = extractCoordinates(o.address) || extractCoordinates(o.note);
    if (!coords) {
      const distCenter = BITLIS_DISTRICT_COORDS[o.district] || BITLIS_CENTER_COORDS;
      coords = { lat: distCenter.lat, lng: distCenter.lng };
    }

    const distKm = calculateDistanceKm(depot.lat, depot.lng, coords.lat, coords.lng);

    return {
      id: o.id,
      business_name: o.business_name,
      full_name: o.full_name,
      phone: o.phone,
      address: o.address,
      district: o.district,
      status: o.status,
      coords,
      distanceFromDepotKm: distKm,
    };
  });

  if (parsedStops.length <= 1) {
    return parsedStops.map((s, index) => ({
      ...s,
      stopNumber: index + 1,
      distanceFromPrevKm: s.distanceFromDepotKm,
      trafficSide: "right" as const,
      trafficTag: "Sağ Şerit (Öncelikli)",
    }));
  }

  // 1. Durakların ağırlık merkezini (koridor doğrultusunu) belirle
  const avgLat = parsedStops.reduce((sum, s) => sum + s.coords.lat, 0) / parsedStops.length;
  const avgLng = parsedStops.reduce((sum, s) => sum + s.coords.lng, 0) / parsedStops.length;

  // Ana gidiş koridoru vektörü: Depodan durak merkezine
  const corridorDx = avgLng - depot.lng;
  const corridorDy = avgLat - depot.lat;

  // 2. Her durağın Türkiye sağ trafik akışına göre yönünü hesapla
  // 2D Çapraz Çarpım (Cross Product): cross <= 0 ise sürüş doğrultusunun sağında kalır
  const annotatedStops = parsedStops.map((s) => {
    const offsetDx = s.coords.lng - depot.lng;
    const offsetDy = s.coords.lat - depot.lat;
    const crossProduct = corridorDx * offsetDy - corridorDy * offsetDx;
    const isRightSide = crossProduct <= 0;

    return {
      ...s,
      trafficSide: (isRightSide ? "right" : "left") as "right" | "left",
      trafficTag: isRightSide
        ? "Sağ Şerit (Öncelikli - Karşı Şerit Kesilmez)"
        : "Karşı Şerit (Dönüş / Güvenli Dönüş Rotası)",
    };
  });

  // 3. Sağ Trafik Akışına Göre Önceliklendirme:
  // Grup A: Gidiş şeridinin sağında kalanlar (Doğrudan yanaşma, öncelikli sıra)
  // Grup B: Sol/karşı şeritte kalanlar (Dönüş rotasında sağ şerit haline gelerek güvenli teslimat)
  const rightStops = annotatedStops.filter((s) => s.trafficSide === "right");
  const leftStops = annotatedStops.filter((s) => s.trafficSide === "left");

  // En Yakın Komşu sıralayıcı
  const orderCluster = (
    cluster: typeof annotatedStops,
    startPos: { lat: number; lng: number },
  ): typeof annotatedStops => {
    const rem = [...cluster];
    const res: typeof annotatedStops = [];
    let cur = startPos;
    while (rem.length > 0) {
      let bIdx = 0;
      let minD = Infinity;
      for (let i = 0; i < rem.length; i++) {
        const d = calculateDistanceKm(cur.lat, cur.lng, rem[i]!.coords.lat, rem[i]!.coords.lng);
        if (d < minD) {
          minD = d;
          bIdx = i;
        }
      }
      const next = rem.splice(bIdx, 1)[0]!;
      res.push(next);
      cur = next.coords;
    }
    return res;
  };

  const orderedRight = orderCluster(rightStops, depot);
  const lastRightPos =
    orderedRight.length > 0 ? orderedRight[orderedRight.length - 1]!.coords : depot;
  const orderedLeft = orderCluster(leftStops, lastRightPos);

  const finalStopsList = [...orderedRight, ...orderedLeft];

  // Durak numaralarını ve önceki duraktan mesafeleri ata
  let prevPos = depot;
  return finalStopsList.map((stop, index) => {
    const distFromPrev = calculateDistanceKm(
      prevPos.lat,
      prevPos.lng,
      stop.coords.lat,
      stop.coords.lng,
    );
    prevPos = stop.coords;
    return {
      ...stop,
      stopNumber: index + 1,
      distanceFromPrevKm: Math.round(distFromPrev * 10) / 10,
    };
  });
}

export function AdminDistrictRouteMap({
  orders,
  selectedDistrict,
  onOrderClick,
}: AdminDistrictRouteMapProps) {
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const onOrderClickRef = useRef(onOrderClick);
  onOrderClickRef.current = onOrderClick;
  const lastSignatureRef = useRef<string>("");

  const [isExpanded, setIsExpanded] = useState(false);
  const [routeStats, setRouteStats] = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Stable signature for orders to prevent infinite re-render cycles
  const ordersSignature = useMemo(() => {
    return orders.map((o) => `${o.id}:${o.status}:${o.address || ""}`).join("|");
  }, [orders]);

  // 1. Siparişlerin koordinatlarını çöz ve depodan başlayarak en yakın sıraya diz (TSP Sıralaması)
  const sortedStops = useMemo<RouteOrderStop[]>(() => {
    return computeOptimizedStops(orders);
  }, [ordersSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Çok duraklı OSRM rotasını hesapla ve haritaya çiz
  useEffect(() => {
    if (!containerNode || typeof window === "undefined") return;

    // Harita zaten oluşturulduysa ve duraklar değişmediyse tekrar çalıştırma
    if (mapInstanceRef.current && lastSignatureRef.current === ordersSignature) {
      return;
    }
    lastSignatureRef.current = ordersSignature;

    let isCancelled = false;

    import("leaflet").then(async (L) => {
      if (isCancelled || !containerNode || !containerNode.isConnected) return;

      const depot = BITLIS_CENTER_COORDS;

      // Eski haritayı temizle
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerNode as any)._leaflet_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (containerNode as any)._leaflet_id;
      }

      // Yeni Leaflet Haritası
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let map: any;
      try {
        map = L.map(containerNode, {
          center: [depot.lat, depot.lng],
          zoom: 12,
          minZoom: 9,
          maxZoom: 18,
          maxBounds: L.latLngBounds(BITLIS_LEAFLET_BOUNDS),
          maxBoundsViscosity: 1.0,
          zoomControl: true,
        });
        mapInstanceRef.current = map;
      } catch (mapErr) {
        console.warn("[AdminDistrictRouteMap] Harita başlatma hatası:", mapErr);
        return;
      }

      // OpenStreetMap Katmanı
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);

      // Ana Depo Rozeti (Tatvan Aydınlar Mah.)
      const depotIcon = L.divIcon({
        className: "custom-route-depot-pin",
        html: `
          <div style="
            position: relative;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
            border-radius: 50%;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 14px rgba(0,0,0,0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
          ">
            🏢
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const depotMarker = L.marker([depot.lat, depot.lng], { icon: depotIcon })
        .addTo(map)
        .bindPopup(
          `<strong>KasımOğulları Ana Depo (Başlangıç)</strong><br/>Aydınlar Mah. İstiklal Cad., Tatvan`,
        );

      markersRef.current = [depotMarker];

      // Her durak için numaralı rozet ekle (Sağ trafik akışına göre renk kodlu)
      const stopBounds = L.latLngBounds([L.latLng(depot.lat, depot.lng)]);

      sortedStops.forEach((stop) => {
        const isRight = stop.trafficSide === "right";
        const bgGradient = isRight
          ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
          : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
        const borderColor = isRight ? "#a7f3d0" : "#bfdbfe";

        const stopIcon = L.divIcon({
          className: "custom-stop-pin",
          html: `
            <div style="
              position: relative;
              width: 32px;
              height: 32px;
              background: ${bgGradient};
              border-radius: 50%;
              border: 2px solid ${borderColor};
              box-shadow: 0 4px 12px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 800;
              font-size: 13px;
              cursor: pointer;
            ">
              ${stop.stopNumber}
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const tagBadge = isRight
          ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:#d1fae5;color:#065f46;margin-bottom:4px;">➡️ Sağ Şerit (Öncelikli)</span>`
          : `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:#dbeafe;color:#1e40af;margin-bottom:4px;">🔄 Karşı Şerit (Dönüş Rotası)</span>`;

        const m = L.marker([stop.coords.lat, stop.coords.lng], { icon: stopIcon }).addTo(map)
          .bindPopup(`
            <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
              ${tagBadge}<br/>
              <strong style="font-size: 13px; color: ${isRight ? "#047857" : "#1d4ed8"};">${stop.stopNumber}. Durak: ${stop.business_name}</strong><br/>
              <span>${stop.full_name} (${stop.phone})</span><br/>
              <span style="color: #6b7280;">${stop.address}</span><br/>
              <span style="font-weight: 600; color: #2563eb;">Depodan: ${stop.distanceFromDepotKm} km</span>
              ${stop.distanceFromPrevKm !== undefined && stop.stopNumber > 1 ? `<br/><span style="color: #059669; font-size: 11px;">Önceki duraktan: +${stop.distanceFromPrevKm} km</span>` : ""}
            </div>
          `);

        if (onOrderClickRef.current) {
          m.on("click", () => onOrderClickRef.current?.(stop.id));
        }

        markersRef.current.push(m);
        stopBounds.extend(L.latLng(stop.coords.lat, stop.coords.lng));
      });

      // Harita alanını tüm durakları kapsayacak şekilde genişlet
      map.fitBounds(stopBounds, { padding: [50, 50], maxZoom: 15 });

      // Çok duraklı OSRM Rotası Çiz
      if (sortedStops.length > 0) {
        setLoadingRoute(true);
        try {
          // OSRM çoklu koordinat formatı: lon,lat;lon,lat;...
          const allCoords = [depot, ...sortedStops.map((s) => s.coords)];
          const coordString = allCoords.map((c) => `${c.lng},${c.lat}`).join(";");
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

          const res = await fetch(osrmUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.code === "Ok" && data.routes && data.routes[0]) {
              const route = data.routes[0];
              const totalKm = Math.round((route.distance / 1000) * 10) / 10;
              const totalMins = Math.round(route.duration / 60);

              const polylineCoords: [number, number][] = route.geometry.coordinates.map(
                (c: [number, number]) => [c[1], c[0]],
              );

              const polyline = L.polyline(polylineCoords, {
                color: "#2563eb",
                weight: 5,
                opacity: 0.85,
                lineCap: "round",
                lineJoin: "round",
              }).addTo(map);

              polylineRef.current = polyline;

              setRouteStats({
                distanceKm: totalKm,
                durationMinutes: totalMins,
                coordinates: polylineCoords,
                summary: `${totalKm} km • ~${totalMins} dk`,
              });
            }
          } else {
            throw new Error("OSRM response not ok");
          }
        } catch (err) {
          console.warn("Çoklu durak OSRM hatası:", err);
          // Fallback rota çizgisi
          const fallbackCoords: [number, number][] = [
            [depot.lat, depot.lng],
            ...sortedStops.map((s) => [s.coords.lat, s.coords.lng] as [number, number]),
          ];
          const polyline = L.polyline(fallbackCoords, {
            color: "#2563eb",
            weight: 4,
            opacity: 0.8,
            dashArray: "6, 8",
          }).addTo(map);
          polylineRef.current = polyline;

          const totalApproxKm = sortedStops.reduce(
            (sum, s) => sum + (s.distanceFromPrevKm ?? s.distanceFromDepotKm),
            0,
          );
          setRouteStats({
            distanceKm: Math.round(totalApproxKm * 10) / 10,
            durationMinutes: Math.round(totalApproxKm * 1.5),
            coordinates: fallbackCoords,
            summary: `~${Math.round(totalApproxKm * 10) / 10} km (Yaklaşık)`,
          });
        } finally {
          setLoadingRoute(false);
        }
      }

      // Gri ekranı önlemek için boyutları güncelle
      setTimeout(() => map.invalidateSize(), 80);
      setTimeout(() => map.invalidateSize(), 300);
    });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
      }
    };
  }, [containerNode, ordersSignature]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 150);
    }
  }, [isExpanded]);

  return (
    <div
      className={`rounded-2xl border border-blue-500/30 bg-card shadow-sm overflow-hidden flex flex-col transition-all duration-200 ${
        isExpanded ? "fixed inset-3 sm:inset-6 z-[9999] shadow-2xl" : "mt-4"
      }`}
    >
      {/* Harita Başlığı ve Canlı Sevkiyat İstatistikleri */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-blue-950/20 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-500">
            <RouteIcon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2 leading-none">
              <span>
                {selectedDistrict === "hepsi"
                  ? "Tüm İlçeler Sevkiyat Rotası"
                  : `${districtLabel(selectedDistrict)} Sevkiyat Rotası`}
              </span>
              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                {sortedStops.length} Teslimat Durağı
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-1">
              KasımOğulları Ana Depo çıkışlı • En yakın duraktan başlayarak sıralı sevkiyat rotası
            </p>
          </div>
        </div>

        {/* Aksiyon Butonları & Büyüt */}
        <div className="flex items-center gap-2">
          {routeStats && (
            <div className="hidden sm:flex items-center gap-3 bg-background/80 px-3 py-1.5 rounded-lg border border-border text-xs">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Milestone className="h-3.5 w-3.5 text-blue-500" />
                {routeStats.distanceKm} km
              </span>
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Clock className="h-3.5 w-3.5 text-emerald-500" />~{routeStats.durationMinutes} dk
              </span>
            </div>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded((v) => !v)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
            title={isExpanded ? "Küçült" : "Tam Ekran Yap"}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Harita Konteyneri */}
      <div className="relative w-full bg-muted min-h-[300px]">
        <div
          ref={setContainerNode}
          className="w-full relative z-0"
          style={{ height: isExpanded ? "calc(100vh - 280px)" : "360px" }}
        />

        {loadingRoute && (
          <div className="absolute top-3 right-3 z-[1000] rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold shadow-md flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>Sevkiyat Rotası Çiziliyor...</span>
          </div>
        )}

        {/* Mobil Özet Kartı */}
        {routeStats && (
          <div className="sm:hidden absolute top-3 left-3 z-[1000] rounded-lg bg-white/95 dark:bg-card/95 border border-blue-500/30 p-2 shadow-md backdrop-blur text-xs flex items-center gap-3 font-semibold">
            <span className="flex items-center gap-1 text-blue-600">
              <Milestone className="h-3 w-3" />
              {routeStats.distanceKm} km
            </span>
            <span className="flex items-center gap-1 text-emerald-600">
              <Clock className="h-3 w-3" />~{routeStats.durationMinutes} dk
            </span>
          </div>
        )}
      </div>

      {/* Sıralı Duraklar Şeridi (Depoya En Yakından En Uzağa) */}
      <div className="border-t border-border bg-muted/30 px-3.5 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
          Sıralı Dağıtım Planı (Depoya En Yakından Başlayarak):
        </span>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <div className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
            <span>🏢 Tatvan Ana Depo</span>
          </div>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

          {sortedStops.map((stop) => (
            <div
              key={stop.id}
              onClick={() => onOrderClick?.(stop.id)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background hover:bg-emerald-500/10 hover:border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-foreground transition-colors cursor-pointer shrink-0"
              title={`${stop.business_name} - ${stop.address}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-extrabold text-white">
                {stop.stopNumber}
              </span>
              <span className="font-semibold truncate max-w-[120px]">{stop.business_name}</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ({stop.distanceFromDepotKm} km)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
