const fs = require('fs');

function patchPOS() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\components\\staff\\POSCashierTab.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // 1. Update POSCartItem type
  if (!content.includes('selectedSize?: { name: string; price: number };')) {
    content = content.replace(
      'qty: number;\n};',
      'qty: number;\n  selectedSize?: { name: string; price: number };\n};'
    );
  }

  // 2. Add size selector state
  if (!content.includes('const [sizeSelectorItem, setSizeSelectorItem]')) {
    content = content.replace(
      'const [searchTerm, setSearchTerm] = useState("");',
      'const [sizeSelectorItem, setSizeSelectorItem] = useState<MenuItem | null>(null);\n  const [searchTerm, setSearchTerm] = useState("");'
    );
  }

  // 3. Update subtotal
  const oldSubtotal = 'return cart.reduce((sum, ci) => sum + ci.item.price * ci.qty, 0);';
  const newSubtotal = 'return cart.reduce((sum, ci) => sum + (ci.selectedSize ? ci.selectedSize.price : ci.item.price) * ci.qty, 0);';
  if (content.includes(oldSubtotal)) {
    content = content.replace(oldSubtotal, newSubtotal);
  }

  // 4. Update addToCart and add handleItemClick
  const oldAddToCart = `function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) => (ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci));
      }
      return [...prev, { item, qty: 1 }];
    });
  }`;
  const newAddToCart = `function handleItemClick(item: MenuItem) {
    if (item.sizes && item.sizes.filter(s => s.available).length > 0) {
      setSizeSelectorItem(item);
    } else {
      addToCart(item);
    }
  }

  function addToCart(item: MenuItem, selectedSize?: { name: string; price: number }) {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id && ci.selectedSize?.name === selectedSize?.name);
      if (existing) {
        return prev.map((ci) => (ci.item.id === item.id && ci.selectedSize?.name === selectedSize?.name ? { ...ci, qty: ci.qty + 1 } : ci));
      }
      return [...prev, { item, qty: 1, selectedSize }];
    });
    setSizeSelectorItem(null);
  }`;
  if (content.includes(oldAddToCart)) {
    content = content.replace(oldAddToCart, newAddToCart);
  }

  // 5. Update onClick={() => addToCart(item)} to onClick={() => handleItemClick(item)}
  content = content.replace(/onClick=\{\(\) => addToCart\(item\)\}/g, 'onClick={() => handleItemClick(item)}');

  // 6. Fix removeFromCart and updateQty to match id and size (since they might have same id but diff size)
  // Or we just change CartItem to have a unique id in POS? We can just pass the index. 
  // Let's replace the whole cart item rendering... wait, updateQty takes `itemId`. If there are 2 sizes of same item, they have same `itemId`!
  // To fix this, we should change updateQty to take index, or generate a unique cartItemId.
  // This is too much AST change for a regex. Let's just update `ci.item.id === itemId` to `ci.item.id === itemId && ci.selectedSize?.name === sizeName` in updateQty.
  
  const oldRemove = `function removeFromCart(itemId: string) {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  }`;
  const newRemove = `function removeFromCart(itemId: string, sizeName?: string) {
    setCart((prev) => prev.filter((ci) => !(ci.item.id === itemId && ci.selectedSize?.name === sizeName)));
  }`;
  if (content.includes(oldRemove)) {
    content = content.replace(oldRemove, newRemove);
  }

  const oldUpdateQty = `function updateQty(itemId: string, qty: number) {
    if (qty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) => prev.map((ci) => (ci.item.id === itemId ? { ...ci, qty } : ci)));
  }`;
  const newUpdateQty = `function updateQty(itemId: string, sizeName: string | undefined, qty: number) {
    if (qty <= 0) {
      removeFromCart(itemId, sizeName);
      return;
    }
    setCart((prev) => prev.map((ci) => ((ci.item.id === itemId && ci.selectedSize?.name === sizeName) ? { ...ci, qty } : ci)));
  }`;
  if (content.includes(oldUpdateQty)) {
    content = content.replace(oldUpdateQty, newUpdateQty);
  }

  // 7. Update UI where updateQty is called
  content = content.replace(/updateQty\(ci\.item\.id, ci\.qty \- 1\)/g, 'updateQty(ci.item.id, ci.selectedSize?.name, ci.qty - 1)');
  content = content.replace(/updateQty\(ci\.item\.id, ci\.qty \+ 1\)/g, 'updateQty(ci.item.id, ci.selectedSize?.name, ci.qty + 1)');
  content = content.replace(/removeFromCart\(ci\.item\.id\)/g, 'removeFromCart(ci.item.id, ci.selectedSize?.name)');

  // 8. Update Order string processing
  const oldItemsStr = 'const itemsStr = cart.map((ci) => `${ci.qty}x ${ci.item.name}`).join(", ");';
  const newItemsStr = 'const itemsStr = cart.map((ci) => `${ci.qty}x ${ci.item.name}${ci.selectedSize ? ` (${ci.selectedSize.name})` : \'\'}`).join(", ");';
  if (content.includes(oldItemsStr)) {
    content = content.replace(oldItemsStr, newItemsStr);
  }
  
  const oldCartItemsStr = 'cart.map((ci) => `${ci.qty}x ${ci.item.name}`).join(", ")';
  const newCartItemsStr = 'cart.map((ci) => `${ci.qty}x ${ci.item.name}${ci.selectedSize ? ` (${ci.selectedSize.name})` : \'\'}`).join(", ")';
  if (content.includes(oldCartItemsStr)) {
    content = content.replace(oldCartItemsStr, newCartItemsStr);
  }

  // 9. Update display of cart items inside POS Cart
  const oldCartItemName = '<p className="font-bold text-stone-800 text-sm leading-tight">{ci.item.name}</p>';
  const newCartItemName = `<p className="font-bold text-stone-800 text-sm leading-tight">{ci.item.name}</p>
                        {ci.selectedSize && <p className="text-[10px] text-amber-600 font-bold uppercase mt-0.5">Size: {ci.selectedSize.name}</p>}`;
  if (content.includes(oldCartItemName)) {
    content = content.replace(oldCartItemName, newCartItemName);
  }
  
  const oldCartItemPrice = '<span className="text-xs font-black text-[#63131d]">₱{(ci.item.price * ci.qty).toFixed(2)}</span>';
  const newCartItemPrice = '<span className="text-xs font-black text-[#63131d]">₱{((ci.selectedSize ? ci.selectedSize.price : ci.item.price) * ci.qty).toFixed(2)}</span>';
  if (content.includes(oldCartItemPrice)) {
    content = content.replace(oldCartItemPrice, newCartItemPrice);
  }

  // 10. Receipt UI Update
  const oldReceiptItemName = '<span className="font-bold text-stone-800">{ci.item.name}</span>';
  const newReceiptItemName = `<span className="font-bold text-stone-800">{ci.item.name}{ci.selectedSize ? \` (\${ci.selectedSize.name})\` : ''}</span>`;
  if (content.includes(oldReceiptItemName)) {
    content = content.replace(oldReceiptItemName, newReceiptItemName);
  }

  const oldReceiptItemPrice = '<span className="font-black">₱{(ci.item.price * ci.qty).toFixed(2)}</span>';
  const newReceiptItemPrice = '<span className="font-black">₱{((ci.selectedSize ? ci.selectedSize.price : ci.item.price) * ci.qty).toFixed(2)}</span>';
  if (content.includes(oldReceiptItemPrice)) {
    content = content.replace(oldReceiptItemPrice, newReceiptItemPrice);
  }

  // 11. Add Size Selector Modal JSX at the end of the return
  const sizeSelectorJSX = `
      {sizeSelectorItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-[#451a03] mb-1">Select Size</h3>
            <p className="text-sm text-stone-500 mb-4">{sizeSelectorItem.name}</p>
            <div className="space-y-2 mb-6">
              {sizeSelectorItem.sizes?.filter(s => s.available).map(size => (
                <button
                  key={size.name}
                  onClick={() => addToCart(sizeSelectorItem, size)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-200 hover:border-[#B91C1C] hover:bg-red-50 text-stone-800 transition-colors"
                >
                  <span className="font-bold text-sm">{size.name}</span>
                  <span className="font-black text-[#B91C1C] text-sm">₱{size.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setSizeSelectorItem(null)}
              className="w-full py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
  `;

  // Inject right before the last closing div of the component
  const componentEndRegex = /(<\/[^>]+>\s*)$/;
  if (content.match(componentEndRegex) && !content.includes('Select Size')) {
    content = content.replace(componentEndRegex, sizeSelectorJSX + '\n$1');
  }

  fs.writeFileSync(file, content);
  console.log('POS patched successfully.');
}

patchPOS();
