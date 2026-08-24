const fs = require('fs');
const path = 'c:/Eat n RepEat Cafe/eat-n-repeat-frontend/components/admin/InventoryTab.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Table headers width adjustments
content = content.replace(
  /<th className="px-6 py-4 font-bold">Ingredient<\/th>/,
  '<th className="px-6 py-4 font-bold w-[22%] min-w-[180px]">Ingredient</th>'
);
content = content.replace(
  /<th className="px-4 py-4 font-bold">Category<\/th>/,
  '<th className="px-4 py-4 font-bold w-[15%]">Category</th>'
);
content = content.replace(
  /<th className="px-4 py-4 font-bold w-48">Remaining Quantity<\/th>/,
  '<th className="px-4 py-4 font-bold w-[20%]">Remaining Quantity</th>'
);
content = content.replace(
  /<th className="px-4 py-4 font-bold">Status<\/th>/,
  '<th className="px-4 py-4 font-bold w-[15%]">Status</th>'
);
content = content.replace(
  /<th className="px-4 py-4 font-bold">Alert Threshold<\/th>/,
  '<th className="px-4 py-4 font-bold w-[13%]">Alert Threshold</th>'
);
content = content.replace(
  /<th className="px-6 py-4 font-bold text-right">Action<\/th>/,
  '<th className="px-6 py-4 font-bold text-right w-[15%]">Action</th>'
);

// 2. Adjust table layout
content = content.replace(
  /<table className="w-full text-left text-sm">/,
  '<table className="w-full text-left text-sm table-fixed">'
);

// 3. Adjust td tags for vertical centering
// Replace specific td classes
content = content.replace(
  /<td className="px-6 py-4">/g,
  '<td className="px-6 py-4 align-middle">'
);
content = content.replace(
  /<td className="px-4 py-4">/g,
  '<td className="px-4 py-4 align-middle">'
);
content = content.replace(
  /<td className="px-4 py-4 text-xs font-bold text-\[\#817875\]">/g,
  '<td className="px-4 py-4 align-middle text-xs font-bold text-[#817875]">'
);
content = content.replace(
  /<td className="px-6 py-4 text-right">/g,
  '<td className="px-6 py-4 align-middle text-right">'
);

// 4. Adjust wrapping for Ingredient Name
content = content.replace(
  /<h3 className="font-bold text-\[\#5A1824\] text-sm">\{item\.name\}<\/h3>/g,
  '<h3 className="font-bold text-[#5A1824] text-sm break-words whitespace-normal">{item.name}</h3>'
);

// 5. Adjust Remaining Quantity
content = content.replace(
  /<div className="flex flex-col gap-1\.5 pr-4">/g,
  '<div className="flex flex-col gap-1.5 pr-4 w-11/12">'
);

// 6. Adjust Status Badge dimensions
content = content.replace(
  /className=\{`inline-flex items-center gap-1\.5 rounded-full px-2\.5 py-1 text-\[10px\] font-black uppercase tracking-wider border \$\{status\.bg\} \$\{status\.color\} \$\{status\.border\}`\}/g,
  'className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border w-24 ${status.bg} ${status.color} ${status.border}`}'
);

// 7. Adjust Contact Admin Button dimensions
content = content.replace(
  /className="inline-flex items-center gap-1\.5 px-3 py-1\.5 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-50 hover:text-\[\#5A1824\] hover:border-\[\#5A1824\]\/20 transition-colors shadow-sm"/g,
  'className="inline-flex items-center justify-center gap-1.5 w-32 px-3 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-50 hover:text-[#5A1824] hover:border-[#5A1824]/20 transition-colors shadow-sm"'
);

// 8. Empty state indicator for action
content = content.replace(
  /<span className="text-\[\#817875\] font-black">—<\/span>/g,
  '<div className="w-32 inline-flex justify-center text-[#817875] font-black">—</div>'
);

// Mobile View button adjustments (Contact Admin) just to be safe it's consistent
content = content.replace(
  /className="mt-3 w-full flex items-center justify-center gap-2 py-2\.5 px-4 bg-white border border-stone-200 text-stone-700 rounded-xl text-sm font-bold hover:bg-stone-50 transition-colors shadow-sm"/g,
  'className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-stone-200 text-stone-700 rounded-xl text-sm font-bold hover:bg-stone-50 transition-colors shadow-sm"'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully patched Inventory Ledger styling');
