import {
  Apple, Carrot, Milk, Wheat, Cookie, SprayCan, Home, ShoppingBag, Utensils, Flame, Sparkles, CupSoda, Croissant, Lollipop, type LucideIcon,
} from 'lucide-react';

// Maps a category icon_name (stored in DB) to a lucide component.
const iconMap: Record<string, LucideIcon> = {
  Apple,
  Carrot,
  Milk,
  Wheat,
  Cookie,
  SprayCan,
  Home,
  ShoppingBag,
  Utensils,
  Flame,
  Sparkles,
  CupSoda,
  Bread: Croissant,
  Candy: Lollipop,
};

export function getCategoryIcon(iconName: string): LucideIcon {
  return iconMap[iconName] ?? ShoppingBag;
}

