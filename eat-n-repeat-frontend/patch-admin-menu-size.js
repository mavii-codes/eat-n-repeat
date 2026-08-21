const fs = require('fs');

function patchAdminMenu() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\app\\admin\\menu\\page.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // 1. Add size state handlers
  const oldHandlers = 'function handleSubmitForm() {';
  const newHandlers = `
  function addSize() {
    setForm(prev => ({ ...prev, sizes: [...(prev.sizes || []), { name: "", price: prev.price || 0, available: true }] }));
  }
  function updateSize(index: number, field: "name" | "price" | "available", value: any) {
    const list = [...(form.sizes || [])];
    list[index] = { ...list[index], [field]: value };
    setForm({ ...form, sizes: list });
  }
  function removeSize(index: number) {
    const list = [...(form.sizes || [])];
    list.splice(index, 1);
    setForm({ ...form, sizes: list });
  }

  function handleSubmitForm() {`;
  if (content.includes(oldHandlers) && !content.includes('function addSize()')) {
    content = content.replace(oldHandlers, newHandlers);
  }

  // 2. Add sizes to payload inside handleSubmitForm
  const oldPayloadStart = 'customizations: form.customizations,';
  const newPayloadStart = 'customizations: form.customizations,\n      sizes: form.sizes,';
  if (content.includes(oldPayloadStart) && !content.includes('sizes: form.sizes,')) {
    content = content.replace(oldPayloadStart, newPayloadStart);
  }

  // 3. Setup form init
  const oldEditInit = 'customizations: item.customizations || emptyForm.customizations,';
  const newEditInit = 'customizations: item.customizations || emptyForm.customizations,\n      sizes: item.sizes || [],';
  if (content.includes(oldEditInit) && !content.includes('sizes: item.sizes || [],')) {
    content = content.replace(oldEditInit, newEditInit);
  }

  const oldEmptyInit = 'categoryId: menuCategories[0]?.id ?? "",';
  const newEmptyInit = 'categoryId: menuCategories[0]?.id ?? "",\n      sizes: [],';
  if (content.includes(oldEmptyInit) && !content.includes('sizes: [],')) {
    content = content.replace(oldEmptyInit, newEmptyInit);
  }

  // 4. Inject Size UI
  const oldSizesInject = `<AdminField label="Category">
                <AdminSelect
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  {menuCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
            </div>`;
            
  const newSizesInject = `<AdminField label="Category">
                <AdminSelect
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  {menuCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
            </div>

            {/* SIZES MANAGEMENT */}
            <div className="p-4 bg-white rounded-xl border border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-800">Sizes & Prices</p>
                  <p className="text-[11px] text-stone-500">Add Small/Medium options. If none added, the Base Price is used.</p>
                </div>
                <AdminButton type="button" onClick={addSize} className="px-3 py-1.5 text-xs">
                  <Plus className="h-3 w-3 mr-1 inline" /> Add Size
                </AdminButton>
              </div>
              
              {form.sizes && form.sizes.length > 0 && (
                <div className="space-y-2 mt-2">
                  {form.sizes.map((size, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200">
                      <div className="flex-1 w-full">
                        <AdminInput 
                          placeholder="e.g. Medium" 
                          value={size.name} 
                          onChange={e => updateSize(idx, "name", e.target.value)} 
                        />
                      </div>
                      <div className="w-full sm:w-28">
                        <AdminInput 
                          type="number" 
                          placeholder="₱ Price" 
                          value={size.price || ""} 
                          onChange={e => updateSize(idx, "price", Number(e.target.value))} 
                        />
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-stone-600 cursor-pointer bg-white px-2 py-2 rounded-lg border border-stone-200 w-full justify-center">
                          <input 
                            type="checkbox" 
                            checked={size.available} 
                            onChange={e => updateSize(idx, "available", e.target.checked)} 
                            className="w-3.5 h-3.5 rounded text-[#B91C1C] focus:ring-[#B91C1C]"
                          />
                          Available
                        </label>
                        <button type="button" onClick={() => removeSize(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition shrink-0 border border-stone-200 bg-white">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>`;
            
  if (content.includes(oldSizesInject) && !content.includes('SIZES MANAGEMENT')) {
    content = content.replace(oldSizesInject, newSizesInject);
  }

  fs.writeFileSync(file, content);
  console.log('Admin Menu patched successfully.');
}

patchAdminMenu();
