"use client";

import { useState, useMemo } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { useAdminData } from "@/context/AdminDataContext";
import type { StaffAccount, StaffAccountInput, StaffRole } from "@/lib/admin/types";
import { useAuth } from "@/context/AuthContext";
import { Search, Eye, Edit2, Power, Trash2, MoreVertical } from "lucide-react";

const emptyForm: StaffAccountInput = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "staff",
  status: "active",
  availability: "Offline",
  contactNumber: "",
  createdAt: new Date().toISOString(),
  lastActive: "Never",
};

const roleLabels: Record<string, string> = {
  admin: "Admin (Owner)",
  staff: "Staff",
  delivery_rider: "Delivery Rider",
};

export default function StaffPage() {
  const { user } = useAuth();
  const currentUserEmail = user?.email;
  const currentRole = user?.role as StaffRole;

  const {
    getActiveStaffAccounts,
    addStaffAccount,
    updateStaffAccount,
    archiveStaffAccount,
  } = useAdminData();

  const allStaffAccounts = getActiveStaffAccounts();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [openAddEdit, setOpenAddEdit] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [viewing, setViewing] = useState<StaffAccount | null>(null);
  const [form, setForm] = useState<StaffAccountInput>(emptyForm);
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Action menu state (for mobile and desktop)
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Filter Logic
  const filteredStaff = useMemo(() => {
    return allStaffAccounts.filter((account) => {
      const matchesSearch = 
        (account.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (account.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (account.email || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === "all" || account.role === roleFilter;
      const matchesAvailability = availabilityFilter === "all" || account.availability === availabilityFilter;
      const matchesStatus = statusFilter === "all" || account.status === statusFilter;

      return matchesSearch && matchesRole && matchesAvailability && matchesStatus;
    });
  }, [allStaffAccounts, searchQuery, roleFilter, availabilityFilter, statusFilter]);

  // Summary Metrics
  const totalStaff = allStaffAccounts.length;
  const activeNowCount = allStaffAccounts.filter(s => s.availability === "Online").length;
  const onDutyCount = allStaffAccounts.filter(s => s.availability === "On Duty").length;

  const roleCounts = useMemo(() => {
    return {
      admin: allStaffAccounts.filter(s => s.role === "admin").length,
      staff: allStaffAccounts.filter(s => s.role === "staff").length,
      delivery_rider: allStaffAccounts.filter(s => s.role === "delivery_rider").length,
    };
  }, [allStaffAccounts]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setConfirmPassword("");
    setOpenAddEdit(true);
  }

  function openEdit(account: StaffAccount) {
    // Basic guard
    if (currentRole === "staff" && account.email !== currentUserEmail) {
      alert("You do not have permission to edit this account.");
      return;
    }
    setEditing(account);
    setForm({
      name: account.name,
      username: account.username || "",
      email: account.email,
      password: "",
      role: account.role,
      status: account.status,
      availability: account.availability || "Offline",
      contactNumber: account.contactNumber || "",
      createdAt: account.createdAt,
      lastActive: account.lastActive,
    });
    setConfirmPassword("");
    setOpenActionMenuId(null);
    setOpenAddEdit(true);
  }

  function handleView(account: StaffAccount) {
    setViewing(account);
    setOpenActionMenuId(null);
    setOpenDetails(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.email.trim() || !form.username.trim()) {
      alert("Please fill out Name, Username, and Email.");
      return;
    }
    
    if (form.password && form.password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    const payload = { ...form };
    
    if (editing) {
      if (editing.role === "admin" && payload.role !== "admin" && currentUserEmail !== editing.email) {
         if (currentRole !== "admin") {
           alert("You cannot change an Admin's role.");
           return;
         }
      }

      if (!payload.password?.trim()) {
        payload.password = editing.password;
      }
      updateStaffAccount(editing.id, payload);
      alert("Staff account updated successfully.");
    } else {
      if (!payload.password?.trim()) {
        alert("Please enter a temporary password.");
        return;
      }
      addStaffAccount(payload);
      alert("Staff account created successfully.");
    }
    setOpenAddEdit(false);
  }

  function handleArchive(account: StaffAccount) {
    setOpenActionMenuId(null);
    if (account.email === currentUserEmail) {
      alert("You cannot archive your own account while logged in.");
      return;
    }
    if (account.role === "admin" && currentRole !== "admin") {
      alert("You do not have permission to archive an Admin account.");
      return;
    }
    if (confirm(`Archive staff account for "${account.name}"? This staff member will no longer be able to sign in.`)) {
      archiveStaffAccount(account.id);
    }
  }

  function toggleStatus(account: StaffAccount) {
    setOpenActionMenuId(null);
    if (account.email === currentUserEmail) {
      alert("You cannot deactivate your own account while logged in.");
      return;
    }
    if (account.role === "admin" && currentRole !== "admin") {
      alert("You do not have permission to deactivate an Admin account.");
      return;
    }
    const action = account.status === "active" ? "Deactivate" : "Activate";
    if (confirm(`${action} this staff account? ${action === "Deactivate" ? "They will no longer be able to sign in." : "They will regain access to the portal."}`)) {
      updateStaffAccount(account.id, {
        ...account,
        status: account.status === "active" ? "inactive" : "active"
      });
    }
  }

  function getStatusColor(status?: string) {
    if (!status) return "bg-stone-100 text-stone-700 ring-stone-200";
    switch (status.toLowerCase()) {
      case "active":
      case "online":
      case "on duty":
        return "bg-green-100 text-green-800 ring-green-200";
      case "inactive":
      case "offline":
        return "bg-stone-100 text-stone-700 ring-stone-200";
      case "on leave":
      case "pending":
        return "bg-orange-100 text-orange-800 ring-orange-200";
      case "error":
      case "suspended":
        return "bg-red-100 text-red-800 ring-red-200";
      default:
        return "bg-stone-100 text-stone-700 ring-stone-200";
    }
  }

  return (
    <>
      <AdminPageHeader
        badge="Team"
        title="Staff Accounts"
        subtitle="Manage admin and staff accounts, availability, and roles."
      />

      {/* Summary Cards */}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="admin-stat-card rounded-2xl p-5 pl-6 flex flex-col justify-between border-l-4 border-l-[#800000]">
          <div>
            <p className="text-sm font-medium text-stone-500">Total Staff</p>
            <p className="mt-2 font-serif text-3xl font-semibold text-stone-900">
              {totalStaff}
            </p>
          </div>
          <p className="mt-4 text-[10px] text-stone-400 font-medium">
            Admin: {roleCounts.admin} &bull; Staff: {roleCounts.staff}
          </p>
        </div>
        <div className="admin-stat-card rounded-2xl p-5 pl-6 flex flex-col justify-between border-l-4 border-l-green-500">
          <div>
            <p className="text-sm font-medium text-stone-500">Active Now</p>
            <p className="mt-2 font-serif text-3xl font-semibold text-stone-900">
              {activeNowCount}
            </p>
          </div>
          <p className="mt-4 text-[10px] text-stone-400 font-medium">
            Staff currently online
          </p>
        </div>
        <div className="admin-stat-card rounded-2xl p-5 pl-6 flex flex-col justify-between border-l-4 border-l-emerald-600">
          <div>
            <p className="text-sm font-medium text-stone-500">On Duty</p>
            <p className="mt-2 font-serif text-3xl font-semibold text-stone-900">
              {onDutyCount}
            </p>
          </div>
          <p className="mt-4 text-[10px] text-stone-400 font-medium">
            Currently working
          </p>
        </div>
      </section>

      {/* Filters & Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search Name, Username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#800000] focus:ring-1 focus:ring-[#800000] transition-colors shadow-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar w-full sm:w-auto">
            <select 
              value={roleFilter} 
              onChange={e => setRoleFilter(e.target.value as any)}
              className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:border-[#800000] min-w-[120px]"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="delivery_rider">Delivery Rider</option>
            </select>
            <select 
              value={availabilityFilter} 
              onChange={e => setAvailabilityFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:border-[#800000] min-w-[140px]"
            >
              <option value="all">All Availability</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="On Duty">On Duty</option>
              <option value="Off Duty">Off Duty</option>
              <option value="On Leave">On Leave</option>
            </select>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:border-[#800000] min-w-[110px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="w-full sm:w-auto shrink-0 shadow-sm">
          <AdminButton onClick={openCreate}>+ Add Staff</AdminButton>
        </div>
      </div>

      <AdminPanel
        title="Staff Directory"
        subtitle={`${filteredStaff.length} matching account${filteredStaff.length === 1 ? "" : "s"}`}
      >
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto px-2 pb-2">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-stone-500 border-b border-stone-200">
                <th className="rounded-tl-xl px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Availability</th>
                <th className="px-4 py-3 font-medium">Account Status</th>
                <th className="px-4 py-3 font-medium">Last Active</th>
                <th className="rounded-tr-xl px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((account) => (
                <tr key={account.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#800000]">{account.name}</span>
                      <a href={`mailto:${account.email}`} className="text-xs text-stone-400 hover:text-[#800000] hover:underline">{account.email}</a>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    @{account.username}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-stone-700">
                      {roleLabels[account.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 ${getStatusColor(account.availability)}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                      {account.availability}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 ${getStatusColor(account.status)}`}>
                      {account.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 font-medium">
                    {account.lastActive || "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block text-left">
                      <button 
                        onClick={() => setOpenActionMenuId(openActionMenuId === account.id ? null : account.id)}
                        className="p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#800000] focus:ring-offset-1"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {openActionMenuId === account.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenActionMenuId(null)}></div>
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-stone-200 rounded-xl shadow-xl z-20 overflow-hidden text-left py-1 animate-in fade-in zoom-in-95 duration-100">
                            <button onClick={() => handleView(account)} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-[#800000] flex items-center gap-2">
                              <Eye className="w-3.5 h-3.5" /> View Details
                            </button>
                            <button onClick={() => openEdit(account)} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-[#800000] flex items-center gap-2">
                              <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                            </button>
                            
                            <div className="h-px bg-stone-100 my-1"></div>
                            
                            <button onClick={() => toggleStatus(account)} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                              <Power className="w-3.5 h-3.5" /> {account.status === "active" ? "Deactivate" : "Activate"}
                            </button>
                            <button onClick={() => handleArchive(account)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                              <Trash2 className="w-3.5 h-3.5" /> Archive Account
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                    No staff accounts match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden flex flex-col gap-3 p-3">
          {filteredStaff.map((account) => (
            <div key={account.id} className="bg-white border border-stone-100 rounded-xl p-4 shadow-sm relative group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-[#800000] leading-tight">{account.name}</h4>
                  <p className="text-xs text-stone-500 font-mono mt-0.5">@{account.username}</p>
                </div>
                
                <div className="relative">
                  <button 
                    onClick={() => setOpenActionMenuId(openActionMenuId === account.id ? null : account.id)}
                    className="p-1.5 text-stone-400 bg-stone-50 hover:bg-stone-100 rounded-md transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openActionMenuId === account.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenActionMenuId(null)}></div>
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-stone-200 rounded-xl shadow-xl z-20 overflow-hidden text-left py-1">
                        <button onClick={() => handleView(account)} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                           <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button onClick={() => openEdit(account)} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                           <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <div className="h-px bg-stone-100 my-1"></div>
                        <button onClick={() => toggleStatus(account)} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                           <Power className="w-3.5 h-3.5" /> {account.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => handleArchive(account)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                           <Trash2 className="w-3.5 h-3.5" /> Archive
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mt-3">
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Role</p>
                  <p className="font-medium text-stone-700 text-xs">{roleLabels[account.role]}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Status</p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ${getStatusColor(account.status)}`}>
                    {account.status}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-stone-100 flex justify-between items-center">
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${getStatusColor(account.availability)}`}>
                    <span className="w-1 h-1 rounded-full bg-current opacity-70"></span>
                    {account.availability}
                  </span>
                  <span className="text-[10px] text-stone-400 font-medium">Last active: {account.lastActive || "Never"}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredStaff.length === 0 && (
            <div className="p-8 text-center text-sm text-stone-500 bg-stone-50 rounded-xl border border-stone-100">
              No staff accounts match your filters.
            </div>
          )}
        </div>
      </AdminPanel>

      {/* Add / Edit Modal */}
      <AdminModal
        open={openAddEdit}
        title={editing ? "Edit Staff Account" : "Add Staff Account"}
        onClose={() => setOpenAddEdit(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setOpenAddEdit(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSubmit}>
              {editing ? "Save Changes" : "Create Account"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1 hide-scrollbar">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Full Name *">
              <AdminInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Maria Santos"
              />
            </AdminField>
            <AdminField label="Username *">
              <AdminInput
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                placeholder="e.g. maria.staff"
              />
            </AdminField>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Email Address *">
              <AdminInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. maria@eatnrepeat.com"
              />
            </AdminField>
            <AdminField label="Contact Number">
              <AdminInput
                value={form.contactNumber || ""}
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                placeholder="+63 9XX XXX XXXX"
              />
            </AdminField>
          </div>
          
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-stone-700">Authentication</h4>

            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label={editing ? "New Password (Optional)" : "Temporary Password *"}>
                <AdminInput
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? "Leave blank to keep unchanged" : "Set initial password"}
                />
              </AdminField>
              <AdminField label="Confirm Password">
                <AdminInput
                  type="text"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </AdminField>
            </div>
            {!editing && (
              <p className="text-[10px] text-stone-500">
                Staff will use this password for their first login.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Role">
              <AdminSelect
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as StaffRole })
                }
              >
                <option value="staff">Staff</option>
                {/* Prevent normal staff from creating admins */}
                {(currentRole === "admin" || editing?.role === "admin") && (
                  <option value="admin">Admin / Owner</option>
                )}
              </AdminSelect>
            </AdminField>
            <AdminField label="Account Status">
              <AdminSelect
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as "active" | "inactive",
                  })
                }
              >
                <option value="active">Active (Enabled)</option>
                <option value="inactive">Inactive (Disabled)</option>
              </AdminSelect>
            </AdminField>
          </div>
        </div>
      </AdminModal>

      {/* Staff Details Modal */}
      <AdminModal
        open={openDetails}
        title="Staff Profile"
        onClose={() => setOpenDetails(false)}
        footer={
          <AdminButton variant="secondary" onClick={() => setOpenDetails(false)}>
            Close
          </AdminButton>
        }
      >
        {viewing && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#800000]">{viewing.name}</h3>
                <p className="text-sm font-mono text-stone-500 mt-1">@{viewing.username}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${getStatusColor(viewing.availability)}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                {viewing.availability}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-stone-50 rounded-xl p-4 border border-stone-100">
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mb-1">Email</p>
                <a href={`mailto:${viewing.email}`} className="text-sm font-medium text-stone-700 hover:text-[#800000]">{viewing.email}</a>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mb-1">Contact Number</p>
                <p className="text-sm font-medium text-stone-700">{viewing.contactNumber || "Not provided"}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mb-1">Role</p>
                <p className="text-sm font-medium text-stone-700">{roleLabels[viewing.role]}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mb-1">Account Status</p>
                <p className="text-sm font-medium text-stone-700 capitalize">{viewing.status}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-stone-700 mb-3 border-b border-stone-100 pb-2">Activity Timeline</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-stone-600">Last login</p>
                  <p className="text-xs text-stone-400">{viewing.lastActive || "Never logged in"}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-stone-600">Date created</p>
                  <p className="text-xs text-stone-400">
                    {viewing.createdAt ? new Date(viewing.createdAt).toLocaleDateString() : "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminModal>
    </>
  );
}
