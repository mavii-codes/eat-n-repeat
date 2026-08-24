const fs = require('fs');

function patchCheckoutDelivery() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\components\\customer\\CartDrawer.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // Normalize line endings
  content = content.replace(/\r\n/g, '\n');

  // 1. Add selectedServiceAreaId to states
  const oldState = `const [address, setAddress] = useState('');`;
  const newState = `const [address, setAddress] = useState('');
  const [selectedServiceAreaId, setSelectedServiceAreaId] = useState('');`;
  if (content.includes(oldState)) {
    content = content.replace(oldState, newState);
  }

  // 2. Extract deliverySettings and serviceAreas
  const oldUseAdmin = `const { addDeliveryOrder, addStoreOrder } = useAdminData();`;
  const newUseAdmin = `const { addDeliveryOrder, addStoreOrder, deliverySettings, serviceAreas } = useAdminData();`;
  if (content.includes(oldUseAdmin)) {
    content = content.replace(oldUseAdmin, newUseAdmin);
  }

  // 3. Update deliveryFee calculation logic
  const oldCalculation = `  const subtotal = cartItems.reduce((acc, item) => acc + (item.selectedSize ? item.selectedSize.price : item.menuItem.price) * item.quantity, 0);
  const deliveryFee = fulfillmentType === 'delivery' ? (subtotal > 500 ? 0 : 49) : 0;
  const discount = (subtotal * discountPercent) / 100;
  const total = Math.max(0, subtotal + deliveryFee - discount);`;

  const newCalculation = `  const subtotal = cartItems.reduce((acc, item) => acc + (item.selectedSize ? item.selectedSize.price : item.menuItem.price) * item.quantity, 0);
  
  const selectedArea = serviceAreas.find(sa => sa.id === selectedServiceAreaId);
  const distanceKm = selectedArea?.distanceKm || 0;
  
  let deliveryFee = 0;
  let deliveryFeeRule = '';
  
  if (fulfillmentType === 'delivery' && selectedArea) {
    if (distanceKm <= (deliverySettings?.freeDeliveryRadiusKm || 0)) {
      deliveryFee = 0;
      deliveryFeeRule = \`Cordova Free Delivery Area (≤ \${deliverySettings?.freeDeliveryRadiusKm || 0} km)\`;
    } else {
      deliveryFee = (deliverySettings?.baseDeliveryFee || 0) + (distanceKm * (deliverySettings?.perKmFee || 0));
      deliveryFeeRule = \`Distance-based (\${distanceKm} km)\`;
    }
  }

  const discount = (subtotal * discountPercent) / 100;
  const total = Math.max(0, subtotal + deliveryFee - discount);`;

  if (content.includes(oldCalculation)) {
    content = content.replace(oldCalculation, newCalculation);
  }

  // 4. Update Checkout validation and payload
  const oldValidation = `    if (fulfillmentType === 'delivery' && !address.trim()) {
      alert('Please enter a delivery address');
      return;
    }`;
  const newValidation = `    if (fulfillmentType === 'delivery') {
      if (!selectedServiceAreaId) {
        alert('Please select your Delivery Area (Barangay/City)');
        return;
      }
      if (!address.trim()) {
        alert('Please enter a complete delivery address');
        return;
      }
    }`;
  if (content.includes(oldValidation)) {
    content = content.replace(oldValidation, newValidation);
  }

  const oldPayload = `        addDeliveryOrder({
          orderNumber: newOrderId,
          customerName: customerName.trim(),
          phone: phone.trim() || '09170000000',
          address: address.trim(),
          serviceAreaId: 'sa-1',
          items: orderItemsSummary,
          subtotal: subtotal,
          deliveryFee: deliveryFee,
          total: total,
          status: 'pending',
          orderedAt: new Date().toISOString(),
          paid: paymentMethod !== 'cod',
          paymentMethod: paymentMethod === 'gcash' ? 'GCash' : 'Cash',
          paymentStatus: paymentMethod === 'gcash' ? 'pending' : undefined,
          archived: false,
        });`;
  const newPayload = `        addDeliveryOrder({
          orderNumber: newOrderId,
          customerName: customerName.trim(),
          phone: phone.trim() || '09170000000',
          address: address.trim(),
          serviceAreaId: selectedServiceAreaId,
          deliveryDistanceKm: distanceKm,
          deliveryFeeRule: deliveryFeeRule,
          items: orderItemsSummary,
          subtotal: subtotal,
          deliveryFee: deliveryFee,
          total: total,
          status: 'pending',
          orderedAt: new Date().toISOString(),
          paid: paymentMethod !== 'cod',
          paymentMethod: paymentMethod === 'gcash' ? 'GCash' : 'Cash',
          paymentStatus: paymentMethod === 'gcash' ? 'pending' : undefined,
          archived: false,
        });`;
  if (content.includes(oldPayload)) {
    content = content.replace(oldPayload, newPayload);
  }

  // 5. Update UI rendering
  const oldAddressBlock = `                  {fulfillmentType === 'delivery' && (
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">Delivery Address</label>
                      <textarea
                        rows={2}
                        placeholder="Complete street address, barangay, landmarks"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none"
                      />
                    </div>
                  )}`;
                  
  const newAddressBlock = `                  {fulfillmentType === 'delivery' && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">Delivery Area (Barangay/City)</label>
                        <select 
                          value={selectedServiceAreaId} 
                          onChange={(e) => setSelectedServiceAreaId(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium text-stone-800 focus:ring-2 focus:ring-rose-900 focus:outline-none"
                        >
                          <option value="">-- Select your area --</option>
                          {serviceAreas.filter(sa => sa.active).map(sa => (
                            <option key={sa.id} value={sa.id}>{sa.name} ({sa.municipality})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">Complete Address</label>
                        <textarea
                          rows={2}
                          placeholder="Street, landmarks, details..."
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-900 focus:outline-none"
                        />
                      </div>
                    </>
                  )}`;
  if (content.includes(oldAddressBlock)) {
    content = content.replace(oldAddressBlock, newAddressBlock);
  }

  // 6. Delivery Distance and Fee display
  const oldSubtotalDisplay = `<div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold">₱{subtotal.toFixed(2)}</span>
                </div>`;
  const newSubtotalDisplay = `<div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-stone-800">₱{subtotal.toFixed(2)}</span>
                </div>
                {fulfillmentType === 'delivery' && selectedServiceAreaId && (
                  <>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500">Delivery Distance</span>
                      <span className="font-semibold text-stone-600">{distanceKm} km</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500">Delivery Fee</span>
                      {deliveryFee === 0 ? (
                        <span className="font-black text-emerald-600 uppercase tracking-wider text-[10px]">FREE</span>
                      ) : (
                        <span className="font-semibold text-stone-800">₱{deliveryFee.toFixed(2)}</span>
                      )}
                    </div>
                  </>
                )}`;
  if (content.includes(oldSubtotalDisplay)) {
    content = content.replace(oldSubtotalDisplay, newSubtotalDisplay);
  }

  fs.writeFileSync(file, content);
  console.log('Cart checkout patched for distance delivery.');
}

patchCheckoutDelivery();
