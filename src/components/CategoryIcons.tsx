import type { ComponentProps } from "react";

export function AllCategoryIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* 4 grid squares with soft rounded corners */}
      <rect x="12" y="12" width="17" height="17" rx="3.5" />
      <rect x="35" y="12" width="17" height="17" rx="3.5" />
      <rect x="12" y="35" width="17" height="17" rx="3.5" />
      <rect x="35" y="35" width="17" height="17" rx="3.5" />
      {/* Detail accents inside bottom-left */}
      <circle cx="17.5" cy="40.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="23.5" cy="40.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="46.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TemizlikCategoryIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Spray bottle */}
      <path d="M22 25 L22 17 C22 15 23 14 25 14 L27 14" />
      {/* Spray head */}
      <path d="M25 14 L33 14 C34 14 35 15 35 16 L35 18 C35 20 33 21 31 21 L25 21" />
      <path d="M25 14 L21 10 C20 9 19 9.5 19 11 L19 15 C19 16 20 17 21 17 Z" />
      {/* Trigger */}
      <path d="M21 21 C18 22 17 25 18 27" />
      {/* Spray bottle body */}
      <path d="M22 25 C20 28 17 33 17 38 L17 48 C17 50 19 52 21 52 L31 52 C33 52 35 50 35 48 L35 38 C35 33 32 28 30 25 Z" />
      {/* Level line */}
      <path d="M19 44 C23 45 28 44 33 45" strokeWidth="2" strokeDasharray="2 3" />

      {/* Scrub brush on right */}
      <path d="M37 39 C37 36 41 33 46 33 L53 33 C56 33 58 35 58 38 L58 40 C58 41 57 42 56 42 L39 42 C38 42 37 41 37 40 Z" />
      {/* Brush bristles */}
      <path d="M38 42 L37 49 L57 49 L56 42" />
      <line x1="42" y1="44" x2="41" y2="48" strokeWidth="1.8" />
      <line x1="47" y1="44" x2="47" y2="48" strokeWidth="1.8" />
      <line x1="52" y1="44" x2="52" y2="48" strokeWidth="1.8" />
    </svg>
  );
}

export function GidaCategoryIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Grocery Basket */}
      <path d="M14 33 L50 33 L45 52 C44.5 54 43 55 41 55 L23 55 C21 55 19.5 54 19 52 Z" />
      {/* Wicker crosshatch */}
      <line x1="22" y1="33" x2="25" y2="55" strokeWidth="1.8" />
      <line x1="32" y1="33" x2="32" y2="55" strokeWidth="1.8" />
      <line x1="42" y1="33" x2="39" y2="55" strokeWidth="1.8" />
      <line x1="16" y1="43" x2="48" y2="43" strokeWidth="1.8" />

      {/* Baguette sticking out top right */}
      <path d="M39 31 L47 16 C48 14 50 14 51 15 C52 16 52 18 50 20 L44 32" />
      <line x1="45" y1="20" x2="48" y2="21" strokeWidth="1.6" />
      <line x1="43" y1="24" x2="46" y2="25" strokeWidth="1.6" />

      {/* Carrot with leafy top sticking out left */}
      <path d="M19 32 L15 22 C14.5 20.5 16 19 17.5 20 L24 31" />
      <path d="M15 20 C13 18 12 15 13 13 C15 13 17 15 16 19" strokeWidth="1.8" />
      <path d="M17 19 C18 16 19 14 21 14 C21 16 20 18 18 20" strokeWidth="1.8" />

      {/* Apple / fruit in center */}
      <circle cx="28" cy="27" r="6" />
      <path d="M28 21 C29 18 31 18 32 19" strokeWidth="1.8" />
    </svg>
  );
}

export function BakliyatCategoryIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Bowl */}
      <path d="M14 34 C15 47 23 52 32 52 C41 52 49 47 50 34 Z" />
      {/* Bowl rim */}
      <ellipse cx="32" cy="34" rx="18" ry="4" strokeWidth="2.4" />
      {/* Foot ring */}
      <path d="M26 52 L25 54 L39 54 L38 52" strokeWidth="2.2" />

      {/* Grains / lentils inside bowl */}
      <circle cx="23" cy="32" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="27" cy="31" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="31" cy="31" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="35" cy="32" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="39" cy="33" r="1.5" fill="currentColor" stroke="none" />

      {/* Wheat stalks rising up on the right */}
      <path d="M38 34 C43 28 47 21 52 14" strokeWidth="2.2" />
      {/* Wheat grain pairs */}
      <ellipse cx="44" cy="25" rx="3.5" ry="1.8" transform="rotate(-30 44 25)" />
      <ellipse cx="48" cy="22" rx="3.5" ry="1.8" transform="rotate(-30 48 22)" />
      <ellipse cx="51" cy="18" rx="3.5" ry="1.8" transform="rotate(-30 51 18)" />
      <path d="M52 14 L55 10" strokeWidth="1.8" />

      <path d="M34 33 C37 26 39 19 41 13" strokeWidth="2" strokeDasharray="30" />
      <ellipse cx="37" cy="22" rx="3" ry="1.6" transform="rotate(-40 37 22)" />
      <ellipse cx="40" cy="17" rx="3" ry="1.6" transform="rotate(-40 40 17)" />

      {/* Fallen grains on surface */}
      <circle cx="46" cy="53" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="49" cy="51" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="53" cy="53" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function KisiselCategoryIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Lotion / shampoo pump dispenser bottle */}
      <path d="M22 28 C22 25 24 23 27 23 L37 23 C40 23 42 25 42 28 L42 51 C42 53 40 55 37 55 L27 55 C24 55 22 53 22 51 Z" />
      {/* Bottle neck */}
      <path d="M29 23 L29 17 L35 17 L35 23" />
      {/* Pump cap & nozzle */}
      <path d="M27 17 L37 17" strokeWidth="2.4" />
      <path d="M32 17 L32 11" strokeWidth="2.4" />
      <path d="M32 11 L22 11 C20 11 19 12 19 14" strokeWidth="2.4" />
      {/* Droplet / sparkle icon */}
      <circle cx="32" cy="38" r="3.5" strokeWidth="2" />
      <path d="M46 16 L49 13 M50 20 L53 21 M48 27 L51 29" strokeWidth="2" />
    </svg>
  );
}
