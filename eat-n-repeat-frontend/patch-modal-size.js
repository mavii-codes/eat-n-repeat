const fs = require('fs');

function patchModal() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\components\\customer\\MenuItemDetailsModal.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // 1. Swap CustomizationOption with MenuSize for selectedSize
  content = content.replace(
    'const [selectedDrinkSize, setSelectedDrinkSize] = useState<CustomizationOption | null>(null);',
    'const [selectedSize, setSelectedSize] = useState<any | null>(null);' // using any to avoid import issue for MenuSize in short term, or we can just use {name:string, price:number}
  );

  // 2. Reset size on open
  content = content.replace(
    'setSelectedDrinkSize(customizations.drinkSizes?.[0] || null);',
    ''
  );
  content = content.replace(
    'setSelectedDrinkSize(null);',
    ''
  );
  const resetInject = 'setSelectedSize(null);';
  if (content.includes('setSelectedAddOns([]);') && !content.includes(resetInject)) {
    content = content.replace('setSelectedAddOns([]);', 'setSelectedAddOns([]);\n    setSelectedSize(null);');
  }

  // 3. Render new sizes from item.sizes instead of customizations.drinkSizes
  const oldDrinkSizeRenderStart = '{/* Drink Sizes */}';
  const oldDrinkSizeRenderEnd = ')}'; // This is fragile. We will use a regex to strip out the Drink Sizes block.

  const oldBlockRegex = /\{\/\* Drink Sizes \*\/\}.*?\{\/\* Sugar Level \*\/\}/s;
  const newSizeRender = `{/* Native Sizes */}
                {item.sizes && item.sizes.length > 0 && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="text-xs font-extrabold text-stone-700 block mb-1.5">Choose Size <span className="text-[#B91C1C]">*</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      {item.sizes.filter(s => s.available).map((size) => (
                        <button
                          key={size.name}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={\`py-2.5 px-3 rounded-xl text-sm font-bold transition border flex justify-between items-center \${
                            selectedSize?.name === size.name
                              ? 'bg-[#B91C1C] text-white border-[#B91C1C] shadow-md'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-amber-50'
                          }\`}
                        >
                          <span>{size.name}</span>
                          <span className={\`text-xs \${selectedSize?.name === size.name ? 'opacity-90' : 'opacity-60'}\`}>
                            ₱{size.price.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Sugar Level */}`;
  
  if (content.match(oldBlockRegex)) {
    content = content.replace(oldBlockRegex, newSizeRender);
  }

  // 4. Update unitPrice calculation
  const oldUnitPrice = 'const unitPrice = item.price + (selectedDrinkSize?.price || 0) + (selectedRiceOption?.price || 0) + addonsPrice;';
  const newUnitPrice = 'const unitPrice = (selectedSize ? selectedSize.price : item.price) + (selectedRiceOption?.price || 0) + addonsPrice;';
  if (content.includes(oldUnitPrice)) {
    content = content.replace(oldUnitPrice, newUnitPrice);
  }

  // 5. Update validation in handleAdd
  const oldAddStart = 'const handleAdd = () => {\n    if (!isAvailable) return;';
  const newAddStart = `const handleAdd = () => {\n    if (!isAvailable) return;\n    if (item.sizes && item.sizes.filter(s=>s.available).length > 0 && !selectedSize) {\n      alert("Please select a size before adding to order.");\n      return;\n    }`;
  if (content.includes(oldAddStart) && !content.includes('alert("Please select a size')) {
    content = content.replace(oldAddStart, newAddStart);
  }

  // 6. Fix handleAdd selectedSize notes & payload
  const oldSizeNote = 'if (selectedDrinkSize) customNotes.push(`Size: ${selectedDrinkSize.name} (+₱${selectedDrinkSize.price})`);';
  const newSizeNote = '/* Size is now explicitly passed in payload, not just notes */';
  if (content.includes(oldSizeNote)) {
    content = content.replace(oldSizeNote, newSizeNote);
  }

  const oldOnAddToCart = `onAddToCart({
          ...item,
          price: unitPrice,
          notes: compiledNotes || undefined,
        });`;
  const newOnAddToCart = `onAddToCart({
          ...item,
          price: unitPrice,
          notes: compiledNotes || undefined,
          ...(selectedSize ? { selectedSize } : {})
        } as any);`;
  if (content.includes(oldOnAddToCart)) {
    content = content.replace(oldOnAddToCart, newOnAddToCart);
  }

  // 7. Change Add button to say "Select Size" if sizes exist and none selected
  const oldButtonRender = `{!isAvailable ? 'Out of Stock' : added ? (
                <>
                  <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Added {quantity} to Order!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> Add to Order • ₱{totalPrice.toFixed(2)}
                </>
              )}`;
              
  const newButtonRender = `{!isAvailable ? 'Out of Stock' : added ? (
                <>
                  <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Added {quantity} to Order!
                </>
              ) : (item.sizes && item.sizes.filter(s=>s.available).length > 0 && !selectedSize) ? (
                'Select Size to Add'
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> Add to Order • ₱{totalPrice.toFixed(2)}
                </>
              )}`;
  if (content.includes(oldButtonRender)) {
    content = content.replace(oldButtonRender, newButtonRender);
  }

  fs.writeFileSync(file, content);
  console.log('Modal patched successfully.');
}

patchModal();
