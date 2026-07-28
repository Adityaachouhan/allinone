import { Star } from 'lucide-react';

export function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? 'fill-accent-400 text-accent-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
}
