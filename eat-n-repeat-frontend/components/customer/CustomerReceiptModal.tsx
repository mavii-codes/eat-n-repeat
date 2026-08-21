'use client';

import Image from 'next/image';
import { Utensils, Bike, FileText, Heart, Printer } from 'lucide-react';

type ReceiptOrderItem = {
  name: string;
  quantity: number;
  price: number;
};

type CustomerReceiptModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  deliveryType: 'dine-in' | 'delivery';
  paymentMethod?: string;
  items: ReceiptOrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount?: number;
  total: number;
  notes?: string;
};

export function CustomerReceiptModal({
  isOpen,
  onClose,
  orderNumber,
  date,
  customerName = 'Valued Customer',
  customerPhone = '(032) 492-0000',
  customerAddress = 'Poblacion, Cordova, Cebu',
  deliveryType,
  paymentMethod = 'Cash on Delivery',
  items,
  subtotal,
  deliveryFee,
  discount = 0,
  total,
  notes,
}: CustomerReceiptModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md bg-[#FFF8F0] rounded-3xl border border-amber-200/80 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col print:shadow-none print:border-none print:max-h-none print:w-full">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#451a03] to-[#3D1703] p-5 text-white flex items-center justify-between print:bg-none print:text-black print:p-2">
          <div>
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
              Official Receipt
            </span>
            <h2 className="text-lg font-black tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
              Eat n' RepEat Café
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition print:hidden"
            aria-label="Close receipt"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Receipt Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white font-mono text-xs text-stone-800">
          {/* Café Header Details */}
          <div className="text-center pb-4 border-b border-dashed border-stone-300">
            <h3 className="font-serif font-black text-base text-[#451a03]">Eat n' RepEat Café</h3>
            <p className="text-[11px] text-stone-500 font-sans">Near Aby Road, Poblacion, Cordova, Cebu</p>
            <p className="text-[11px] text-stone-500 font-sans">Hotline: (032) 492-0000</p>
            <div className="mt-2 text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
              {deliveryType === 'dine-in' ? (
                <><Utensils className="w-3 h-3" /> Dine-In Order</>
              ) : (
                <><Bike className="w-3 h-3" /> Express Delivery</>
              )}
            </div>
          </div>

          {/* Order Info Meta */}
          <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-stone-300">
            <div className="flex justify-between">
              <span className="text-stone-500">Order ID:</span>
              <span className="font-bold text-[#B91C1C]">#{orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Date &amp; Time:</span>
              <span>{date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Customer Name:</span>
              <span className="font-semibold">{customerName}</span>
            </div>
            {deliveryType === 'delivery' && (
              <div className="flex justify-between">
                <span className="text-stone-500">Address:</span>
                <span className="font-semibold truncate max-w-[200px]">{customerAddress}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Payment Method:</span>
              <span className="font-semibold text-emerald-700">{paymentMethod}</span>
            </div>
          </div>

          {/* Itemized List */}
          <div className="space-y-2 pb-3 border-b border-dashed border-stone-300">
            <div className="flex justify-between font-extrabold text-[10px] text-stone-400 uppercase tracking-wider">
              <span>Item Description</span>
              <span>Amount</span>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-medium">
                  <span className="truncate pr-2">{item.name}</span>
                  <span className="font-bold shrink-0">₱{(item.price * item.quantity).toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-stone-400 pl-2">
                  {item.quantity} × ₱{item.price.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Special Instructions */}
          <div className="pb-3 border-b border-dashed border-stone-300 font-sans text-[11px]">
            <span className="font-extrabold text-stone-400 uppercase tracking-wider flex items-center gap-1 text-[10px] mb-1">
              <FileText className="w-3 h-3" /> Special Instructions
            </span>
            {notes && notes.trim().length > 0 ? (
              <p className="font-semibold text-[#451a03] bg-amber-50 p-2 rounded-lg border border-amber-200/80 leading-relaxed italic">
                "{notes}"
              </p>
            ) : (
              <p className="text-stone-400 italic">No special instructions.</p>
            )}
          </div>

          {/* Payment Summary */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span>₱{subtotal.toFixed(2)}</span>
            </div>
            {deliveryType === 'delivery' && (
              <div className="flex justify-between text-stone-600">
                <span>Delivery Fee</span>
                <span>{deliveryFee > 0 ? `₱${deliveryFee.toFixed(2)}` : 'FREE'}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount / Promo</span>
                <span>-₱{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-[#451a03] pt-2 border-t border-stone-300">
              <span>TOTAL PAID</span>
              <span className="text-[#B91C1C]">₱{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center pt-3 text-[11px] text-stone-500 font-sans leading-relaxed border-t border-dashed border-stone-300">
            <p className="font-extrabold text-[#451a03] flex items-center justify-center gap-1">
              Thank you for dining with us! <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
            </p>
            <p className="text-[10px]">Eat n' RepEat Café — Cordova, Cebu</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-[#FFF8F0] border-t border-amber-200/80 flex gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-extrabold text-xs transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-3 px-4 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Printer className="w-4 h-4" /> Print / Download Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
