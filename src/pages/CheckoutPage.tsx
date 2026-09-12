import { useEffect, useState } from 'react';
import { MapPin, Truck, ChevronLeft, Banknote, Pencil } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, useRoute } from '@/lib/router';
import * as db from '@/lib/db';
import type { Address, DeliverySetting } from '@/types';
import { formatCurrency, generateOrderNumber } from '@/lib/utils';
import { Spinner } from '@/components/Feedback';

export function CheckoutPage() {
  const navigate = useNavigate();
  const route = useRoute();
  const { items, subtotal, clear, recheckAllCartItems } = useCart();
  const { session } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySetting[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [newAddr, setNewAddr] = useState({
    label: 'Home', full_name: '', phone: '', line1: '', line2: '', city: '', pincode: '',
  });
  const [deliverySlot, setDeliverySlot] = useState('');
  const paymentMode = 'cod';
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items.length, navigate]);

  useEffect(() => {
    if (!session) {
      navigate('/login?redirect=/checkout');
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const [addrList, delSettings] = await Promise.all([
          db.listAddresses(session.user.id),
          db.listDeliverySettings({ activeOnly: true }),
        ]);
        if (!mounted) return;
        setAddresses(addrList);
        setDeliverySettings(delSettings);

        const activePincode = (route.query['pincode'] || localStorage.getItem('aio_pincode') || '').trim();

        let matchingAddr = null;
        if (activePincode && addrList.length > 0) {
          matchingAddr = addrList.find((a) => a.pincode.trim() === activePincode);
        }

        const defaultAddr = matchingAddr || addrList.find((a) => a.is_default) || addrList[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        } else {
          if (addrList.length === 0) setShowAddressForm(true);
          if (activePincode) {
            setNewAddr((prev) => ({ ...prev, pincode: activePincode }));
          }
        }
      } finally {
        if (mounted) setLoadingData(false);
      }
    })();
    return () => { mounted = false; };
  }, [session, navigate, route.query]);

  // ── Calculate pincode-specific delivery charge ──────────────────────────────
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const currentPincode = (showAddressForm || !selectedAddressId)
    ? newAddr.pincode.trim()
    : selectedAddress?.pincode.trim() || '';

  // Keep aio_pincode in localStorage synced
  useEffect(() => {
    if (currentPincode && /^\d{6}$/.test(currentPincode)) {
      localStorage.setItem('aio_pincode', currentPincode);
    }
  }, [currentPincode]);

  const matchedDeliverySetting = deliverySettings.find(
    (s) => s.is_active && s.pincode.trim() === currentPincode
  );

  let deliveryCharge = 30;
  let areaName = '';

  if (matchedDeliverySetting) {
    areaName = matchedDeliverySetting.area_name;
    deliveryCharge = matchedDeliverySetting.delivery_charge;
  } else {
    // Default fallback charge when pincode isn't specifically configured in admin
    const activeCharges = deliverySettings.map((s) => s.delivery_charge);
    deliveryCharge = activeCharges.length > 0 ? activeCharges[0] : 30;
  }

  const total = subtotal + deliveryCharge;

  const isNewAddressValid =
    showAddressForm &&
    newAddr.full_name.trim().length > 0 &&
    /^\d{10}$/.test(newAddr.phone.trim()) &&
    newAddr.line1.trim().length > 0 &&
    newAddr.city.trim().length > 0 &&
    /^\d{6}$/.test(newAddr.pincode.trim());

  const hasValidAddress = Boolean(selectedAddressId) || isNewAddressValid;
  const canPlaceOrder = !placing && hasValidAddress;

  const saveAddress = async () => {
    if (!session) return;
    setError('');
    if (!newAddr.full_name || !newAddr.phone || !newAddr.line1 || !newAddr.city || !newAddr.pincode) {
      setError('Please fill all required address fields.');
      return;
    }
    if (!/^\d{10}$/.test(newAddr.phone.trim())) {
      setError('Phone number must be a 10-digit number.');
      return;
    }
    if (!/^\d{6}$/.test(newAddr.pincode)) {
      setError('Pincode must be a 6-digit number.');
      return;
    }

    try {
      if (editingAddressId) {
        const updated = await db.updateAddress(editingAddressId, {
          ...newAddr,
          line2: newAddr.line2 || null,
        });
        setAddresses((prev) => prev.map((a) => (a.id === editingAddressId ? updated : a)));
        setSelectedAddressId(updated.id);
      } else {
        const saved = await db.insertAddress({
          ...newAddr,
          user_id: session.user.id,
          line2: newAddr.line2 || null,
          is_default: addresses.length === 0,
        });
        setAddresses((prev) => [...prev, saved]);
        setSelectedAddressId(saved.id);
      }
      setShowAddressForm(false);
      setEditingAddressId(null);
      setNewAddr({ label: 'Home', full_name: '', phone: '', line1: '', line2: '', city: '', pincode: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save address.');
    }
  };

  const handleEditAddress = (a: Address) => {
    setEditingAddressId(a.id);
    setNewAddr({
      label: a.label || 'Home',
      full_name: a.full_name || '',
      phone: a.phone || '',
      line1: a.line1 || '',
      line2: a.line2 || '',
      city: a.city || '',
      pincode: a.pincode || '',
    });
    setShowAddressForm(true);
  };

  const handleAddNewAddressClick = () => {
    setEditingAddressId(null);
    setNewAddr({ label: 'Home', full_name: '', phone: '', line1: '', line2: '', city: '', pincode: '' });
    setShowAddressForm(true);
  };

  const handleCancelAddressForm = () => {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setNewAddr({ label: 'Home', full_name: '', phone: '', line1: '', line2: '', city: '', pincode: '' });
  };

  const placeOrder = async () => {
    if (!session) {
      navigate('/login?redirect=/checkout');
      return;
    }
    setError('');

    // Recheck live stock from server before proceeding
    const stockOk = await recheckAllCartItems();
    if (!stockOk) {
      setError('Some items in your cart are no longer available or have limited stock. Please review your cart.');
      return;
    }

    let targetAddressId = selectedAddressId;

    // Auto-save address if user filled new address form directly
    if (!targetAddressId && isNewAddressValid) {
      setPlacing(true);
      try {
        const saved = await db.insertAddress({
          ...newAddr,
          user_id: session.user.id,
          line2: newAddr.line2 || null,
          is_default: addresses.length === 0,
        });
        setAddresses((prev) => [...prev, saved]);
        targetAddressId = saved.id;
        setSelectedAddressId(saved.id);
        setShowAddressForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save address.');
        setPlacing(false);
        return;
      }
    }

    const address = addresses.find((a) => a.id === targetAddressId);
    if (!address) {
      setError('Please select or fill in a valid delivery address.');
      return;
    }

    setPlacing(true);
    try {
      const orderNumber = generateOrderNumber();
      const addressSnapshot = {
        label: address.label,
        full_name: address.full_name,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        pincode: address.pincode,
      };

      await db.createOrderWithItems(
        {
          user_id: session.user.id,
          order_number: orderNumber,
          status: 'placed',
          subtotal,
          delivery_charge: deliveryCharge,
          discount: 0,
          total,
          payment_mode: paymentMode,
          payment_status: paymentMode === 'cod' ? 'pay_on_delivery' : 'pending',
          address_snapshot: addressSnapshot,
          delivery_slot: deliverySlot || null,
          notes: notes || null,
        },
        items.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          product_image: i.product.image_url,
          unit: i.product.unit,
          price: i.product.price,
          quantity: i.quantity,
          subtotal: i.product.price * i.quantity,
        })),
      );

      clear();
      navigate(`/order-confirmation/${orderNumber}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  const slots = [
    'Today, 6 PM – 8 PM',
    'Today, 8 PM – 10 PM',
    'Tomorrow, 7 AM – 9 AM',
    'Tomorrow, 10 AM – 12 PM',
    'Tomorrow, 4 PM – 6 PM',
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 py-4 sm:py-6 animate-fade-in min-w-0">
      <button
        onClick={() => navigate('/cart')}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-700"
      >
        <ChevronLeft size={16} /> Back to cart
      </button>

      <h1 className="mt-2 font-heading text-2xl font-bold text-gray-900">Checkout</h1>

      <div className="mt-5 grid gap-5 lg:gap-6 lg:grid-cols-3 w-full min-w-0">
        <div className="space-y-4 sm:space-y-5 lg:col-span-2 w-full min-w-0">
          {/* Address */}
          <Section icon={MapPin} title="Delivery Address" step={1}>
            {addresses.length > 0 && !showAddressForm && (
              <div className="space-y-2 w-full min-w-0">
                {addresses.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAddressId(a.id)}
                    className={`flex items-start justify-between gap-2.5 sm:gap-3 rounded-lg border p-2.5 sm:p-3 cursor-pointer transition-all w-full min-w-0 ${
                      selectedAddressId === a.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddressId === a.id}
                        onChange={() => setSelectedAddressId(a.id)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 shrink-0"
                      />
                      <div className="text-sm min-w-0 flex-1">
                        <p className="font-medium text-gray-900 break-words">
                          {a.full_name} <span className="text-gray-500">· {a.label}</span>
                        </p>
                        <p className="text-gray-600 break-words text-xs sm:text-sm">
                          {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city} – {a.pincode}
                        </p>
                        <p className="text-gray-500 text-xs sm:text-sm">Phone: {a.phone}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAddress(a);
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 bg-white border border-gray-200 hover:border-primary-300 rounded px-2.5 py-1 shadow-sm transition-all shrink-0"
                      title="Edit Address"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAddNewAddressClick}
                  className="text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  + Add new address
                </button>
              </div>
            )}

            {showAddressForm && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="font-medium text-gray-900 text-sm">
                    {editingAddressId ? 'Edit Address' : 'Add New Address'}
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Label</label>
                    <select
                      value={newAddr.label}
                      onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                      className="input"
                    >
                      <option>Home</option>
                      <option>Work</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Full Name *</label>
                    <input
                      value={newAddr.full_name}
                      onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })}
                      className="input"
                      placeholder="Recipient name"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Phone *</label>
                    <input
                      type="tel"
                      value={newAddr.phone}
                      onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="input"
                      placeholder="10-digit mobile"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="label">Pincode *</label>
                    <input
                      value={newAddr.pincode}
                      onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value })}
                      className="input"
                      placeholder="6-digit pincode"
                      maxLength={6}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Address Line 1 *</label>
                  <input
                    value={newAddr.line1}
                    onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
                    className="input"
                    placeholder="House no, building, street"
                  />
                </div>
                <div>
                  <label className="label">Address Line 2</label>
                  <input
                    value={newAddr.line2}
                    onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })}
                    className="input"
                    placeholder="Area, landmark (optional)"
                  />
                </div>
                <div>
                  <label className="label">City *</label>
                  <input
                    value={newAddr.city}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                    className="input"
                    placeholder="City"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveAddress} className="btn-primary">
                    {editingAddressId ? 'Update Address' : 'Save Address'}
                  </button>
                  {addresses.length > 0 && (
                    <button onClick={handleCancelAddressForm} className="btn-secondary">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* Delivery slot */}
          <Section icon={Truck} title="Delivery Slot" step={2}>
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((slot) => (
                <label
                  key={slot}
                  className={`flex cursor-pointer items-center gap-2.5 sm:gap-3 rounded-lg border p-2.5 sm:p-3 text-sm w-full min-w-0 ${
                    deliverySlot === slot
                      ? 'border-primary-500 bg-primary-50 text-primary-800'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="slot"
                    checked={deliverySlot === slot}
                    onChange={() => setDeliverySlot(slot)}
                    className="h-4 w-4 text-primary-600 shrink-0"
                  />
                  <span className="min-w-0 truncate">{slot}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Payment */}
          <Section icon={Banknote} title="Payment Method" step={3}>
            <div className="space-y-2 w-full min-w-0">
              <label
                className="flex cursor-pointer items-center gap-2.5 sm:gap-3 rounded-lg border border-primary-500 bg-primary-50 p-2.5 sm:p-3 w-full min-w-0"
              >
                <input
                  type="radio"
                  name="payment"
                  checked={true}
                  readOnly
                  className="h-4 w-4 text-primary-600 shrink-0"
                />
                <Banknote size={20} className="text-primary-600 shrink-0" />
                <div className="text-sm min-w-0 flex-1">
                  <p className="font-medium text-gray-900">Cash on Delivery (COD)</p>
                  <p className="text-gray-500 text-xs sm:text-sm">Pay with cash when your order arrives</p>
                </div>
              </label>
            </div>
          </Section>

          {/* Notes */}
          <div className="w-full min-w-0">
            <label className="label">Order Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Any delivery instructions for our delivery partner…"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1 w-full min-w-0">
          <div className="card sticky top-32 p-4 sm:p-5 w-full min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Order Summary</h2>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center gap-2 text-sm w-full min-w-0">
                  <img src={product.image_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-500">{quantity} × {formatCurrency(product.price)}</p>
                  </div>
                  <span className="font-medium shrink-0">{formatCurrency(product.price * quantity)}</span>
                </div>
              ))}
            </div>
            <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm w-full min-w-0">
              <div className="flex justify-between items-center gap-2">
                <dt className="text-gray-600">Subtotal</dt>
                <dd className="font-medium shrink-0">{formatCurrency(subtotal)}</dd>
              </div>
              <div className="flex justify-between items-start gap-2">
                <dt className="text-gray-600 text-xs sm:text-sm min-w-0 flex-1 break-words">
                  Delivery Fee {currentPincode ? `(${currentPincode}${areaName ? ` · ${areaName}` : ''})` : ''}
                </dt>
                <dd className="font-semibold text-gray-900 text-xs sm:text-sm shrink-0">
                  {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="font-bold">{formatCurrency(total)}</dd>
              </div>
            </dl>

            {error && (
              <p className="mt-3 rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600">{error}</p>
            )}

            <button
              onClick={placeOrder}
              disabled={!canPlaceOrder}
              className="btn-primary mt-4 w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {placing ? <Spinner size={18} /> : `Place Order · ${formatCurrency(total)}`}
            </button>

            {!hasValidAddress && (
              <p className="mt-2 text-center text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                ⚠️ Please select a delivery address or fill out all required address fields (*Name, Phone, Pincode 6-digits, Line 1, City) to place order.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  step,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  step: number;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-3.5 sm:p-5 w-full min-w-0">
      <div className="mb-3 flex items-center gap-2 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
          {step}
        </div>
        <Icon size={18} className="text-gray-600 shrink-0" />
        <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>
      </div>
      {children}
    </div>
  );
}
