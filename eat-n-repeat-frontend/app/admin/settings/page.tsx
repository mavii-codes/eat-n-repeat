"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
} from "@/components/admin/AdminForm";
import { useAdminData } from "@/context/AdminDataContext";
import { useAuth } from "@/context/AuthContext";
import type { SystemSettings } from "@/lib/admin/types";

export default function SettingsPage() {
  const { systemSettings, updateSystemSettings } = useAdminData();
  const { user, changePassword } = useAuth();
  const [form, setForm] = useState<SystemSettings>(systemSettings);
  const [saved, setSaved] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmNewPwd, setConfirmNewPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm(systemSettings);
  }, [systemSettings]);

  function handleChange<K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    updateSystemSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handlePasswordChange(e: React.FormEvent) {
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

  return (
    <>
      <AdminPageHeader
        badge="System"
        title="System Settings"
        subtitle="Configure café details, operating hours, tax, and notification preferences."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel title="Café Information" subtitle="Business profile">
          <div className="space-y-4 px-6 py-5">
            <AdminField label="Café Name">
              <AdminInput
                value={form.cafeName}
                onChange={(e) => handleChange("cafeName", e.target.value)}
              />
            </AdminField>
            <AdminField label="Branch">
              <AdminInput
                value={form.branch}
                onChange={(e) => handleChange("branch", e.target.value)}
              />
            </AdminField>
            <AdminField label="Address">
              <AdminInput
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </AdminField>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Phone">
                <AdminInput
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </AdminField>
              <AdminField label="Email">
                <AdminInput
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </AdminField>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel title="Operations" subtitle="Hours, tax & alerts">
          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Opening Time">
                <AdminInput
                  type="time"
                  value={form.openingTime}
                  onChange={(e) => handleChange("openingTime", e.target.value)}
                />
              </AdminField>
              <AdminField label="Closing Time">
                <AdminInput
                  type="time"
                  value={form.closingTime}
                  onChange={(e) => handleChange("closingTime", e.target.value)}
                />
              </AdminField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Currency">
                <AdminSelect
                  value={form.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                >
                  <option value="PHP">PHP (₱)</option>
                  <option value="USD">USD ($)</option>
                </AdminSelect>
              </AdminField>
              <AdminField label="Tax Rate (%)">
                <AdminInput
                  type="number"
                  min={0}
                  max={100}
                  value={form.taxRate}
                  onChange={(e) =>
                    handleChange("taxRate", Number(e.target.value))
                  }
                />
              </AdminField>
            </div>
            <AdminField label="Low Stock Alerts">
              <AdminSelect
                value={form.lowStockAlerts ? "on" : "off"}
                onChange={(e) =>
                  handleChange("lowStockAlerts", e.target.value === "on")
                }
              >
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </AdminSelect>
            </AdminField>
            <AdminField label="Order Notifications">
              <AdminSelect
                value={form.orderNotifications ? "on" : "off"}
                onChange={(e) =>
                  handleChange("orderNotifications", e.target.value === "on")
                }
              >
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </AdminSelect>
            </AdminField>
          </div>
        </AdminPanel>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm font-medium text-success">
            Settings saved successfully.
          </span>
        )}
        <AdminButton onClick={handleSave}>Save Settings</AdminButton>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2 border-t border-accent/10 pt-8">
        <AdminPanel title="Security Settings" subtitle="Change account password">
          <form onSubmit={handlePasswordChange} className="space-y-4 px-6 py-5">
            {pwdError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
                {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold text-green-800">
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
    </>
  );
}
