"use client";

import { useEffect, useState } from "react";
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
import type { DeliverySettings, ServiceArea, ServiceAreaInput } from "@/lib/admin/types";

const emptyAreaForm: ServiceAreaInput = {
  name: "",
  barangay: "",
  deliveryFee: 49,
  active: true,
};

export default function DeliverySettingsPage() {
  const {
    deliverySettings,
    serviceAreas,
    deliveryOrders,
    updateDeliverySettings,
    addServiceArea,
    updateServiceArea,
    deleteServiceArea,
  } = useAdminData();

  const [settingsForm, setSettingsForm] =
    useState<DeliverySettings>(deliverySettings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [areaForm, setAreaForm] = useState<ServiceAreaInput>(emptyAreaForm);

  useEffect(() => {
    setSettingsForm(deliverySettings);
  }, [deliverySettings]);

  function saveSettings() {
    updateDeliverySettings(settingsForm);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  function openCreateArea() {
    setEditingArea(null);
    setAreaForm({
      ...emptyAreaForm,
      deliveryFee: settingsForm.baseDeliveryFee,
    });
    setAreaModalOpen(true);
  }

  function openEditArea(area: ServiceArea) {
    setEditingArea(area);
    setAreaForm({
      name: area.name,
      barangay: area.barangay,
      deliveryFee: area.deliveryFee,
      active: area.active,
    });
    setAreaModalOpen(true);
  }

  function handleAreaSubmit() {
    if (!areaForm.name.trim() || !areaForm.barangay.trim()) return;

    if (editingArea) {
      updateServiceArea(editingArea.id, areaForm);
    } else {
      addServiceArea(areaForm);
    }
    setAreaModalOpen(false);
  }

  function handleAreaDelete(area: ServiceArea) {
    const orderCount = deliveryOrders.filter(
      (order) => order.serviceAreaId === area.id,
    ).length;

    if (orderCount > 0) {
      alert(
        `Cannot delete "${area.name}" — ${orderCount} delivery order(s) use this area.`,
      );
      return;
    }

    if (confirm(`Delete service area "${area.name}"?`)) {
      deleteServiceArea(area.id);
    }
  }

  return (
    <>
      <AdminPageHeader
        badge="Delivery"
        title="Delivery Settings"
        subtitle="Set delivery fees, coverage limits, and manage service areas for Cordova."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel title="Delivery Fees" subtitle="Default pricing rules">
          <div className="space-y-4 px-6 py-5">
            <AdminField label="Base Delivery Fee (₱)">
              <AdminInput
                type="number"
                min={0}
                value={settingsForm.baseDeliveryFee}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    baseDeliveryFee: Number(e.target.value),
                  })
                }
              />
            </AdminField>
            <AdminField label="Free Delivery Minimum Order (₱)">
              <AdminInput
                type="number"
                min={0}
                value={settingsForm.freeDeliveryMinimum}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    freeDeliveryMinimum: Number(e.target.value),
                  })
                }
              />
            </AdminField>
            <AdminField label="Max Delivery Radius (km)">
              <AdminInput
                type="number"
                min={1}
                value={settingsForm.maxDeliveryRadiusKm}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    maxDeliveryRadiusKm: Number(e.target.value),
                  })
                }
              />
            </AdminField>
          </div>
        </AdminPanel>

        <AdminPanel
          title="Service Areas"
          subtitle={`${serviceAreas.length} area${serviceAreas.length === 1 ? "" : "s"} configured`}
          action={<AdminButton onClick={openCreateArea}>+ Add Area</AdminButton>}
        >
          <div className="space-y-3 px-4 py-4">
            {serviceAreas.map((area) => (
              <div
                key={area.id}
                className="flex items-center justify-between rounded-xl border border-accent/10 bg-accent-light/40 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-[#800000]">{area.name}</p>
                  <p className="text-xs text-muted">{area.barangay}</p>
                  <p className="mt-1 text-sm font-semibold text-accent">
                    ₱{area.deliveryFee} delivery fee
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      area.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {area.active ? "Active" : "Inactive"}
                  </span>
                  <CrudActions
                    onEdit={() => openEditArea(area)}
                    onDelete={() => handleAreaDelete(area)}
                  />
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {settingsSaved && (
          <span className="text-sm font-medium text-success">
            Delivery settings saved.
          </span>
        )}
        <AdminButton onClick={saveSettings}>Save Delivery Settings</AdminButton>
      </div>

      <AdminModal
        open={areaModalOpen}
        title={editingArea ? "Edit Service Area" : "Add Service Area"}
        onClose={() => setAreaModalOpen(false)}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setAreaModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={handleAreaSubmit}>
              {editingArea ? "Save Changes" : "Add Area"}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="Area Name">
            <AdminInput
              value={areaForm.name}
              onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
              placeholder="Gabi"
            />
          </AdminField>
          <AdminField label="Barangay / Location">
            <AdminInput
              value={areaForm.barangay}
              onChange={(e) =>
                setAreaForm({ ...areaForm, barangay: e.target.value })
              }
              placeholder="Gabi, Cordova"
            />
          </AdminField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Delivery Fee (₱)">
              <AdminInput
                type="number"
                min={0}
                value={areaForm.deliveryFee}
                onChange={(e) =>
                  setAreaForm({
                    ...areaForm,
                    deliveryFee: Number(e.target.value),
                  })
                }
              />
            </AdminField>
            <AdminField label="Status">
              <AdminSelect
                value={areaForm.active ? "active" : "inactive"}
                onChange={(e) =>
                  setAreaForm({
                    ...areaForm,
                    active: e.target.value === "active",
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
