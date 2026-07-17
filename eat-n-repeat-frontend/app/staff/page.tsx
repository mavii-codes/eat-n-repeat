"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdminData } from "@/context/AdminDataContext";
import { Logo } from "@/components/brand/Logo";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
  CrudActions,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminChatModal } from "@/components/admin/AdminChatModal";
import { StatCard, DollarIcon, ClipboardIcon, TrendIcon } from "@/components/admin/StatCard";
import type { MenuItem, MenuItemInput, StockItem, StaffRole, DeliveryStatus, AttendanceRecord, AttendanceStatus } from "@/lib/admin/types";

type StaffTab = "dashboard" | "orders" | "menu" | "inventory" | "delivery" | "profile" | "attendance";

type PeriodSummary = {
  staffId: string;
  staffName: string;
  position: string;
  period: string; // e.g. "2026-07-13 to 2026-07-19" or "July 2026"
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  totalHours: number;
};

function getWeekRange(dateStr: string): { start: string; end: string; label: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay();
  const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const pad = (n: number) => String(n).padStart(2, "0");
  const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  const endStr = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
  return {
    start: startStr,
    end: endStr,
    label: `${startStr} to ${endStr}`,
  };
}

function getMonthLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function StaffPortalPage() {
  const { user, logout, changePassword, updateProfile } = useAuth();
  const {
    storeOrders,
    deliveryOrders,
    menuItems,
    menuCategories,
    stockItems,
    stockCategories,
    updateStoreOrderStatus,
    confirmStoreOrderPayment,
    addMenuItem,
    updateMenuItem,
    updateStockItem,
    updateDeliveryStatus,
    getMenuCategoryName,
    getStockCategoryName,
    attendanceRecords,
    staffAccounts,
    addAttendanceRecord,
    updateAttendanceRecord,
    deleteAttendanceRecord,
    clockIn,
    clockOut,
  } = useAdminData();

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StaffTab>("dashboard");

  // Form states for adding/editing menu items
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState<MenuItemInput>({
    name: "",
    description: "",
    price: 0,
    categoryId: menuCategories[0]?.id || "",
    available: true,
  });

  // Profile Form States
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Security Form States
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmNewPwd, setConfirmNewPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // Attendance Filter States
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({
    staffId: "",
    date: new Date().toLocaleDateString("en-CA"),
    timeIn: "08:00 AM",
    timeOut: "05:00 PM",
    status: "Present" as AttendanceStatus,
    reason: "",
    totalHours: undefined as number | undefined,
  });
  const [searchStaff, setSearchStaff] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [viewTab, setViewTab] = useState<"daily" | "weekly" | "monthly">("daily");
  const [attendanceSubTab, setAttendanceSubTab] = useState<"timecard" | "monitor">("timecard");
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatOrder, setActiveChatOrder] = useState<{ customerName: string; orderNumber: string } | null>(null);

  const handleOpenChat = (customerName: string, orderNumber: string) => {
    setActiveChatOrder({ customerName, orderNumber });
    setChatOpen(true);
  };
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    setCurrentTime(
      new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
    const interval = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const myFullHistory = useMemo(() => {
    if (!user) return [];
    return attendanceRecords
      .filter((r) => r.staffId === user.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, user]);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString("en-CA");
  }, []);

  const todayRecord = useMemo(() => {
    if (!user) return null;
    return attendanceRecords.find((r) => r.staffId === user.id && r.date === todayStr);
  }, [attendanceRecords, user, todayStr]);

  const myHistory = useMemo(() => {
    if (!user) return [];
    return attendanceRecords
      .filter((r) => r.staffId === user.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [attendanceRecords, user]);

  const activeStaff = useMemo(() => {
    return staffAccounts.filter((acc) => !acc.archived && acc.role !== "admin");
  }, [staffAccounts]);

  const weeklySummaries = useMemo(() => {
    const groups: { [key: string]: PeriodSummary } = {};

    attendanceRecords.forEach((record) => {
      const staffAccount = staffAccounts.find((s) => s.id === record.staffId);
      const position = staffAccount ? (staffAccount.role === "head_staff" ? "Head Staff" : "Staff") : "Staff";
      
      let weekLabel = "Unknown Period";
      try {
        weekLabel = getWeekRange(record.date).label;
      } catch (e) {
        console.error(e);
      }

      const key = `${record.staffId}_${weekLabel}`;

      if (!groups[key]) {
        groups[key] = {
          staffId: record.staffId,
          staffName: record.staffName,
          position,
          period: weekLabel,
          presentCount: 0,
          lateCount: 0,
          excusedCount: 0,
          absentCount: 0,
          totalHours: 0,
        };
      }

      if (record.status === "Present") groups[key].presentCount++;
      else if (record.status === "Late") groups[key].lateCount++;
      else if (record.status === "Excused") groups[key].excusedCount++;
      else if (record.status === "Absent") groups[key].absentCount++;

      if (record.totalHours) {
        groups[key].totalHours = Number((groups[key].totalHours + record.totalHours).toFixed(2));
      }
    });

    return Object.values(groups).sort((a, b) => b.period.localeCompare(a.period) || a.staffName.localeCompare(b.staffName));
  }, [attendanceRecords, staffAccounts]);

  const filteredWeeklySummaries = useMemo(() => {
    return weeklySummaries.filter((s) => s.staffName.toLowerCase().includes(searchStaff.toLowerCase()));
  }, [weeklySummaries, searchStaff]);

  const monthlySummaries = useMemo(() => {
    const groups: { [key: string]: PeriodSummary } = {};

    attendanceRecords.forEach((record) => {
      const staffAccount = staffAccounts.find((s) => s.id === record.staffId);
      const position = staffAccount ? (staffAccount.role === "head_staff" ? "Head Staff" : "Staff") : "Staff";

      let monthLabel = "Unknown Month";
      try {
        monthLabel = getMonthLabel(record.date);
      } catch (e) {
        console.error(e);
      }

      const key = `${record.staffId}_${monthLabel}`;

      if (!groups[key]) {
        groups[key] = {
          staffId: record.staffId,
          staffName: record.staffName,
          position,
          period: monthLabel,
          presentCount: 0,
          lateCount: 0,
          excusedCount: 0,
          absentCount: 0,
          totalHours: 0,
        };
      }

      if (record.status === "Present") groups[key].presentCount++;
      else if (record.status === "Late") groups[key].lateCount++;
      else if (record.status === "Excused") groups[key].excusedCount++;
      else if (record.status === "Absent") groups[key].absentCount++;

      if (record.totalHours) {
        groups[key].totalHours = Number((groups[key].totalHours + record.totalHours).toFixed(2));
      }
    });

    return Object.values(groups).sort((a, b) => b.period.localeCompare(a.period) || a.staffName.localeCompare(b.staffName));
  }, [attendanceRecords, staffAccounts]);

  const filteredMonthlySummaries = useMemo(() => {
    return monthlySummaries.filter((s) => s.staffName.toLowerCase().includes(searchStaff.toLowerCase()));
  }, [monthlySummaries, searchStaff]);

  // Submit manual record Form
  function handleAttendanceSubmit() {
    if (!attendanceForm.staffId || !attendanceForm.date) {
      alert("Staff Member and Date are required fields.");
      return;
    }

    const selectedStaff = staffAccounts.find((s) => s.id === attendanceForm.staffId);
    if (!selectedStaff) return;

    let computedHours: number | undefined = undefined;
    if (attendanceForm.timeIn && attendanceForm.timeOut && (attendanceForm.status === "Present" || attendanceForm.status === "Late")) {
      try {
        const parseTime = (timeStr: string, dateStr: string) => {
          const [t, modifier] = timeStr.split(" ");
          let [hoursVal, minutesVal] = t.split(":").map(Number);
          if (modifier === "PM" && hoursVal < 12) hoursVal += 12;
          if (modifier === "AM" && hoursVal === 12) hoursVal = 0;
          return new Date(`${dateStr}T${String(hoursVal).padStart(2, "0")}:${String(minutesVal).padStart(2, "0")}:00`);
        };
        const inD = parseTime(attendanceForm.timeIn, attendanceForm.date);
        const outD = parseTime(attendanceForm.timeOut, attendanceForm.date);
        const diff = outD.getTime() - inD.getTime();
        if (diff > 0) {
          computedHours = Number((diff / (1000 * 60 * 60)).toFixed(2));
        }
      } catch (e) {
        console.error("Hours calculation error:", e);
      }
    }

    const payload = {
      staffId: attendanceForm.staffId,
      staffName: selectedStaff.name,
      date: attendanceForm.date,
      timeIn: (attendanceForm.status === "Present" || attendanceForm.status === "Late") ? attendanceForm.timeIn : undefined,
      timeOut: (attendanceForm.status === "Present" || attendanceForm.status === "Late") ? attendanceForm.timeOut : undefined,
      status: attendanceForm.status,
      reason: attendanceForm.status === "Excused" ? attendanceForm.reason : undefined,
      totalHours: computedHours !== undefined ? computedHours : attendanceForm.totalHours,
    };

    if (editingRecord) {
      updateAttendanceRecord(editingRecord.id, payload);
    } else {
      addAttendanceRecord(payload);
    }
    setAttendanceModalOpen(false);
  }

  function openCreateAttendance() {
    setEditingRecord(null);
    setAttendanceForm({
      staffId: activeStaff[0]?.id || "",
      date: new Date().toLocaleDateString("en-CA"),
      timeIn: "08:00 AM",
      timeOut: "05:00 PM",
      status: "Present",
      reason: "",
      totalHours: undefined,
    });
    setAttendanceModalOpen(true);
  }

  function openEditAttendance(record: AttendanceRecord) {
    setEditingRecord(record);
    setAttendanceForm({
      staffId: record.staffId,
      date: record.date,
      timeIn: record.timeIn || "",
      timeOut: record.timeOut || "",
      status: record.status,
      reason: record.reason || "",
      totalHours: record.totalHours,
    });
    setAttendanceModalOpen(true);
  }

  function handleDeleteAttendance(record: AttendanceRecord) {
    if (confirm(`Are you sure you want to delete this attendance log for ${record.staffName}?`)) {
      deleteAttendanceRecord(record.id);
    }
  }

  // Load profile values on mount/user load
  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
      setProfileUsername(user.username);
    }
  }, [user]);

  // Tab configurations
  const tabs = useMemo(() => {
    const list: { id: StaffTab; label: string; icon: React.ReactNode }[] = [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        ),
      },
      {
        id: "orders",
        label: "Customer Orders",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      },
      {
        id: "menu",
        label: "Menu Items",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        ),
      },
      {
        id: "inventory",
        label: "Inventory / Stock",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
      },
      {
        id: "delivery",
        label: "Delivery Orders",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <rect x="1" y="3" width="15" height="13" rx="1" />
            <path d="M16 8h4l3 4v5h-7V8z" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        ),
      },
    ];

    if (user?.role === "head_staff" || user?.role === "staff") {
      list.push({
        id: "attendance",
        label: "Staff Attendance",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      });
    }

    list.push({
      id: "profile",
      label: "My Profile",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ),
    });

    return list;
  }, [user]);

  // Dynamic Sales Calculations for Daily Summary
  const salesSummary = useMemo(() => {
    const activeStore = storeOrders.filter(o => !o.archived);
    const activeDel = deliveryOrders.filter(o => !o.archived);

    const storePaidSales = activeStore.filter(o => o.status === "completed" || o.paid).reduce((sum, o) => sum + o.total, 0);
    const delDeliveredSales = activeDel.filter(o => o.status === "delivered").reduce((sum, o) => sum + o.total, 0);
    const totalSales = storePaidSales + delDeliveredSales;

    const totalOrders = activeStore.length + activeDel.length;
    const completedOrders = activeStore.filter(o => o.status === "completed").length + activeDel.filter(o => o.status === "delivered").length;
    const pendingOrders = activeStore.filter(o => o.status === "pending").length + activeDel.filter(o => ["pending", "confirmed", "preparing", "out_for_delivery"].includes(o.status)).length;

    return {
      totalSales,
      totalOrders,
      completedOrders,
      pendingOrders,
    };
  }, [storeOrders, deliveryOrders]);

  // Live low-stock notifications calculated dynamically
  const stockNotifications = useMemo(() => {
    return stockItems
      .filter((item) => item.quantity <= item.lowStockThreshold)
      .map((item) => ({
        id: `low-${item.id}`,
        title: `Low stock: ${item.name}`,
        details: `Only ${item.quantity} ${item.unit} remaining (Threshold: ${item.lowStockThreshold})`,
        timestamp: "Just Now",
      }));
  }, [stockItems]);

  // Handle stock adjustment (+/- buttons)
  function handleAdjustStock(item: StockItem, amount: number) {
    const updatedQty = Math.max(0, item.quantity + amount);
    updateStockItem(item.id, {
      name: item.name,
      categoryId: item.categoryId,
      quantity: updatedQty,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold,
    });
  }

  // Toggle availability of menu items
  function handleToggleAvailability(item: MenuItem) {
    updateMenuItem(item.id, {
      name: item.name,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      available: !item.available,
    });
  }

  // Handle open add menu item
  function openAddMenu() {
    setEditingMenuItem(null);
    setMenuForm({
      name: "",
      description: "",
      price: 0,
      categoryId: menuCategories[0]?.id || "",
      available: true,
    });
    setMenuModalOpen(true);
  }

  // Handle open edit menu item
  function openEditMenu(item: MenuItem) {
    setEditingMenuItem(item);
    setMenuForm({
      name: item.name,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      available: item.available,
    });
    setMenuModalOpen(true);
  }

  // Submit Menu Item Form
  function handleMenuSubmit() {
    if (!menuForm.name.trim() || menuForm.price <= 0) return;

    if (editingMenuItem) {
      updateMenuItem(editingMenuItem.id, menuForm);
    } else {
      addMenuItem(menuForm);
    }
    setMenuModalOpen(false);
  }

  // Profile Edit Submission
  function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileName.trim() || !profileEmail.trim() || !profileUsername.trim()) {
      setProfileError("All profile fields are required.");
      return;
    }

    updateProfile(profileName.trim(), profileEmail.trim(), profileUsername.trim());
    setProfileSuccess("Profile updated successfully.");
  }

  // Password Change Submission
  function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!user) return;

    if (currentPwd !== user.password) {
      setPwdError("Current password is incorrect.");
      return;
    }

    if (newPwd.length < 6) {
      setPwdError("New password must be at least 6 characters.");
      return;
    }

    if (newPwd !== confirmNewPwd) {
      setPwdError("New passwords do not match.");
      return;
    }

    changePassword(newPwd);
    setPwdSuccess("Password updated successfully.");
    setCurrentPwd("");
    setNewPwd("");
    setConfirmNewPwd("");
  }

  if (!user) return null;

  return (
    <div className="admin-shell min-h-screen flex text-[#1c1c1c]">
      {/* LEFT SIDEBAR */}
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto text-white">
        <div className="border-b border-white/8 px-6 py-6">
          <Logo size="md" showText={false} />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/45">
            Staff Portal
          </p>
          <p className="mt-1 font-script text-xl text-white/90">Eat n&apos; Repeat</p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                activeTab === tab.id
                  ? "bg-accent/20 text-white border-l-4 border-accent shadow-inner"
                  : "text-white/70 hover:bg-white/5"
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                activeTab === tab.id ? "bg-accent text-white" : "bg-white/8 text-white/80"
              }`}>
                {tab.icon}
              </span>
              <span className="text-sm font-semibold">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* FOOTER USER CARD */}
        <div className="border-t border-white/8 px-6 py-5 space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm flex flex-col gap-2">
            <div>
              <p className="text-xs font-semibold text-white/95">{user.name}</p>
              <p className="text-[10px] text-white/45 font-mono">@{user.username} • {user.role}</p>
            </div>
            <button
              onClick={logout}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-accent/20 border border-accent/30 py-2 text-xs font-semibold text-white transition-all hover:bg-accent/40 active:scale-[0.98] cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN MAIN AREA */}
      <main className="relative z-10 pl-72 flex-1 mx-auto max-w-6xl px-8 py-8">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Overview</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Café Summary</h1>
              <p className="text-sm text-muted">Monitor sales overview and alert notifications.</p>
            </div>

            {/* Sales Stats Summary */}
            <section className="grid gap-5 sm:grid-cols-3">
              <StatCard
                title="Today's Sales Revenue"
                value={`₱${salesSummary.totalSales.toLocaleString()}`}
                subtitle="In-store & completed deliveries"
                icon={<DollarIcon />}
                tone="wine"
              />
              <StatCard
                title="Completed Orders"
                value={salesSummary.completedOrders.toLocaleString()}
                subtitle="Fulfilled customer requests"
                icon={<TrendIcon />}
                tone="rose"
              />
              <StatCard
                title="Pending Workload"
                value={salesSummary.pendingOrders.toLocaleString()}
                subtitle="Orders awaiting prep/delivery"
                icon={<ClipboardIcon />}
                tone="red"
              />
            </section>

            {/* My Attendance History */}
            <div className="grid gap-5">
              <div className="w-full">
                <AdminPanel title="My Attendance History" subtitle="Your 5 most recent attendance entries">
                  <div className="overflow-x-auto px-6 py-4">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead>
                        <tr className="admin-table-head text-muted border-b border-accent/10 pb-2">
                          <th className="py-2 font-medium">Date</th>
                          <th className="py-2 font-medium">Time In</th>
                          <th className="py-2 font-medium">Time Out</th>
                          <th className="py-2 font-medium">Status</th>
                          <th className="py-2 font-medium">Reason</th>
                          <th className="py-2 font-medium text-right">Total Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-accent/5">
                        {myHistory.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-muted">No attendance logs found.</td>
                          </tr>
                        ) : (
                          myHistory.map((h) => (
                            <tr key={h.id} className="hover:bg-accent-light/5 text-ink">
                              <td className="py-3 font-semibold text-[#800000]">{h.date}</td>
                              <td className="py-3 text-muted font-mono">{h.timeIn || "—"}</td>
                              <td className="py-3 text-muted font-mono">{h.timeOut || "—"}</td>
                              <td className="py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                                  !h.timeOut && (h.status === "Present" || h.status === "Late")
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : h.status === "Late"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : h.status === "Absent"
                                    ? "bg-red-50 text-red-800 border-red-200"
                                    : h.status === "Excused"
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : "bg-green-50 text-green-800 border-green-200"
                                }`}>
                                  {!h.timeOut && (h.status === "Present" || h.status === "Late") ? "On Shift" : h.status}
                                </span>
                              </td>
                              <td className="py-3 text-muted italic max-w-[200px] truncate" title={h.reason || ""}>
                                {h.reason || "—"}
                              </td>
                              <td className="py-3 text-right font-semibold">{h.totalHours ? `${h.totalHours} hrs` : "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </AdminPanel>
              </div>
            </div>

            {/* Notification alert panels */}
            <div className="grid gap-5 md:grid-cols-2">
              <AdminPanel title="System Alerts & Warnings" subtitle="Low inventory notices">
                <div className="divide-y divide-accent/10 px-6 py-2 max-h-[300px] overflow-y-auto">
                  {stockNotifications.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted">All stock levels are optimal. No alerts.</p>
                  ) : (
                    stockNotifications.map((notif) => (
                      <div key={notif.id} className="py-4 flex gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-900">{notif.title}</p>
                          <p className="text-xs text-muted mt-0.5">{notif.details}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </AdminPanel>

              <AdminPanel title="Staff Quick Reference" subtitle="Operating guidelines">
                <div className="p-6 text-sm text-muted leading-relaxed space-y-3">
                  <p>Welcome to your staff shifts! To maintain restaurant efficiency, make sure to:</p>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs">
                    <li>Confirm in-store payments as customers pay.</li>
                    <li>Update inventory stock counts as raw ingredients arrive.</li>
                    <li>Keep menu availability checked (toggle off items if ingredients run out).</li>
                    <li>Update delivery status promptly so customers can track deliveries.</li>
                  </ul>
                </div>
              </AdminPanel>
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOMER ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Operations</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">In-store Orders</h1>
              <p className="text-sm text-muted">Manage in-store customer tickets, update workflow status, and confirm payments.</p>
            </div>

            <AdminPanel title="Active Orders Tickets" subtitle="Awaiting prep or completion">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">ID</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeOrders.filter(o => !o.archived && o.status !== "completed").length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted">No active order tickets.</td>
                      </tr>
                    ) : (
                      storeOrders.filter(o => !o.archived && o.status !== "completed").map((order) => (
                        <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                          <td className="px-4 py-3 font-bold text-[#800000]">{order.orderId}</td>
                          <td className="px-4 py-3 text-muted text-xs">{order.time}</td>
                          <td className="px-4 py-3 text-xs font-medium">{order.items}</td>
                          <td className="px-4 py-3 font-semibold">₱{order.total}</td>
                          <td className="px-4 py-3">
                            {order.paid ? (
                              <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Paid</span>
                            ) : (
                              <button
                                onClick={() => confirmStoreOrderPayment(order.id)}
                                className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-green-100 hover:text-green-800 transition-colors cursor-pointer"
                              >
                                Confirm Payment
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-red-50 text-accent border border-accent/15 px-2.5 py-0.5 text-xs font-semibold capitalize">
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 flex gap-2 items-center">
                            <AdminSelect
                              value={order.status}
                              onChange={(e) => updateStoreOrderStatus(order.id, e.target.value as any)}
                              className="!py-1 !text-xs max-w-28"
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </AdminSelect>
                            <button
                              type="button"
                              onClick={() => handleOpenChat(`Customer #${order.orderId}`, order.orderId)}
                              className="p-1.5 text-accent hover:bg-accent-light rounded-lg transition-colors cursor-pointer focus:outline-none"
                              title="Chat with Customer"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AdminPanel>

            <AdminPanel title="Customer Order History" subtitle="Fulfilled or cancelled records">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">ID</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg">Final Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeOrders.filter(o => o.status === "completed" || o.status === "cancelled").length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted">No history found.</td>
                      </tr>
                    ) : (
                      storeOrders.filter(o => o.status === "completed" || o.status === "cancelled").map((order) => (
                        <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 text-muted">
                          <td className="px-4 py-3 font-bold">{order.orderId}</td>
                          <td className="px-4 py-3 text-xs">{order.time}</td>
                          <td className="px-4 py-3 text-xs">{order.items}</td>
                          <td className="px-4 py-3 font-semibold text-ink">₱{order.total}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Confirmed Paid</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                              order.status === "completed" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                            }`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </div>
        )}

        {/* TAB 3: MENU ITEMS */}
        {activeTab === "menu" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Menu</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Menu Management</h1>
              <p className="text-sm text-muted">Add, edit, or adjust the live availability of café items.</p>
            </div>

            <AdminPanel
              title="Café Menu Catalog"
              subtitle={`${menuItems.filter(m => !m.archived).length} menu items`}
              action={<AdminButton onClick={openAddMenu}>+ Add Menu Item</AdminButton>}
            >
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">Item Name</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Availability Status</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuItems.filter(m => !m.archived).map((item) => (
                      <tr key={item.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                        <td className="px-4 py-3 font-medium text-[#800000]">
                          <p>{item.name}</p>
                          <p className="text-[10px] text-muted font-normal mt-0.5">{item.description}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">{getMenuCategoryName(item.categoryId)}</td>
                        <td className="px-4 py-3 font-semibold">₱{item.price}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleAvailability(item)}
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all cursor-pointer ${
                              item.available
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-red-100 text-red-800 border border-red-200"
                            }`}
                          >
                            {item.available ? "● Available" : "○ Out of Stock"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openEditMenu(item)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-light transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </div>
        )}

        {/* TAB 4: INVENTORY */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Inventory</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Stock Levels</h1>
              <p className="text-sm text-muted">Monitor and adjust ingredient counts inline.</p>
            </div>

            <AdminPanel title="Raw Ingredients & Stock Items" subtitle="Quantities directly editable">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">Ingredient</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Alert Level</th>
                      <th className="px-4 py-3 font-medium text-center">Remaining Quantity</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg text-center">Stock Adjustment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockItems.map((item) => {
                      const isLow = item.quantity <= item.lowStockThreshold;
                      return (
                        <tr key={item.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                          <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                          <td className="px-4 py-3 text-xs text-muted">{getStockCategoryName(item.categoryId)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border ${
                              isLow ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-green-50 text-green-800 border-green-200"
                            }`}>
                              {isLow ? `Low stock (<=${item.lowStockThreshold})` : "Optimal"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-sm">
                            {item.quantity} <span className="text-xs font-normal text-muted">{item.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex gap-1.5 justify-center items-center">
                              <button
                                onClick={() => handleAdjustStock(item, -1)}
                                className="h-7 w-7 rounded-lg border border-accent/15 hover:bg-accent-light font-bold text-[#800000] text-sm flex items-center justify-center transition-colors cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-xs font-mono font-semibold w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => handleAdjustStock(item, 1)}
                                className="h-7 w-7 rounded-lg border border-accent/15 hover:bg-accent-light font-bold text-[#800000] text-sm flex items-center justify-center transition-colors cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </div>
        )}

        {/* TAB 5: DELIVERY ORDERS */}
        {activeTab === "delivery" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Deliveries</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Delivery Orders</h1>
              <p className="text-sm text-muted">View delivery addresses, item manifests, and update progress status.</p>
            </div>

            <AdminPanel title="Active Deliveries Queue" subtitle="Monitoring café home-deliveries">
              <div className="overflow-x-auto p-2">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead>
                    <tr className="admin-table-head text-muted">
                      <th className="px-4 py-3 font-medium rounded-l-lg">Order ID</th>
                      <th className="px-4 py-3 font-medium">Customer Details</th>
                      <th className="px-4 py-3 font-medium">Manifest</th>
                      <th className="px-4 py-3 font-medium">Total Price</th>
                      <th className="px-4 py-3 font-medium">Delivery Status</th>
                      <th className="px-4 py-3 font-medium rounded-r-lg text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryOrders.filter(o => !o.archived).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted">No delivery orders listed.</td>
                      </tr>
                    ) : (
                      deliveryOrders.filter(o => !o.archived).map((order) => (
                        <tr key={order.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10">
                          <td className="px-4 py-3 font-bold text-[#800000]">{order.orderNumber}</td>
                          <td className="px-4 py-3 text-xs leading-4">
                            <p className="font-bold text-ink">{order.customerName}</p>
                            <p className="text-muted">{order.phone}</p>
                            <p className="text-muted mt-0.5">{order.address}</p>
                            <button
                              type="button"
                              onClick={() => handleOpenChat(order.customerName, order.orderNumber)}
                              className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent hover:underline cursor-pointer focus:outline-none"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3 w-3">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                              Chat with Customer
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs">{order.items}</td>
                          <td className="px-4 py-3 font-semibold">₱{order.total}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize border ${
                              order.status === "delivered"
                                ? "bg-green-50 text-green-800 border-green-200"
                                : order.status === "cancelled"
                                ? "bg-gray-50 text-gray-700 border-gray-200"
                                : "bg-red-50 text-accent border-accent/15"
                            }`}>
                              {order.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AdminSelect
                              value={order.status}
                              onChange={(e) => updateDeliveryStatus(order.id, e.target.value as DeliveryStatus)}
                              className="!py-1 !text-xs max-w-32 inline-block"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="preparing">Preparing</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </AdminSelect>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </div>
        )}

        {/* TAB 6: PROFILE */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Profile</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">My Account Settings</h1>
              <p className="text-sm text-muted">Update your staff profile credentials and password.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <AdminPanel title="Profile Details" subtitle="Full Name and contact details">
                <form onSubmit={handleProfileUpdate} className="space-y-4 px-6 py-5">
                  {profileError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800">
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-800">
                      {profileSuccess}
                    </div>
                  )}
                  <AdminField label="Full Name">
                    <AdminInput
                      value={profileName}
                      onChange={(e) => {
                        setProfileName(e.target.value);
                        setProfileError(null);
                        setProfileSuccess(null);
                      }}
                      placeholder="e.g. Maria Santos"
                      required
                    />
                  </AdminField>
                  <AdminField label="Username">
                    <AdminInput
                      value={profileUsername}
                      onChange={(e) => {
                        setProfileUsername(e.target.value.toLowerCase().replace(/\s+/g, ""));
                        setProfileError(null);
                        setProfileSuccess(null);
                      }}
                      placeholder="e.g. maria"
                      required
                    />
                  </AdminField>
                  <AdminField label="Email Address">
                    <AdminInput
                      type="email"
                      value={profileEmail}
                      onChange={(e) => {
                        setProfileEmail(e.target.value);
                        setProfileError(null);
                        setProfileSuccess(null);
                      }}
                      placeholder="e.g. maria@eatnrepeat.com"
                      required
                    />
                  </AdminField>
                  <div className="pt-2 flex justify-end">
                    <AdminButton type="submit">Update Profile</AdminButton>
                  </div>
                </form>
              </AdminPanel>

              <AdminPanel title="Security Settings" subtitle="Change account password">
                <form onSubmit={handlePasswordUpdate} className="space-y-4 px-6 py-5">
                  {pwdError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800">
                      {pwdError}
                    </div>
                  )}
                  {pwdSuccess && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-800">
                      {pwdSuccess}
                    </div>
                  )}
                  <AdminField label="Current Password">
                    <AdminInput
                      type="password"
                      value={currentPwd}
                      onChange={(e) => {
                        setCurrentPwd(e.target.value);
                        setPwdError(null);
                        setPwdSuccess(null);
                      }}
                      placeholder="••••••••"
                      required
                    />
                  </AdminField>
                  <AdminField label="New Password">
                    <AdminInput
                      type="password"
                      value={newPwd}
                      onChange={(e) => {
                        setNewPwd(e.target.value);
                        setPwdError(null);
                        setPwdSuccess(null);
                      }}
                      placeholder="••••••••"
                      required
                    />
                  </AdminField>
                  <AdminField label="Confirm New Password">
                    <AdminInput
                      type="password"
                      value={confirmNewPwd}
                      onChange={(e) => {
                        setConfirmNewPwd(e.target.value);
                        setPwdError(null);
                        setPwdSuccess(null);
                      }}
                      placeholder="••••••••"
                      required
                    />
                  </AdminField>
                  <div className="pt-2 flex justify-end">
                    <AdminButton type="submit">Update Password</AdminButton>
                  </div>
                </form>
              </AdminPanel>
            </div>
          </div>
        )}

        {/* TAB 7: STAFF ATTENDANCE MONITORING (HEAD STAFF & STAFF) */}
        {activeTab === "attendance" && (user.role === "head_staff" || user.role === "staff") && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent border border-accent/10">Attendance</span>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-[#800000] mt-1.5">Staff Attendance</h1>
              <p className="text-sm text-muted">
                {user.role === "head_staff"
                  ? "Manage your personal shift clock and monitor employee attendance records."
                  : "Clock in, clock out, and monitor your personal attendance history."}
              </p>
            </div>

            {/* Sub-tabs for Head Staff only */}
            {user.role === "head_staff" && (
              <div className="flex gap-2 border-b border-accent/10 pb-4 mb-2">
                <button
                  onClick={() => setAttendanceSubTab("timecard")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-0 ${
                    attendanceSubTab === "timecard"
                      ? "bg-[#800000]/10 text-[#800000] border-l-4 border-[#800000] shadow-sm"
                      : "text-muted hover:bg-accent-light/10"
                  }`}
                >
                  My Timecard
                </button>
                <button
                  onClick={() => setAttendanceSubTab("monitor")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-0 ${
                    attendanceSubTab === "monitor"
                      ? "bg-[#800000]/10 text-[#800000] border-l-4 border-[#800000] shadow-sm"
                      : "text-muted hover:bg-accent-light/10"
                  }`}
                >
                  Monitor Team
                </button>
              </div>
            )}

            {/* Standard Staff View OR Head Staff personal Timecard view */}
            {(user.role === "staff" || (user.role === "head_staff" && attendanceSubTab === "timecard")) && (
              <div className="space-y-6">
                {/* Personal Shift Clock Card */}
                <div className="bg-white rounded-2xl border border-accent/10 p-6 shadow-sm max-w-md">
                  <div className="text-center space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Shift Clock</p>
                    <h2 className="text-4xl font-mono font-bold text-[#800000] tracking-tight">{currentTime || "00:00:00 AM"}</h2>
                    <p className="text-xs text-muted font-medium">
                      {new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>

                    <div className="border-t border-accent/10 pt-4 flex flex-col items-center gap-3">
                      {todayRecord ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted">Status today:</span>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize border ${
                              todayRecord.status === "Present"
                                ? "bg-green-50 text-green-800 border-green-200"
                                : todayRecord.status === "Late"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : todayRecord.status === "Absent"
                                ? "bg-red-50 text-red-800 border-red-200"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            }`}>
                              {todayRecord.status}
                            </span>
                          </div>

                          {todayRecord.timeOut ? (
                            <div className="space-y-1 text-center">
                              <p className="text-sm text-ink">
                                Shift Completed: <span className="font-mono font-semibold">{todayRecord.timeIn}</span> to <span className="font-mono font-semibold">{todayRecord.timeOut}</span>
                              </p>
                              {todayRecord.totalHours && (
                                <p className="text-xs font-bold text-[#800000]">
                                  Total Hours Worked: {todayRecord.totalHours} hrs
                                </p>
                              )}
                            </div>
                          ) : todayRecord.status === "Absent" || todayRecord.status === "Excused" ? (
                            <p className="text-sm text-muted italic">
                              {todayRecord.status === "Absent" ? "Marked as Absent for today." : `Excused Absence: ${todayRecord.reason || ""}`}
                            </p>
                          ) : (
                            <div className="space-y-4 w-full">
                              <p className="text-sm text-muted">
                                Clocked In at: <span className="font-mono font-semibold text-ink">{todayRecord.timeIn}</span>
                              </p>
                              <button
                                onClick={() => {
                                  if (confirm("Are you sure you want to Clock Out?")) {
                                    clockOut(user.id);
                                  }
                                }}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-sm transition-all duration-200 hover:shadow cursor-pointer text-sm"
                              >
                                Clock Out of Shift
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="space-y-4 w-full">
                          <p className="text-sm text-muted">You are currently off duty.</p>
                          <button
                            onClick={() => {
                              if (confirm("Are you sure you want to Clock In now?")) {
                                clockIn(user.id, user.name);
                              }
                            }}
                            className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-sm transition-all duration-200 hover:shadow cursor-pointer text-sm"
                          >
                            Clock In for Shift
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Personal History Logs */}
                <AdminPanel
                  title="My Attendance History"
                  subtitle="Your personal clock-in and clock-out database logs"
                >
                  <div className="overflow-x-auto p-2">
                    <table className="w-full text-left text-sm min-w-[700px]">
                      <thead>
                        <tr className="admin-table-head text-muted border-b border-accent/10">
                          <th className="px-4 py-3 font-medium rounded-l-lg">Date</th>
                          <th className="px-4 py-3 font-medium">Time In</th>
                          <th className="px-4 py-3 font-medium">Time Out</th>
                          <th className="px-4 py-3 font-medium">Total Hours</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="rounded-r-lg px-4 py-3 font-medium">Excuse / Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myFullHistory.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-muted">
                              No attendance records logged yet.
                            </td>
                          </tr>
                        ) : (
                          myFullHistory.map((record) => (
                            <tr key={record.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 text-ink">
                              <td className="px-4 py-3 text-muted text-xs font-semibold">{record.date}</td>
                              <td className="px-4 py-3 text-muted font-mono text-xs">{record.timeIn || "—"}</td>
                              <td className="px-4 py-3 text-muted font-mono text-xs">{record.timeOut || "—"}</td>
                              <td className="px-4 py-3 font-semibold text-xs text-ink">{record.totalHours ? `${record.totalHours} hrs` : "—"}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize border ${
                                  record.status === "Present"
                                    ? "bg-green-50 text-green-800 border-green-200"
                                    : record.status === "Late"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : record.status === "Absent"
                                    ? "bg-red-50 text-red-800 border-red-200"
                                    : "bg-blue-50 text-blue-800 border-blue-200"
                                }`}>
                                  {record.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted italic max-w-[200px] truncate" title={record.reason || ""}>
                                {record.reason || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </AdminPanel>
              </div>
            )}

            {/* Head Staff Team Monitoring View */}
            {user.role === "head_staff" && attendanceSubTab === "monitor" && (
              <div className="space-y-6">
                {/* Attendance Quick Stats */}
                <section className="grid gap-5 sm:grid-cols-4">
                  <div className="admin-stat-card rounded-2xl p-5 pl-6">
                    <p className="text-xs font-medium text-muted">Present Today</p>
                    <p className="mt-3 font-serif text-3xl font-semibold text-green-600">
                      {attendanceRecords.filter(r => r.date === todayStr && r.status === "Present").length}
                    </p>
                    <p className="text-[10px] text-muted mt-1">Clocked in on time today</p>
                  </div>
                  <div className="admin-stat-card rounded-2xl p-5 pl-6">
                    <p className="text-xs font-medium text-muted">Late Today</p>
                    <p className="mt-3 font-serif text-3xl font-semibold text-amber-600">
                      {attendanceRecords.filter(r => r.date === todayStr && r.status === "Late").length}
                    </p>
                    <p className="text-[10px] text-muted mt-1">Clocked in past 08:30 AM</p>
                  </div>
                  <div className="admin-stat-card rounded-2xl p-5 pl-6">
                    <p className="text-xs font-medium text-muted">Excused Today</p>
                    <p className="mt-3 font-serif text-3xl font-semibold text-blue-600">
                      {attendanceRecords.filter(r => r.date === todayStr && r.status === "Excused").length}
                    </p>
                    <p className="text-[10px] text-muted mt-1">Approved absences with reasons</p>
                  </div>
                  <div className="admin-stat-card rounded-2xl p-5 pl-6">
                    <p className="text-xs font-medium text-muted">Absent Today</p>
                    <p className="mt-3 font-serif text-3xl font-semibold text-red-500">
                      {activeStaff.filter(s => !attendanceRecords.some(r => r.staffId === s.id && r.date === todayStr)).length}
                    </p>
                    <p className="text-[10px] text-muted mt-1">Absent/awaiting clock-in</p>
                  </div>
                </section>

                {/* Search and Filters */}
                <div className="bg-white rounded-2xl border border-accent/10 p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-end gap-4 justify-between">
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="min-w-[200px]">
                        <AdminField label="Search Staff Member">
                          <AdminInput
                            type="text"
                            value={searchStaff}
                            onChange={(e) => setSearchStaff(e.target.value)}
                            placeholder="Search by name..."
                          />
                        </AdminField>
                      </div>
                      {viewTab === "daily" && (
                        <div className="min-w-[150px]">
                          <AdminField label="Filter Date">
                            <AdminInput
                              type="date"
                              value={filterDate}
                              onChange={(e) => setFilterDate(e.target.value)}
                            />
                          </AdminField>
                        </div>
                      )}
                      {(searchStaff || (viewTab === "daily" && filterDate)) && (
                        <button
                          onClick={() => {
                            setSearchStaff("");
                            setFilterDate("");
                          }}
                          className="mt-6 text-xs text-accent font-semibold hover:underline cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                    <AdminButton onClick={openCreateAttendance}>
                      + Record Absence or Presence
                    </AdminButton>
                  </div>
                </div>

                {/* Attendance Logs Table */}
                <AdminPanel
                  title="Attendance Records Sheet"
                  subtitle="Daily shift history database logs & aggregated periods"
                >
                  {/* Segmented View Tabs */}
                  <div className="flex gap-2 border-b border-accent/10 pb-4 mb-4 px-2">
                    <button
                      onClick={() => setViewTab("daily")}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-0 ${
                        viewTab === "daily"
                          ? "bg-[#800000]/10 text-[#800000] border-l-4 border-[#800000] shadow-sm"
                          : "text-muted hover:bg-accent-light/10"
                      }`}
                    >
                      Daily Logs
                    </button>
                    <button
                      onClick={() => setViewTab("weekly")}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-0 ${
                        viewTab === "weekly"
                          ? "bg-[#800000]/10 text-[#800000] border-l-4 border-[#800000] shadow-sm"
                          : "text-muted hover:bg-accent-light/10"
                      }`}
                    >
                      Weekly Summary
                    </button>
                    <button
                      onClick={() => setViewTab("monthly")}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-0 ${
                        viewTab === "monthly"
                          ? "bg-[#800000]/10 text-[#800000] border-l-4 border-[#800000] shadow-sm"
                          : "text-muted hover:bg-accent-light/10"
                      }`}
                    >
                      Monthly Summary
                    </button>
                  </div>

                  <div className="overflow-x-auto p-2">
                    {viewTab === "daily" && (
                      <table className="w-full text-left text-sm min-w-[800px]">
                        <thead>
                          <tr className="admin-table-head text-muted border-b border-accent/10">
                            <th className="px-4 py-3 font-medium rounded-l-lg">Staff Member</th>
                            <th className="px-4 py-3 font-medium">Position</th>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Time In</th>
                            <th className="px-4 py-3 font-medium">Time Out</th>
                            <th className="px-4 py-3 font-medium">Total Hours</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Reason</th>
                            <th className="rounded-r-lg px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filtered = attendanceRecords
                              .filter(r => {
                                const matchesSearch = r.staffName.toLowerCase().includes(searchStaff.toLowerCase());
                                const matchesDate = filterDate ? r.date === filterDate : true;
                                return matchesSearch && matchesDate;
                              })
                              .sort((a, b) => b.date.localeCompare(a.date) || a.staffName.localeCompare(b.staffName));

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={9} className="text-center py-8 text-muted">
                                    No attendance logs match the active filters.
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((record) => {
                              const staffAccount = staffAccounts.find(s => s.id === record.staffId);
                              const position = staffAccount ? (staffAccount.role === "head_staff" ? "Head Staff" : "Staff") : "Staff";
                              return (
                                <tr key={record.id} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 text-ink">
                                  <td className="px-4 py-3 font-semibold text-[#800000]">
                                    {record.staffName}
                                  </td>
                                  <td className="px-4 py-3 text-muted text-xs capitalize">{position}</td>
                                  <td className="px-4 py-3 text-muted text-xs font-medium">{record.date}</td>
                                  <td className="px-4 py-3 text-muted font-mono text-xs">{record.timeIn || "—"}</td>
                                  <td className="px-4 py-3 text-muted font-mono text-xs">{record.timeOut || "—"}</td>
                                  <td className="px-4 py-3 font-semibold text-xs text-ink">
                                    {record.totalHours ? `${record.totalHours} hrs` : "—"}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize border ${
                                      record.status === "Present"
                                        ? "bg-green-50 text-green-800 border-green-200"
                                        : record.status === "Late"
                                        ? "bg-amber-50 text-amber-800 border-amber-200"
                                        : record.status === "Absent"
                                        ? "bg-red-50 text-red-800 border-red-200"
                                        : "bg-blue-50 text-blue-800 border-blue-200"
                                    }`}>
                                      {record.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-muted italic max-w-[200px] truncate" title={record.reason || ""}>
                                    {record.reason || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        onClick={() => openEditAttendance(record)}
                                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-light transition-colors cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteAttendance(record)}
                                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    )}

                    {viewTab === "weekly" && (
                      <table className="w-full text-left text-sm min-w-[800px]">
                        <thead>
                          <tr className="admin-table-head text-muted border-b border-accent/10">
                            <th className="px-4 py-3 font-medium rounded-l-lg">Staff Member</th>
                            <th className="px-4 py-3 font-medium">Position</th>
                            <th className="px-4 py-3 font-medium">Week Period</th>
                            <th className="px-4 py-3 font-medium text-center">Present</th>
                            <th className="px-4 py-3 font-medium text-center">Late</th>
                            <th className="px-4 py-3 font-medium text-center">Excused</th>
                            <th className="px-4 py-3 font-medium text-center">Absent</th>
                            <th className="rounded-r-lg px-4 py-3 font-medium text-right">Total Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredWeeklySummaries.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="text-center py-8 text-muted">
                                No weekly summaries found.
                              </td>
                            </tr>
                          ) : (
                            filteredWeeklySummaries.map((summary) => (
                              <tr key={`${summary.staffId}_${summary.period}`} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 text-ink">
                                <td className="px-4 py-3 font-semibold text-[#800000]">
                                  {summary.staffName}
                                </td>
                                <td className="px-4 py-3 text-muted text-xs capitalize">{summary.position}</td>
                                <td className="px-4 py-3 text-muted text-xs font-mono">{summary.period}</td>
                                <td className="px-4 py-3 text-center font-bold text-green-700">{summary.presentCount}</td>
                                <td className="px-4 py-3 text-center font-bold text-amber-600">{summary.lateCount}</td>
                                <td className="px-4 py-3 text-center font-bold text-blue-600">{summary.excusedCount}</td>
                                <td className="px-4 py-3 text-center font-bold text-red-500">{summary.absentCount}</td>
                                <td className="px-4 py-3 text-right font-bold font-mono text-[#800000]">{summary.totalHours} hrs</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {viewTab === "monthly" && (
                      <table className="w-full text-left text-sm min-w-[800px]">
                        <thead>
                          <tr className="admin-table-head text-muted border-b border-accent/10">
                            <th className="px-4 py-3 font-medium rounded-l-lg">Staff Member</th>
                            <th className="px-4 py-3 font-medium">Position</th>
                            <th className="px-4 py-3 font-medium">Month</th>
                            <th className="px-4 py-3 font-medium text-center">Present</th>
                            <th className="px-4 py-3 font-medium text-center">Late</th>
                            <th className="px-4 py-3 font-medium text-center">Excused</th>
                            <th className="px-4 py-3 font-medium text-center">Absent</th>
                            <th className="rounded-r-lg px-4 py-3 font-medium text-right">Total Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMonthlySummaries.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="text-center py-8 text-muted">
                                No monthly summaries found.
                              </td>
                            </tr>
                          ) : (
                            filteredMonthlySummaries.map((summary) => (
                              <tr key={`${summary.staffId}_${summary.period}`} className="border-b border-accent/5 last:border-0 hover:bg-accent-light/10 text-ink">
                                <td className="px-4 py-3 font-semibold text-[#800000]">
                                  {summary.staffName}
                                </td>
                                <td className="px-4 py-3 text-muted text-xs capitalize">{summary.position}</td>
                                <td className="px-4 py-3 text-muted text-xs font-mono">{summary.period}</td>
                                <td className="px-4 py-3 text-center font-bold text-green-700">{summary.presentCount}</td>
                                <td className="px-4 py-3 text-center font-bold text-amber-600">{summary.lateCount}</td>
                                <td className="px-4 py-3 text-center font-bold text-blue-600">{summary.excusedCount}</td>
                                <td className="px-4 py-3 text-center font-bold text-red-500">{summary.absentCount}</td>
                                <td className="px-4 py-3 text-right font-bold font-mono text-[#800000]">{summary.totalHours} hrs</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </AdminPanel>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MANUAL LOG / EDIT ATTENDANCE MODAL */}
      <AdminModal
        open={attendanceModalOpen}
        title={editingRecord ? "Edit Attendance Record" : "Log Manual Attendance"}
        onClose={() => setAttendanceModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setAttendanceModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleAttendanceSubmit}>
              {editingRecord ? "Save Changes" : "Create Record"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="Staff Member">
            <AdminSelect
              value={attendanceForm.staffId}
              onChange={(e) => setAttendanceForm({ ...attendanceForm, staffId: e.target.value })}
              disabled={!!editingRecord}
            >
              {activeStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} (@{staff.username})
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Date">
              <AdminInput
                type="date"
                value={attendanceForm.date}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
              />
            </AdminField>
            <AdminField label="Attendance Status">
              <AdminSelect
                value={attendanceForm.status}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value as AttendanceStatus })}
              >
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
                <option value="Excused">Excused Absence</option>
              </AdminSelect>
            </AdminField>
          </div>

          {(attendanceForm.status === "Present" || attendanceForm.status === "Late") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Time In">
                <AdminInput
                  type="text"
                  value={attendanceForm.timeIn}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, timeIn: e.target.value })}
                  placeholder="e.g. 08:30 AM"
                />
              </AdminField>
              <AdminField label="Time Out (optional if currently on shift)">
                <AdminInput
                  type="text"
                  value={attendanceForm.timeOut}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, timeOut: e.target.value })}
                  placeholder="e.g. 05:30 PM"
                />
              </AdminField>
            </div>
          )}

          {attendanceForm.status === "Excused" && (
            <AdminField label="Absence Excuse Reason / Remarks">
              <AdminTextarea
                value={attendanceForm.reason}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, reason: e.target.value })}
                placeholder="e.g. Medical appointment, family leave approval"
                required
              />
            </AdminField>
          )}

          {editingRecord && (attendanceForm.status === "Present" || attendanceForm.status === "Late") && (
            <AdminField label="Total Hours Worked (override - optional)">
              <AdminInput
                type="number"
                step="0.01"
                value={attendanceForm.totalHours || ""}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, totalHours: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Leave blank for auto-calculation"
              />
            </AdminField>
          )}
        </div>
      </AdminModal>

      {/* ADD/EDIT MENU ITEM MODAL */}
      <AdminModal
        open={menuModalOpen}
        title={editingMenuItem ? "Edit Menu Item" : "Add Menu Item"}
        onClose={() => setMenuModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setMenuModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleMenuSubmit}>
              {editingMenuItem ? "Save Changes" : "Add Item"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="Item Name">
            <AdminInput
              value={menuForm.name}
              onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
              placeholder="e.g. Mocha Latte"
              required
            />
          </AdminField>
          <AdminField label="Description">
            <AdminTextarea
              value={menuForm.description}
              onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
              placeholder="e.g. Rich espresso with dark cocoa and chocolate dust."
            />
          </AdminField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Category">
              <AdminSelect
                value={menuForm.categoryId}
                onChange={(e) => setMenuForm({ ...menuForm, categoryId: e.target.value })}
              >
                {menuCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminField label="Price (PHP)">
              <AdminInput
                type="number"
                min={1}
                value={menuForm.price}
                onChange={(e) => setMenuForm({ ...menuForm, price: Number(e.target.value) })}
                required
              />
            </AdminField>
          </div>
        </div>
      </AdminModal>

      {activeChatOrder && (
        <AdminChatModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          customerName={activeChatOrder.customerName}
          orderId={activeChatOrder.orderNumber}
        />
      )}
    </div>
  );
}
