const fs = require('fs');

function patchPaymentUI() {
  const file = 'c:\\Eat n RepEat Cafe\\eat-n-repeat-frontend\\components\\customer\\CartDrawer.tsx';
  let content = fs.readFileSync(file, 'utf-8');

  // Normalize line endings
  content = content.replace(/\r\n/g, '\n');

  // 1. Update State
  const oldState = "const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'cod' | 'card'>('gcash');";
  const newState = `const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'cod' | null>(null);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);`;
  
  if (content.includes(oldState)) {
    content = content.replace(oldState, newState);
  }

  // 2. Add Cash Description Function
  const oldAutoSwitch = `  // Auto-switch to COD if offline
  useEffect(() => {
    if (isOffline && paymentMethod === 'gcash') {
      setPaymentMethod('cod');
    }
  }, [isOffline, paymentMethod]);`;
  
  const newAutoSwitch = `  // Auto-switch to COD if offline
  useEffect(() => {
    if (isOffline && paymentMethod === 'gcash') {
      setPaymentMethod('cod');
    }
  }, [isOffline, paymentMethod]);

  useEffect(() => {
    // Both GCash and Cash are available for all fulfillment types right now.
    // However, if we ever have restricted ones, we reset them here:
    if (paymentMethod && !['gcash', 'cod'].includes(paymentMethod)) {
      setPaymentMethod(null);
    }
  }, [fulfillmentType, paymentMethod]);

  const getCashDescription = () => {
    if (fulfillmentType === 'delivery') return 'Pay when your order arrives';
    if (fulfillmentType === 'pickup') return 'Pay when you pick up your order';
    if (fulfillmentType === 'dine-in') return 'Pay at the café';
    return 'Pay with cash';
  };`;

  if (content.includes(oldAutoSwitch)) {
    content = content.replace(oldAutoSwitch, newAutoSwitch);
  }

  // 3. Update Checkout Validation
  const oldCheckoutValidation = `    if (fulfillmentType === 'delivery' && !address.trim()) {
      alert('Please enter a delivery address');
      return;
    }`;
  const newCheckoutValidation = `    if (fulfillmentType === 'delivery' && !address.trim()) {
      alert('Please enter a delivery address');
      return;
    }

    if (!paymentMethod) {
      alert('Please select a payment method');
      return;
    }`;
  if (content.includes(oldCheckoutValidation) && !content.includes('Please select a payment method')) {
    content = content.replace(oldCheckoutValidation, newCheckoutValidation);
  }

  // 4. Replace Payment UI Block
  const oldPaymentBlockRegex = /<div>\s*<label className="text-xs font-semibold text-stone-700 block mb-1">Payment Method<\/label>\s*<div className="grid grid-cols-3 gap-2">[\s\S]*?<\/div>\s*<\/div>/;
  
  const newPaymentBlock = `<div className="mt-4">
                    <label className="text-xs font-semibold text-stone-700 block mb-1">Payment Details</label>
                    <div 
                      onClick={() => setShowPaymentSheet(true)}
                      className="p-3 border border-stone-200 hover:border-[#800000] rounded-xl flex items-center justify-between cursor-pointer transition-colors bg-white shadow-sm"
                    >
                      {paymentMethod === 'gcash' ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xs">G</div>
                          <div>
                            <p className="text-sm font-bold text-stone-800">GCash</p>
                            <p className="text-[10px] text-stone-500 font-medium tracking-wide">Powered by Xendit</p>
                          </div>
                        </div>
                      ) : paymentMethod === 'cod' ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                            <Banknote className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-stone-800">Cash</p>
                            <p className="text-[10px] text-stone-500 font-medium tracking-wide">{getCashDescription()}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-stone-500">
                          <CreditCard className="w-5 h-5" />
                          <p className="text-sm font-bold text-stone-800">Select payment method</p>
                        </div>
                      )}
                      <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>`;

  if (content.match(oldPaymentBlockRegex)) {
    content = content.replace(oldPaymentBlockRegex, newPaymentBlock);
  }

  // 5. Inject Bottom Sheet UI
  const bottomSheetUI = `
      {/* Payment Selection Bottom Sheet */}
      {showPaymentSheet && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowPaymentSheet(false)}>
          <div 
            className="bg-white w-full sm:w-[400px] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-stone-800">Payment Details</h3>
              <button onClick={() => setShowPaymentSheet(false)} className="p-2 text-stone-400 hover:text-stone-600 bg-stone-100 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { setPaymentMethod('gcash'); setShowPaymentSheet(false); }}
                className={\`w-full p-4 border rounded-2xl flex items-center justify-between transition-colors \${paymentMethod === 'gcash' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-stone-200 hover:border-blue-300'}\`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm">G</div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-stone-800">GCash</p>
                    <p className="text-xs text-stone-500 font-medium">Powered by Xendit</p>
                  </div>
                </div>
                {paymentMethod === 'gcash' ? <Check className="w-5 h-5 text-blue-600" /> : <div className="w-5 h-5 rounded-full border-2 border-stone-200"></div>}
              </button>

              <button
                type="button"
                onClick={() => { setPaymentMethod('cod'); setShowPaymentSheet(false); }}
                className={\`w-full p-4 border rounded-2xl flex items-center justify-between transition-colors \${paymentMethod === 'cod' ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-stone-200 hover:border-emerald-300'}\`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-stone-800">Cash</p>
                    <p className="text-xs text-stone-500 font-medium">{getCashDescription()}</p>
                  </div>
                </div>
                {paymentMethod === 'cod' ? <Check className="w-5 h-5 text-emerald-600" /> : <div className="w-5 h-5 rounded-full border-2 border-stone-200"></div>}
              </button>
            </div>
          </div>
        </div>
      )}`;

  const componentEndRegex = /(<\/[^>]+>\s*)$/;
  if (content.match(componentEndRegex) && !content.includes('Payment Selection Bottom Sheet')) {
    content = content.replace(componentEndRegex, bottomSheetUI + '\n$1');
  }

  fs.writeFileSync(file, content);
  console.log('Payment UI patched successfully.');
}

patchPaymentUI();
