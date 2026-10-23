"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// `also` = sub-pages that light up this tab, so you can still tell where you are
const items = [
  { href: "/home", label: "Home", icon: HomeIcon, also: ["/akomodasi", "/dokumen", "/history", "/profile", "/admin"] },
  { href: "/itinerary", label: "Itin", icon: ItinIcon, also: ["/peta"] },
  { href: "/packing", label: "Packing", icon: PackingIcon, also: [] },
  { href: "/budget", label: "Budget", icon: BudgetIcon, also: [] },
  { href: "/explore", label: "Explore", icon: ExploreIcon, also: ["/kiblat", "/tips"] },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Menu utama"
      className="fixed left-4 right-4 bottom-4 mx-auto max-w-[440px] h-[68px] bg-white rounded-[34px] flex items-center justify-around px-1.5 shadow-[0_8px_24px_rgba(30,58,42,0.12)] z-20"
    >
      {items.map(({ href, label, icon: Icon, also }) => {
        const active = pathname === href || also.some((p) => pathname.startsWith(p));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 h-14 rounded-[26px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              active ? "bg-kb-lime text-kb-ink" : "text-kb-muted"
            }`}
          >
            <Icon />
            <span className="text-[10px] font-bold leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function iconProps() {
  return { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" {...iconProps()}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function ItinIcon() {
  return (
    <svg aria-hidden="true" {...iconProps()}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function PackingIcon() {
  return (
    <svg aria-hidden="true" {...iconProps()}>
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="M9 7V4h6v3M9 11v5M15 11v5" />
    </svg>
  );
}
function BudgetIcon() {
  return (
    <svg aria-hidden="true" {...iconProps()}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </svg>
  );
}
function ExploreIcon() {
  return (
    <svg aria-hidden="true" {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}
