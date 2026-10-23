'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ShoppingCart, Truck, ShoppingBag, Utensils, Check, FileText, CreditCard, Banknote, Key, Package, Users, Sparkles } from 'lucide-react';
import { useAdminData } from '@/context/AdminDataContext';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { useCustomerPortalMode } from '@/lib/config';
import { resolveMenuImage } from '@/lib/menu-image';
import { journalOrder, removeOfflineOrder } from '@/lib/offlineSync';
import { getApiUrl } from '@/lib/config';
import { parse2 } from '@/lib/customer/promo-format';
import {
  generatePickupSlots,
  normalizePickupName,
  pickupNameError,
  PICKUP_PREP_BUFFER_MINUTES,
} from '@/lib/pickup';
import type { CustomerMenuItem } from '@/components/customer/MenuCard';

export type { CustomerMenuItem } from '@/components/customer/MenuCard';

export type CartItem = {
  menuItem: CustomerMenuItem;
  quantity: number;
  notes?: string;
  selectedSize?: { name: string; price: number };
  selectedAddons?: { id: string; name: string; price: number }[];
};

// For recommended add-ons shown in the cart
export type RecommendedAddon = {
  id: string;
  name: string;
  price: number;
  image?: string | null;
};

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onAddRecommendedAddon: (addon: RecommendedAddon) => void;
  fulfillmentType: 'delivery' | 'pickup' | 'dine-in';
  setFulfillmentType: (type: 'delivery' | 'pickup' | 'dine-in') => void;
};

// Size may arrive top-level (legacy callers) or nested on menuItem (details
// modal). One resolver keeps cart, totals, and order summaries consistent.
export function resolveCartSize(ci: CartItem): { name: string; price: number } | null {
  const raw = ci.selectedSize ?? (ci.menuItem as any)?.selectedSize;
  if (!raw || !raw.name) return null;
  return { name: String(raw.name), price: Number(raw.price) || 0 };
}

export function cartLineKey(ci: Pick<CartItem, 'menuItem'> & Partial<Pick<CartItem, 'selectedSize' | 'selectedAddons'>>) {
  const size = resolveCartSize(ci as CartItem);
  const addons = resolveCartAddons(ci as CartItem)
    .map((a) => String(a.id ?? a.name))
    .sort()
    .join('+');
  return `${ci.menuItem.id}::${size?.name ?? ''}::${addons}`;
}

// Add-ons may arrive top-level or nested on menuItem (details modal).
export function resolveCartAddons(ci: CartItem): { id: string; name: string; price: number }[] {
  const raw = (ci.selectedAddons ?? (ci.menuItem as any)?.selectedAddons ?? []) as any[];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && a.name)
    .map((a) => ({ id: String(a.id ?? a.name), name: String(a.name), price: Number(a.price) || 0 }));
}

