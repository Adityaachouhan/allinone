import {
  Apple, Milk, Wheat, Cookie, SprayCan, Home, ShoppingBag, type LucideIcon,
} from 'lucide-react';

// Maps a category icon_name (stored in DB) to a lucide component.
const iconMap: Record<string, LucideIcon> = {
  Apple,
  Milk,
  Wheat,
  Cookie,
  SprayCan,
  Home,
  ShoppingBag,
};

export function getCategoryIcon(iconName: string): LucideIcon {
  return iconMap[iconName] ?? ShoppingBag;
}
