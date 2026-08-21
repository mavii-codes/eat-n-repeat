"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ReviewsProvider } from "@/context/ReviewsContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { OnlineIndicator } from "@/components/shared/OnlineIndicator";
import { Menu, X } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role !== "admin") {
        router.replace("/staff");
      }
    }
  }, [user, loading, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="admin-shell min-h-screen flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
          <p className="font-serif text-lg text-white/70">Verifying Admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <ReviewsProvider>
      <div className="admin-shell min-h-screen w-full overflow-x-hidden">
        <OnlineIndicator />
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between bg-[#1a0a0d]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 sticky top-0 z-30">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-white p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-serif text-lg text-white/90 font-medium">Eat n' RepEat Admin</div>
          <div className="w-6"></div> {/* Spacer for centering */}
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex bg-[#1a0a0d] shadow-2xl overflow-hidden">
              <div className="relative w-full h-full flex flex-col">
                <AdminSidebar />
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="absolute top-4 right-4 text-white/60 hover:text-white p-2 bg-white/5 rounded-full backdrop-blur-md transition-colors z-50"
                  aria-label="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <AdminSidebar />
        </div>

        {/* Main Content Area */}
        <div className="relative z-10 w-full lg:pl-72 transition-all duration-300">
          <main className="mx-auto max-w-6xl w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </ReviewsProvider>
  );
}
