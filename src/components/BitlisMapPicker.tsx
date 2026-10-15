import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  Navigation,
  Loader2,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Compass,
  CheckCircle2,
  Route as RouteIcon,
  Store,
  Clock,
  Milestone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  reverseGeocodeNominatim,
  fetchOSRMRoute,
  GeoLocation,
  RouteResult,
  BITLIS_LEAFLET_BOUNDS,
  BITLIS_CENTER_COORDS,
  BITLIS_DISTRICT_COORDS,
  clampToBitlis,
  isWithinBitlis,
} from "@/lib/location-utils";
import { toast } from "sonner";

export interface BitlisMapPickerProps {
  value?: GeoLocation | null;
  onChange: (result: {
    lat: number;
    lng: number;
    address: string;
    districtMatch?: string;
    city?: string;
    district?: string;
    neighbourhood?: string;
    road?: string;
    houseNumber?: string;
  }) => void;
  height?: string;
  allowExpand?: boolean;
  className?: string;
  showRouting?: boolean;
}

export function BitlisMapPicker({
  value,
  onChange,
  height = "340px",
  allowExpand = true,
  className = "",
  showRouting = true,
}: BitlisMapPickerProps) {
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destinationMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const depotMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);

  // Callback ref ile sonsuz döngüyü önle
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isGpsLocating, setIsGpsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const [addressPreview, setAddressPreview] = useState<string>("");
  const [isOutsideWarning, setIsOutsideWarning] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState<string>("tatvan");
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [isRouteActive, setIsRouteActive] = useState<boolean>(true);
  const [mapInitError, setMapInitError] = useState(false);
  const timeoutsRef = useRef<number[]>([]);

  const [selectedCoords, setSelectedCoords] = useState<GeoLocation>(() => {
    if (value && isWithinBitlis(value.lat, value.lng)) {
      return value;
    }
    return BITLIS_CENTER_COORDS;
  });

  const initialCoordsRef = useRef<GeoLocation>(
    value && isWithinBitlis(value.lat, value.lng) ? value : BITLIS_CENTER_COORDS,
  );

  // OSRM Rota Çizimi (Tatvan Ana Depo -> Seçilen Teslimat Konumu)
  const drawRouteToCoords = useCallback(
    async (destLat: number, destLng: number) => {
      if (!isRouteActive || !mapInstanceRef.current) return;

      setIsRoutingLoading(true);
      try {
        const depotCoords = BITLIS_CENTER_COORDS; // Tatvan Ana Depo
        const destCoords = { lat: destLat, lng: destLng };

        const routeData = await fetchOSRMRoute(depotCoords, destCoords);
        if (routeData && routeData.coordinates.length > 0) {
          setRouteInfo(routeData);

          import("leaflet").then((L) => {
            if (!mapInstanceRef.current) return;

            // Eski rotayı temizle
            if (polylineRef.current) {
              polylineRef.current.remove();
              polylineRef.current = null;
            }

            // Yeni mavi rotayı haritaya ekle
            const polyline = L.polyline(routeData.coordinates, {
              color: "#2563eb",
              weight: 5,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(mapInstanceRef.current);

            polylineRef.current = polyline;

            // Rota ve noktaları kapsayacak şekilde harita alanını ayarla (küçük padding ile)
            if (routeData.distanceKm > 1) {
              const bounds = polyline.getBounds();
              mapInstanceRef.current.fitBounds(bounds, {
                padding: [40, 40],
                maxZoom: 16,
              });
            }
          });
        }
      } catch (err) {
        console.warn("Rota çizim hatası:", err);
      } finally {
        setIsRoutingLoading(false);
      }
    },
    [isRouteActive],
  );

  // Ters adres çözümleme (Nominatim OpenStreetMap)
  const updateAddressForCoords = useCallback(
    async (lat: number, lng: number, notifyParent: boolean = true) => {
      setIsGeocoding(true);
      try {
        const res = await reverseGeocodeNominatim(lat, lng);
        setAddressPreview(res.formattedAddress);
        if (notifyParent) {
          onChangeRef.current({
            lat,
            lng,
            address: res.formattedAddress,
            districtMatch: res.districtLabel || res.district || res.matchedDistrictValue,
            city: res.city,
            district: res.districtLabel || res.district,
            neighbourhood: res.neighbourhood,
            road: res.road,
            houseNumber: res.houseNumber,
          });
        }
      } catch {
        const fallbackNearest = findNearestBitlisDistrict(lat, lng);
        const fallback = `${fallbackNearest.label}, Bitlis Teslimat Konumu (📍 ${lat.toFixed(6)}, ${lng.toFixed(6)})`;
        setAddressPreview(fallback);
        if (notifyParent) {
          onChangeRef.current({
            lat,
            lng,
            address: fallback,
            districtMatch: fallbackNearest.label,
            district: fallbackNearest.label,
            city: "Bitlis",
          });
        }
      } finally {
        setIsGeocoding(false);
      }

      // Rota çizimini tetikle
      if (showRouting) {
        void drawRouteToCoords(lat, lng);
      }
    },
    [showRouting, drawRouteToCoords],
  );

  const updateAddressForCoordsRef = useRef(updateAddressForCoords);
  updateAddressForCoordsRef.current = updateAddressForCoords;

  // GPS ile Konum Bulma (Mobil Safari & WebKit İzin Çökme Korumalı)
  const handleUseGps = useCallback(() => {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      toast.error("Tarayıcınız konum servisini desteklemiyor.");
      return;
    }

    setIsGpsLocating(true);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const rawLat = pos.coords.latitude;
          const rawLng = pos.coords.longitude;
          const clamped = clampToBitlis(rawLat, rawLng);

          if (clamped.isClamped) {
            setIsOutsideWarning(true);
            toast.warning(
              "Cihazınızın GPS konumu Bitlis sınırları dışında. Dağıtım ağımız yalnızca Bitlis ili içerisindedir; harita Tatvan ana depoya odaklandı.",
              { duration: 5000 },
            );
            setSelectedCoords(BITLIS_CENTER_COORDS);
            if (destinationMarkerRef.current) {
              destinationMarkerRef.current.setLatLng([
                BITLIS_CENTER_COORDS.lat,
                BITLIS_CENTER_COORDS.lng,
              ]);
            }
            void updateAddressForCoordsRef.current(
              BITLIS_CENTER_COORDS.lat,
              BITLIS_CENTER_COORDS.lng,
              true,
            );
          } else {
            setIsOutsideWarning(false);
            setSelectedCoords({ lat: rawLat, lng: rawLng });
            if (destinationMarkerRef.current) {
              destinationMarkerRef.current.setLatLng([rawLat, rawLng]);
            }
            if (mapInstanceRef.current) {
              mapInstanceRef.current.panTo([rawLat, rawLng], { animate: true });
            }
            void updateAddressForCoordsRef.current(rawLat, rawLng, true);
            toast.success("GPS konumunuz alındı ve rota güncellendi.");
          }
          setIsGpsLocating(false);
        },
        (err) => {
          setIsGpsLocating(false);
          console.warn("GPS hatası:", err);
          toast.error("GPS konumuna ulaşılamadı. Lütfen cihaz konum izinlerinizi kontrol edin.");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    } catch (gpsErr) {
      setIsGpsLocating(false);
      console.warn("GPS senkron hatası (Safari izin engeli):", gpsErr);
      toast.error("Konum servisi başlatılamadı. Lütfen Safari konum izinlerini kontrol edin.");
    }
  }, []);

  // Hızlı İlçe Butonu
  const handleSelectDistrict = (districtKey: string) => {
    const d = BITLIS_DISTRICT_COORDS[districtKey];
    if (!d) return;

    setActiveDistrict(districtKey);
    setSelectedCoords({ lat: d.lat, lng: d.lng });
    setIsOutsideWarning(false);

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setLatLng([d.lat, d.lng]);
    }

    void updateAddressForCoordsRef.current(d.lat, d.lng, true);
  };

  // Harita Başlatma - SADECE 1 KEZ containerNode DOM'a bağlandığında çalışır
  useEffect(() => {
    if (!containerNode || typeof window === "undefined") return;

    let isCancelled = false;

    import("leaflet")
      .then((L) => {
        if (isCancelled || !containerNode || !containerNode.isConnected) return;

        const startLat = initialCoordsRef.current.lat;
        const startLng = initialCoordsRef.current.lng;

        // Varsa eski haritayı ve Leaflet DOM id'sini güvenle sıfırla
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

        // 1. Teslimat Noktası (Müşteri Dükkanı) İkonu - Canlı Yeşil Pin
        const destinationIcon = L.divIcon({
          className: "custom-map-dest-pin",
          html: `
            <div style="
              position: relative;
              width: 38px;
              height: 38px;
              background: linear-gradient(135deg, #10b981 0%, #047857 100%);
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 6px 18px rgba(0,0,0,0.45);
              border: 2.5px solid #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 14px;
                height: 14px;
                background: #ffffff;
                border-radius: 50%;
                transform: rotate(45deg);
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              "></div>
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 38],
          popupAnchor: [0, -38],
        });

        // 2. Ana Depo (Tatvan Dağıtım Merkezi) İkonu - Mavi/Altın Rozet
        const depotIcon = L.divIcon({
          className: "custom-map-depot-pin",
          html: `
            <div style="
              position: relative;
              width: 36px;
              height: 36px;
              background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%);
              border-radius: 50%;
              box-shadow: 0 4px 14px rgba(30,64,175,0.5);
              border: 2.5px solid #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-size: 16px;
            ">
              🏢
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let map: any;
        try {
          map = L.map(containerNode, {
            center: [startLat, startLng],
            zoom: 13,
            minZoom: 10,
            maxZoom: 19,
            maxBounds: L.latLngBounds(BITLIS_LEAFLET_BOUNDS),
            maxBoundsViscosity: 1.0, // Bitlis dışına çıkamaz
            zoomControl: true,
          });
          mapInstanceRef.current = map;
        } catch (mapErr) {
          console.warn("[BitlisMapPicker] Leaflet map oluşturma hatası (Safari/DOM):", mapErr);
          setMapInitError(true);
          return;
        }

        try {
          // OpenStreetMap Katmanı
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
            maxZoom: 19,
            subdomains: ["a", "b", "c"],
          }).addTo(map);

          // Bitlis Sınır Dikdörtgeni (Zümrüt Yeşil Kesikli Çizgi)
          L.rectangle(BITLIS_LEAFLET_BOUNDS, {
            color: "#10b981",
            weight: 2,
            dashArray: "6, 6",
            fillColor: "#10b981",
            fillOpacity: 0.03,
            interactive: false,
          }).addTo(map);

          // Ana Depo Sabit İşaretçisi (Tatvan)
          const depotMarker = L.marker([BITLIS_CENTER_COORDS.lat, BITLIS_CENTER_COORDS.lng], {
            icon: depotIcon,
            interactive: true,
          })
            .addTo(map)
            .bindPopup(
              `<strong>KasımOğulları Ana Depo</strong><br/>Aydınlar Mahallesi, İstiklal Caddesi<br/>Tatvan / Bitlis`,
            );
          depotMarkerRef.current = depotMarker;

          // Müşteri Teslimat İşaretçisi (Sürüklenebilir)
          const destMarker = L.marker([startLat, startLng], {
            icon: destinationIcon,
            draggable: true,
          })
            .addTo(map)
            .bindPopup(
              `<strong>Teslimat Noktanız</strong><br/>Dükkan kapısına sürükleyebilirsiniz`,
            );
          destinationMarkerRef.current = destMarker;

          // Pin sürüklendiğinde Bitlis sınırlarını koru ve adresi güncelle
          destMarker.on("dragend", () => {
            if (!mapInstanceRef.current || isCancelled) return;
            const pos = destMarker.getLatLng();
            const clamped = clampToBitlis(pos.lat, pos.lng);
            if (clamped.isClamped) {
              destMarker.setLatLng([clamped.lat, clamped.lng]);
              toast.warning("Konum Bitlis il sınırları içerisine hizalandı.");
            }
            setSelectedCoords({ lat: clamped.lat, lng: clamped.lng });
            setIsOutsideWarning(clamped.isClamped);
            void updateAddressForCoordsRef.current(clamped.lat, clamped.lng, true);
          });

          // Haritaya tıklandığında teslimat noktasını taşı
          map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
            if (!mapInstanceRef.current || isCancelled) return;
            const { lat, lng } = e.latlng;
            const clamped = clampToBitlis(lat, lng);
            if (clamped.isClamped) {
              destMarker.setLatLng([clamped.lat, clamped.lng]);
              setSelectedCoords({ lat: clamped.lat, lng: clamped.lng });
              setIsOutsideWarning(true);
              toast.warning("Yalnızca Bitlis ili sınırları içerisinden nokta seçebilirsiniz.");
            } else {
              destMarker.setLatLng([lat, lng]);
              setSelectedCoords({ lat, lng });
              setIsOutsideWarning(false);
            }
            void updateAddressForCoordsRef.current(clamped.lat, clamped.lng, true);
          });

          // Zamanlayıcıları temiz bir listede tut
          const t1 = window.setTimeout(() => {
            if (!isCancelled && mapInstanceRef.current) {
              try {
                mapInstanceRef.current.invalidateSize();
              } catch {
                // ignore
              }
            }
          }, 80);
          const t2 = window.setTimeout(() => {
            if (!isCancelled && mapInstanceRef.current) {
              try {
                mapInstanceRef.current.invalidateSize();
              } catch {
                // ignore
              }
            }
          }, 300);
          timeoutsRef.current.push(t1, t2);

          // İlk adres çözümlemesi
          void updateAddressForCoordsRef.current(startLat, startLng, false);
        } catch (layerErr) {
          console.warn("[BitlisMapPicker] Katman hatası:", layerErr);
        }
      })
      .catch((err) => {
        console.warn("[BitlisMapPicker] Leaflet yüklenemedi:", err);
        setMapInitError(true);
      });

    return () => {
      isCancelled = true;
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
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
  }, [containerNode]);

  // Boyut değiştiğinde veya büyütüldüğünde haritayı yeniden boyutlandır
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isExpanded]);

  return (
    <div
      className={`rounded-2xl border border-emerald-500/30 bg-card shadow-sm overflow-hidden flex flex-col transition-all duration-200 ${
        isExpanded ? "fixed inset-3 sm:inset-6 z-[9999] shadow-2xl" : className
      }`}
    >
      {/* Harita Başlık Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-emerald-950/20 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5 leading-none">
              <span>OpenStreetMap & OSRM Rota</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Bitlis Sınırları
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Haritaya tıklayarak veya pimi sürükleyerek teslimat noktanızı belirleyin
            </p>
          </div>
        </div>

        {/* Aksiyon Butonları (GPS, Rota Aç/Kapat, Genişlet) */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleUseGps}
            disabled={isGpsLocating}
            className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs cursor-pointer border-0"
            title="Cihazınızın GPS konumunu alıp Bitlis haritasında işaretler"
          >
            {isGpsLocating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin text-white" />
            ) : (
              <Navigation className="h-3.5 w-3.5 mr-1 text-white" />
            )}
            {isGpsLocating ? "GPS Alınıyor..." : "GPS Konumumu Bul"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant={isRouteActive ? "secondary" : "outline"}
            onClick={() => {
              setIsRouteActive((v) => !v);
              if (!isRouteActive) {
                void drawRouteToCoords(selectedCoords.lat, selectedCoords.lng);
              } else if (polylineRef.current) {
                polylineRef.current.remove();
                polylineRef.current = null;
                setRouteInfo(null);
              }
            }}
            className="h-7 text-xs px-2 gap-1 text-blue-600 dark:text-blue-400 border-blue-500/30 cursor-pointer"
            title="Tatvan ana depodan yol rotasını aç/kapat"
          >
            <RouteIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Rota</span>
          </Button>

          {allowExpand && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              title={isExpanded ? "Küçült" : "Tam Ekran Yap"}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Hızlı İlçe Seçim Şeridi */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-background px-3 py-1.5 text-xs no-scrollbar">
        <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0 mr-1 flex items-center gap-1">
          <MapPin className="h-3 w-3 text-emerald-500" />
          İlçeler:
        </span>
        {Object.entries(BITLIS_DISTRICT_COORDS).map(([key, d]) => (
          <button
            key={key}
            type="button"
            onClick={() => handleSelectDistrict(key)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
              activeDistrict === key
                ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                : "border-border bg-muted/50 text-foreground hover:bg-emerald-500/10 hover:border-emerald-500/30"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Harita Konteyneri */}
      <div className="relative flex-1 w-full bg-muted min-h-[260px]">
        {mapInitError ? (
          <div
            className="flex flex-col items-center justify-center p-6 text-center w-full bg-[#09120c] text-white"
            style={{ height: isExpanded ? "calc(100vh - 220px)" : height }}
          >
            <MapPin className="h-9 w-9 text-emerald-400 mb-2" />
            <p className="font-bold text-sm text-emerald-300">Harita Güvenli Modda Açıldı</p>
            <p className="text-xs text-white/70 max-w-xs mt-1">
              Cihazınızda harita güvenli modda çalışmaktadır. Yukarıdaki ilçe butonlarını tıklayarak
              veya GPS butonunu kullanarak teslimat noktanızı doğrudan belirleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div
            ref={setContainerNode}
            className="w-full h-full relative z-0"
            style={{ height: isExpanded ? "calc(100vh - 220px)" : height }}
          />
        )}

        {/* Canlı Rota Kartı (OSRM Mesafe ve Süre Bilgisi) */}
        {isRouteActive && routeInfo && (
          <div className="absolute top-3 left-3 z-[1000] rounded-xl bg-white/95 dark:bg-card/95 border border-blue-500/40 p-2.5 shadow-lg backdrop-blur text-xs flex flex-col gap-1 max-w-[240px]">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                <RouteIcon className="h-4 w-4" />
                <span>Tatvan Depo Sevkiyat Rotası</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Aydınlar Mah. İstiklal Cad. çıkışlı
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground pt-0.5 border-t border-border">
              <span className="flex items-center gap-1">
                <Milestone className="h-3 w-3 text-blue-500" />
                Mesafe:
              </span>
              <span className="font-semibold text-foreground">{routeInfo.distanceKm} km</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-emerald-500" />
                Tahmini Süre:
              </span>
              <span className="font-semibold text-foreground">
                ~{routeInfo.durationMinutes} dakika
              </span>
            </div>
          </div>
        )}

        {/* Rota Yükleniyor Göstergesi */}
        {isRoutingLoading && (
          <div className="absolute top-3 right-3 z-[1000] rounded-lg bg-blue-600 text-white px-2.5 py-1 text-xs font-medium shadow-md flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>OSRM Rotası Hesaplanıyor...</span>
          </div>
        )}

        {/* Bitlis Sınır Uyarısı */}
        {isOutsideWarning && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000] rounded-lg bg-amber-500/95 text-white px-3 py-1.5 text-xs font-medium backdrop-blur shadow-md flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Teslimat ağımız yalnızca Bitlis ili içerisindedir (Tatvan, Merkez, Ahlat, Adilcevaz,
              Güroymak, Hizan).
            </span>
          </div>
        )}
      </div>

      {/* Seçilen Konum ve Açık Adres Kartı (Nominatim) */}
      <div className="border-t border-border bg-muted/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Açık Teslimat Adresi (Nominatim):
          </span>
          <p className="font-semibold text-foreground truncate mt-0.5 text-xs sm:text-sm">
            {isGeocoding ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                Adres çözümleniyor...
              </span>
            ) : (
              addressPreview || "Harita üzerindeki pimi dükkan kapınıza kaydırın"
            )}
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="font-mono text-[11px] text-muted-foreground block">
            {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Store className="h-3 w-3" />
            Bitlis İli
          </span>
        </div>
      </div>
    </div>
  );
}
