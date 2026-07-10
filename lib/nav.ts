import {
  LayoutDashboard,
  Ship,
  FileCheck2,
  LineChart,
  TrendingUp,
  Newspaper,
  Boxes,
  BarChart3,
  Building2,
  FolderKanban,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

/** Top-level entry: a plain link, or a collapsible group of links. */
export interface NavEntry {
  label: string;
  icon: LucideIcon;
  description: string;
  href?: string;
  children?: NavItem[];
}

export const NAV_ITEMS: NavEntry[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Overview of key signals",
  },
  {
    label: "Vessels",
    href: "/vessels",
    icon: Ship,
    description: "Browse the fleet and open vessel details",
  },
  {
    label: "Supply Chain",
    icon: Boxes,
    description: "Procurement analytics, vendors and projects",
    children: [
      {
        label: "Analytics",
        href: "/supply-chain/analytics",
        icon: BarChart3,
        description: "Procurement dashboard",
      },
      {
        label: "Vendors",
        href: "/supply-chain/vendors",
        icon: Building2,
        description: "Contractors and suppliers",
      },
      {
        label: "Projects",
        href: "/supply-chain/projects",
        icon: FolderKanban,
        description: "Procurement projects",
      },
    ],
  },
  {
    label: "Certificates & Clearances",
    href: "/certificates",
    icon: FileCheck2,
    description: "Regulatory and operational documents",
  },
  {
    label: "Oil Prices",
    href: "/prices",
    icon: LineChart,
    description: "Brent crude monitoring",
  },
  {
    label: "Forecast",
    href: "/forecast",
    icon: TrendingUp,
    description: "Simple statistical projection",
  },
  {
    label: "Industry Updates",
    href: "/news",
    icon: Newspaper,
    description: "Oil and gas news feed",
  },
];
