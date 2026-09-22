import { Link, useRouter } from "@tanstack/react-router";
import {
  ShoppingCart,
  Package,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Menu,
  Search,
  Box,
  X,
} from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { totalQuantity } = useCart();
  const { user, isAdmin, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSearchClick = () => {
    if (window.location.pathname !== "/") {
      void router.navigate({ to: "/" });
      setTimeout(() => {
        const el = document.getElementById("search-input");
        el?.focus();
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    } else {
      const el = document.getElementById("search-input");
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const navLinks = (
    <>
      <Link
        to="/"
        className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        onClick={() => setOpen(false)}
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
      {isAdmin && (
        <Link
          to="/yonetim"
          className="rounded-lg px-3 py-2 text-sm font-medium text-[#22c55e] transition-colors hover:bg-white/10 hover:text-[#4ade80]"
          onClick={() => setOpen(false)}
        >
          <ShieldCheck className="mr-1.5 inline h-4 w-4" />
          Yönetim
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060b08]/95 text-white backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Name */}
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#166534] text-white shadow-md shadow-black/50 transition-transform group-hover:scale-105 active:scale-95">
            <Box className="h-5 w-5 stroke-[2.2]" />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-white">
            Kasım<span className="text-[#22c55e]">Oğulları</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden items-center gap-1 md:flex">{navLinks}</nav>

        {/* Header Actions (Search, Cart, User, Menu) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search Button */}
          <button
            type="button"
            onClick={handleSearchClick}
            aria-label="Ürün Ara"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
          >
            <Search className="h-5 w-5 stroke-[2]" />
          </button>

          {/* Cart Button with Count Badge */}
          <Link
            to="/sepet"
            aria-label="Sepetim"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ShoppingCart className="h-5 w-5 stroke-[2]" />
            {totalQuantity > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#166534] px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#060b08]">
                {totalQuantity}
              </span>
            )}
          </Link>

          {/* User / Profile Button */}
          {user ? (
            <Link
              to="/profil"
              aria-label="Hesabım"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              title={profile?.business_name || profile?.full_name || "Hesabım"}
            >
              <UserIcon className="h-5 w-5 stroke-[2]" />
            </Link>
          ) : (
            <Link
              to="/giris"
              aria-label="Giriş Yap"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
            >
              <UserIcon className="h-5 w-5 stroke-[2]" />
            </Link>
          )}

          {/* Menu / Hamburger Button */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menüyü Aç"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:scale-95 cursor-pointer"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5 stroke-[2]" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown */}
      {open && (
        <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-1 border-t border-white/10 bg-[#060b08] px-4 py-3 shadow-xl">
          {navLinks}
          {user ? (
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
              <Link
                to="/profil"
                className="text-sm font-medium text-[#22c55e] hover:underline"
                onClick={() => setOpen(false)}
              >
                {profile?.business_name || profile?.full_name || "Profilim"}
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:bg-white/10 hover:text-red-300"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                Çıkış
              </Button>
            </div>
          ) : (
            <div className="mt-2 border-t border-white/10 pt-2">
              <Link
                to="/giris"
                className="text-sm font-semibold text-[#22c55e] hover:underline"
                onClick={() => setOpen(false)}
              >
                Giriş Yap / Kayıt Ol
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
