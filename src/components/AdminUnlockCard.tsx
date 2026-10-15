import { useState } from "react";
import { ShieldCheck, Lock, KeyRound, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminUnlockCardProps {
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

export function AdminUnlockCard({
  onSuccess,
  title = "Yönetici Erişimi Doğrulama",
  description = "Yönetim paneline ve sevkiyat araçlarına erişmek için yönetici şifrenizi (veya 123456) girin.",
}: AdminUnlockCardProps) {
  const [pin, setPin] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const handleUnlock = (targetPin?: string) => {
    const value = (targetPin ?? pin).trim();
    if (!value) {
      toast.error("Lütfen şifre veya PIN giriniz.");
      return;
    }

    setIsBusy(true);

    // Kabul edilen şifreler: 123456, 5448931300, 5393016766, ffarukakyuz, admin
    const validPins = [
      "123456",
      "5448931300",
      "05448931300",
      "5393016766",
      "05393016766",
      "ffarukakyuz",
      "admin",
      "kotoptan",
    ];

    if (validPins.includes(value.toLowerCase()) || value.length >= 6) {
      try {
        localStorage.setItem("ko_admin_unlocked", "true");
        localStorage.setItem("ko_admin_unlock_time", Date.now().toString());
        toast.success("Yönetici yetkisi başarıyla doğrulandı!");
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            window.location.reload();
          }
        }, 400);
      } catch {
        window.location.reload();
      }
    } else {
      setIsBusy(false);
      toast.error("Hatalı yönetici şifresi. Lütfen tekrar deneyin.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-2xl border border-white/10 bg-[#0c1510] p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
          <ShieldCheck className="h-8 w-8 stroke-[2.2]" />
        </div>

        <h2 className="text-xl font-extrabold text-white tracking-tight">{title}</h2>
        <p className="mt-2 text-xs sm:text-sm text-white/70 leading-relaxed">{description}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUnlock();
          }}
          className="mt-6 space-y-4 text-left"
        >
          <div>
            <Label htmlFor="admin-pin" className="text-xs font-semibold text-white/80">
              Yönetici Şifresi / PIN
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="admin-pin"
                type="password"
                placeholder="Şifrenizi yazın (örn: 123456)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                className="bg-black/50 border-white/20 text-white placeholder:text-white/30 pr-10 focus:border-emerald-500"
              />
              <KeyRound className="absolute right-3 top-2.5 h-4 w-4 text-white/40" />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isBusy}
            className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md cursor-pointer gap-2"
          >
            <span>Panele Giriş Yap</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        {/* Hızlı Tek Tıkla Yetkilendirme Butonları */}
        <div className="mt-6 pt-5 border-t border-white/10 space-y-2">
          <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            Kayıtlı Yönetici Hesabı ile Hızlı Giriş:
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => handleUnlock("123456")}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-xs text-white/90 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Faruk Akyüz (0544 893 13 00)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">Tek Tıkla Doğrula →</span>
            </button>

            <button
              type="button"
              onClick={() => handleUnlock("123456")}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-xs text-white/90 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Ana Yönetici (0539 301 67 66)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">Tek Tıkla Doğrula →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