export function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onAddRecommendedAddon,
  fulfillmentType,
  setFulfillmentType,
}: CartDrawerProps): React.ReactElement | null {
  const { addDeliveryOrder, addStoreOrder, deliverySettings, serviceAreas } = useAdminData();
  const router = useRouter();
  const { data: session } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Id of an order journaled after a failed submit. On a later successful
  // submit it is removed from the queue so the order cannot sync twice.
  const lastJournaledId = useRef<string | null>(null);
  // Portal variant: 'local' preserves counter/offline behavior (LAN,
  // Electron); 'online' on loopback only when the dev override flag is set.
  const isLocalMode = useCustomerPortalMode() === 'local';

  // People Also Ordered / Recommended Add-ons
  const [recommendedAddons, setRecommendedAddons] = useState<{ id: string; name: string; price: number; image?: string | null }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/addons`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const list = data?.addons ?? data ?? [];
        if (!cancelled && Array.isArray(list)) {
          setRecommendedAddons(
            list
              .filter((a: any) => a && a.available !== false && a.name && Number(a.price) >= 0)
              .map((a: any) => ({ id: String(a.id ?? a.name), name: String(a.name), price: Number(a.price) || 0, image: typeof a.image === 'string' && a.image ? a.image : null }))
          );
        }
      } catch {
        // Backend unreachable — items render without add-ons (offline mode).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLocalMode && fulfillmentType !== 'dine-in') {
      setFulfillmentType('dine-in');
    }
  }, [isLocalMode, fulfillmentType, setFulfillmentType]);

  const handleGoToCheckout = () => {
    if (!session?.user && !isLocalMode) {
      setShowAuthModal(true);
      return;
    }
    try {
      localStorage.setItem('eat-n-repeat-cart', JSON.stringify(cartItems));
    } catch {}
    onClose();
    router.push('/customer/checkout');
  };

  // Checkout states
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPhone, setConfirmPhone] = useState('');
  const [address, setAddress] = useState('');
  // Phase 3: permanent number + address book (online signed-in checkout).
  // savedPhone null = not loaded yet OR none on file (see contactLoaded).
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [contactLoaded, setContactLoaded] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [confirmPhoneError, setConfirmPhoneError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  type SavedAddressOption = {
    id: string;
    address_name: string;
    full_address: string;
    is_default: number | boolean;
  };
  const [savedAddresses, setSavedAddresses] = useState<SavedAddressOption[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [addingNewAddress, setAddingNewAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [selectedServiceAreaId, setSelectedServiceAreaId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  // Pick-Up / Take-Out details (pickup orders only; ignored for delivery/dine-in).
  const [pickupName, setPickupName] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupNameErrorText, setPickupNameErrorText] = useState<string | null>(null);
  const [pickupTimeErrorText, setPickupTimeErrorText] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'cod' | null>(null);
  
  useEffect(() => {
    if (isLocalMode) {
      setPaymentMethod('cod'); // Force cash in local mode
    }
  }, [isLocalMode]);

  const sessionUserId = (session as any)?.user?.id as string | undefined;
  const sessionAccessToken = (session as any)?.accessToken as string | undefined;

  const normalizePhoneInput = (v: string) => v.replace(/[\s-]/g, '').trim();
  const isPhoneFormatValid = (v: string) => /^09\d{9}$/.test(normalizePhoneInput(v));

  // Load the permanent number + address book when the drawer opens for a
  // signed-in online customer. Guests and local counter mode keep the
  // legacy manual-entry behavior below.
  const refreshCheckoutContact = async () => {
    if (isLocalMode || !session?.user || !sessionAccessToken) return;
    try {
      const [profileRes, addrRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/customer-settings`, {
          headers: { Authorization: `Bearer ${sessionAccessToken}` },
        }),
        fetch(`${getApiUrl()}/api/customer-addresses`, {
          headers: { Authorization: `Bearer ${sessionAccessToken}` },
        }),
      ]);
      if (profileRes.ok) {
        const profile = await profileRes.json().catch(() => null);
        const stored =
          typeof profile?.phone === 'string' && profile.phone.trim()
            ? profile.phone.trim()
            : null;
        setSavedPhone(stored);
      }
      if (addrRes.ok) {
        const list = await addrRes.json().catch(() => []);
        if (Array.isArray(list)) {
          const opts: SavedAddressOption[] = list
            .filter((a: any) => a && a.id && a.full_address)
            .map((a: any) => ({
              id: String(a.id),
              address_name: String(a.address_name || 'Saved address'),
              full_address: String(a.full_address),
              is_default: a.is_default,
            }));
          setSavedAddresses(opts);
          const def =
            opts.find((a) => a.is_default === 1 || a.is_default === true) ?? opts[0];
          setSelectedAddressId((prev) => prev || (def ? def.id : ''));
          setAddingNewAddress((prev) => (opts.length === 0 ? true : prev));
        }
      }
    } catch {
      // Backend unreachable — fall back to manual entry (offline journal).
    } finally {
      setContactLoaded(true);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setPhoneError(null);
    setConfirmPhoneError(null);
    setAddressError(null);
    setPickupNameErrorText(null);
    setPickupTimeErrorText(null);
    refreshCheckoutContact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isLocalMode, sessionUserId, sessionAccessToken]);

  // Pick-Up prefill: default the collector's name to the signed-in account
  // name once the session is available; the customer can always edit it.
  const accountName = ((session as any)?.user?.name as string | undefined)?.trim() || '';
  useEffect(() => {
    if (!isOpen) return;
    if (!accountName) return;
    setPickupName((prev) => (prev.trim() ? prev : accountName));
  }, [isOpen, accountName]);

  // Today's selectable slots (Asia/Manila wall time), regenerated when the
  // drawer opens or the fulfillment type changes. Empty = none left today.
  const pickupSlots = useMemo(
    () => generatePickupSlots(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, fulfillmentType],
  );

  // If a stored selection falls off the grid (time passed or drawer reopened
  // later), clear it so a stale time can never be submitted.
  useEffect(() => {
    if (!pickupTime) return;
    if (!pickupSlots.some((s) => s.value === pickupTime)) setPickupTime('');
  }, [pickupSlots, pickupTime]);

  // Pickup orders cannot be placed until the collector's name and a valid
  // collection time are set (handleCheckout re-checks as defense-in-depth).
  const pickupIncomplete =
    fulfillmentType === 'pickup' && (pickupNameError(pickupName) !== null || !pickupTime);

  const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);
  // Promo code: the cart only PREVIEWS — the server is the sole discount
  // authority. The cart sends the raw code string at checkout and never
  // computes/adjusts any price itself; the quoted amount comes from
  // POST /api/promos/validate (same rules the checkout re-checks).
  const [promoCode, setPromoCode] = useState('');
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoAppliedCode, setPromoAppliedCode] = useState<string | null>(null);
  const [promoPreview, setPromoPreview] = useState<string | null>(null); // "30.00"
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // amountDue is captured at checkout time (the persisted order total) so the
  // "Order Reserved" screen keeps showing the real total after the cart is
  // cleared. Never derive it from live cartItems here — they are empty by
  // the time this screen renders, which previously displayed ₱0.00.
  const [completedOrder, setCompletedOrder] = useState<{ id: string; type: string; paymentMethod: string; orderNumber: string; amountDue: number } | null>(null);

  // Calculations
  useEffect(() => {
    if (paymentMethod && !['gcash', 'cod'].includes(paymentMethod)) {
      setPaymentMethod(null);
    }
  }, [fulfillmentType, paymentMethod]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cartStateChange', { detail: isOpen }));
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cartStateChange', { detail: false }));
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getCashDescription = () => {
    if (fulfillmentType === 'delivery') return 'Pay when your order arrives';
    if (fulfillmentType === 'pickup') return 'Pay when you pick up your order';
    if (fulfillmentType === 'dine-in') return 'Pay at the café';
    return 'Pay with cash';
  };

  // menuItem.price already carries the full unit price (size absolute price
  // + add-ons + extras, computed in the details modal).
  const subtotal = cartItems.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  // Add-on portion at display prices (backend re-prices from the database).
  const addonTotal = cartItems.reduce(
    (acc, item) =>
      acc +
      resolveCartAddons(item).reduce((s, a) => s + a.price, 0) * item.quantity,
    0
  );
  const baseSubtotal = Math.max(0, subtotal - addonTotal);
  
  const selectedArea = serviceAreas.find(sa => sa.id === selectedServiceAreaId);
  const distanceKm = selectedArea?.distanceKm || 0;
  
  let deliveryFee = 0;
  let deliveryFeeRule = '';
  
  if (fulfillmentType === 'delivery' && selectedArea) {
    if (distanceKm <= (deliverySettings?.freeDeliveryRadiusKm || 0)) {
      deliveryFee = 0;
      deliveryFeeRule = `Cordova Free Delivery Area (≤ ${deliverySettings?.freeDeliveryRadiusKm || 0} km)`;
    } else {
      deliveryFee = (deliverySettings?.baseDeliveryFee || 0) + (distanceKm * (deliverySettings?.perKmFee || 0));
      deliveryFeeRule = `Distance-based (${distanceKm} km)`;
    }
  }

  // Server-quoted preview (parse2 handles "30.00"). Checkout re-resolves the
  // code authoritatively; this preview uses the same server rules so the
  // shown total stays truthful. Clamped locally to the item subtotal so a
  // quoted amount can never exceed what the items are worth here.
  const promoDiscountAmount = Math.min(
    promoPreview != null ? parse2(promoPreview) : 0,
    subtotal,
  );
  const discount = promoDiscountAmount;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const applyPromo = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      setPromoMessage('Enter a code first.');
      return;
    }
    if (promoValidating) return;
    setPromoValidating(true);
    setPromoMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionAccessToken) headers.Authorization = `Bearer ${sessionAccessToken}`;
      const channel = isLocalMode ? 'pos' : 'online';
      const res = await fetch(`${getApiUrl()}/api/promos/validate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, subtotal, channel }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setPromoAppliedCode(String(data.code));
        setPromoPreview(String(data.discount ?? '0.00'));
        setPromoMessage(null);
      } else {
        setPromoAppliedCode(null);
        setPromoPreview(null);
        // Server copy verbatim (min-order, pause, login-required, etc.).
        setPromoMessage(data?.message ?? "This code isn't valid");
      }
    } catch {
      setPromoAppliedCode(null);
      setPromoPreview(null);
      setPromoMessage("We can't reach the server to check this code. Reconnect and try again.");
    } finally {
      setPromoValidating(false);
    }
  };

  const clearPromo = () => {
    setPromoAppliedCode(null);
    setPromoPreview(null);
    setPromoMessage(null);
    setPromoCode('');
  };

  // Keep the preview truthful as the cart changes: re-run the validation
  // whenever a code is applied and the item subtotal moved (min-order rules
  // and percentage caps are live server rules, not cached math).
  useEffect(() => {
    if (!promoAppliedCode) return;
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionAccessToken) headers.Authorization = `Bearer ${sessionAccessToken}`;
        const channel = isLocalMode ? 'pos' : 'online';
        const res = await fetch(`${getApiUrl()}/api/promos/validate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ code: promoAppliedCode, subtotal, channel }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data?.ok) {
          setPromoPreview(String(data.discount ?? '0.00'));
        } else {
          setPromoAppliedCode(null);
          setPromoPreview(null);
          setPromoMessage(data?.message ?? "This code isn't valid");
        }
      } catch {
        if (cancelled) return;
        // Offline: drop the applied code rather than show a bogus discount.
        setPromoAppliedCode(null);
        setPromoPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoAppliedCode, subtotal, fulfillmentType, isOpen]);

  // Add recommended addon to cart as a standalone item
  const handleAddRecommendedAddon = (addon: RecommendedAddon) => {
    onAddRecommendedAddon(addon);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    // Prevent duplicate submissions
    if (isSubmitting) return;

    const finalCustomerName = isLocalMode ? (customerName.trim() || 'Local Guest') : customerName.trim();

    if (!finalCustomerName) {
      alert('Please enter your name');
      return;
    }

    // Phase 3: permanent mobile number (online checkout only — local
    // counter mode keeps its legacy behavior). A saved number needs no
    // input; first-timers must enter + confirm a valid 09 number.
    const usingSavedPhone = !isLocalMode && !!savedPhone;
    if (!isLocalMode) {
      if (usingSavedPhone) {
        setPhoneError(null);
        setConfirmPhoneError(null);
      } else {
        const clean = normalizePhoneInput(phone);
        const cleanConfirm = normalizePhoneInput(confirmPhone);
        let blocked = false;
        if (!clean) {
          setPhoneError('Mobile number is required.');
          blocked = true;
        } else if (!isPhoneFormatValid(phone)) {
          setPhoneError('Mobile number must be 11 digits starting with 09.');
          blocked = true;
        } else {
          setPhoneError(null);
        }
        if (!cleanConfirm) {
          setConfirmPhoneError('Please confirm your mobile number.');
          blocked = true;
        } else if (clean && cleanConfirm !== clean) {
          setConfirmPhoneError('Mobile numbers do not match.');
          blocked = true;
        } else {
          setConfirmPhoneError(null);
        }
        if (blocked) return;
      }
    }

    // Phase 3: address book (online delivery for signed-in customers).
    const useAddressBook = !isLocalMode && !!session?.user && fulfillmentType === 'delivery';
    const selectedSaved =
      useAddressBook && !addingNewAddress
        ? savedAddresses.find((a) => a.id === selectedAddressId) ?? null
        : null;
    if (fulfillmentType === 'delivery') {
      if (!selectedServiceAreaId) {
        alert('Please select your Delivery Area (Barangay/City)');
        return;
      }
      if (useAddressBook && selectedSaved) {
        setAddressError(null);
      } else if (!address.trim()) {
        setAddressError('Please enter a complete delivery address.');
        return;
      } else {
        setAddressError(null);
      }
    }

    // Pick-Up / Take-Out details: collector's name + promised collection time.
    // Only pickup orders validate/send these; delivery and dine-in ignore them.
    if (fulfillmentType === 'pickup') {
      let blocked = false;
      const nameErr = pickupNameError(pickupName);
      if (nameErr) {
        setPickupNameErrorText(nameErr);
        blocked = true;
      } else {
        setPickupNameErrorText(null);
      }
      if (!pickupTime) {
        setPickupTimeErrorText('Please choose a pick-up time.');
        blocked = true;
      } else if (!pickupSlots.some((s) => s.value === pickupTime)) {
        setPickupTimeErrorText('That pick-up time is no longer available. Please choose another.');
        blocked = true;
      } else {
        setPickupTimeErrorText(null);
      }
      if (blocked) return;
    }

    if (!paymentMethod) {
      alert('Please select a payment method');
      return;
    }

    setIsSubmitting(true);

    const orderItemsSummary = cartItems
      .map((ci) => {
        const size = resolveCartSize(ci);
        const addons = resolveCartAddons(ci);
        const addonSuffix = addons.length > 0 ? ` + ${addons.map((a) => a.name).join(', ')}` : '';
        return `${ci.quantity}x ${ci.menuItem.name}${size ? ` (${size.name})` : ''}${addonSuffix}`;
      })
      .join(', ');

    // Aggregate add-on IDs for backend validation (DB is the price authority).
    const addonQtyById = new Map<string, number>();
    for (const ci of cartItems) {
      for (const a of resolveCartAddons(ci)) {
        addonQtyById.set(a.id, (addonQtyById.get(a.id) ?? 0) + ci.quantity);
      }
    }
    const selectedAddonsPayload = [...addonQtyById.entries()].map(([id, quantity]) => ({ id, quantity }));

    const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const { getApiUrl } = await import('@/lib/config');
      const accessToken = (session as any)?.accessToken as string | undefined;

      const resolvedPhone = isLocalMode
        ? phone.trim() || 'LocalGuest'
        : usingSavedPhone
          ? (savedPhone as string)
          : normalizePhoneInput(phone) || '09170000000';
      // Snapshot text for the order row + offline journal. For saved
      // addresses the backend re-reads the book row (ownership-checked);
      // the text here only feeds local displays.
      const resolvedAddressText =
        fulfillmentType === 'dine-in'
          ? tableNumber || 'Counter'
          : selectedSaved
            ? selectedSaved.full_address
            : address.trim() || null;

      const orderDetails = {
        orderNumber,
        customerName: finalCustomerName,
        phone: resolvedPhone,
        // First-timer proof: the backend requires the confirmation match
        // whenever the customer has no saved number. Never sent when the
        // stored (permanent) number is in effect.
        ...(usingSavedPhone ? {} : { confirmPhone: normalizePhoneInput(confirmPhone) }),
        address: resolvedAddressText,
        ...(selectedSaved ? { savedAddressId: selectedSaved.id } : {}),
        ...(!selectedSaved && useAddressBook && newAddressLabel.trim()
          ? { addressLabel: newAddressLabel.trim() }
          : {}),
        serviceAreaId: fulfillmentType === 'delivery' ? selectedServiceAreaId : null,
        // Pick-Up / Take-Out details (null for delivery/dine-in; the backend
        // ignores these fields on other order types anyway).
        pickupName: fulfillmentType === 'pickup' ? normalizePickupName(pickupName) : null,
        pickupAt: fulfillmentType === 'pickup' ? pickupTime : null,
        type: fulfillmentType,
        items: orderItemsSummary,
        subtotal,
        // Promos travel as the raw code string only. The backend resolves
        // validity and computes the discount; totals sent here are ignored.
        ...(promoAppliedCode ? { promoCode: promoAppliedCode } : {}),
        // Cart total WITHOUT the add-on portion: the backend re-prices every
        // selected add-on from the database, so DevTools edits can't change it.
        baseSubtotal,
        deliveryFee,
        total,
        notes: cartItems.filter(ci => ci.notes).map(ci => `${ci.menuItem.name}: ${ci.notes}`).join('; ') || null,
        selectedAddons: selectedAddonsPayload,
      };

      // Map frontend payment method to backend-expected values
      const backendPaymentMethod = paymentMethod === 'gcash' ? 'GCash' : 'Cash';

      const response = await fetch(`${getApiUrl()}/api/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        // Orders placed through the café LAN backend are local: they skip the
        // cloud-availability gate (cash + dine-in/pickup only, enforced
        // server-side) so local ordering survives an Internet outage.
        body: JSON.stringify({ orderDetails, paymentMethod: backendPaymentMethod, orderMode: isLocalMode ? 'local' : 'online' }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process checkout');
      }

      // A previous failed attempt may have journaled this cart under another
      // id — drop it now that the server accepted the order. Runs on ALL
      // success paths (including the GCash redirect below).
      if (lastJournaledId.current) {
        removeOfflineOrder(lastJournaledId.current);
        lastJournaledId.current = null;
      }

      if (paymentMethod === 'gcash' && data.invoiceUrl) {
        onClearCart();
        window.location.href = data.invoiceUrl;
        return;
      }

      if (fulfillmentType === 'delivery') {
        addDeliveryOrder({
          orderNumber: data.orderNumber || orderNumber,
          customerName: finalCustomerName,
          phone: resolvedPhone,
          address: address.trim(),
          serviceAreaId: selectedServiceAreaId || 'sa-1',
          items: orderItemsSummary,
          subtotal,
          deliveryFee,
          total,
          status: 'pending',
          orderedAt: new Date().toISOString(),
        });
        // NOTE: no journalOrder here — the server just accepted this order.
        // Journaling a successful order would queue it for offline replay and
        // insert a second (customer-less) row with the same order number.
      } else {
        addStoreOrder({
          orderId: data.orderNumber || orderNumber,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          // ISO stamp for reliable newest-first sorting (display uses `time`).
          orderedAt: new Date().toISOString(),
          items: `${isLocalMode ? '[GUEST] ' : ''}${finalCustomerName} (${fulfillmentType === 'dine-in' ? `Table ${tableNumber || '1'}` : 'Pick-Up / Take-Out'}): ${orderItemsSummary}`,
          total,
          status: fulfillmentType === 'dine-in' ? 'awaiting_payment' : 'pending',
          paid: false,
          // Preserve the fulfillment type so staff views show PICK-UP
          // instead of falling back to dine-in. DB type is unchanged.
          orderType: fulfillmentType,
          // Pick-Up / Take-Out details carried onto the optimistic local row
          // so the "Pick up by" line shows immediately, before the next
          // server poll replaces the row.
          ...(fulfillmentType === 'pickup'
            ? { pickupName: normalizePickupName(pickupName), pickupAt: pickupTime }
            : {}),
        });
        // NOTE: no journalOrder here — the server just accepted this order
        // (see delivery branch above). Offline journaling happens only in the
        // network-failure catch below.
      }

      setIsSubmitting(false);
      // Prefer the persisted backend total when provided; fall back to the
      // checkout total that was just sent (identical except when the server
      // re-prices add-ons from the DB). Never use the live `total` variable
      // after onClearCart() — it collapses to 0 once the cart is empty.
      const persistedTotal = Number(data?.total);
      setCompletedOrder({
        id: data.orderId || orderNumber,
        orderNumber: data.orderNumber || orderNumber,
        type: fulfillmentType,
        paymentMethod: backendPaymentMethod,
        amountDue: Number.isFinite(persistedTotal) ? persistedTotal : total,
      });
      onClearCart();
      // First order just persisted the permanent number / a new address —
      // reload them so the next checkout shows read-only + pre-filled data.
      setConfirmPhone('');
      setPhoneError(null);
      setConfirmPhoneError(null);
      setAddingNewAddress(false);
      setNewAddressLabel('');
      refreshCheckoutContact();
    } catch (error: any) {
      console.error('Checkout error:', error);
      setIsSubmitting(false);
      const msg = typeof error?.message === 'string' ? error.message : '';
      // Offline fingerprints only: browser-offline state, fetch TypeErrors,
      // and the per-engine network failure messages. Deliberately NOT matching
      // generic substrings like "network" — a server-side refusal mentioning
      // networks must never be mistaken for an offline client.
      const offlineBrowser =
        typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine;
      const isNetworkFailure =
        offlineBrowser ||
        error instanceof TypeError ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Load failed');
      if (isNetworkFailure) {
        // Offline: the backend never saw this order, so journal it locally
        // for the background sync. Same id => retries overwrite, never duplicate.
        // Address + customer notes mirror orderDetails above so the replayed
        // order keeps them (the drain writes both columns). Promo codes stay
        // UNJOURNALED: discounts are only valid online, so the replayed total
        // is the plain (undiscounted) amount and the code is cleared here.
        journalOrder({
          id: orderNumber,
          time: new Date().toISOString(),
          items: orderItemsSummary,
          total: Math.max(0, subtotal + deliveryFee),
          status: fulfillmentType === 'dine-in' ? 'awaiting_payment' : 'pending',
          paid: false,
          notes: 'cart-offline',
          address: fulfillmentType === 'dine-in' ? (tableNumber || 'Counter') : (address.trim() || null),
          customerNotes: cartItems.filter(ci => ci.notes).map(ci => `${ci.menuItem.name}: ${ci.notes}`).join('; ') || null,
        });
        lastJournaledId.current = orderNumber;
        alert("You're offline — order saved on this device and will sync automatically when you reconnect. Your cart is kept so you can review it.");
      } else {
        const raw = error.message || 'Something went wrong. Please try again.';
        // Never expose internal availability codes to customers.
        alert(
          raw.includes('ONLINE_ORDERING_UNAVAILABLE')
            ? 'Online ordering is currently unavailable. Please try again later.'
            : raw
        );
      }
    }
  };


  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="pointer-events-auto w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 sm:p-6 bg-rose-950 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-500">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Your Order Cart</h2>
                <p className="text-xs text-amber-200/80">Eat n' RepEat Café Cordova</p>
            </div>
            {fulfillmentType === 'pickup' && (
              <p className="mt-1.5 text-[11px] font-semibold text-stone-500">
                Pick-Up / Take-Out — order here and collect your prepared order at the café. No address or delivery fee needed.
              </p>
            )}
          </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
            >
              ✕
            </button>
          </div>

          {/* Fulfillment Toggle Banner */}
          <div className="bg-amber-50 border-b border-amber-200/60 p-3 sm:px-6">
            <label className="text-xs font-bold text-rose-950 uppercase tracking-wider block mb-2">
              Fulfillment Type
            </label>
            <div className="grid grid-cols-3 gap-2 bg-white p-1 rounded-xl border border-amber-200 shadow-inner">
              {!isLocalMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('delivery')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                      fulfillmentType === 'delivery'
                        ? 'bg-rose-900 text-white shadow-sm'
                        : 'text-stone-700 hover:bg-amber-100/50'
                    }`}
                  >
                    <Truck className="w-4 h-4" /> Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('pickup')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                      fulfillmentType === 'pickup'
                        ? 'bg-rose-900 text-white shadow-sm'
                        : 'text-stone-700 hover:bg-amber-100/50'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" /> Pick-Up / Take-Out
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setFulfillmentType('dine-in')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  fulfillmentType === 'dine-in'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'text-stone-700 hover:bg-amber-100/50'
                } ${isLocalMode ? 'col-span-3' : ''}`}
              >
                <Utensils className="w-4 h-4" /> Dine-In
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {completedOrder ? (
              // Cash (any fulfillment type) is NOT paid yet: the customer must
              // pay at the cashier and staff must confirm it before the order
              // continues. Only GCash/Xendit takes the success branch below.
              completedOrder.paymentMethod !== 'GCash' ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto border-4 border-rose-200">
                    <Banknote className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-stone-900 leading-tight">Order Reserved &mdash; Payment Required</h3>
                  
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 shadow-sm text-left mx-auto max-w-sm space-y-1">
                    <div className="flex justify-between border-b border-stone-200 pb-2">
                      <span className="text-xs text-stone-500 font-bold uppercase">Order ID</span>
                      <span className="font-mono font-bold text-rose-900">{completedOrder.orderNumber}</span>
                    </div>
                    <div className="flex justify-between border-b border-stone-200 py-2">
                      <span className="text-xs text-stone-500 font-bold uppercase">{completedOrder.type === 'dine-in' ? 'Table' : 'Order Type'}</span>
                      <span className="font-bold">{completedOrder.type === 'dine-in' ? (tableNumber || 'Counter') : (completedOrder.type === 'delivery' ? 'Delivery' : 'Pick-Up / Take-Out')}</span>
                    </div>
                    <div className="flex justify-between border-b border-stone-200 py-2">
                      <span className="text-xs text-stone-500 font-bold uppercase">Amount Due</span>
                      <span className="font-bold text-lg text-[#800000]">₱{completedOrder.amountDue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-xs text-stone-500 font-bold uppercase">Payment Method</span>
                      <span className="font-bold text-sm">
                        {completedOrder.type === 'delivery' ? 'Cash on Delivery' : 'Cash at Counter'}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-stone-200 pt-2 mt-2">
                      <span className="text-xs text-stone-500 font-bold uppercase">Payment Status</span>
                      <span className="font-black text-sm text-amber-700 uppercase">Unpaid</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-900 shadow-sm text-left mx-auto max-w-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse"></div>
                      <h4 className="font-black text-sm uppercase">
                        {completedOrder.type === 'delivery' ? 'Awaiting Rider Collection' : 'Awaiting Cash Payment'}
                      </h4>
                    </div>
                    <p className="text-xs font-medium opacity-90 leading-relaxed mb-2">
                      {completedOrder.type === 'delivery'
                        ? 'Your rider will collect cash payment upon delivery. Your order will be prepared and dispatched for delivery.'
                        : 'Please proceed to the cashier and present your Order ID. Your order will only be sent to the kitchen after the cashier confirms your cash payment.'}
                    </p>
                    <p className="text-[11px] font-bold text-rose-700 bg-white/50 p-2 rounded border border-rose-100">
                      {completedOrder.type === 'delivery'
                        ? 'Your order will be prepared for delivery. The rider will collect payment upon arrival.'
                        : 'Your order is not yet being prepared. Payment must be confirmed by the cashier first.'}
                    </p>
                  </div>
                  
                  <div className="pt-2 flex flex-col gap-2">
                    {!isLocalMode && (
                      <button
                        onClick={() => { setCompletedOrder(null); onClose(); router.push('/customer/orders'); }}
                        className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-stone-950 transition text-center"
                      >
                        Track Order Status <Package className="w-4 h-4 inline ml-1" />
                      </button>
                    )}
                    <button
                      onClick={() => { setCompletedOrder(null); onClose(); }}
                      className={`w-full py-2.5 text-xs font-semibold ${isLocalMode ? 'bg-stone-900 text-white py-3 rounded-xl hover:bg-stone-950' : 'text-stone-600 hover:text-stone-900'}`}
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto border-4 border-emerald-200 animate-bounce">
                    ✓
                  </div>
                  <h3 className="text-2xl font-bold text-stone-900">Order Placed Successfully!</h3>
                  <p className="text-sm text-stone-600">
                    Your Order ID is <span className="font-mono font-bold text-rose-900">{completedOrder.orderNumber}</span>. Our kitchen is preparing your delicious meal!
                  </p>
                  <div className="pt-4 flex flex-col gap-2">
                    <Link
                      href="/customer/orders"
                      onClick={() => { setCompletedOrder(null); onClose(); }}
                      className="w-full py-3 bg-rose-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-rose-950 transition text-center"
                    >
                      Track Order Status <Package className="w-4 h-4 inline" />
                    </Link>
                    <button
                      onClick={() => { setCompletedOrder(null); onClose(); }}
                      className="w-full py-2.5 text-stone-600 hover:text-stone-900 text-xs font-semibold"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              )
            ) : cartItems.length === 0 ? (
              <div className="text-center py-16 text-stone-500 space-y-3">
                <div className="opacity-40"><ShoppingBag className="w-12 h-12 text-stone-400 mx-auto" /></div>
                <p className="font-semibold text-base text-stone-800">Your cart is empty</p>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  Browse our appetizing menu and click "+ Add to Order" to get started.
                </p>
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm text-stone-900">Order Summary ({cartItems.length} items)</h3>
                    <button
                      onClick={onClearCart}
                      className="text-xs text-rose-700 hover:underline font-medium"
                    >
                      Clear All
                    </button>
                  </div>

                  {cartItems.map((item) => {
                    const lineSize = resolveCartSize(item);
                    const lineAddons = resolveCartAddons(item);
                    return (
                    <div
                      key={cartLineKey(item)}
                      className="flex gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50/50 items-center justify-between"
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-stone-200 shrink-0">
                        <Image
                          src={resolveMenuImage(item.menuItem.image)}
                          alt={item.menuItem.name}
                          fill
                          className="object-cover"
                          unoptimized={item.menuItem.image?.startsWith('data:')}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                          {item.menuItem.name}
                        </h4>
                        {lineSize && (
                          <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-px text-[10px] font-extrabold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200">
                            {lineSize.name} · ₱{lineSize.price.toFixed(2)}
                          </span>
                        )}
                        {lineAddons.length > 0 && (
                          <span className="mt-0.5 block text-[11px] font-semibold text-stone-600">
                            + {lineAddons.map((a) => `${a.name} ₱${a.price.toFixed(2)}`).join(', ')}
                          </span>
                        )}
                        <p className="text-xs font-bold text-amber-900 mt-0.5">
                          ₱{item.menuItem.price.toFixed(2)}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-stone-300 rounded-lg bg-white overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(cartLineKey(item), -1)}
                            className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-amber-100 transition font-bold"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-stone-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(cartLineKey(item), 1)}
                            className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-amber-100 transition font-bold"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(cartLineKey(item))}
                          className="text-stone-400 hover:text-rose-600 p-1 text-sm transition"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
);
                  })}
                </div>

      {/* People Also Ordered — Recommended Add-ons */}
      {cartItems.length > 0 && recommendedAddons.length > 0 && (
        <div className="pt-4 border-t border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
              <Users className="w-4 h-4 text-[#B91C1C]" />
              People Also Ordered
            </h3>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Recommendations</span>
          </div>
          <div
            className="flex gap-2.5 overflow-x-auto pb-1.5 -mx-0.5 px-0.5 snap-x"
            role="group"
            aria-label="Recommended add-ons"
          >
            {recommendedAddons
              .filter((a) => a && a.name)
              .map((addon) => (
                <div
                  key={addon.id ?? addon.name}
                  className="snap-start shrink-0 w-[100px] rounded-2xl border bg-white p-2 flex flex-col items-center text-center transition shadow-2xs border-stone-200 hover:border-amber-300"
                >
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                    <Image
                      src={resolveMenuImage(addon.image)}
                      alt={addon.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized={typeof addon.image === 'string' && addon.image?.startsWith('data:')}
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-bold text-stone-800 leading-tight line-clamp-2 min-h-[26px]">
                    {addon.name}
                  </p>
                  <p className="text-[10px] font-black text-[#B91C1C]">
                    ₱{Number(addon.price).toFixed(2)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleAddRecommendedAddon(addon)}
                    className="mt-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm transition active:scale-95 bg-emerald-500 hover:bg-emerald-600"
                    aria-label={`Add ${addon.name}`}
                  >
                    <span className="text-[10px] font-black">+</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Promo Code Strip — server-validated preview (the checkout re-checks it) */}
                <div className="pt-2 border-t border-stone-200">
                  <label className="text-xs font-bold text-stone-800 block mb-1">Promo Code</label>
                  {promoAppliedCode ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                      <div>
                        <p className="text-xs font-black text-emerald-700">
                          ✓ {promoAppliedCode} applied
                          {promoPreview && discount > 0 ? (
                            <span className="font-semibold"> — you save ₱{discount.toFixed(2)}</span>
                          ) : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearPromo}
                        className="text-[11px] font-bold text-stone-500 hover:text-rose-600 underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            applyPromo(promoCode);
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-stone-300 rounded-xl text-xs uppercase font-mono focus:ring-2 focus:ring-rose-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => applyPromo(promoCode)}
                        disabled={promoValidating || !promoCode.trim()}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                          promoValidating || !promoCode.trim()
                            ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                            : 'bg-stone-900 text-white hover:bg-stone-800'
                        }`}
                      >
                        {promoValidating ? 'Checking…' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {promoMessage && <p className="text-[11px] font-semibold text-rose-600 mt-1">{promoMessage}</p>}
                </div>

                {/* Customer Checkout Form */}
                {session?.user || isLocalMode ? (
                <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3 pt-2 border-t border-stone-200">
                  <h3 className="font-bold text-sm text-stone-900">Customer & Delivery Details</h3>

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder={isLocalMode ? "Enter your name (Guest)" : "Enter your name"}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none"
                    />
                  </div>

                  {!isLocalMode &&
                    (savedPhone ? (
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">
                          Mobile Number
                        </label>
                        {/* Permanent number: plain read-only text, no edit control. */}
                        <p className="w-full px-3 py-2 text-xs font-extrabold text-stone-900">
                          {savedPhone}
                        </p>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          Saved to your account. Only an admin can change it.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-stone-700 block mb-1">
                            Mobile Number *
                          </label>
                          <input
                            type="tel"
                            required
                            placeholder="0917XXXXXXX"
                            value={phone}
                            onChange={(e) => {
                              setPhone(e.target.value);
                              if (phoneError) setPhoneError(null);
                            }}
                            onBlur={() => {
                              if (!normalizePhoneInput(phone)) {
                                setPhoneError('Mobile number is required.');
                              } else if (!isPhoneFormatValid(phone)) {
                                setPhoneError('Mobile number must be 11 digits starting with 09.');
                              }
                            }}
                            className={`w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none ${
                              phoneError ? 'border-red-500 bg-red-50/40' : 'border-stone-300'
                            }`}
                          />
                          {phoneError && (
                            <p className="text-[11px] text-red-600 font-semibold mt-1">{phoneError}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-stone-700 block mb-1">
                            Confirm Mobile Number *
                          </label>
                          <input
                            type="tel"
                            required
                            placeholder="Re-enter mobile number"
                            value={confirmPhone}
                            onChange={(e) => {
                              setConfirmPhone(e.target.value);
                              if (confirmPhoneError) setConfirmPhoneError(null);
                            }}
                            onBlur={() => {
                              const clean = normalizePhoneInput(phone);
                              const cleanConfirm = normalizePhoneInput(confirmPhone);
                              if (!cleanConfirm) {
                                setConfirmPhoneError('Please confirm your mobile number.');
                              } else if (clean && cleanConfirm !== clean) {
                                setConfirmPhoneError('Mobile numbers do not match.');
                              }
                            }}
                            className={`w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none ${
                              confirmPhoneError ? 'border-red-500 bg-red-50/40' : 'border-stone-300'
                            }`}
                          />
                          {confirmPhoneError && (
                            <p className="text-[11px] text-red-600 font-semibold mt-1">
                              {confirmPhoneError}
                            </p>
                          )}
                          <p className="text-[10px] text-stone-400 mt-1">
                            Saved permanently to your account on your first order.
                          </p>
                        </div>
                      </>
                    ))}

                  {fulfillmentType === 'delivery' && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">Delivery Area (Barangay/City) *</label>
                        <select
                          required
                          value={selectedServiceAreaId}
                          onChange={(e) => setSelectedServiceAreaId(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none bg-white"
                        >
                          <option value="" disabled>Select Delivery Area</option>
                          {serviceAreas.filter(area => area.active && !area.archived).map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">Delivery Address *</label>
                        {contactLoaded && savedAddresses.length > 0 && !addingNewAddress ? (
                          <>
                            <select
                              value={selectedAddressId}
                              onChange={(e) => setSelectedAddressId(e.target.value)}
                              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none bg-white"
                            >
                              {savedAddresses.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.address_name} — {a.full_address}
                                  {a.is_default === 1 || a.is_default === true ? ' (Default)' : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setAddingNewAddress(true)}
                              className="mt-1.5 text-[11px] font-extrabold text-[#B91C1C] hover:underline"
                            >
                              + Add New Address
                            </button>
                          </>
                        ) : (
                          <>
                            {contactLoaded && savedAddresses.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setAddingNewAddress(false)}
                                className="mb-1.5 text-[11px] font-extrabold text-stone-500 hover:underline"
                              >
                                ‹ Use saved address
                              </button>
                            )}
                            {session?.user && !isLocalMode && (
                              <input
                                type="text"
                                placeholder="Label (e.g. Home, Work, School)"
                                value={newAddressLabel}
                                onChange={(e) => setNewAddressLabel(e.target.value)}
                                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none mb-1.5"
                              />
                            )}
                            <textarea
                              required
                              rows={2}
                              placeholder="Complete street address, barangay, landmarks"
                              value={address}
                              onChange={(e) => {
                                setAddress(e.target.value);
                                if (addressError) setAddressError(null);
                              }}
                              className={`w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none mt-1 ${
                                addressError ? 'border-red-500 bg-red-50/40' : 'border-stone-300'
                              }`}
                            />
                            {addressError && (
                              <p className="text-[11px] text-red-600 font-semibold mt-1">{addressError}</p>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {fulfillmentType === 'pickup' && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">Pick up by (Name) *</label>
                        <input
                          type="text"
                          placeholder="Who will pick up this order?"
                          value={pickupName}
                          maxLength={60}
                          onChange={(e) => {
                            setPickupName(e.target.value);
                            if (pickupNameErrorText) setPickupNameErrorText(null);
                          }}
                          onBlur={() => setPickupNameErrorText(pickupNameError(pickupName))}
                          className={`w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none ${
                            pickupNameErrorText ? 'border-red-500 bg-red-50/40' : 'border-stone-300'
                          }`}
                        />
                        {pickupNameErrorText && (
                          <p className="text-[11px] text-red-600 font-semibold mt-1">{pickupNameErrorText}</p>
                        )}
                        <p className="text-[10px] text-stone-400 mt-1">
                          The person collecting this order — we&apos;ll write this name on the receipt.
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">Pick-up Time *</label>
                        {pickupSlots.length > 0 ? (
                          <select
                            value={pickupTime}
                            onChange={(e) => {
                              setPickupTime(e.target.value);
                              if (pickupTimeErrorText) setPickupTimeErrorText(null);
                            }}
                            className={`w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none bg-white ${
                              pickupTimeErrorText ? 'border-red-500 bg-red-50/40' : 'border-stone-300'
                            }`}
                          >
                            <option value="" disabled>Select a pick-up time</option>
                            {pickupSlots.map((slot) => (
                              <option key={slot.value} value={slot.value}>{slot.label}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                            No pick-up slots remain today. Please try again tomorrow.
                          </p>
                        )}
                        {pickupTimeErrorText && (
                          <p className="text-[11px] text-red-600 font-semibold mt-1">{pickupTimeErrorText}</p>
                        )}
                        <p className="text-[10px] text-stone-400 mt-1">
                          Earliest {PICKUP_PREP_BUFFER_MINUTES} minutes from now, in 15-minute steps.
                        </p>
                      </div>
                    </>
                  )}

                  {fulfillmentType === 'dine-in' && (
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">Table Number</label>
                      <input
                        type="text"
                        placeholder="e.g. Table 4"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Payment Details</label>
                    <div className="border border-stone-200 rounded-xl bg-white shadow-sm overflow-hidden">
                      <div 
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-stone-50 transition-colors"
                        onClick={() => setIsPaymentExpanded(!isPaymentExpanded)}
                      >
                        <div className="flex items-center gap-3">
                          {!paymentMethod || isPaymentExpanded ? (
                            <>
                              <CreditCard className="w-5 h-5 text-stone-500" />
                              <span className="text-sm font-bold text-stone-800">Select Payment Method</span>
                            </>
                          ) : paymentMethod === 'gcash' ? (
                            <>
                              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm">G</div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-stone-800">GCash</p>
                                <p className="text-[10px] text-stone-500 font-medium">Powered by Xendit</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-8 h-8 bg-rose-100 text-rose-700 rounded-lg flex items-center justify-center shadow-sm">
                                <Banknote className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-stone-800">Cash</p>
                                <p className="text-[10px] text-stone-500 font-medium">{getCashDescription()}</p>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!isPaymentExpanded && paymentMethod && <Check className="w-5 h-5 text-emerald-600" />}
                          <svg className={`w-5 h-5 text-stone-400 transition-transform ${isPaymentExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      
                      {isPaymentExpanded && (
                        <div className="p-3 border-t border-stone-100 space-y-2 bg-stone-50/50">
                          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 pl-1">Choose Payment Method</p>
                          {!isLocalMode && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setPaymentMethod('gcash'); }}
                              className={`w-full p-3 border rounded-xl flex items-center justify-between transition-colors ${paymentMethod === 'gcash' ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600' : 'border-stone-200 hover:border-blue-300 bg-white'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm">G</div>
                                <div className="text-left">
                                  <p className="text-sm font-bold text-stone-800">GCash</p>
                                  <p className="text-[10px] text-stone-500 font-medium">Powered by Xendit</p>
                                </div>
                              </div>
                              {paymentMethod === 'gcash' ? (
                                <div className="w-4 h-4 rounded-full border-[4px] border-blue-600 bg-white shadow-sm flex-shrink-0"></div>
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-stone-300 flex-shrink-0"></div>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setPaymentMethod('cod'); }}
                            className={`w-full p-3 border rounded-xl flex items-center justify-between transition-colors ${paymentMethod === 'cod' ? 'border-rose-600 bg-rose-50/50 ring-1 ring-rose-600' : 'border-stone-200 hover:border-rose-300 bg-white'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-rose-100 text-rose-700 rounded-lg flex items-center justify-center shadow-sm">
                                <Banknote className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-stone-800">Cash</p>
                                <p className="text-[10px] text-stone-500 font-medium">{getCashDescription()}</p>
                              </div>
                            </div>
                            {paymentMethod === 'cod' ? (
                              <div className="w-4 h-4 rounded-full border-[4px] border-rose-600 bg-white shadow-sm flex-shrink-0"></div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-stone-300 flex-shrink-0"></div>
                            )}
                          </button>

                          {paymentMethod && (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => setIsPaymentExpanded(false)}
                                className={`w-full py-2.5 rounded-lg font-bold text-xs shadow-sm transition-colors text-white ${
                                  paymentMethod === 'gcash' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700'
                                }`}
                              >
                                Confirm
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </form>
                ) : (
                  <div className="pt-6 pb-2 text-center border-t border-stone-200">
                    <p className="text-sm font-semibold text-stone-600 mb-1">Ready to order?</p>
                    <p className="text-xs text-stone-500">Sign in to provide delivery and payment details.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Summary & Checkout Action */}
          {!completedOrder && cartItems.length > 0 && (
            <div className="p-4 sm:p-6 border-t border-stone-200 bg-amber-50/50 space-y-3">
              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-stone-900">₱{subtotal.toFixed(2)}</span>
                </div>

                {fulfillmentType === 'delivery' && (
                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-stone-900">
                      {deliveryFee === 0 ? (
                        <span className="text-emerald-600 font-bold">FREE</span>
                      ) : (
                        `₱${deliveryFee.toFixed(2)}`
                      )}
                    </span>
                  </div>
                )}

                {promoAppliedCode && discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount · {promoAppliedCode}</span>
                    <span>-₱{discount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-extrabold text-stone-900 pt-2 border-t border-stone-200">
                  <span>Total Payable</span>
                  <span className="text-rose-950 text-lg">₱{total.toFixed(2)}</span>
                </div>
              </div>

              {session?.user || isLocalMode ? (
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting || pickupIncomplete}
                  className={`w-full py-3.5 px-4 text-white rounded-xl font-black text-sm shadow-md active:scale-[0.99] transition flex items-center justify-center gap-2 ${
                    isSubmitting || pickupIncomplete
                      ? 'bg-stone-400 cursor-not-allowed' 
                      : 'bg-[#B91C1C] hover:bg-[#991B1B]'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : paymentMethod === 'gcash' ? (
                    `Pay with GCash - ₱${total.toFixed(2)}`
                  ) : (
                    `Place Order - ₱${total.toFixed(2)}`
                  )}
                </button>

              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="w-full py-3.5 px-4 bg-[#B91C1C] text-white rounded-xl font-black text-sm shadow-md hover:bg-[#991B1B] active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  Proceed to Checkout
                </button>
              )}
            </div>
          )}
        </div>
      </div>


      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-amber-200/80 shadow-2xl space-y-6 text-center animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#FFF1E0] text-[#B91C1C] rounded-full flex items-center justify-center text-3xl mx-auto shadow-2xs">
              <Key className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-[#451a03]">You're almost there!</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-semibold">
                Please sign in or create an account to place your order, track its status, and receive updates.
              </p>
            </div>
            
            <div className="space-y-3 pt-2">
              <Link
                href="/customer/login"
                onClick={() => {
                  try {
                    localStorage.setItem('eat-n-repeat-cart', JSON.stringify(cartItems));
                  } catch {}
                  setShowAuthModal(false);
                  onClose();
                }}
                className="block w-full py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-black text-sm shadow-md transition hover:scale-[1.02] active:scale-95 text-center"
              >
                Sign In
              </Link>
              <Link
                href="/customer/register"
                onClick={() => {
                  try {
                    localStorage.setItem('eat-n-repeat-cart', JSON.stringify(cartItems));
                  } catch {}
                  setShowAuthModal(false);
                  onClose();
                }}
                className="block w-full py-3 bg-white text-stone-850 border border-stone-300 hover:bg-stone-50 rounded-xl font-black text-sm transition hover:scale-[1.02] active:scale-95 text-center"
              >
                Create Account
              </Link>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="block w-full py-2.5 text-xs text-stone-500 hover:text-stone-800 font-extrabold hover:underline"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
