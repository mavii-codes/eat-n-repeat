"use client";

import { useRef, useState, useEffect } from "react";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminButton } from "@/components/admin/AdminForm";
import { getStaffOrAdminToken } from "@/lib/admin/auth-token";
import { Camera, Image as ImageIcon, RotateCcw, Check, AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type ProofOfDeliveryModalProps = {
  open: boolean;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    phone?: string | null;
    address?: string | null;
  } | null;
  onClose: () => void;
  onSubmit: (proof: { photo: string; signature: string; note?: string | null }) => Promise<void>;
};

export function ProofOfDeliveryModal({
  open,
  order,
  onClose,
  onSubmit,
}: ProofOfDeliveryModalProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (open) {
      setPhotoFile(null);
      setPhotoPreview(null);
      setNote("");
      setSubmitting(false);
      setHasSignature(false);
      setErrorMessage(null);
      setTimeout(() => initCanvas(), 50);
    }
  }, [open]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set resolution match visual size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c1917";
    setHasSignature(false);
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (submitting) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawingRef.current = true;
    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || submitting) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    if (submitting) return;
    initCanvas();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, or WEBP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo size exceeds 5MB limit");
      return;
    }

    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
    setErrorMessage(null);
  };

  const removePhoto = () => {
    if (submitting) return;
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const compressPhoto = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) {
          return reject(new Error("Failed to read image file."));
        }
        const img = new Image();
        img.onload = () => {
          try {
            const MAX_SIDE = 800;
            const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              return resolve(rawDataUrl);
            }
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            resolve(dataUrl);
          } catch {
            resolve(rawDataUrl);
          }
        };
        img.onerror = () => {
          resolve(rawDataUrl);
        };
        img.src = rawDataUrl;
      };
      reader.onerror = () => {
        reject(new Error("Could not read image file."));
      };
      reader.readAsDataURL(file);
    });
  };

  const getPhotoUrl = async (file: File): Promise<string> => {
    // Compress directly to lightweight JPEG data URL (~40-60KB)
    return compressPhoto(file);
  };

  const getSignatureUrl = async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Signature pad unavailable");
    return canvas.toDataURL("image/png");
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!photoFile) {
      setErrorMessage("Please capture or upload a delivery photo.");
      return;
    }

    if (!hasSignature) {
      setErrorMessage("Please collect the customer signature.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Process delivery photo (with automatic serverless fallback)
      const photoUrl = await getPhotoUrl(photoFile);

      // 2. Process customer signature
      const signatureUrl = await getSignatureUrl();

      // 3. Submit proof of delivery
      await onSubmit({
        photo: photoUrl,
        signature: signatureUrl,
        note: note.trim() || null,
      });

      toast.success("Delivery completed with proof!");
      onClose();
    } catch (err: any) {
      console.error("Proof of delivery submission error:", err);
      setErrorMessage(err.message || "Failed to complete delivery.");
      toast.error(err.message || "Failed to complete delivery.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !order) return null;

  return (
    <AdminModal
      open={open}
      title="Complete Delivery & Proof of Delivery"
      onClose={() => !submitting && onClose()}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <AdminButton
            type="button"
            variant="primary"
            disabled={submitting || !photoFile || !hasSignature}
            onClick={handleSubmit}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting Proof...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Submit & Complete Delivery
              </>
            )}
          </AdminButton>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Order Info Banner */}
        <div className="rounded-xl bg-amber-50/60 border border-amber-200/60 p-3 text-stone-700">
          <div className="flex items-center justify-between text-xs font-semibold text-[#800000]">
            <span>Order #{order.orderNumber}</span>
            <span>Customer: {order.customerName}</span>
          </div>
          <p className="mt-1 text-xs text-stone-600 truncate" title={order.address || undefined}>
            📍 {order.address || "Standard Delivery"}
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Delivery Photo */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
            1. Delivery Photo <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-stone-500 mb-2">
            Take or upload a clear photo of the delivered items at the customer address.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelect}
            disabled={submitting}
          />

          {photoPreview ? (
            <div className="relative rounded-xl border border-stone-200 overflow-hidden bg-stone-50 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Delivery proof preview"
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-stone-800 shadow hover:bg-white transition"
                >
                  Change Photo
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={removePhoto}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-red-700 transition"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/50 p-6 text-stone-600 hover:border-[#800000] hover:bg-amber-50/30 transition cursor-pointer"
            >
              <div className="rounded-full bg-stone-200/80 p-3 text-stone-600">
                <Camera className="h-6 w-6 text-[#800000]" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-stone-800">
                  Tap to capture or upload photo
                </p>
                <p className="text-[11px] text-stone-500">JPG, PNG, or WEBP up to 5MB</p>
              </div>
            </button>
          )}
        </div>

        {/* 2. Customer Signature */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
              2. Customer Signature <span className="text-red-500">*</span>
            </label>
            {hasSignature && !submitting && (
              <button
                type="button"
                onClick={clearSignature}
                className="inline-flex items-center gap-1 text-xs text-[#800000] hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Clear & Re-sign
              </button>
            )}
          </div>
          <p className="text-xs text-stone-500 mb-2">
            Ask the recipient to sign in the box below using their finger or stylus.
          </p>

          <div className="rounded-xl border border-stone-300 bg-white overflow-hidden shadow-inner touch-none relative">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-36 block cursor-crosshair"
            />
            {!hasSignature && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-stone-400">
                Sign here
              </div>
            )}
          </div>
        </div>

        {/* 3. Delivery Note (Optional) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
            3. Delivery Note <span className="text-stone-400 font-normal lowercase">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            placeholder="e.g. Received by guard / left with neighbor / handed to customer"
            rows={2}
            className="w-full rounded-xl border border-stone-300 p-2.5 text-xs text-stone-800 placeholder-stone-400 focus:border-[#800000] focus:ring-1 focus:ring-[#800000] outline-none"
          />
        </div>
      </div>
    </AdminModal>
  );
}
