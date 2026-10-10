import { Link, useRouter } from "@tanstack/react-router";
import {
  ShoppingCart,
  Package,
  LogOut,
  LogIn,
  User as UserIcon,
  ShieldCheck,
  Menu,
  Search,
  Box,
  X,
  Smartphone,
} from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { PWAInstallModal } from "@/components/PWAInstallBanner";
import { BRAND_LOGO_SRC } from "@/lib/branding";

export function SiteHeader() {
  const { totalQuantity } = useCart();
  const { user, isAdmin, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [showPwaGuide, setShowPwaGuide] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const router = useRouter();

  const handleInstallClick = async () => {
    setOpen(false);
    if (isInstallable) {
      await install();
    } else {
      setShowPwaGuide(true);
    }
  };

  const handleSearchClick = () => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/") {
      void router.navigate({ to: "/" });
      setTimeout(() => {
        if (typeof document !== "undefined") {
          const el = document.getElementById("search-input");
          el?.focus();
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
    } else {
      if (typeof document !== "undefined") {
        const el = document.getElementById("search-input");
        el?.focus();
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const navLinks = (
    <>
      <Link
        to="/"
        className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        onClick={() => {
          setOpen(false);
          if (typeof window !== "undefined" && window.location.pathname === "/") {
            const el = document.getElementById("urunler");
            el?.scrollIntoView({ behavior: "smooth" });
          }
        }}
      >
        Ürünler
      </Link>

      {user && (
        <Link
          to="/siparislerim"
          className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          onClick={() => setOpen(false)}
        >
          <Package className="mr-1.5 inline h-4 w-4" />
          Siparişlerim
        </Link>
      )}

      {/* Yönetim Butonu (Admin ise belirgin yeşil/altın rozet) */}
      {isAdmin && (
        <Link
          to="/yonetim"
          className="rounded-lg px-3 py-2 text-sm font-bold text-[#22c55e] transition-colors hover:bg-white/10 hover:text-[#4ade80] flex items-center gap-1.5"
          onClick={() => setOpen(false)}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Yönetim</span>
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060b08]/95 text-white backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Name */}
        <Link to="/" className="group flex items-center gap-2.5 sm:gap-3">
          <span className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl overflow-hidden shadow-md shadow-black/50 border border-emerald-500/40 ring-1 ring-emerald-500/20 bg-[#040806] transition-transform duration-200 group-hover:scale-105 active:scale-95 shrink-0">
            <img
              src={BRAND_LOGO_SRC}
              alt="KasımOğulları Logo"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </span>
          <div className="flex flex-col justify-center">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-none">
              Kasım<span className="text-[#22c55e]">Oğulları</span>
            </span>
            <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-400 tracking-wider uppercase mt-0.5 leading-none">
              Toptan Dağıtım
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden items-center gap-1 md:flex">{navLinks}</nav>

        {/* Header Actions (Search, Cart, Yönetim, User, Çıkış, Menu) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Search Button */}
          <button
            type="button"
            onClick={handleSearchClick}
            aria-label="Ürün Ara"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
            title="Ürün Ara"
          >
            <Search className="h-4.5 w-4.5 stroke-[2]" />
          </button>

          {/* Cart Button with Count Badge */}
          <Link
            to="/sepet"
            aria-label="Sepetim"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
            title="Sepetim"
          >
            <ShoppingCart className="h-4.5 w-4.5 stroke-[2]" />
            {totalQuantity > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#166534] px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#060b08]">
                {totalQuantity}
              </span>
            )}
          </Link>

          {/* User & Çıkış Bölümü */}
          {user ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Link
                to="/profil"
                aria-label="Hesabım"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
                title={profile?.business_name || profile?.full_name || "Hesabım"}
              >
                <UserIcon className="h-4.5 w-4.5 stroke-[2]" />
              </Link>

              {/* ÇIKIŞ YAP BUTONU (Masaüstü Doğrudan Görünür) */}
              <button
                type="button"
                onClick={() => void signOut()}
                className="hidden sm:flex items-center gap-1 rounded-lg bg-red-950/40 hover:bg-red-800 border border-red-500/30 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:text-white transition-colors cursor-pointer"
                title="Oturumu Kapat"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Çıkış</span>
              </button>
            </div>
          ) : (
            /* GİRİŞ YAP BUTONU */
            <Link
              to="/giris"
              aria-label="Giriş Yap"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Giriş Yap</span>
            </Link>
          )}

          {/* Menu / Hamburger Button */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menüyü Aç"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5 stroke-[2]" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown */}
      {open && (
        <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-1 border-t border-white/10 bg-[#060b08] px-4 py-3 shadow-xl md:hidden">
          {/* Logo & Marka Başlığı */}
          <div className="flex items-center gap-3 pb-3 mb-1 border-b border-white/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl overflow-hidden shadow-md shadow-black/40 border border-emerald-500/30 shrink-0">
              <img
                src={BRAND_LOGO_SRC}
                alt="KasımOğulları Logo"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </span>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white block">
                Kasım<span className="text-[#22c55e]">Oğulları</span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-400 block">
                Tatvan Toptan Dağıtım Merkezi
              </span>
            </div>
          </div>

          {navLinks}

          {/* Kısayol Ekle / Ana Ekrana Ekle Butonu */}
          {!isInstalled && (
            <div className="mt-2 border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex w-full items-center gap-2 rounded-lg bg-[#166534]/40 hover:bg-[#166534] px-3 py-2 text-xs font-semibold text-emerald-300 hover:text-white transition-colors cursor-pointer"
              >
                <Smartphone className="h-4 w-4 text-emerald-400" />
                <span>Ana Ekrana Kısayol Ekle</span>
              </button>
            </div>
          )}

          {user ? (
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <Link
                to="/profil"
                className="text-xs font-semibold text-emerald-400 hover:underline truncate max-w-[180px]"
                onClick={() => setOpen(false)}
              >
                {profile?.business_name || profile?.full_name || "Profilim"}
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-800 hover:text-white text-xs gap-1.5 cursor-pointer"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Çıkış Yap</span>
              </Button>
            </div>
          ) : (
            <div className="mt-3 border-t border-white/10 pt-3">
              <Link
                to="/giris"
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-colors"
                onClick={() => setOpen(false)}
              >
                <LogIn className="h-4 w-4" />
                <span>Giriş Yap / Kayıt Ol</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {showPwaGuide && <PWAInstallModal isIOS={isIOS} onClose={() => setShowPwaGuide(false)} />}
    </header>
  );
}
