import { useEffect, useState } from 'react';
import {
  Package, MapPin, User as UserIcon, LogOut, ChevronRight, Plus, Trash2, Check,
  Clock, Truck, PackageCheck, Home, X, Loader2, AlertTriangle, XCircle,
} from 'lucide-react';
import * as db from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from '@/lib/router';
import type { Address, Order, OrderItem } from '@/types';
import { formatCurrency, formatDate, orderStatusLabels, ORDER_STATUS_FLOW } from '@/lib/utils';
import { EmptyState, Spinner } from '@/components/Feedback';

type Tab = 'orders' | 'addresses' | 'profile';

export function AccountPage() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Cancel order state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Profile edit
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Address form
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState({
    label: 'Home', full_name: '', phone: '', line1: '', line2: '', city: '', pincode: '',
  });
  const [addrError, setAddrError] = useState('');

  useEffect(() => {
    if (!session) {
      setSelectedOrder(null);
      setOrderItems([]);
      setOrders([]);
      setAddresses([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const o = await db.listOrders({ userId: session.user.id });
        const a = await db.listAddresses(session.user.id);
        if (!mounted) return;
        setOrders(o);
        setAddresses(a);
        if (profile) {
          setEditName(profile.full_name);
          setEditPhone(profile.phone);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [session, profile]);

  const viewOrder = async (order: Order) => {
    setSelectedOrder(order);
    setOrderItems(await db.listOrderItems(order.id));
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setCancellingOrder(true);
    setCancelError(null);
    try {
      const updated = await db.cancelOrder(selectedOrder.id);
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setShowCancelConfirm(false);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel order.');
    } finally {
      setCancellingOrder(false);
    }
  };

  const saveProfile = async () => {
    if (!session) return;
    setSavingProfile(true);
    try {
      await db.updateProfile(session.user.id, { full_name: editName, phone: editPhone });
      await refreshProfile();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } finally {
      setSavingProfile(false);
    }
  };

  const saveAddress = async () => {
    if (!session) return;
    setAddrError('');
    if (!addrForm.full_name || !addrForm.phone || !addrForm.line1 || !addrForm.city || !addrForm.pincode) {
      setAddrError('Please fill all required fields.');
      return;
    }
    if (!/^\d{6}$/.test(addrForm.pincode)) {
      setAddrError('Pincode must be 6 digits.');
      return;
    }
    const data = await db.insertAddress({
      ...addrForm,
      user_id: session.user.id,
      line2: addrForm.line2 || null,
      is_default: addresses.length === 0,
    });
    setAddresses((prev) => [...prev, data]);
    setShowAddrForm(false);
    setAddrForm({ label: 'Home', full_name: '', phone: '', line1: '', line2: '', city: '', pincode: '' });
  };

  const deleteAddress = async (id: string) => {
    await db.deleteAddress(id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSignOut = async () => {
    setSelectedOrder(null);
    setOrderItems([]);
    setOrders([]);
    setAddresses([]);
    navigate('/');
    await signOut();
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={32} /></div>;

  // Order detail modal
  if (selectedOrder) {
    const addr = selectedOrder.address_snapshot;
    const currentStep = ORDER_STATUS_FLOW.indexOf(selectedOrder.status);
    const isCancellable = selectedOrder.status === 'placed' || selectedOrder.status === 'packed';
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 animate-fade-in">
        <button
          onClick={() => { setSelectedOrder(null); setShowCancelConfirm(false); setCancelError(null); }}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-700"
        >
          <ChevronRight size={16} className="rotate-180" /> Back to orders
        </button>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold text-gray-900 break-all">{selectedOrder.order_number}</h1>
            <p className="text-sm text-gray-500">Placed on {formatDate(selectedOrder.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`self-start rounded-full px-3 py-1 text-sm font-medium ${
              selectedOrder.status === 'cancelled' ? 'bg-error-50 text-error-600' : 'bg-success-50 text-success-700'
            }`}>
              {orderStatusLabels(selectedOrder.status)}
            </span>
            {isCancellable && (
              <button
                onClick={() => { setCancelError(null); setShowCancelConfirm(true); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-error-200 bg-error-50 px-3 py-1 text-xs font-semibold text-error-700 hover:bg-error-100 hover:border-error-300 transition-colors"
              >
                <XCircle size={14} /> Cancel Order
              </button>
            )}
          </div>
        </div>

        {/* Tracking timeline */}
        {selectedOrder.status !== 'cancelled' && (
          <div className="mt-5 card p-5">
            <h2 className="text-base font-semibold text-gray-900">Order Tracking</h2>
            <div className="mt-4 flex items-center">
              {ORDER_STATUS_FLOW.map((status, i) => {
                const Icon = [Clock, Package, Truck, PackageCheck][i] || Clock;
                const done = i <= currentStep;
                return (
                  <div key={status} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        done ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Icon size={18} />
                      </div>
                      <span className={`mt-1 text-[10px] sm:text-xs ${done ? 'text-primary-700 font-medium' : 'text-gray-400'}`}>
                        {orderStatusLabels(status)}
                      </span>
                    </div>
                    {i < ORDER_STATUS_FLOW.length - 1 && (
                      <div className={`mx-1 h-0.5 flex-1 ${i < currentStep ? 'bg-primary-600' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="mt-4 card p-5">
          <h2 className="text-base font-semibold text-gray-900">Items</h2>
          <div className="mt-3 space-y-3">
            {orderItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <img src={item.product_image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.product_name}</p>
                  <p className="text-xs text-gray-500">{item.quantity} × {formatCurrency(item.price)}</p>
                </div>
                <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-gray-600">Subtotal</dt><dd>{formatCurrency(selectedOrder.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Delivery</dt><dd>{selectedOrder.delivery_charge === 0 ? 'FREE' : formatCurrency(selectedOrder.delivery_charge)}</dd></div>
            <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold"><dt>Total</dt><dd>{formatCurrency(selectedOrder.total)}</dd></div>
          </dl>
        </div>

        {/* Address */}
        {addr && (
          <div className="mt-4 card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <MapPin size={18} className="text-primary-600" /> Delivery Address
            </h2>
            <div className="mt-2 text-sm text-gray-600">
              <p className="font-medium text-gray-900">{addr.full_name}</p>
              <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city} – {addr.pincode}</p>
              <p>Phone: {addr.phone}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="text-gray-600">Payment: <span className="font-medium text-gray-900">{selectedOrder.payment_mode === 'cod' ? 'Cash on Delivery' : 'Online'}</span></span>
              {selectedOrder.delivery_slot && <span className="text-gray-600">Slot: <span className="font-medium text-gray-900">{selectedOrder.delivery_slot}</span></span>}
            </div>
          </div>
        )}

        {/* Actions bar / Cancel button */}
        {isCancellable && (
          <div className="mt-5 card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-error-100 bg-error-50/30">
            <div className="text-sm">
              <p className="font-semibold text-gray-900">Need to change your mind?</p>
              <p className="text-xs text-gray-500">You can cancel this order before it is out for delivery.</p>
            </div>
            <button
              onClick={() => { setCancelError(null); setShowCancelConfirm(true); }}
              className="btn-secondary w-full sm:w-auto border-error-200 text-error-700 hover:bg-error-50 hover:border-error-300 flex items-center justify-center gap-1.5 shrink-0"
            >
              <XCircle size={16} className="text-error-600" /> Cancel Order
            </button>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl animate-slide-up">
              <div className="flex items-center gap-3 text-error-600">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-50">
                  <AlertTriangle size={22} />
                </div>
                <h3 className="font-heading text-lg font-bold text-gray-900">Cancel Order?</h3>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Are you sure you want to cancel order <span className="font-semibold text-gray-900">{selectedOrder.order_number}</span>? This will stop your delivery and release the items back to stock.
              </p>

              {cancelError && (
                <div className="mt-3 rounded-lg bg-error-50 p-3 text-xs text-error-700 font-medium">
                  {cancelError}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancellingOrder}
                  className="btn-secondary py-2 text-sm"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={cancellingOrder}
                  className="rounded-lg bg-error-600 px-4 py-2 text-sm font-semibold text-white hover:bg-error-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {cancellingOrder ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Cancelling...
                    </>
                  ) : (
                    'Yes, Cancel Order'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-fade-in">
      {/* Profile header */}
      <div className="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">
          {profile?.full_name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-lg font-bold text-gray-900">{profile?.full_name || 'Customer'}</h1>
          <p className="truncate text-sm text-gray-500">{profile?.email}</p>
          {profile?.phone && <p className="text-sm text-gray-500">{profile.phone}</p>}
        </div>
        <button onClick={handleSignOut} className="btn-secondary shrink-0">
          <LogOut size={16} /> <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-gray-200 no-scrollbar sm:gap-2">
        {([
          { key: 'orders', label: 'My Orders', icon: Package },
          { key: 'addresses', label: 'Addresses', icon: MapPin },
          { key: 'profile', label: 'Profile', icon: UserIcon },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium sm:gap-2 sm:px-4 ${
                tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {/* Orders tab */}
        {tab === 'orders' && (
          orders.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No orders yet"
              description="When you place an order, it will appear here."
              actionLabel="Start Shopping"
              onAction={() => navigate('/')}
            />
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => viewOrder(order)}
                  className="card flex w-full items-center gap-4 p-4 text-left hover:shadow-card-hover"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <Package size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-500">{formatDate(order.created_at)} · {order.items?.length ?? ''} items</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(order.total)}</p>
                    <span className={`text-xs font-medium ${
                      order.status === 'cancelled' ? 'text-error-600' : 'text-success-600'
                    }`}>
                      {orderStatusLabels(order.status)}
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </button>
              ))}
            </div>
          )
        )}

        {/* Addresses tab */}
        {tab === 'addresses' && (
          <div>
            <div className="mb-4 flex justify-end">
              <button onClick={() => setShowAddrForm(true)} className="btn-primary">
                <Plus size={16} /> Add Address
              </button>
            </div>
            {addresses.length === 0 && !showAddrForm ? (
              <EmptyState
                icon={MapPin}
                title="No saved addresses"
                description="Add a delivery address to speed up checkout."
                actionLabel="Add Address"
                onAction={() => setShowAddrForm(true)}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <div key={a.id} className="card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Home size={16} className="text-primary-600" />
                        <span className="text-sm font-semibold text-gray-900">{a.label}</span>
                        {a.is_default && (
                          <span className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">Default</span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteAddress(a.id)}
                        className="text-gray-400 hover:text-error-600"
                        aria-label="Delete address"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <p className="font-medium text-gray-900">{a.full_name}</p>
                      <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
                      <p>{a.city} – {a.pincode}</p>
                      <p>Phone: {a.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Address form modal */}
            {showAddrForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-md rounded-xl bg-white p-5 animate-slide-up">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Add New Address</h3>
                    <button onClick={() => setShowAddrForm(false)} aria-label="Close">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Label</label>
                        <select value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} className="input">
                          <option>Home</option><option>Work</option><option>Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Name *</label>
                        <input value={addrForm.full_name} onChange={(e) => setAddrForm({ ...addrForm, full_name: e.target.value })} className="input" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Phone *</label>
                        <input value={addrForm.phone} onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })} className="input" maxLength={10} />
                      </div>
                      <div>
                        <label className="label">Pincode *</label>
                        <input value={addrForm.pincode} onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })} className="input" maxLength={6} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Address Line 1 *</label>
                      <input value={addrForm.line1} onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="label">Address Line 2</label>
                      <input value={addrForm.line2} onChange={(e) => setAddrForm({ ...addrForm, line2: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="label">City *</label>
                      <input value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} className="input" />
                    </div>
                    {addrError && <p className="text-sm text-error-600">{addrError}</p>}
                    <button onClick={saveAddress} className="btn-primary w-full">Save Address</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile tab */}
        {tab === 'profile' && (
          <div className="max-w-md">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">Edit Profile</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Email (read-only)</label>
                  <input value={profile?.email || ''} disabled className="input bg-gray-50 text-gray-500" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="input" maxLength={10} />
                </div>
                <button onClick={saveProfile} disabled={savingProfile} className="btn-primary">
                  {savingProfile ? <Loader2 size={16} className="animate-spin" /> : profileSaved ? <><Check size={16} /> Saved</> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
