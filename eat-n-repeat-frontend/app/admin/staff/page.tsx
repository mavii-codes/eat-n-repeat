"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
  CrudActions,
} from "@/components/admin/AdminForm";
import { AdminModal } from "@/components/admin/AdminModal";
import { useAdminData } from "@/context/AdminDataContext";
import type { StaffAccount, StaffAccountInput, StaffRole } from "@/lib/admin/types";

const emptyForm: StaffAccountInput = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "staff",
  status: "active",
};

const roleLabels: Record<StaffRole, string> = {
  admin: "Admin",
  head_staff: "Head Staff",
  staff: "Staff",
};

export default function StaffPage() {
  const {
    getActiveStaffAccounts,
    addStaffAccount,
    updateStaffAccount,
    archiveStaffAccount,
  } = useAdminData();

  const staffAccounts = getActiveStaffAccounts();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [form, setForm] = useState<StaffAccountInput>(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(account: StaffAccount) {
    setEditing(account);
    setForm({
      name: account.name,
      username: account.username || "",
      email: account.email,
      password: "",
      role: account.role,
      status: account.status,
    });
    setOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.email.trim() || !form.username.trim()) return;

    const payload = { ...form };
    if (editing) {
      if (!payload.password?.trim()) {
        payload.password = editing.password;
      }
      updateStaffAccount(editing.id, payload);
    } else {
      if (!payload.password?.trim()) {
        alert("Please enter a temporary password.");
        return;
      }
      addStaffAccount(payload);
    }
    setOpen(false);
  }

  function handleArchive(account: StaffAccount) {
    if (confirm(`Archive staff account for "${account.name}"?`)) {
      archiveStaffAccount(account.id);
    }
  }

  return (
    <>
      <AdminPageHeader
        badge="Team"
        title="Staff Accounts"
        subtitle="Manage admin and staff accounts for your café."
      />

      <section className="mb-5 grid gap-5 sm:grid-cols-3">
        {(["admin", "head_staff", "staff"] as const).map((role) => (
          <div key={role} className="admin-stat-card rounded-2xl p-5 pl-6">
            <p className="text-sm font-medium text-muted">{roleLabels[role]}s</p>
            <p className="mt-3 font-serif text-3xl font-semibold text-[#800000]">
              {staffAccounts.filter((account) => account.role === role).length}
            </p>
          </div>
        ))}
      </section>

      <AdminPanel
        title="All Staff Accounts"
        subtitle={`${staffAccounts.length} account${staffAccounts.length === 1 ? "" : "s"}`}
        action={<AdminButton onClick={openCreate}>+ Add Staff</AdminButton>}
      >
        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="admin-table-head text-muted">
                <th className="rounded-l-lg px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="rounded-r-lg px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffAccounts.map((account) => (
                <tr key={account.id} className="border-b border-accent/5 last:border-0">
                  <td className="px-4 py-3 font-medium text-[#800000]">
                    {account.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    @{account.username}
                  </td>
                  <td className="px-4 py-3 text-muted">{account.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-semibold capitalize text-accent">
                      {account.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        account.status === "active"
                          ? "bg-green-100 text-green-800 ring-1 ring-green-200"
                          : "bg-gray-100 text-gray-700 ring-1 ring-gray-200"
                      }`}
                    >
                      {account.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <CrudActions
                      onEdit={() => openEdit(account)}
                      onDelete={() => handleArchive(account)}
                      deleteLabel="Archive"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <AdminModal
        open={open}
        title={editing ? "Edit Staff Account" : "Add Staff Account"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleSubmit}>
              {editing ? "Save Changes" : "Add Staff"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="Full Name">
            <AdminInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Maria Santos"
            />
          </AdminField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Username">
              <AdminInput
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                placeholder="e.g. maria.staff"
              />
            </AdminField>
            <AdminField label="Email">
              <AdminInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. maria@eatnrepeat.com"
              />
            </AdminField>
          </div>
          <AdminField label={editing ? "Change Password (leave blank to keep unchanged)" : "Temporary Password"}>
            <AdminInput
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? "••••••••" : "Temporary login password"}
            />
          </AdminField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Role">
              <AdminSelect
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as StaffRole })
                }
              >
                <option value="staff">Staff</option>
                <option value="head_staff">Head Staff</option>
                <option value="admin">Admin</option>
              </AdminSelect>
            </AdminField>
            <AdminField label="Status">
              <AdminSelect
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as "active" | "inactive",
                  })
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </AdminSelect>
            </AdminField>
          </div>
        </div>
      </AdminModal>
    </>
  );
}
