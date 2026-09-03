"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Wifi, WifiOff, RefreshCw, Copy, CheckCircle2, Server, Globe } from "lucide-react";

type LocalModeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function LocalModeModal({ isOpen, onClose }: LocalModeModalProps) {
  const [networkInfo, setNetworkInfo] = useState<{ ip: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchNetworkInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/local-network");
      if (!res.ok) {
        throw new Error("Failed to detect local network");
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setNetworkInfo({ ip: data.ip, url: data.url });
      
      // Save state to let other components know it's forced local mode for demo
      localStorage.setItem("force-local-mode-demo", "true");
      // Trigger a storage event manually for same tab
      window.dispatchEvent(new Event('local-mode-toggled'));
    } catch (err: any) {
      setError(err.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !networkInfo) {
      fetchNetworkInfo();
    }
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [isOpen, networkInfo]);

  const handleCopy = () => {
    if (networkInfo?.url) {
      navigator.clipboard.writeText(networkInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStopLocalMode = () => {
    localStorage.removeItem("force-local-mode-demo");
    window.dispatchEvent(new Event('local-mode-toggled'));
    setNetworkInfo(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="bg-[#63131d] px-6 py-5 flex items-center justify-between text-white">
          <div>
            <h2 className="font-serif text-xl font-bold flex items-center gap-2">
              <Server className="h-5 w-5" />
              LOCAL MODE ACTIVE
            </h2>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mt-1">
              Local Café Ordering Demo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 overflow-y-auto">
          {/* STATUS CARDS */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 flex flex-col items-center justify-center text-center">
              <Wifi className="h-5 w-5 text-emerald-600 mb-1" />
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Customer Network</span>
              <span className="text-sm font-bold text-stone-800">Connected</span>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 flex flex-col items-center justify-center text-center">
              <Server className="h-5 w-5 text-emerald-600 mb-1" />
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Local Server</span>
              <span className="text-sm font-bold text-stone-800">Running</span>
            </div>
            <div className={`rounded-xl p-3 border flex flex-col items-center justify-center text-center ${isOnline ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'}`}>
              {isOnline ? (
                <Globe className="h-5 w-5 text-blue-600 mb-1" />
              ) : (
                <WifiOff className="h-5 w-5 text-rose-600 mb-1" />
              )}
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Internet</span>
              <span className={`text-sm font-bold ${isOnline ? 'text-blue-800' : 'text-rose-800'}`}>
                {isOnline ? 'Available' : 'Unavailable'}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#63131d] border-t-transparent mb-4"></div>
              <p className="font-bold text-stone-600">Detecting Local Network IP...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
              <WifiOff className="h-10 w-10 text-rose-500 mx-auto mb-3" />
              <h3 className="font-bold text-rose-800 text-lg mb-2">Local Network Not Available</h3>
              <p className="text-sm text-rose-600 mb-4">
                Connect this computer to the café Wi-Fi or hotspot, then try again.
              </p>
              <button
                onClick={fetchNetworkInfo}
                className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Try Again
              </button>
            </div>
          ) : networkInfo ? (
            <div className="flex flex-col md:flex-row gap-6">
              {/* QR CODE SECTION */}
              <div className="flex-1 flex flex-col items-center justify-center bg-stone-50 rounded-2xl border border-stone-200 p-6">
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4">SCAN TO ORDER</p>
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-stone-100">
                  <QRCodeSVG 
                    value={networkInfo.url} 
                    size={200}
                    level="H"
                    includeMargin={true}
                    fgColor="#1c1c1c"
                  />
                </div>
              </div>

              {/* DETAILS SECTION */}
              <div className="flex-1 flex flex-col justify-center">
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Detected Local IP</p>
                  <p className="font-mono font-bold text-lg text-stone-800">{networkInfo.ip}</p>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Customer Local URL</p>
                  <div className="flex items-center gap-2">
                    <a href={networkInfo.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate font-mono font-medium block">
                      {networkInfo.url}
                    </a>
                    <button 
                      onClick={handleCopy}
                      className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500 transition-colors"
                      title="Copy URL"
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-[#fff9f6] border border-[#63131d]/10 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-[#63131d] uppercase tracking-wider mb-2">Customer Instructions</h4>
                  <ol className="text-sm text-stone-600 space-y-1.5 list-decimal list-inside font-medium">
                    <li>Connect phone to café Wi-Fi.</li>
                    <li>Scan the QR code.</li>
                    <li>Start ordering.</li>
                  </ol>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* FOOTER */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex justify-between items-center">
          <button
            onClick={fetchNetworkInfo}
            disabled={loading}
            className="text-sm font-bold text-stone-500 hover:text-stone-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh IP / QR
          </button>
          <button
            onClick={handleStopLocalMode}
            className="bg-stone-800 hover:bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors"
          >
            Switch back to Online Mode
          </button>
        </div>
      </div>
    </div>
  );
}
