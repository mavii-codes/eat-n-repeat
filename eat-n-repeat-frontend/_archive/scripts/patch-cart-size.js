const fs = require('fs');

function patchCart() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\components\\customer\\CartDrawer.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // Normalize line endings for reliable replacement
  content = content.replace(/\r\n/g, '\n');

  // 1. Update CartItem interface safely
  if (!content.includes('selectedSize?: { name: string; price: number };')) {
    content = content.replace(
      'notes?: string;\n};',
      'notes?: string;\n  selectedSize?: { name: string; price: number };\n};'
    );
  }

  // 2. Update subtotal calculation
  const oldSubtotal = 'const subtotal = cartItems.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);';
  const newSubtotal = 'const subtotal = cartItems.reduce((acc, item) => acc + (item.selectedSize ? item.selectedSize.price : item.menuItem.price) * item.quantity, 0);';
  if (content.includes(oldSubtotal)) {
    content = content.replace(oldSubtotal, newSubtotal);
  }

  // 3. Update orderItemsSummary string logic
  const oldSummaryRegex = /const orderItemsSummary = cartItems\s*\n\s*\.map\(\(ci\) => \`\$\{ci\.quantity\}x \$\{ci\.menuItem\.name\}\`\)\s*\n\s*\.join\(\', \'\);/;
  const newSummary = 'const orderItemsSummary = cartItems\n        .map((ci) => `${ci.quantity}x ${ci.menuItem.name}${ci.selectedSize ? ` (${ci.selectedSize.name})` : \'\'}`)\n        .join(\', \');';
  
  content = content.replace(oldSummaryRegex, newSummary);

  // 4. Update UI in CartDrawer to display the selected size
  const oldNameRender = '<h4 className="font-extrabold text-stone-800 text-sm leading-tight">{item.menuItem.name}</h4>';
  const newNameRender = `<h4 className="font-extrabold text-stone-800 text-sm leading-tight">
                        {item.menuItem.name}
                      </h4>
                      {item.selectedSize && (
                        <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mt-0.5">
                          Size: {item.selectedSize.name}
                        </p>
                      )}`;
  if (content.includes(oldNameRender) && !content.includes('Size: {item.selectedSize.name}')) {
    content = content.replace(oldNameRender, newNameRender);
  }

  // 5. Update UI in CartDrawer to display the correct price
  const oldPriceRender = '<p className="font-black text-stone-800">₱{(item.menuItem.price * item.quantity).toFixed(2)}</p>';
  const newPriceRender = '<p className="font-black text-stone-800">₱{((item.selectedSize ? item.selectedSize.price : item.menuItem.price) * item.quantity).toFixed(2)}</p>';
  if (content.includes(oldPriceRender)) {
    content = content.replace(oldPriceRender, newPriceRender);
  }
  
  // also update single item price text 
  const oldEachPriceRender = '<p className="text-xs font-semibold text-stone-500 mt-0.5">₱{item.menuItem.price.toFixed(2)} each</p>';
  const newEachPriceRender = '<p className="text-xs font-semibold text-stone-500 mt-0.5">₱{(item.selectedSize ? item.selectedSize.price : item.menuItem.price).toFixed(2)} each</p>';
  if (content.includes(oldEachPriceRender)) {
    content = content.replace(oldEachPriceRender, newEachPriceRender);
  }

  fs.writeFileSync(file, content);
  console.log('Cart patched successfully.');
}

patchCart();
