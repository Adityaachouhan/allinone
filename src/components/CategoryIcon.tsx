import {
  Apple, Carrot, Milk, Wheat, Cookie, SprayCan, Home, ShoppingBag, Utensils, Flame, Sparkles, CupSoda, Croissant, Lollipop,
  Gift, Baby, Flower2, Snowflake, FlameKindling,
  type LucideIcon,
} from 'lucide-react';

// Maps a category icon_name (stored in DB) to a lucide component.
const iconMap: Record<string, LucideIcon> = {
  // Existing icons
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
  // New category icons
  Gift,
  Baby,
  Flower2,
  Snowflake,
  FlameKindling,
  // Friendly aliases (used as icon_name in DB)
  Kids:   Baby,
  Beauty: Flower2,
  Frozen: Snowflake,
  Spices: FlameKindling,
};

export function getCategoryIcon(iconName: string): LucideIcon {
  return iconMap[iconName] ?? ShoppingBag;
}

