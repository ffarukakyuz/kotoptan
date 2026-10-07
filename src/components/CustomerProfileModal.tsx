import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Store,
  Phone,
  MapPin,
  ExternalLink,
  MessageSquare,
  Clock,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findFallbackUser, FALLBACK_USERS } from "@/data/users";

interface CustomerProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  userPhone?: string;
  userId?: string | null;
  initialDistrict?: string;
}

interface CustomerDetails {
  id?: string;
  fullName: string;
  businessName: string;
  phone: string;
  district: string;
  address: string;
  ordersCount: number;
  lastOrderDate?: string | null;
  isAdmin: boolean;
}

export function CustomerProfileModal({
  open,
  onOpenChange,
  userName = "",
  userPhone = "",
  userId,
  initialDistrict,
}: CustomerProfileModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<CustomerDetails | null>(null);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setLoading(true);

    async function loadData() {
      const cleanPhone = (userPhone || "").replace(/\D/g, "");
      const shortPhone = cleanPhone.startsWith("90")
        ? cleanPhone.slice(2)
        : cleanPhone.replace(/^0/, "");

      // 1. Yerel kullanıcı verisinden ara
      const fallback =
        findFallbackUser(userPhone || "") ||
        FALLBACK_USERS.find(
          (u) =>
            (shortPhone && u.normalizedPhone.includes(shortPhone)) ||
            (userName && u.fullName.toLowerCase().includes(userName.toLowerCase())),
        );

      let foundName = fallback?.fullName || userName || "Müşteri / Bayi";
      let foundBusiness = fallback?.businessName || "";
      let foundPhone = fallback?.phone || userPhone || "";
      let foundAddress = fallback?.address || "";
      let foundDistrict = fallback?.district || initialDistrict || "";
      const isAdm = fallback?.role === "admin";

      // 2. Supabase profiles tablosundan ara
      try {
        let query = supabase.from("profiles").select("*");
        if (userId) {
          query = query.eq("id", userId);
        } else if (shortPhone) {
          query = query.ilike("phone", `%${shortPhone}%`);
        } else if (userName) {
          query = query.ilike("full_name", `%${userName}%`);
        }

        const { data, error } = await query.limit(1).maybeSingle();
        if (!error && data) {
          foundName = data.full_name || foundName;
          foundBusiness = data.business_name || foundBusiness;
          foundPhone = data.phone || foundPhone;
          foundAddress = data.address || foundAddress;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((data as any).district) foundDistrict = (data as any).district;
        }
      } catch (err) {
        console.warn("[CustomerProfileModal] profile fetch error:", err);
      }

      // İlçe tespiti (Metinden çıkartma)
      if (!foundDistrict) {
        const text = `${foundAddress} ${foundBusiness}`.toLowerCase();
        if (text.includes("tatvan")) foundDistrict = "Tatvan";
        else if (text.includes("ahlat")) foundDistrict = "Ahlat";
        else if (text.includes("adilcevaz")) foundDistrict = "Adilcevaz";
        else if (text.includes("güroymak") || text.includes("guroymak")) foundDistrict = "Güroymak";
        else if (text.includes("hizan")) foundDistrict = "Hizan";
        else if (text.includes("mutki")) foundDistrict = "Mutki";
        else if (text.includes("merkez") || text.includes("bitlis"))
          foundDistrict = "Bitlis Merkez";
        else foundDistrict = "Tatvan";
      }

      // 3. Sipariş geçmişini sorgula
      let ordersCount = 0;
      let lastOrderDate: string | null = null;
      try {
        if (shortPhone) {
          const { data: orders } = await supabase
            .from("orders")
            .select("id, created_at")
            .ilike("phone", `%${shortPhone}%`)
            .order("created_at", { ascending: false });

          if (orders && orders.length > 0) {
            ordersCount = orders.length;
            lastOrderDate = orders[0]?.created_at || null;
          }
        }
      } catch {
        // Devam et
      }

      if (isMounted) {
        setDetails({
          id: userId || fallback?.id,
          fullName: foundName,
          businessName: foundBusiness || "Kayıtlı İşletme",
          phone: foundPhone,
          district: foundDistrict,
          address: foundAddress || "Adres belirtilmemiş",
          ordersCount,
          lastOrderDate,
          isAdmin: isAdm,
        });
        setLoading(false);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [open, userName, userPhone, userId, initialDistrict]);

  const cleanPhoneForWa = (details?.phone || userPhone || "").replace(/\D/g, "").replace(/^0/, "");

  const handleNavigateToUsers = () => {
    onOpenChange(false);
    const searchTerm = details?.phone || details?.fullName || userName;
    void navigate({
      to: "/yonetim",
      search: {
        tab: "users",
        search: searchTerm,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0d1418] border-white/10 text-white p-5 sm:p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="border-b border-white/10 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-extrabold text-white flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-400" />
              <span>Müşteri & Bayi Kartı</span>
            </DialogTitle>
            {details?.isAdmin && (
              <Badge className="bg-[#166534] text-white text-[11px] font-bold">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Yönetici
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-xs text-white/50">
            Müşteri detayları yükleniyor...
          </div>
        ) : details ? (
          <div className="space-y-4 pt-2">
            {/* Üst Profil Kartı */}
            <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3.5 border border-white/10">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-extrabold text-lg">
                {details.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-white truncate">{details.fullName}</h4>
                <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5 truncate">
                  <Store className="h-3.5 w-3.5 shrink-0" />
                  <span>{details.businessName}</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                    <MapPin className="h-3 w-3" />
                    {details.district}
                  </span>
                  {details.ordersCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-300 border border-sky-500/30">
                      <PackageCheck className="h-3 w-3" />
                      {details.ordersCount} Sipariş
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* İletişim ve Adres Bilgileri */}
            <div className="space-y-2.5 rounded-xl bg-white/[0.03] p-3 border border-white/5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/50 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-white/40" />
                  Telefon:
                </span>
                <span className="font-mono font-semibold text-white">
                  {details.phone || "Kayıtlı telefon yok"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 pt-1 border-t border-white/5">
                <span className="text-white/50 flex items-center gap-1.5 shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-white/40" />
                  Teslimat Adresi:
                </span>
                <span className="text-right text-white/80 leading-relaxed font-medium">
                  {details.address}
                </span>
              </div>

              {details.lastOrderDate && (
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-white/50">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Son Sipariş Tarihi:
                  </span>
                  <span>{new Date(details.lastOrderDate).toLocaleDateString("tr-TR")}</span>
                </div>
              )}
            </div>

            {/* Hızlı Eylemler */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {details.phone && (
                <a
                  href={`tel:${details.phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-bold text-white transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Telefonla Ara</span>
                </a>
              )}

              {cleanPhoneForWa && (
                <a
                  href={`https://wa.me/90${cleanPhoneForWa}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] px-3 py-2 text-xs font-bold text-white transition-colors shadow-sm"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>

            {/* Yönetim Paneli Üyeler Sekmesine Yönlendir */}
            <Button
              type="button"
              onClick={handleNavigateToUsers}
              className="w-full bg-[#166534] hover:bg-[#15803d] text-white font-bold text-xs gap-1.5 rounded-xl py-2.5 shadow-md cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Yönetim Panelinde Üyeyi İncele & Düzenle</span>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
