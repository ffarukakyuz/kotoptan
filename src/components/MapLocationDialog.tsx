import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Loader2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { reverseGeocodeNominatim, GeoLocation } from "@/lib/location-utils";
import { toast } from "sonner";

interface MapLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocation?: GeoLocation | null;
  onLocationSelect: (result: {
    lat: number;
    lng: number;
    address: string;
    districtMatch?: string;
  }) => void;
}

export function MapLocationDialog({
  open,
  onOpenChange,
  initialLocation,
  onLocationSelect,
}: MapLocationDialogProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  // Default coordinates: Tatvan / Bitlis center [38.5020, 42.2850]
  const [selectedCoords, setSelectedCoords] = useState<GeoLocation>(
    initialLocation || { lat: 38.502, lng: 42.285 },
  );
  const [addressPreview, setAddressPreview] = useState<string>("");
  const [matchedDistrict, setMatchedDistrict] = useState<string | undefined>();
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isGpsLocating, setIsGpsLocating] = useState<boolean>(false);

  // Reverse geocoding fetcher
  const updateAddressForCoords = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const res = await reverseGeocodeNominatim(lat, lng);
      setAddressPreview(res.formattedAddress);
      setMatchedDistrict(res.matchedDistrictValue);
    } catch {
      setAddressPreview(`Seçili Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Harita başlatma & Leaflet SSR izolasyonu
  useEffect(() => {
    if (!open || typeof window === "undefined" || !mapContainerRef.current) return;

    let isCancelled = false;

    // Dinamik import ile Leaflet SSR patlamasını %100 önle
    import("leaflet").then((L) => {
      if (isCancelled || !mapContainerRef.current) return;

      const defaultLat = initialLocation?.lat || selectedCoords.lat;
      const defaultLng = initialLocation?.lng || selectedCoords.lng;

      // Özel modern SVG Pin İkonu
      const pinIcon = L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="
            position: relative;
            width: 36px;
            height: 36px;
            background: #e11d48;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 14px rgba(0,0,0,0.45);
            border: 2px solid #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 12px;
              height: 12px;
              background: #ffffff;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      });

      // Eski haritayı temizle
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Yeni harita oluştur
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 16,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      // OpenStreetMap katmanı
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Sürüklenebilir İşaretçi (Pin)
      const marker = L.marker([defaultLat, defaultLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);
      markerRef.current = marker;

      // İşaretçi sürüklendiğinde
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setSelectedCoords({ lat: pos.lat, lng: pos.lng });
        void updateAddressForCoords(pos.lat, pos.lng);
      });

      // Haritaya tıklandığında işaretçiyi taşı
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setSelectedCoords({ lat, lng });
        void updateAddressForCoords(lat, lng);
      });

      // Dialog animasyonundan sonra harita boyutunu güncelle
      setTimeout(() => {
        if (!isCancelled && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);

      void updateAddressForCoords(defaultLat, defaultLng);
    });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [open]);

  // GPS butonuna basıldığında
  const handleUseGps = () => {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      toast.error("Tarayıcınız konum servisini desteklemiyor.");
      return;
    }

    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setSelectedCoords({ lat, lng });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17);
          markerRef.current.setLatLng([lat, lng]);
        }
        void updateAddressForCoords(lat, lng);
        setIsGpsLocating(false);
        toast.success("Mevcut konumunuz haritada işaretlendi.");
      },
      (err) => {
        setIsGpsLocating(false);
        console.warn("GPS error:", err);
        toast.error("Konumunuza ulaşılamadı. Lütfen konum izinlerinizi kontrol edin.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handleConfirm = () => {
    onLocationSelect({
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      address: addressPreview,
      districtMatch: matchedDistrict,
    });
    onOpenChange(false);
    toast.success("Konum adrese eklendi!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-4 sm:p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
            <MapPin className="h-5 w-5 text-rose-500" />
            Haritadan Konum Seçin
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Dükkanınızın veya deponuzun tam kapı konumunu harita üzerindeki pimi kaydırarak belirleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          {/* Harita Konteyneri */}
          <div
            ref={mapContainerRef}
            className="h-[320px] sm:h-[400px] w-full rounded-xl border border-border shadow-inner bg-muted"
          />

          {/* GPS Butonu (Harita üzerinde yüzer buton) */}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute top-3 right-3 z-[1000] shadow-md bg-white/95 dark:bg-card/95 hover:bg-white text-foreground text-xs font-semibold backdrop-blur"
            onClick={handleUseGps}
            disabled={isGpsLocating}
          >
            {isGpsLocating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 text-primary" />
            ) : (
              <Navigation className="h-3.5 w-3.5 mr-1 text-primary" />
            )}
            {isGpsLocating ? "Konum Alınıyor..." : "GPS Konumuma Git"}
          </Button>
        </div>

        {/* Adres ve Koordinat Bilgi Kutusu */}
        <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Seçilen Adres Bilgisi
              </span>
              <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">
                {isGeocoding ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Adres çözümleniyor...
                  </span>
                ) : (
                  addressPreview || "Harita üzerinde bir noktayı işaretleyin"
                )}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-mono text-muted-foreground block">
                {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Bu Konumu Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
