const fs = require('fs');

function patchAdminDeliverySettings() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\app\\admin\\delivery\\settings\\page.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // Normalize line endings
  content = content.replace(/\r\n/g, '\n');

  // 1. Update emptyAreaForm
  const oldEmptyArea = `const emptyAreaForm: ServiceAreaInput = {
  name: "",
  barangay: "",
  municipality: "Cordova",
  deliveryFee: 0,
  deliveryType: "FREE",
  active: true,
};`;
  const newEmptyArea = `const emptyAreaForm: ServiceAreaInput = {
  name: "",
  barangay: "",
  municipality: "Cordova",
  distanceKm: 0,
  active: true,
};`;
  if (content.includes(oldEmptyArea)) {
    content = content.replace(oldEmptyArea, newEmptyArea);
  }

  // 2. Remove force free effect
  const oldForceFree = `  // Force delivery fee to 0 if FREE is selected
  useEffect(() => {
    if (areaForm.deliveryType === "FREE" && areaForm.deliveryFee !== 0) {
      setAreaForm((prev) => ({ ...prev, deliveryFee: 0 }));
    }
  }, [areaForm.deliveryType, areaForm.deliveryFee]);`;
  content = content.replace(oldForceFree, '');

  // 3. Update openEditArea
  const oldOpenEditArea = `  function openEditArea(area: ServiceArea) {
    setEditingArea(area);
    setAreaForm({
      name: area.name,
      barangay: area.barangay,
      municipality: area.municipality || "Cordova",
      deliveryFee: area.deliveryFee,
      deliveryType: area.deliveryType || "FREE",
      active: area.active,
    });
    setAreaModalOpen(true);
  }`;
  const newOpenEditArea = `  function openEditArea(area: ServiceArea) {
    setEditingArea(area);
    setAreaForm({
      name: area.name,
      barangay: area.barangay,
      municipality: area.municipality || "Cordova",
      distanceKm: area.distanceKm || 0,
      active: area.active,
    });
    setAreaModalOpen(true);
  }`;
  if (content.includes(oldOpenEditArea)) {
    content = content.replace(oldOpenEditArea, newOpenEditArea);
  }

  // 4. Update Left Column UI (Global Delivery Rules)
  const oldGlobalRulesRegex = /<div className="space-y-6 px-6 py-5">[\s\S]*?<\/AdminPanel>\s*<AdminPanel/m;
  
  const newGlobalRules = `<div className="space-y-4 px-6 py-5">
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
          <AdminPanel`;
  
  if (content.match(oldGlobalRulesRegex)) {
    content = content.replace(oldGlobalRulesRegex, newGlobalRules);
  }

  // 5. Update Preview Card
  const oldPreviewRegex = /<AdminPanel\s*title="Delivery Rule Preview"[\s\S]*?<\/AdminPanel>/m;
  const newPreview = `<AdminPanel title="Delivery Rule Preview" subtitle="How delivery is currently calculated at checkout">
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
          </AdminPanel>`;
  if (content.match(oldPreviewRegex)) {
    content = content.replace(oldPreviewRegex, newPreview);
  }

  // 6. Update Service Areas List Item Rendering
  const oldAreaType = `area.deliveryType === "FREE" ? (`;
  const newAreaType = `area.distanceKm <= (deliverySettings.freeDeliveryRadiusKm || 0) ? (`;
  content = content.replace(oldAreaType, newAreaType);
  
  const oldAreaFreeBadge = `<span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold">Free</span>`;
  const newAreaFreeBadge = `<span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold">Free (≤ {deliverySettings.freeDeliveryRadiusKm || 0} km)</span>`;
  content = content.replace(oldAreaFreeBadge, newAreaFreeBadge);

  const oldAreaPaidBadge = `₱{area.deliveryFee.toFixed(2)}`;
  const newAreaPaidBadge = `₱{((deliverySettings.baseDeliveryFee || 0) + (area.distanceKm || 0) * (deliverySettings.perKmFee || 0)).toFixed(2)}`;
  content = content.replace(oldAreaPaidBadge, newAreaPaidBadge);

  const oldAreaSubtext = `<p className="text-[11px] text-stone-500">{area.municipality}</p>`;
  const newAreaSubtext = `<p className="text-[11px] text-stone-500">{area.municipality} • {area.distanceKm} km away</p>`;
  content = content.replace(oldAreaSubtext, newAreaSubtext); // there are multiple? no, just one in the map
  // To be safe, let's use string split and join
  content = content.split(oldAreaSubtext).join(newAreaSubtext);

  // 7. Update Admin Modal for Area Form
  const oldModalFormRegex = /<div className="grid gap-4 sm:grid-cols-2">\s*<AdminField label="Delivery Type">[\s\S]*?<\/AdminField>\s*<\/div>/m;
  const newModalForm = `<div className="grid gap-4 sm:grid-cols-1">
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
          </div>`;
  if (content.match(oldModalFormRegex)) {
    content = content.replace(oldModalFormRegex, newModalForm);
  }

  fs.writeFileSync(file, content);
  console.log('Admin Delivery Settings UI patched successfully.');
}

patchAdminDeliverySettings();
