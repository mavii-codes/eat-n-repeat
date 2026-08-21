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
import { Truck, MapPin, CheckCircle, Info, ShieldCheck } from "lucide-react";

const emptyAreaForm: ServiceAreaInput = {
  name: "",
  barangay: "",
  municipality: "Cordova",
  distanceKm: 0,
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
    archiveServiceArea,
    restoreServiceArea,
  } = useAdminData();

  const [settingsForm, setSettingsForm] = useState<DeliverySettings>(deliverySettings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [areaForm, setAreaForm] = useState<ServiceAreaInput>(emptyAreaForm);
  
  // Modal State
  const [modalAction, setModalAction] = useState<'archive' | 'permanent_delete' | null>(null);
  const [areaToDelete, setAreaToDelete] = useState<ServiceArea | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const activeAreas = serviceAreas.filter(a => !a.archived);
  const archivedAreas = serviceAreas.filter(a => a.archived);

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
    setAreaForm({ ...emptyAreaForm });
    setAreaModalOpen(true);
  }

  function openEditArea(area: ServiceArea) {
    setEditingArea(area);
    setAreaForm({
      name: area.name,
      barangay: area.barangay,
      municipality: area.municipality || "Cordova",
      distanceKm: area.distanceKm || 0,
      active: area.active,
    });
    setAreaModalOpen(true);
  }

  function handleAreaSubmit() {
    if (!areaForm.name.trim() || !areaForm.barangay.trim() || !areaForm.municipality.trim()) return;

    if (editingArea) {
      updateServiceArea(editingArea.id, areaForm);
    } else {
      addServiceArea(areaForm);
    }
    setAreaModalOpen(false);
  }

  function handleAreaDelete(area: ServiceArea) {
    setAreaToDelete(area);
    setModalAction('archive');
  }

  function handlePermanentDeletePrompt(area: ServiceArea) {
    const orderCount = deliveryOrders.filter((order) => order.serviceAreaId === area.id).length;
    if (orderCount > 0) {
      alert(`Cannot permanently delete "${area.name}" because it is linked to ${orderCount} past order(s).`);
      return;
    }
    setAreaToDelete(area);
    setModalAction('permanent_delete');
  }

  function confirmAction() {
    if (!areaToDelete || !modalAction) return;
    setIsDeleting(true);

    setTimeout(() => {
      if (modalAction === 'archive') {
        archiveServiceArea(areaToDelete.id);
        setSuccessMessage(`"${areaToDelete.name}" has been moved to Archived Service Areas.`);
      } else if (modalAction === 'permanent_delete') {
        deleteServiceArea(areaToDelete.id);
        setSuccessMessage(`"${areaToDelete.name}" has been permanently deleted.`);
      }
      setIsDeleting(false);
      setModalAction(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    }, 600);
  }

  function handleRestoreArea(area: ServiceArea) {
    restoreServiceArea(area.id);
    setSuccessMessage(`"${area.name}" has been restored to active service areas.`);
    setTimeout(() => setSuccessMessage(''), 3000);
  }

  return (
    <>
      <AdminPageHeader
        badge="Delivery"
        title="Delivery Settings"
        subtitle="Configure location-based delivery pricing and manage supported areas."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <AdminPanel title="Global Delivery Rules" subtitle="System-wide defaults">
            <div className="space-y-4 px-6 py-5">
              <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                <div>
                  <p className="text-sm font-bold text-stone-800">Enable Delivery System</p>
                  <p className="text-xs text-stone-500">Allow customers to place delivery orders online.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={settingsForm.deliveryEnabled || false} onChange={e => setSettingsForm({...settingsForm, deliveryEnabled: e.target.checked})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <AdminField label="Café Location (Origin)">
                <AdminInput value={settingsForm.cafeLocation || ''} onChange={(e) => setSettingsForm({...settingsForm, cafeLocation: e.target.value})} placeholder="e.g. Cordova, Cebu" />
              </AdminField>

              <div className="grid grid-cols-2 gap-4">
                <AdminField label="Free Delivery Radius (km)">
                  <AdminInput type="number" min={0} step={0.1} value={settingsForm.freeDeliveryRadiusKm || 0} onChange={(e) => setSettingsForm({...settingsForm, freeDeliveryRadiusKm: Number(e.target.value)})} />
                </AdminField>
                <AdminField label="Maximum Radius (km)">
                  <AdminInput type="number" min={1} step={0.1} value={settingsForm.maxDeliveryRadiusKm || 0} onChange={(e) => setSettingsForm({...settingsForm, maxDeliveryRadiusKm: Number(e.target.value)})} />
                </AdminField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <AdminField label="Base Delivery Fee (₱)">
                  <AdminInput type="number" min={0} value={settingsForm.baseDeliveryFee || 0} onChange={(e) => setSettingsForm({...settingsForm, baseDeliveryFee: Number(e.target.value)})} />
                </AdminField>
                <AdminField label="Additional Per-km Fee (₱)">
                  <AdminInput type="number" min={0} value={settingsForm.perKmFee || 0} onChange={(e) => setSettingsForm({...settingsForm, perKmFee: Number(e.target.value)})} />
                </AdminField>
              </div>
              
              <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
                <div>
                  {settingsSaved && (
                    <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 animate-in fade-in zoom-in duration-300">
                      <CheckCircle className="w-4 h-4" /> Settings Saved!
                    </span>
                  )}
                </div>
                <button
                  onClick={saveSettings}
                  className="px-5 py-2.5 bg-[#800000] hover:bg-[#5a0000] text-white font-bold rounded-xl shadow-md transition active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </AdminPanel>
          <AdminPanel title="Delivery Rule Preview" subtitle="How delivery is currently calculated at checkout">
            <div className="p-6 bg-stone-50 rounded-b-2xl border-t border-stone-200">
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-emerald-100 p-1.5 rounded-full text-emerald-600"><ShieldCheck className="w-5 h-5" /></div>
                  <div>
                    <h4 className="font-bold text-sm text-stone-900">Within {settingsForm.freeDeliveryRadiusKm || 0} km</h4>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mt-0.5">FREE DELIVERY</p>
                    <p className="text-[11px] text-stone-500 mt-1">Service Areas with distance ≤ {settingsForm.freeDeliveryRadiusKm || 0} km get free delivery automatically.</p>
                  </div>
                </div>
                <div className="border-t border-stone-100 pt-4 flex items-start gap-3">
                  <div className="mt-1 bg-amber-100 p-1.5 rounded-full text-amber-600"><Truck className="w-5 h-5" /></div>
                  <div>
                    <h4 className="font-bold text-sm text-stone-900">Beyond {settingsForm.freeDeliveryRadiusKm || 0} km</h4>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mt-0.5">DISTANCE-BASED FEE</p>
                    <p className="text-[11px] text-stone-500 mt-1">Fee = ₱{settingsForm.baseDeliveryFee || 0} Base + (Distance × ₱{settingsForm.perKmFee || 0}/km).</p>
                  </div>
                </div>
              </div>
            </div>
          </AdminPanel>
        </div>

        {/* Right Column */}
        <div>
          <AdminPanel
            title="Service Areas"
            subtitle={`${activeAreas.length} active delivery zone${activeAreas.length === 1 ? "" : "s"}`}
            action={
              <button 
                onClick={openCreateArea}
                className="px-3 py-1.5 bg-rose-50 text-[#800000] font-bold text-xs rounded-lg border border-rose-200 hover:bg-rose-100 transition"
              >
                + Add Area
              </button>
            }
          >
            <div className="space-y-3 px-4 py-4 bg-stone-50/50 rounded-b-2xl">
              {successMessage && (
                <div className="p-3 mb-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm font-medium animate-in fade-in zoom-in duration-300">
                  <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
                  <p>{successMessage}</p>
                </div>
              )}
              {activeAreas.length === 0 ? (
                <div className="text-center py-8 text-stone-500">
                  <MapPin className="w-10 h-10 mx-auto opacity-20 mb-2" />
                  <p className="text-sm font-medium">No custom service areas found.</p>
                </div>
              ) : (
                activeAreas.map((area) => (
                  <div
                    key={area.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${area.active ? (area.distanceKm <= (deliverySettings.freeDeliveryRadiusKm || 0) ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-stone-300'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-stone-900 text-sm">
                            {area.name}
                          </p>
                          {area.distanceKm <= (deliverySettings.freeDeliveryRadiusKm || 0) ? (
                             <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold border border-emerald-200">
                               FREE DELIVERY
                             </span>
                          ) : (
                             <span className="text-[9px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-md font-bold border border-stone-200">
                               PAID DELIVERY
                             </span>
                          )}
                          {!area.active && (
                            <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md font-bold border border-rose-200">
                              INACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {area.barangay}, {area.municipality} • {area.distanceKm} km
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pl-5 sm:pl-0 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#800000]">
                          {area.distanceKm <= (deliverySettings.freeDeliveryRadiusKm || 0) 
                            ? 'FREE' 
                            : '₱' + ((deliverySettings.baseDeliveryFee || 0) + (area.distanceKm || 0) * (deliverySettings.perKmFee || 0)).toFixed(2)}
                        </p>
                      </div>
                      <CrudActions
                        onEdit={() => openEditArea(area)}
                        onDelete={() => handleAreaDelete(area)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </AdminPanel>
          
          {archivedAreas.length > 0 && (
            <div className="mt-6">
              <AdminPanel title="Archived Service Areas" subtitle="Inactive zones">
                <div className="space-y-3 px-4 py-4 bg-stone-50/50 rounded-b-2xl opacity-80">
                  {archivedAreas.map((area) => (
                    <div
                      key={area.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 bg-stone-300" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-stone-900 text-sm line-through text-opacity-50">
                              {area.name}
                            </p>
                            <span className="text-[9px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-md font-bold border border-stone-200">
                              ARCHIVED
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {area.barangay}, {area.municipality} • {area.distanceKm} km
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-5 sm:pl-0 shrink-0">
                        <button
                          onClick={() => handleRestoreArea(area)}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg hover:bg-emerald-100 transition whitespace-nowrap"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => handlePermanentDeletePrompt(area)}
                          className="px-3 py-1.5 bg-rose-50 text-rose-700 font-bold text-xs rounded-lg hover:bg-rose-100 transition whitespace-nowrap"
                        >
                          Permanently Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </AdminPanel>
            </div>
          )}
        </div>
      </div>

      <AdminModal
        open={areaModalOpen}
        title={editingArea ? "Edit Service Area" : "Add Service Area"}
        onClose={() => setAreaModalOpen(false)}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button 
              type="button" 
              onClick={() => setAreaModalOpen(false)}
              className="px-4 py-2 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleAreaSubmit}
              className="px-4 py-2 text-sm font-bold text-white bg-[#800000] hover:bg-[#5a0000] rounded-xl shadow-md transition"
            >
              {editingArea ? "Save Changes" : "Add Area"}
            </button>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Barangay / Area Name">
              <AdminInput
                value={areaForm.barangay}
                onChange={(e) =>
                  setAreaForm({ ...areaForm, barangay: e.target.value, name: e.target.value })
                }
                placeholder="e.g. Gabi"
              />
            </AdminField>
            <AdminField label="City / Municipality">
              <AdminInput
                value={areaForm.municipality}
                onChange={(e) =>
                  setAreaForm({ ...areaForm, municipality: e.target.value })
                }
                placeholder="e.g. Cordova"
              />
            </AdminField>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-1">
            <AdminField label="Distance from Café (km)">
              <AdminInput
                type="number"
                min={0}
                step={0.1}
                value={areaForm.distanceKm || 0}
                onChange={(e) =>
                  setAreaForm({ ...areaForm, distanceKm: Number(e.target.value) })
                }
              />
            </AdminField>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex gap-3 text-blue-800 text-xs font-medium leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
            <p>If Distance ≤ {deliverySettings.freeDeliveryRadiusKm || 0} km (Free Radius), the system will automatically make this area FREE. Otherwise, it will calculate the fee based on the Base Fee + Per-Km rate.</p>
          </div>
          
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
      </AdminModal>

      {/* Archive/Delete Confirmation Modal */}
      <AdminModal
        open={modalAction !== null}
        onClose={() => !isDeleting && setModalAction(null)}
        title={modalAction === 'archive' ? 'Archive Service Area?' : 'Delete Service Area?'}
        footer={
          areaToDelete ? (
            <div className="flex justify-end gap-3 w-full">
              <button
                onClick={() => setModalAction(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-stone-100 text-stone-700 font-bold text-sm rounded-xl hover:bg-stone-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={isDeleting}
                className="px-4 py-2 bg-[#800000] text-white font-bold text-sm rounded-xl hover:bg-[#5a0000] transition disabled:opacity-50 flex items-center justify-center min-w-[130px] shadow-sm"
              >
                {isDeleting ? "Processing..." : modalAction === 'archive' ? "Archive Area" : "Delete"}
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="p-5 space-y-4">
          {areaToDelete && modalAction === 'archive' && (
            <p className="text-stone-700 text-sm leading-relaxed">
              Are you sure you want to archive <strong>{areaToDelete.name}</strong>?
              <br/><br/>
              It will no longer be available for new delivery orders, but its historical order records will be preserved.
            </p>
          )}
          {areaToDelete && modalAction === 'permanent_delete' && (
            <p className="text-stone-700 text-sm leading-relaxed">
              Are you absolutely sure you want to permanently delete <strong>{areaToDelete.name}</strong>?
              <br/><br/>
              This action cannot be undone.
            </p>
          )}
        </div>
      </AdminModal>
    </>
  );
}
