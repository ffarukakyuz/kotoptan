import type React from "react";

// Auto-generated product image mapping for production & local hosting
export const PRODUCT_IMAGE_MAP: Record<string, string> = {};

export const GENERIC_PRODUCT_ICON =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'><rect width='20' height='20' x='2' y='2' rx='4'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

/**
 * Resolves a product's display image URL.
 * Supports string URLs, product objects, absolute CDN paths, and local assets.
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

  if (!url || typeof url !== "string") {
    return GENERIC_PRODUCT_ICON;
  }

  const trimmed = url.trim();
  if (!trimmed) return GENERIC_PRODUCT_ICON;

  // Base64 data URLs work anywhere
  if (trimmed.startsWith("data:")) return trimmed;

  // Absolute http/https URLs (direct CDN paths) work anywhere
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

  // Direct public path
  if (trimmed.startsWith("/products/")) return trimmed;

  // Check direct mapping
  if (PRODUCT_IMAGE_MAP[trimmed]) {
    return PRODUCT_IMAGE_MAP[trimmed];
  }

  // If local /public/__l5e/assets-v1/...
  if (trimmed.startsWith("/__l5e/assets-v1/")) {
    return trimmed;
  }

  // If local /src/assets/images/...
  if (trimmed.includes("/src/assets/images/")) {
    const filename = trimmed.split("/").pop();
    return filename ? "/products/" + filename : trimmed;
  }

  return trimmed;
}

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
