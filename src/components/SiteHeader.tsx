import { Link } from "@tanstack/react-router";
import { ShoppingCart, Package, LogOut, User as UserIcon, ShieldCheck, Menu } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { totalQuantity } = useCart();
  const { user, isAdmin, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const navLinks = (
    <>
      <Link
        to="/"
        className="rounded-md px-3 py-2 text-sm font-medium text-secondary-foreground/80 transition-colors hover:bg-white/10 hover:text-secondary-foreground"
        onClick={() => setOpen(false)}
      >
        Ürünler
      </Link>
      {user && (
        <Link
          to="/siparislerim"
          className="rounded-md px-3 py-2 text-sm font-medium text-secondary-foreground/80 transition-colors hover:bg-white/10 hover:text-secondary-foreground"
          onClick={() => setOpen(false)}
        >
          <Package className="mr-1 inline h-4 w-4" />
          Siparişlerim
        </Link>
      )}
      {isAdmin && (
        <Link
          to="/yonetim"
          className="rounded-md px-3 py-2 text-sm font-medium text-brand-green transition-colors hover:bg-white/10"
          onClick={() => setOpen(false)}
        >
          <ShieldCheck className="mr-1 inline h-4 w-4" />
          Yönetim
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 bg-secondary text-secondary-foreground">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="group flex items-center gap-2">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="absolute inset-0 rounded-md bg-primary/50 animate-logo-ring" />
            <Package className="relative h-5 w-5 animate-logo-pop" />
          </span>
          <span className="animate-wordmark-in text-lg font-extrabold tracking-tight">
            Kasım<span className="text-brand-green">Oğulları</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">{navLinks}</nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="relative hover:bg-white/10">
            <Link to="/sepet">
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden sm:inline">Sepet</span>
              {totalQuantity > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
                  {totalQuantity}
                </span>
              )}
            </Link>
          </Button>

          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to="/profil"
                className="max-w-[140px] truncate rounded-md px-2 py-1 text-sm text-secondary-foreground/80 hover:text-secondary-foreground"
              >
                <UserIcon className="mr-1 inline h-4 w-4" />
                {profile?.business_name || profile?.full_name || "Hesabım"}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-white/10"
                aria-label="Çıkış yap"
                onClick={() => void signOut()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button asChild size="sm">
              <Link to="/giris">
                <UserIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Hesap</span>
              </Link>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden hover:bg-white/10"
            aria-label="Menü"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-1 border-t border-white/10 px-4 pb-3 md:hidden">
          {navLinks}
          {user ? (
            <Link
              to="/profil"
              className="rounded-md px-3 py-2 text-sm text-secondary-foreground/80"
              onClick={() => setOpen(false)}
            >
              Hesabım
            </Link>
          ) : null}
        </div>
      )}
    </header>
  );
}
