import { AdminField, AdminInput, AdminSelect, AdminButton } from "@/components/admin/AdminForm";
import type { CustomizationConfig, CustomizationOption } from "@/lib/admin/types";

export type MenuCustomizationFormProps = {
  config: CustomizationConfig;
  onChange: (config: CustomizationConfig) => void;
};

export function MenuCustomizationForm({ config, onChange }: MenuCustomizationFormProps) {
  const update = (key: keyof CustomizationConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const updateOptionList = (listKey: keyof CustomizationConfig, index: number, field: keyof CustomizationOption, value: any) => {
    const list = [...(config[listKey] as CustomizationOption[] || [])];
    list[index] = { ...list[index], [field]: value };
    update(listKey, list);
  };

  const addOption = (listKey: keyof CustomizationConfig) => {
    const list = [...(config[listKey] as CustomizationOption[] || [])];
    list.push({ name: "", price: 0 });
    update(listKey, list);
  };

  const removeOption = (listKey: keyof CustomizationConfig, index: number) => {
    const list = [...(config[listKey] as CustomizationOption[] || [])];
    list.splice(index, 1);
    update(listKey, list);
  };

  if (!config.enabled) {
    return (
      <div className="p-4 border border-dashed border-stone-300 rounded-lg text-center bg-stone-50">
        <p className="text-sm text-stone-500 mb-3">Customizations are currently disabled for this item.</p>
        <AdminButton onClick={() => update("enabled", true)}>Enable Customizations</AdminButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
        <span className="font-bold text-amber-900 text-sm">Customizations Enabled</span>
        <button
          type="button"
          onClick={() => update("enabled", false)}
          className="text-xs text-red-600 font-bold hover:underline"
        >
          Disable All
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="Enable Spice Levels?">
          <AdminSelect
            value={config.spiceLevels ? "yes" : "no"}
            onChange={(e) => update("spiceLevels", e.target.value === "yes" ? ["None", "Mild", "Medium", "Hot"] : undefined)}
          >
            <option value="no">Disabled</option>
            <option value="yes">Enabled (None, Mild, Medium, Hot)</option>
          </AdminSelect>
        </AdminField>

        <AdminField label="Enable Sugar Levels?">
          <AdminSelect
            value={config.sugarLevels ? "yes" : "no"}
            onChange={(e) => update("sugarLevels", e.target.value === "yes" ? ["0%", "25%", "50%", "75%", "100%"] : undefined)}
          >
            <option value="no">Disabled</option>
            <option value="yes">Enabled (0% - 100%)</option>
          </AdminSelect>
        </AdminField>

        <AdminField label="Enable Ice Levels?">
          <AdminSelect
            value={config.iceLevels ? "yes" : "no"}
            onChange={(e) => update("iceLevels", e.target.value === "yes" ? ["No Ice", "Less Ice", "Normal Ice", "Extra Ice"] : undefined)}
          >
            <option value="no">Disabled</option>
            <option value="yes">Enabled (No Ice - Extra Ice)</option>
          </AdminSelect>
        </AdminField>
        
        <AdminField label="Special Instructions / Notes">
          <AdminSelect
            value={config.enableSpecialInstructions ? "yes" : "no"}
            onChange={(e) => update("enableSpecialInstructions", e.target.value === "yes")}
          >
            <option value="yes">Enabled</option>
            <option value="no">Disabled</option>
          </AdminSelect>
        </AdminField>
      </div>

      {/* Dynamic Option Lists */}
      {(["drinkSizes", "riceOptions", "addons"] as const).map((listKey) => (
        <div key={listKey} className="pt-4 border-t border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-stone-700 capitalize">
              {listKey.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            <button
              type="button"
              onClick={() => addOption(listKey)}
              className="text-xs bg-stone-100 px-2 py-1 rounded font-bold hover:bg-stone-200 text-stone-700"
            >
              + Add Option
            </button>
          </div>
          
          <div className="space-y-2">
            {(!config[listKey] || config[listKey]!.length === 0) ? (
              <p className="text-xs text-stone-400 italic">No options added.</p>
            ) : (
              config[listKey]!.map((opt, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <AdminInput
                      placeholder="Name (e.g. Large)"
                      value={opt.name}
                      onChange={(e) => updateOptionList(listKey, idx, "name", e.target.value)}
                    />
                  </div>
                  <div className="w-24">
                    <AdminInput
                      type="number"
                      placeholder="+Price"
                      value={opt.price === 0 ? "" : opt.price}
                      onChange={(e) => updateOptionList(listKey, idx, "price", Number(e.target.value))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOption(listKey, idx)}
                    className="text-red-500 hover:text-red-700 font-bold px-2"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
