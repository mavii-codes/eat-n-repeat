"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Globe,
  Wifi,
  WifiOff,
  Server,
  Database,
  CreditCard,
  ShoppingBag,
  Copy,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Link as LinkIcon,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useLocalMode, startLocalMode, stopLocalMode } from "@/lib/customer/useLocalMode";
import { useNetworkStatus } from "@/context/NetworkStatusContext";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { getApiUrl } from "@/lib/config";
import toast from "react-hot-toast";

type CafeAvailabilityMode = "AUTO" | "FORCE_AVAILABLE" | "FORCE_UNAVAILABLE";

export default function OperatingModePage() {
  const isLocalMode = useLocalMode();
  const { isOffline, onlineOrdering } = useNetworkStatus();
  const { confirm } = useConfirm();

  const [networkInfo, setNetworkInfo] = useState<{ ip: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<"start" | "stop" | null>(null);

  // Online ordering override state
  const [overrideMode, setOverrideMode] = useState<CafeAvailabilityMode>("AUTO");
  const [savingOverride, setSavingOverride] = useState(false);

  const fetchNetworkInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/local-network");
      if (!res.ok) throw new Error("Failed to detect local network");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNetworkInfo({ ip: data.ip, url: `${data.url}?mode=local` });
    } catch (err: any) {
      setError(err.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLocalMode && !networkInfo) {
      fetchNetworkInfo();
    }
  }, [isLocalMode]);

  const handleCopy = () => {
    if (networkInfo?.url) {
      navigator.clipboard.writeText(networkInfo.url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartLocal = () => {
    startLocalMode();
    setConfirmDialog(null);
    toast.success("Local Mode activated");
  };

  const handleStopLocal = () => {
    stopLocalMode();
    setNetworkInfo(null);
    setConfirmDialog(null);
    toast.success("Switched to Online Mode");
  };

  const handleOverrideChange = useCallback(async (newMode: CafeAvailabilityMode) => {
    // Confirm before force-unavailable since it blocks customer ordering
    if (newMode === "FORCE_UNAVAILABLE") {
      const ok = await confirm({
        title: "Force Online Ordering Unavailable?",
        message: "This will block all customers from placing online orders. They will see a \"Temporarily Unavailable\" message. Are you sure you want to proceed?",
        variant: "danger",
        confirmLabel: "Force Unavailable",
      });
      if (!ok) return;
    }

    setSavingOverride(true);
    try {
      const token = localStorage.getItem("eat-n-repeat-admin-token");
      const res = await fetch(`${getApiUrl()}/api/admin/cafe-availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode: newMode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update availability");
      }

      setOverrideMode(newMode);
      const label = newMode === "AUTO" ? "Automatic" : newMode === "FORCE_AVAILABLE" ? "Force Available" : "Force Unavailable";
      toast.success(`Online ordering mode set to ${label}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update availability");
    } finally {
      setSavingOverride(false);
    }
  }, [confirm]);

  return (
    <>
      <AdminPageHeader
        badge="System"
        title="Operating Mode"
        subtitle="Choose how Eat n RepEat is currently operating. Switch between cloud-based online operations and local café network ordering."
      />

      {/* Hero Section */}
      <div className="mb-8 rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md px-8 py-8 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#800000]/60 mb-2">
              Café Local Ordering
            </p>
            <h2 className="font-serif text-2xl font-bold text-[#800000] mb-1">
              Your café. Your network. Your orders.
            </h2>
            <p className="text-sm text-stone-500 max-w-lg">
              Let customers order directly from their phones while connected to the café network.
            </p>
          </div>
          {isLocalMode && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Local Mode Active
            </span>
          )}
        </div>
      </div>

      {/* Mode Selector */}
      <div className="grid gap-5 lg:grid-cols-2 mb-8">
        {/* Online Mode Card */}
        <div
          className={`relative rounded-2xl border-2 p-6 transition-all duration-300 ${
            !isLocalMode
              ? "border-emerald-400 bg-emerald-50/50 shadow-md shadow-emerald-500/10"
              : "border-stone-200 bg-white/70"
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                !isLocalMode ? "bg-emerald-100 text-emerald-600" : "bg-stone-100 text-stone-400"
              }`}>
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#800000]">Online Mode</h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Cloud Connected</p>
              </div>
            </div>
            {!isLocalMode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-stone-500 mb-5 leading-relaxed">
            Normal online ordering, delivery, and payments. Uses the cloud backend for full-featured café operations.
          </p>
          {!isLocalMode ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Currently Active
            </div>
          ) : (
            <button
              onClick={() => setConfirmDialog("stop")}
              className="flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-200 transition-colors"
            >
              Switch to Online
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Local Mode Card */}
        <div
          className={`relative rounded-2xl border-2 p-6 transition-all duration-300 ${
            isLocalMode
              ? "border-amber-400 bg-amber-50/50 shadow-md shadow-amber-500/10"
              : "border-stone-200 bg-white/70"
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                isLocalMode ? "bg-amber-100 text-amber-600" : "bg-stone-100 text-stone-400"
              }`}>
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#800000]">Local Mode</h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Café Network</p>
              </div>
            </div>
            {isLocalMode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-stone-500 mb-5 leading-relaxed">
            Continue café ordering through the local network. Customers connect to café Wi-Fi and order directly from their phones.
          </p>
          {isLocalMode ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
              <CheckCircle2 className="h-4 w-4" />
              Currently Active
            </div>
          ) : (
            <button
              onClick={() => setConfirmDialog("start")}
              className="flex items-center gap-2 rounded-xl bg-[#800000] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#63131d] transition-colors shadow-sm"
            >
              Switch to Local Mode
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── LOCAL MODE DASHBOARD ── */}
      {isLocalMode && (
        <div className="space-y-6">
          {/* Status Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 px-6 py-4 flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">Local Mode Active — Customer ordering is ready</p>
              <p className="text-xs text-amber-700/70">Customers connected to the café network can scan the QR code and order.</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* QR Code Card (centerpiece) — 3 cols */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-md shadow-sm overflow-hidden">
                <div className="px-8 pt-8 pb-6 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#800000]/50 mb-6">
                    Scan to Order
                  </p>

                  {loading ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#800000] border-t-transparent mb-4" />
                      <p className="text-sm font-bold text-stone-500">Detecting local network...</p>
                    </div>
                  ) : error ? (
                    <div className="py-12">
                      <WifiOff className="h-10 w-10 text-rose-400 mx-auto mb-3" />
                      <p className="font-bold text-rose-700 text-sm mb-2">Local Network Not Available</p>
                      <p className="text-xs text-rose-500 mb-4">Connect to the café Wi-Fi or hotspot, then try again.</p>
                      <button
                        onClick={fetchNetworkInfo}
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-100 text-rose-700 px-4 py-2 text-xs font-bold hover:bg-rose-200 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Try Again
                      </button>
                    </div>
                  ) : networkInfo ? (
                    <>
                      <div className="flex justify-center mb-6">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
                          <QRCodeSVG
                            value={networkInfo.url}
                            size={220}
                            level="H"
                            includeMargin={false}
                            fgColor="#1c1c1c"
                          />
                        </div>
                      </div>

                      <p className="font-serif text-lg font-bold text-[#800000] mb-0.5">
                        Eat n&apos; RepEat Café
                      </p>
                      <p className="text-sm text-stone-500 mb-5">Local Ordering</p>

                      <p className="text-xs text-stone-400 mb-6 max-w-xs mx-auto leading-relaxed">
                        Connect to the café Wi-Fi first, then scan this code to start ordering.
                      </p>

                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={handleCopy}
                          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                        >
                          {copied ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copied ? "Copied" : "Copy Link"}
                        </button>
                        <button
                          onClick={fetchNetworkInfo}
                          disabled={loading}
                          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                          Refresh QR
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right Column — Steps + Status */}
            <div className="lg:col-span-2 space-y-5">
              {/* How to Order */}
              <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-md shadow-sm p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#800000]/50 mb-5">
                  How to Order
                </p>
                <div className="space-y-5">
                  {[
                    { step: "01", title: "Connect", desc: "Connect your phone to the café Wi-Fi." },
                    { step: "02", title: "Scan", desc: "Scan the QR code." },
                    { step: "03", title: "Order", desc: "Browse the menu and place your order." },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#800000] text-[11px] font-bold text-white">
                        {item.step}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-stone-800">{item.title}</p>
                        <p className="text-xs text-stone-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Local System Status */}
              <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-md shadow-sm p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#800000]/50 mb-4">
                  Local System Status
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Local Network", ok: true },
                    { label: "Local Server", ok: true },
                    { label: "Database", ok: true },
                    { label: "Internet", ok: !isOffline },
                    { label: "Customer Access", ok: !!networkInfo },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-600">{item.label}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${item.ok ? "text-emerald-600" : "text-rose-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${item.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {item.ok ? "Connected" : "Unavailable"}
                      </span>
                    </div>
                  ))}
                </div>

                {networkInfo && (
                  <div className="mt-5 pt-4 border-t border-stone-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">Customer Link</p>
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      <a
                        href={networkInfo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate font-mono"
                      >
                        {networkInfo.url}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Switch to Online (bottom) */}
          <div className="flex justify-end">
            <button
              onClick={() => setConfirmDialog("stop")}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Switch to Online Mode
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── ONLINE MODE DASHBOARD ── */}
      {!isLocalMode && (
        <div className="space-y-6">
          {/* Status Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 px-6 py-4 flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Online Mode Active — Cloud operations running</p>
              <p className="text-xs text-emerald-700/70">Eat n RepEat is currently using the online cloud system.</p>
            </div>
          </div>

          {/* Online Status Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Server, label: "Cloud Server", status: "Connected", ok: true },
              { icon: Database, label: "Database", status: "Connected", ok: true },
              { icon: ShoppingBag, label: "Online Ordering", status: onlineOrdering === "AVAILABLE" ? "Available" : onlineOrdering === "UNAVAILABLE" ? "Unavailable" : "Local Only", ok: onlineOrdering === "AVAILABLE" },
              { icon: CreditCard, label: "Payments", status: "Available", ok: true },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-md shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-9 w-9 rounded-xl ${item.ok ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"} flex items-center justify-center`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-bold text-stone-600">{item.label}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${item.ok ? "text-emerald-600" : "text-red-600"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${item.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  {item.status}
                </span>
              </div>
            ))}
          </div>

          {/* Online Ordering Override Control */}
          <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-md shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#800000]/50 mb-1.5">
                  Online Ordering Override
                </p>
                <p className="text-sm text-stone-500">
                  Control whether customers can place online orders. Overrides the automatic availability check.
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
                onlineOrdering === "AVAILABLE"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${onlineOrdering === "AVAILABLE" ? "bg-emerald-500" : "bg-red-500"} ${onlineOrdering === "AVAILABLE" ? "" : "animate-pulse"}`} />
                Effective: {onlineOrdering === "AVAILABLE" ? "Available" : onlineOrdering === "UNAVAILABLE" ? "Unavailable" : "Local Only"}
              </span>
            </div>

            <div className="space-y-2">
              {([
                { value: "AUTO" as CafeAvailabilityMode, label: "Automatic", desc: "Determined by server health and network status" },
                { value: "FORCE_AVAILABLE" as CafeAvailabilityMode, label: "Force Available", desc: "Always allow online orders regardless of server status" },
                { value: "FORCE_UNAVAILABLE" as CafeAvailabilityMode, label: "Force Unavailable", desc: "Block all online customer orders with an unavailable message" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={savingOverride}
                  onClick={() => handleOverrideChange(opt.value)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    overrideMode === opt.value
                      ? opt.value === "FORCE_UNAVAILABLE"
                        ? "border-red-400 bg-red-50/50 ring-1 ring-red-400"
                        : opt.value === "FORCE_AVAILABLE"
                        ? "border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-400"
                        : "border-[#800000]/40 bg-[#800000]/5 ring-1 ring-[#800000]/20"
                      : "border-stone-200 hover:border-stone-300 bg-white"
                  } ${savingOverride ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-bold ${overrideMode === opt.value ? "text-stone-900" : "text-stone-700"}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">{opt.desc}</p>
                    </div>
                    {overrideMode === opt.value && (
                      <CheckCircle2 className={`h-5 w-5 shrink-0 ${
                        opt.value === "FORCE_UNAVAILABLE" ? "text-red-600" : opt.value === "FORCE_AVAILABLE" ? "text-emerald-600" : "text-[#800000]"
                      }`} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Switch to Local */}
          <div className="flex justify-end">
            <button
              onClick={() => setConfirmDialog("start")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#800000] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#63131d] transition-colors shadow-sm"
            >
              Switch to Local Mode
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION DIALOGS ── */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="font-serif text-xl font-bold text-[#800000] mb-2">
              {confirmDialog === "start" ? "Start Local Café Ordering?" : "Return to Online Mode?"}
            </h3>
            <p className="text-sm text-stone-500 leading-relaxed mb-4">
              {confirmDialog === "start"
                ? "Local Mode will allow customers connected to the café's Wi-Fi or hotspot to access the local ordering system."
                : "Customers will return to the normal online ordering environment."}
            </p>
            {confirmDialog === "start" && (
              <div className="flex items-center gap-2 mb-5">
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Dine-In
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Cash Payment
                </span>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog === "start" ? handleStartLocal : handleStopLocal}
                className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-colors shadow-sm ${
                  confirmDialog === "start"
                    ? "bg-[#800000] hover:bg-[#63131d]"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {confirmDialog === "start" ? "Start Local Mode" : "Switch to Online"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
