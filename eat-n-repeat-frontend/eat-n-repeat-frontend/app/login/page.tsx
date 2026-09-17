"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { Lock, Eye, EyeOff, ShieldCheck, User, Package, Users } from "lucide-react";

export default function LoginPage() {
  const { user, login, loading: authLoading, error, clearError } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Clear context error on mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/staff");
      }
    }
  }, [user, authLoading, router]);

  // Handle local context error changes
  useEffect(() => {
    if (error) {
      setErrorMsg(error);
    }
  }, [error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const identifier = usernameOrEmail.trim();
    const pass = password.trim();

    if (!identifier || !pass) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    startTransition(async () => {
      const success = await login(identifier, pass);
      if (success) {
        // Redirection is handled by the useEffect above
      }
    });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF] animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#8B2E2E] border-t-transparent"></div>
          <p className="font-sans text-[15px] font-medium text-[#2D2A26]/70">Loading Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FFFFFF]">
      
      {/* LEFT SIDE: Branding (Hidden on Mobile) */}
      <div className="hidden lg:flex w-full lg:w-1/2 relative flex-col justify-between p-8 sm:p-10 lg:p-16 min-h-[450px] lg:min-h-screen overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url('/admin-cafe-bg.jpg?v=1')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        ></div>
        
        {/* Dark/Coffee Overlay */}
        <div className="absolute inset-0 bg-[#1C1814]/75 z-0 backdrop-blur-[1px]"></div>

        {/* Top Content */}
        <div className="relative z-10 flex flex-col h-full max-w-[540px]">
          {/* Logo */}
          <div className="mb-10 lg:mb-16">
            <Image
              src="/logo.png"
              alt="Eat n' RepEat Café Logo"
              width={90}
              height={90}
              unoptimized
              className="object-contain"
            />
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-[32px] sm:text-[38px] lg:text-[46px] font-bold text-white leading-[1.1] mb-5 tracking-tight">
              Welcome to <br className="hidden sm:block" /> Eat n' RepEat Café
            </h1>
            <p className="text-[16px] lg:text-[18px] text-white/90 mb-10 leading-relaxed font-medium">
              Manage your café operations from one secure workspace.
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4 text-white">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                  <ShieldCheck className="w-4 h-4 text-[#C97A40]" />
                </div>
                <p className="text-[15px] lg:text-[16px] font-semibold tracking-wide">
                  Secure Admin & Staff Access
                </p>
              </div>
              <div className="flex items-center gap-4 text-white">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                  <Package className="w-4 h-4 text-[#C97A40]" />
                </div>
                <p className="text-[15px] lg:text-[16px] font-semibold tracking-wide">
                  Order & Inventory Management
                </p>
              </div>
              <div className="flex items-center gap-4 text-white">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                  <Users className="w-4 h-4 text-[#C97A40]" />
                </div>
                <p className="text-[15px] lg:text-[16px] font-semibold tracking-wide">
                  Staff & Administration
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Content */}
        <div className="relative z-10 mt-12 lg:mt-16 pt-6 border-t border-white/15">
          <h3 className="text-[14px] font-bold text-white mb-2 uppercase tracking-widest">
            Administrator Managed System
          </h3>
          <p className="text-[14px] text-white/70 leading-relaxed font-medium">
            Staff accounts are created and managed by the Café Administrator.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE: Login Form (and Mobile Full Screen) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-[#FAF8F5] lg:bg-[#FFFFFF] min-h-[100dvh] lg:min-h-0 relative">
        
        {/* Mobile Smooth Top Background Atmosphere */}
        <div className="absolute top-0 left-0 w-full h-[55dvh] lg:hidden z-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute inset-0 opacity-[0.35] blur-[2px] scale-105"
            style={{
              backgroundImage: "url('/admin-cafe-bg.jpg?v=1')",
              backgroundSize: "cover",
              backgroundPosition: "top center",
              WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)",
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)"
            }}
          ></div>
        </div>

        <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out flex flex-col justify-center relative z-10 pt-[10px] lg:pt-0">
          
          {/* MOBILE Header */}
          <div className="flex flex-col items-center lg:hidden mb-10 text-center">
            <Image
              src="/logo.png"
              alt="Eat n' RepEat Café Logo"
              width={85}
              height={85}
              unoptimized
              className="object-contain mb-5"
            />
            <h1 className="text-[24px] font-bold text-[#2D2A26] leading-tight mb-2">
              Welcome to <br />Eat n' RepEat Café
            </h1>
            <p className="text-[14px] text-[#2D2A26]/60 font-medium px-4">
              Sign in to access your Admin or Staff workspace.
            </p>
          </div>

          {/* DESKTOP Header */}
          <div className="hidden lg:block mb-10 text-left">
            <h2 className="text-[32px] font-bold text-[#2D2A26] tracking-tight mb-3">
              Portal Sign In
            </h2>
            <p className="text-[15px] text-[#2D2A26]/60 font-medium">
              Sign in to access your Admin or Staff workspace.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 rounded-lg p-3.5 text-[14px] font-semibold text-[#8B2E2E] bg-red-50 border border-red-100 flex items-center gap-3 justify-center lg:justify-start">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-5">
            <div className="space-y-0 lg:space-y-2">
              <label className="hidden lg:block text-[14px] font-bold text-[#2D2A26] text-left">
                Username or Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 lg:pl-4 flex items-center pointer-events-none text-[#2D2A26]/40 group-focus-within:text-[#8B2E2E] transition-colors">
                  <User className="w-[18px] h-[18px] lg:w-5 lg:h-5" />
                </div>
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => {
                    setUsernameOrEmail(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Enter your username or email"
                  disabled={isPending}
                  autoComplete="username"
                  required
                  className="w-full h-[54px] pl-[46px] lg:pl-[44px] pr-5 lg:pr-4 rounded-xl border-none lg:border lg:border-[#E8DDD5] bg-[#F6F4F0] lg:bg-[#FAF8F5] text-[15px] font-medium text-[#2D2A26] placeholder:text-[#2D2A26]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/20 lg:focus:border-[#8B2E2E] lg:hover:border-[#C97A40]/40 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-0 lg:space-y-2">
              <label className="hidden lg:block text-[14px] font-bold text-[#2D2A26] text-left">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 lg:pl-4 flex items-center pointer-events-none text-[#2D2A26]/40 group-focus-within:text-[#8B2E2E] transition-colors">
                  <Lock className="w-[18px] h-[18px] lg:w-5 lg:h-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Enter your password"
                  disabled={isPending}
                  autoComplete="current-password"
                  required
                  className="w-full h-[54px] pl-[46px] lg:pl-[44px] pr-12 lg:pr-12 rounded-xl border-none lg:border lg:border-[#E8DDD5] bg-[#F6F4F0] lg:bg-[#FAF8F5] text-[15px] font-medium text-[#2D2A26] placeholder:text-[#2D2A26]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/20 lg:focus:border-[#8B2E2E] lg:hover:border-[#C97A40]/40 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-5 lg:pr-4 flex items-center text-[#2D2A26]/40 hover:text-[#8B2E2E] transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px] lg:w-5 lg:h-5" />
                  ) : (
                    <Eye className="w-[18px] h-[18px] lg:w-5 lg:h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-5 lg:pt-3">
              <button
                type="submit"
                disabled={isPending}
                className="w-full h-[54px] bg-[#8B2E2E] hover:bg-[#6F2323] text-white rounded-xl text-[15px] lg:text-[16px] font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2 active:scale-[0.98] shadow-md lg:shadow-sm lg:hover:shadow-md tracking-wider lg:tracking-normal"
              >
                {isPending ? (
                  <>
                    <div className="h-[20px] w-[20px] animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                    <span className="lg:hidden uppercase">SIGNING IN...</span>
                    <span className="hidden lg:inline">Signing In...</span>
                  </>
                ) : (
                  <>
                    <span className="lg:hidden uppercase">SIGN IN</span>
                    <span className="hidden lg:inline">Sign In</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Desktop Security Text */}
          <div className="hidden lg:block mt-12 pt-8 border-t border-[#E8DDD5]">
            <h3 className="flex items-center justify-center lg:justify-start gap-2 text-[14px] font-bold text-[#8B2E2E] mb-2">
              <ShieldCheck className="w-[18px] h-[18px]" />
              Authorized Personnel Only
            </h3>
            <p className="text-[13px] text-[#2D2A26]/60 leading-relaxed font-medium text-center lg:text-left">
              This portal is restricted to authorized Eat n' RepEat Café Administrators and Staff.
            </p>
          </div>

          {/* Mobile Security Text */}
          <div className="lg:hidden mt-8 text-center flex flex-col gap-2">
            <h3 className="text-[13px] font-bold text-[#2D2A26]">
              Authorized Personnel Only
            </h3>
            <p className="text-[12px] text-[#2D2A26]/60 font-medium px-4">
              This portal is restricted to authorized Eat n' RepEat Café Admin and Staff.
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}
