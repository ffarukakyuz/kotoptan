// Product image resolver - strictly uses live Supabase image_url (base64 or direct asset paths)
// No mock product image filenames, no keyword mappings, and no external placeholder services.

export const GENERIC_PRODUCT_ICON =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'><rect width='20' height='20' x='2' y='2' rx='4'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

/**
 * Resolves a product's display image URL directly from the Supabase record.
 * Handles:
 * - Direct base64 data URLs (data:image/...)
 * - Direct storage / CDN asset URLs
 * - Absolute paths
 * If no image URL is present, returns an empty string or neutral generic SVG.
 */
export function getPublicProductImageUrl(
  rawInput?:
    | string
    | null
    | {
        image_url?: string | null;
        image?: string | null;
        name?: string | null;
        category?: string | null;
      },
  _productName?: string | null,
  _category?: string | null,
): string {
  let url: string | null | undefined;

  if (rawInput && typeof rawInput === "object") {
    url = rawInput.image_url || rawInput.image;
  } else if (typeof rawInput === "string") {
    url = rawInput;
  }

  if (url && typeof url === "string") {
    let trimmed = url.trim();
    if (trimmed.length > 0) {
      // Base64 data URLs work directly
      if (trimmed.startsWith("data:")) return trimmed;
      // Absolute http/https URLs
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      
      // Clean up accidental public/ prefix (e.g. "public/caykur.jpg" -> "/caykur.jpg")
      if (trimmed.startsWith("public/")) {
        trimmed = trimmed.replace(/^public\//, "/");
      }
      if (trimmed.startsWith("./public/")) {
        trimmed = trimmed.replace(/^\.\/public\//, "/");
      }

      // Root-relative asset paths (e.g. /image_name.jpg)
      if (trimmed.startsWith("/")) return trimmed;

      // Relative filename without leading slash (e.g. "caykur.jpg") -> convert to root-relative "/caykur.jpg"
      return `/${trimmed}`;
    }
  }

  return "";
}

/**
 * Convenience helper to resolve image from a Product object
 */
export function resolveProductImage(
  product?: {
    image_url?: string | null;
    image?: string | null;
    name?: string | null;
    category?: string | null;
  } | null,
): string {
  if (!product) return "";
  return getPublicProductImageUrl(product);
}

/**
 * Category fallback - returns empty string or generic icon, no mock products
 */
export function getCategoryFallbackImageUrl(_category?: string | null): string {
  return "";
}

/**
 * Image error handler for <img /> components:
 * Sets opacity and uses a generic neutral SVG icon if the image cannot be loaded.
 * Does not fall back to any mock product images.
 */
export function handleProductImageError(
  e: React.SyntheticEvent<HTMLImageElement>,
  _productName?: string | null,
  _category?: string | null,
) {
  const target = e.currentTarget;
  if (target.dataset.hasFailed) return;
  target.dataset.hasFailed = "true";
  target.style.opacity = "0.3";
  target.src = GENERIC_PRODUCT_ICON;
}
