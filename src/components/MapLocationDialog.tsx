import { useState } from "react";
import { MapPin, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GeoLocation } from "@/lib/location-utils";
import { BitlisMapPicker } from "./BitlisMapPicker";
import { toast } from "sonner";

interface MapLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocation?: GeoLocation | null;
  autoGps?: boolean;
  onLocationSelect: (result: {
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
}

export function MapLocationDialog({
  open,
  onOpenChange,
  initialLocation,
  onLocationSelect,
}: MapLocationDialogProps) {
  const [currentSelection, setCurrentSelection] = useState<{
    lat: number;
    lng: number;
    address: string;
    districtMatch?: string;
    city?: string;
    district?: string;
    neighbourhood?: string;
    road?: string;
    houseNumber?: string;
  } | null>(null);

  const handleConfirm = () => {
    if (currentSelection) {
      onLocationSelect(currentSelection);
      onOpenChange(false);
      toast.success("Konum başarıyla kaydedildi!");
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-4 sm:p-6 overflow-hidden bg-[#07110a] text-white border-emerald-950/80">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <MapPin className="h-5 w-5 text-emerald-500" />
              Bitlis Haritasından Konum Seçin
            </DialogTitle>
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Sadece Bitlis Sınırları
            </span>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Dükkanınızın veya deponuzun teslimat kapısını haritada işaretleyin veya GPS ile bulun.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <BitlisMapPicker
            value={initialLocation}
            onChange={(res) => setCurrentSelection(res)}
            height="380px"
            allowExpand={false}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Bu Konumu Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
