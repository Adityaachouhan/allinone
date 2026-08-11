import { Plus, Minus, Check } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useNavigate } from '@/lib/router';
import { formatCurrency, discountPercent, isProductAvailable } from '@/lib/utils';
import { StarRating } from '@/components/StarRating';

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { addItem, getQuantity, updateQuantity } = useCart();
  const inCart = getQuantity(product.id);
  const available = isProductAvailable(product);
  const [justAdded, setJustAdded] = useState(false);
  const discount = discountPercent(product.price, product.mrp);

  const handleAdd = () => {
    addItem(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div
      className="group card overflow-hidden transition-shadow hover:shadow-card-hover bg-white"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >

      {/*
        IMAGE CONTAINER — padding-top:100% creates a 1:1 square via the
        "intrinsic ratio box" trick. Works in all browsers regardless of
        the image's natural width/height. The <img> is absolutely
        positioned to fill the padding box completely.
      */}
      <div
        style={{ position: 'relative', width: '100%', paddingTop: '100%', flexShrink: 0, overflow: 'hidden', backgroundColor: '#f3f4f6', cursor: 'pointer' }}
        onClick={() => navigate(`/product/${product.slug}`)}
        role="button"
        aria-label={`View ${product.name}`}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/product/${product.slug}`)}
      >
        <img
          src={
            product.image_url ||
            'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop'
          }
          alt={product.name}
          loading="lazy"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            transition: 'transform 0.3s ease',
          }}
          className="group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop';
          }}
        />

        {/* Discount badge */}
        {discount > 0 && (
          <span
            style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10 }}
            className="rounded-md bg-accent-500 px-2 py-0.5 text-xs font-semibold text-white"
          >
            {discount}% OFF
          </span>
        )}

        {/* Out of stock overlay */}
        {!available && (
          <div
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <span className="rounded-md bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/*
        CARD BODY — flex:1 fills the remaining card height after the image.
        Fixed heights on every zone guarantee pixel-perfect alignment:
          • Brand:  16px  (1 line, truncated)
          • Title:  40px  (2 lines of 14px/20px line-height, overflow hidden)
          • Rating: 20px  (1 line)
          • mt:auto pushes price + button to the bottom edge
      */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '12px' }}>

        {/* Brand – 1 line, truncated, 16px tall */}
        <p
          style={{
            height: '16px',
            lineHeight: '16px',
            fontSize: '12px',
            color: '#6b7280',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            margin: 0,
          }}
        >
          {product.brand || 'All In One'}
        </p>

        {/* Product name – always exactly 40px (2 lines × 20px), clipped */}
        <button
          onClick={() => navigate(`/product/${product.slug}`)}
          style={{
            marginTop: '2px',
            height: '40px',
            maxHeight: '40px',
            overflow: 'hidden',
            textAlign: 'left',
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: '20px',
            color: '#111827',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'block',
            width: '100%',
          }}
          className="hover:text-primary-700"
        >
          {product.name}
        </button>

        {/* Star rating – exactly 20px tall */}
        <div
          style={{ marginTop: '4px', height: '20px', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}
        >
          <StarRating rating={product.rating} size={12} />
          <span style={{ fontSize: '12px', color: '#9ca3af', flexShrink: 0 }}>
            {product.rating.toFixed(1)}
          </span>
        </div>

        {/* Price + Add button — marginTop:auto pushes this to bottom */}
        <div style={{ marginTop: 'auto', paddingTop: '8px' }}>

          {/* Price row – height: 34px allows up to 2 lines for long unit strings */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              height: '34px',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                {formatCurrency(product.price)}
              </span>
              {product.mrp > product.price && (
                <span style={{ fontSize: '11px', color: '#9ca3af', textDecoration: 'line-through' }}>
                  {formatCurrency(product.mrp)}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: '11px',
                color: '#6b7280',
                lineHeight: '1.4',
                marginTop: '2px', // align visually with the baseline of the price
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                wordBreak: 'break-word',
              }}
            >
              / {product.unit}
            </span>
          </div>

          {/* Add / quantity stepper – always 36px tall */}
          {available ? (
            inCart > 0 ? (
              <div
                style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}
              >
                <button
                  onClick={() => updateQuantity(product.id, inCart - 1)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100"
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>
                <span
                  style={{ minWidth: '24px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#111827' }}
                >
                  {inCart}
                </span>
                <button
                  onClick={() => updateQuantity(product.id, inCart + 1)}
                  className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-primary-600 px-1.5 text-sm font-medium text-white hover:bg-primary-700"
                  aria-label="Add more"
                >
                  <Plus size={16} className="shrink-0" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Add</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                style={{
                  marginTop: '8px',
                  height: '36px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                  boxSizing: 'border-box',
                }}
                className={
                  justAdded
                    ? 'bg-primary-600 text-white border-0'
                    : 'border border-primary-600 text-primary-700 hover:bg-primary-50 bg-transparent'
                }
              >
                {justAdded ? (
                  <><Check size={16} /> Added</>
                ) : (
                  <><Plus size={16} /> Add</>
                )}
              </button>
            )
          ) : (
            <button
              disabled
              style={{
                marginTop: '8px',
                height: '36px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'not-allowed',
              }}
              className="bg-gray-100 text-gray-400"
            >
              Unavailable
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
