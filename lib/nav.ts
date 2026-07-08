import {
  LayoutDashboard,
  Ship,
  FileCheck2,
  LineChart,
  TrendingUp,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
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
