// Cart rebuild — called by the final showPage definition below

function rebuildCartPage() {
  const wrapper = document.getElementById('cart-content');
  if(!wrapper) return;
  if(cartItems.length === 0) {
    wrapper.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:48px;margin-bottom:20px">🛒</div>
      <p style="font-size:18px;margin-bottom:20px">Your cart is empty</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a class="btn-primary" style="text-decoration:none;" href="/electric-dirt-bikes/" data-route="shop">Browse Dirt Bikes →</a>
        <a class="btn-outline" style="text-decoration:none;" href="/electric-quad-bikes/" data-route="quads">Browse Quads →</a>
      </div>
    </div>`;
    return;
  }
  let subtotal = 0;
  const rows = cartItems.map((item,i) => {
    const num = parseFloat((item.price||'0').replace(/[^0-9.]/g,'')) || 0;
    subtotal += num;
    const colourLine = item.colour
      ? `<span class="cart-row-colour">Colour: ${item.colour}</span> · `
      : '';
    return `<div class="cart-row">
      <div class="cart-row-info" style="flex:1">
        <div class="cart-row-name">${item.name}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">${colourLine}Qty: 1 · Free UK delivery</div>
      </div>
      <div class="cart-row-price">${item.price}</div>
      <button class="cart-remove" onclick="removeFromCart(${i})" aria-label="Remove item">✕</button>
    </div>`;
  }).join('');
  const vatAmt = subtotal - (subtotal / 1.2);
  wrapper.innerHTML = `
    <div class="cart-layout">
      <div>
        <div id="cart-items-list">${rows}</div>
        <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border)">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <input class="form-input" style="max-width:220px;font-size:13px;" placeholder="Promo code" id="promo-input">
            <button class="btn-outline" style="padding:11px 20px;font-size:13px;" onclick="applyPromo()">Apply Code</button>
          </div>
        </div>
        <div class="legal-disclaimer" style="margin-top:20px">
          <strong>⚠ Off-road use only</strong> for most models. Ensure you have checked the legality of the product before purchase. <a href="/guides/are-electric-dirt-bikes-legal-uk/" data-route="guide-legal" style="color:var(--amber);cursor:pointer">UK Riding Laws Guide →</a>
        </div>
      </div>
      <div>
        <div class="cart-summary">
          <h3>Order Summary</h3>
          <div class="summary-row"><span>Subtotal (inc. VAT)</span><strong id="cart-subtotal">£${subtotal.toLocaleString('en-GB', {minimumFractionDigits:0})}</strong></div>
          <div class="summary-row"><span>VAT (20%)</span><strong>£${vatAmt.toFixed(2)}</strong></div>
          <div class="summary-row"><span>Delivery</span><strong style="color:var(--volt)">FREE</strong></div>
          <div class="summary-row" id="promo-row" style="display:none"><span>Promo code</span><strong style="color:var(--volt)" id="promo-discount">-£0</strong></div>
          <div class="summary-total"><span>Total</span><strong id="cart-total">£${subtotal.toLocaleString('en-GB', {minimumFractionDigits:0})}</strong></div>
          <a class="checkout-btn" style="text-decoration:none;" href="/checkout/" data-route="checkout">Proceed to Checkout →</a>
          <a class="btn-outline" style="text-decoration:none;width:100%;padding:12px;font-size:13px;justify-content:center;margin-bottom:16px" href="/electric-dirt-bikes/" data-route="shop">Continue Shopping</a>
          <div class="checkout-secure">🔒 Secure checkout · SSL encrypted</div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap">
            <span class="payment-icon">VISA</span><span class="payment-icon">MC</span><span class="payment-icon">AMEX</span><span class="payment-icon">Bank Transfer</span>
          </div>
        </div>
        <div style="margin-top:16px;text-align:center">
          <a class="btn-outline" style="text-decoration:none;padding:10px 20px;font-size:13px;" href="/finance/" data-route="finance">Calculate Finance →</a>
        </div>
      </div>
    </div>`;
}

function applyPromo() {
  const code = (document.getElementById('promo-input')||{}).value || '';
  if(code.toUpperCase() === 'VOLT10') {
    document.getElementById('promo-row').style.display='flex';
    showToast('Promo code VOLT10 applied — 10% off!', 'var(--volt)');
  } else {
    showToast('Invalid promo code.', '#ff4040');
  }
}

function removeFromCart(i) {
  cartItems.splice(i,1);
  const count = document.querySelector('.cart-count');
  if(count) count.textContent = cartItems.length > 0 ? cartItems.length : '0';
  rebuildCartPage();
}