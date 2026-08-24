const fs = require('fs');

const filePath = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/app/staff/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add menuFormError state
if (!content.includes('menuFormError')) {
    content = content.replace(
        'const [menuForm, setMenuForm] = useState<MenuItemInput>({\n    name: "",\n    description: "",\n    price: 0,\n    categoryId: menuCategories[0]?.id || "",\n    available: true,\n    image: "",\n  });',
        'const [menuForm, setMenuForm] = useState<MenuItemInput>({\n    name: "",\n    description: "",\n    price: 0,\n    categoryId: menuCategories[0]?.id || "",\n    available: true,\n    image: "",\n  });\n  const [menuFormError, setMenuFormError] = useState<string | null>(null);'
    );
}

// 2. Update openAddMenu to clear error
content = content.replace(
    /function openAddMenu\(\) \{([\s\S]*?)\}/,
    (match, body) => {
        if (!body.includes('setMenuFormError')) {
            return match.replace('setEditingMenuItem(null);', 'setEditingMenuItem(null);\n    setMenuFormError(null);');
        }
        return match;
    }
);

// 3. Update openEditMenu to clear error
content = content.replace(
    /function openEditMenu\(item: MenuItem\) \{([\s\S]*?)\}/,
    (match, body) => {
        if (!body.includes('setMenuFormError')) {
            return match.replace('setEditingMenuItem(item);', 'setEditingMenuItem(item);\n    setMenuFormError(null);');
        }
        return match;
    }
);

// 4. Update handleMenuSubmit with validation
const oldSubmit = `  // Submit Menu Item Form
  function handleMenuSubmit() {
    if (!menuForm.name.trim() || menuForm.price <= 0) return;

    if (editingMenuItem) {
      updateMenuItem(editingMenuItem.id, menuForm);
    } else {
      addMenuItem(menuForm);
    }
    setMenuModalOpen(false);
  }`;

const newSubmit = `  // Submit Menu Item Form
  function handleMenuSubmit() {
    setMenuFormError(null);
    if (!menuForm.name.trim()) {
      setMenuFormError("Item name is required.");
      return;
    }
    if (!menuForm.categoryId) {
      setMenuFormError("Category is required.");
      return;
    }
    if (menuForm.price <= 0 || isNaN(menuForm.price)) {
      setMenuFormError("Please enter a valid price greater than 0.");
      return;
    }

    if (editingMenuItem) {
      updateMenuItem(editingMenuItem.id, menuForm);
    } else {
      addMenuItem(menuForm);
    }
    setMenuModalOpen(false);
  }`;

content = content.replace(oldSubmit, newSubmit);

// 5. Update the Modal content to show the error
const oldModalContent = `<div className="space-y-4">
          <AdminField label="Item Name">`;
const newModalContent = `<div className="space-y-4">
          {menuFormError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 border border-red-200 flex items-center gap-2 shadow-sm">
              <AlertTriangle className="h-4 w-4" /> {menuFormError}
            </div>
          )}
          <AdminField label="Item Name">`;

content = content.replace(oldModalContent, newModalContent);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Patched modal validation");
