// ── PRODUCT TABS ──
function switchTab(btn, paneId) {
  const tabsParent = btn.closest('.product-tabs');
  const detailParent = tabsParent ? tabsParent.parentElement : btn.closest('.product-info, div');
  tabsParent.querySelectorAll('.product-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const pane = document.getElementById(paneId);
  if(!pane) return;
  const allPanes = pane.parentElement.querySelectorAll('.product-tab-pane');
  allPanes.forEach(p => p.classList.remove('active'));
  pane.classList.add('active');
}

// ── CHECKOUT INIT ──
// ══════════════════════════════════════════════════════════
//  WOOCOMMERCE-STYLE CHECKOUT LOGIC
// ══════════════════════════════════════════════════════════
let _coupon = null; // {code, pct}
const COUPONS = { 'VOLT10': 10, 'WELCOME5': 5 }; // demo coupon codes

function _cartQtyMap() {
  // group identical cart items (same name AND colour) into one line with qty
  const map = {};
  cartItems.forEach(it => {
    const key = it.name + '||' + (it.colour || '');
    if(!map[key]) map[key] = { name: it.name, colour: it.colour || null, price: it.price, num: parseFloat((it.price||'0').replace(/[^0-9.]/g,''))||0, qty: 0 };
    map[key].qty += 1;
  });
  return Object.values(map);
}

function initCheckout() {
  const itemsEl = document.getElementById('checkout-items');
  if(!itemsEl) return;
  const grouped = _cartQtyMap();
  // Fire Meta Pixel + GA InitiateCheckout event
  try {
    let _icValue = 0;
    const _icIds = [], _icItems = [];
    grouped.forEach(g => {
      _icValue += g.num * g.qty;
      _icIds.push(g.name);
      _icItems.push({ item_name: g.name, price: g.num, quantity: g.qty });
    });
    if (grouped.length && typeof fbq === 'function') fbq('track', 'InitiateCheckout', {
      content_ids: _icIds, contents: grouped.map(g => ({ id: g.name, quantity: g.qty })),
      num_items: grouped.reduce((n,g)=>n+g.qty,0),
      value: _icValue, currency: 'GBP'
    });
    if (grouped.length && typeof gtag === 'function') gtag('event', 'begin_checkout', {
      currency: 'GBP', value: _icValue, items: _icItems
    });
  } catch(e) {}
  let sub = 0;
  if(grouped.length === 0) {
    itemsEl.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:10px 0">Your cart is empty. <a href="/electric-dirt-bikes/" data-route="shop" style="color:var(--volt)">Browse bikes →</a></p>';
  } else {
    itemsEl.innerHTML = grouped.map(g => {
      const line = g.num * g.qty;
      sub += line;
      const colourTag = g.colour ? '<span class="co-item-colour">Colour: ' + g.colour + '</span>' : '';
      return '<div class="co-item"><span class="co-item-name">' + g.name
        + ' <span class="co-item-qty">× ' + g.qty + '</span>' + colourTag + '</span>'
        + '<strong>£' + line.toLocaleString('en-GB') + '</strong></div>';
    }).join('');
  }
  // discount
  let discount = 0;
  const discRow = document.getElementById('co-discount-row');
  if(_coupon && sub > 0) {
    discount = Math.round(sub * _coupon.pct / 100);
    if(discRow) { discRow.style.display = 'flex'; document.getElementById('co-discount').textContent = '− £' + discount.toLocaleString('en-GB'); }
  } else if(discRow) {
    discRow.style.display = 'none';
  }
  const total = Math.max(0, sub - discount);
  // VAT is already included in UK retail prices — show the VAT component (1/6 of total)
  const vat = Math.round(total - total / 1.2);
  const subEl = document.getElementById('co-subtotal');
  const vatEl = document.getElementById('co-vat');
  const totEl = document.getElementById('co-total');
  if(subEl) subEl.textContent = '£' + sub.toLocaleString('en-GB');
  if(vatEl) vatEl.textContent = '£' + vat.toLocaleString('en-GB');
  if(totEl) totEl.textContent = '£' + total.toLocaleString('en-GB');
  // Pre-fill Pay in 4 amounts for both methods
  if(typeof _updatePi4Amounts === 'function') {
    _updatePi4Amounts('card');
    _updatePi4Amounts('bank');
  }
}

function toggleShipping() {
  const box = document.getElementById('co-shipping-fields');
  const cb = document.getElementById('co-ship-diff');
  if(box && cb) box.style.display = cb.checked ? 'block' : 'none';
}

function selectPayment(method) {
  ['card','bank'].forEach(m => {
    const body = document.getElementById('pay-body-' + m);
    if(body) body.style.display = (m === method) ? 'block' : 'none';
    // Reset Pay in 4 when switching payment method
    if(m !== method) {
      const cb = document.getElementById('pi4-' + m + '-cb');
      const panel = document.getElementById('pi4-' + m + '-panel');
      if(cb) cb.checked = false;
      if(panel) panel.classList.remove('open');
    }
  });
  // Recalculate Pay in 4 amounts for the newly selected method
  _updatePi4Amounts(method);
}

// Update the displayed Pay in 4 instalment amounts for a given method
function _updatePi4Amounts(method) {
  // Get current cart total (after any discount)
  const totEl = document.getElementById('co-total');
  if(!totEl) return;
  const totalStr = totEl.textContent.replace(/[^0-9.]/g,'');
  const total = parseFloat(totalStr) || 0;
  if(total <= 0) return;
  const each = (total / 4).toFixed(2);
  const fmt = '£' + parseFloat(each).toLocaleString('en-GB', {minimumFractionDigits:2, maximumFractionDigits:2});
  ['p1','p2','p3','p4'].forEach(function(p) {
    const el = document.getElementById('pi4-' + method + '-' + p);
    if(el) el.textContent = fmt;
  });
}

// Toggle Pay in 4 panel open/closed and update amounts
function togglePi4(method) {
  const cb = document.getElementById('pi4-' + method + '-cb');
  const panel = document.getElementById('pi4-' + method + '-panel');
  if(!cb || !panel) return;
  if(cb.checked) {
    panel.classList.add('open');
    _updatePi4Amounts(method);
  } else {
    panel.classList.remove('open');
  }
}

function applyCoupon() {
  const input = document.getElementById('co-coupon');
  const msg = document.getElementById('co-coupon-msg');
  if(!input || !msg) return;
  const code = input.value.trim().toUpperCase();
  if(!code) { msg.textContent = 'Enter a code.'; msg.style.color = 'var(--muted)'; return; }
  if(COUPONS[code]) {
    _coupon = { code: code, pct: COUPONS[code] };
    msg.textContent = '✓ Coupon "' + code + '" applied — ' + COUPONS[code] + '% off';
    msg.style.color = 'var(--volt)';
  } else {
    _coupon = null;
    msg.textContent = '✗ "' + code + '" is not a valid coupon.';
    msg.style.color = 'var(--red)';
  }
  initCheckout();
}

function handleCheckout(e) {
  e.preventDefault();
  if(cartItems.length === 0) {
    alert('Your cart is empty. Add a product before checking out.');
    return;
  }
  const orderNo = 'VT' + Math.floor(10000 + Math.random() * 90000);
  // Build order details
  const grouped = (typeof _cartQtyMap === 'function') ? _cartQtyMap() : [];
  let sub = 0;
  const lines = grouped.map(g => {
    const lineTotal = g.num * g.qty;
    sub += lineTotal;
    return '• ' + g.name + (g.colour ? ' (' + g.colour + ')' : '') + ' x ' + g.qty + ' — £' + lineTotal.toLocaleString('en-GB');
  }).join('\n');
  let discount = 0;
  if(typeof _coupon !== 'undefined' && _coupon && sub > 0) discount = Math.round(sub * _coupon.pct / 100);
  const total = Math.max(0, sub - discount);
  const fname = _coField ? _coField('First Name') : '';
  const lname = _coField ? _coField('Last Name')  : '';
  const cEmail = _coField ? _coField('Email Address') : '';
  const phone = _coField ? _coField('Phone') : '';
  const addr1 = _coField ? _coField('Address Line 1') : '';
  const addr2 = _coField ? _coField('Address Line 2 (optional)') : '';
  const city  = _coField ? _coField('Town / City') : '';
  const post  = _coField ? _coField('Postcode') : '';
  const notes = _coField ? _coField('Order Notes (optional)') : '';
  const payEl = document.querySelector('#checkout-form input[name="payment"]:checked');
  const payValue = payEl ? payEl.value : 'bank';
  const payment = payValue === 'bank' ? 'Direct Bank Transfer' : 'Credit / Debit Card';
  // Pay in 4 detection
  const pi4Cb = document.getElementById('pi4-' + payValue + '-cb');
  const pi4Selected = pi4Cb ? pi4Cb.checked : false;
  const pi4Each = pi4Selected ? (total / 4).toLocaleString('en-GB', {minimumFractionDigits:2, maximumFractionDigits:2}) : null;

  let body = 'NEW ORDER from the VoltTrail website\n';
  body += 'Order Ref: ' + orderNo + '\n';
  body += '\n--- Items ---\n' + lines + '\n';
  body += '\nSubtotal: £' + sub.toLocaleString('en-GB') + '\n';
  if(discount > 0) body += 'Discount (' + _coupon.code + '): -£' + discount.toLocaleString('en-GB') + '\n';
  body += 'Delivery: FREE (UK mainland)\nTotal: £' + total.toLocaleString('en-GB') + '\n';
  body += '\n--- Customer ---\n' + fname + ' ' + lname + '\nEmail: ' + cEmail + '\nPhone: ' + phone + '\n';
  body += 'Address: ' + addr1 + (addr2 ? ', ' + addr2 : '') + ', ' + city + ', ' + post + '\n';
  body += '\nPayment method: ' + payment + '\n';
  if(pi4Selected) {
    body += 'Payment plan: Pay in 4 — £' + pi4Each + ' x 4 instalments\n';
    if(payValue === 'card') {
      body += 'Schedule: Today, Week 4, Week 8, Week 12 (charged automatically)\n';
    } else {
      body += 'Schedule: Instalment 1 now by bank transfer. Instalments 2-4 to be arranged via email (Week 4, 8, 12).\n';
      body += '⚠ ACTION REQUIRED: Contact customer to arrange future bank transfer instalments.\n';
    }
  }
  if(notes) body += '\nNotes: ' + notes + '\n';

  const subject = payValue === 'card'
    ? '⏳ PAYMENT PENDING — Order ' + orderNo + ' — VoltTrail'
    : 'New order ' + orderNo + ' — VoltTrail';
  const goToConfirmation = function() {
    // Fire Meta Pixel + GA Purchase event (the most important event for ad optimisation)
    try {
      const _pIds = grouped.map(g => g.name);
      const _pItems = grouped.map(g => ({ item_name: g.name, price: g.num, quantity: g.qty }));
      if (typeof fbq === 'function') fbq('track', 'Purchase', {
        content_ids: _pIds,
        contents: grouped.map(g => ({ id: g.name, quantity: g.qty, item_price: g.num })),
        num_items: grouped.reduce((n,g)=>n+g.qty,0),
        value: total, currency: 'GBP'
      });
      if (typeof gtag === 'function') gtag('event', 'purchase', {
        transaction_id: orderNo, currency: 'GBP', value: total, items: _pItems
      });
    } catch(e) {}
    const el = document.getElementById('order-num');
    if(el) el.textContent = orderNo.replace('VT','');
    cartItems = [];
    if(typeof _coupon !== 'undefined') _coupon = null;
    const count = document.querySelector('.cart-count');
    if(count) count.textContent = '0';
    showPage('order-confirm');
  };

  // Disable the submit button while sending
  const btn = e.target.querySelector('button[type=submit]');
  const originalLabel = btn ? btn.innerHTML : '';
  if(btn) { btn.disabled = true; btn.innerHTML = 'Placing order…'; }

  // ── Helper: send order via API (saves to KV + sends business & customer emails) ──
  function _sendOrderEmail(extraLine, channel) {
    var pi4Data = null;
    if(pi4Selected) {
      var instalment = total / 4;
      pi4Data = { dueToday: instalment, instalment: instalment };
    }
    fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          name: fname + ' ' + lname,
          email: cEmail,
          phone: phone,
          address1: addr1,
          address2: addr2,
          city: city,
          postcode: post
        },
        order: {
          orderNumber: orderNo,
          items: grouped.map(function(g){ return { name: g.name + (g.colour ? ' (' + g.colour + ')' : ''), price: g.num, quantity: g.qty }; }),
          subtotal: sub,
          discount: discount,
          grandTotal: total,
          shippingFree: true,
          paymentLabel: payment + (pi4Selected ? ' — Pay in 4' : ''),
          payIn4: pi4Data
        },
        channel: channel || 'email'
      })
    }).catch(function(err) { console.error('Order submit failed:', err); });
  }

  if (payValue === 'card') {
    // ── CARD PATH: show polished Fincra payment overlay ──
    if (btn) { btn.disabled = false; btn.innerHTML = originalLabel; }

    // Populate overlay with order details
    var fEl = document.getElementById('fincra-total');
    var fRef = document.getElementById('fincra-ref');
    var fItems = document.getElementById('fincra-items');
    var fBtn = document.getElementById('fincra-pay-btn');
    if (fEl) fEl.textContent = '£' + total.toLocaleString('en-GB', {minimumFractionDigits:2, maximumFractionDigits:2});
    if (fRef) fRef.textContent = 'Order ref: ' + orderNo;
    if (fItems) {
      fItems.innerHTML = grouped.map(function(g) {
        var lineTotal = g.num * g.qty;
        return '<div class="fincra-modal-item">' +
          '<span class="fincra-modal-item-name">' + (g.qty > 1 ? g.qty + '\xd7 ' : '') + g.name + (g.colour ? ' <span style="color:var(--muted);font-size:11px">(' + g.colour + ')</span>' : '') + '</span>' +
          '<span class="fincra-modal-item-price">\xa3' + lineTotal.toLocaleString('en-GB', {minimumFractionDigits:2}) + '</span>' +
          '</div>';
      }).join('');
    }
    if (fBtn) fBtn.setAttribute('href', FINCRA_PAYMENT_LINK);

    // Store callbacks on window so fincraPayClick / closeFincraOverlay can reach them
    window._fincraSendEmail = function() {
      _sendOrderEmail(
        '\u23f3 PAYMENT PENDING \u2014 Customer clicked Pay Securely Now on the VoltTrail checkout.\n' +
        '\u2705 Check your Fincra dashboard to confirm payment before dispatching this order.'
      );
      goToConfirmation();
    };

    // Show overlay
    document.getElementById('fincra-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    // ── BANK / KLARNA / CLEARPAY PATH ──
    _sendOrderEmail(
      '⚠️ ACTION REQUIRED: Customer chose ' + payment + '. Send payment instructions.'
    );
    if (btn) { btn.disabled = false; btn.innerHTML = originalLabel; }
    goToConfirmation();
  }
}

// ══════════════════════════════════════════════════════════
//  WHATSAPP CHAT & CHECKOUT
// ══════════════════════════════════════════════════════════
function _waLink(message) {
  return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
}
// Floating chat button — opens a general enquiry chat
function openWhatsAppChat() {
  const msg = 'Hi VoltTrail 👋 I have a question about your electric dirt bikes / quads.';
  window.open(_waLink(msg), '_blank');
}
// Read a value from the checkout form by its field label text
function _coField(label) {
  const groups = document.querySelectorAll('#checkout-form .form-group');
  for(const g of groups) {
    const l = g.querySelector('.form-label');
    if(l && l.textContent.replace('*','').trim().toLowerCase() === label.toLowerCase()) {
      const input = g.querySelector('input, textarea, select');
      if(input) return input.value.trim();
    }
  }
  return '';
}
// Build the order message from the checkout form + cart, then open WhatsApp
function whatsappCheckout() {
  if(cartItems.length === 0) {
    alert('Your cart is empty. Add a product before checking out.');
    return;
  }
  // Validate the essentials
  const fname = _coField('First Name');
  const lname = _coField('Last Name');
  const email = _coField('Email Address');
  const phone = _coField('Phone');
  const addr1 = _coField('Address Line 1');
  const city  = _coField('Town / City');
  const post  = _coField('Postcode');
  if(!fname || !lname || !email || !phone || !addr1 || !city || !post) {
    alert('Please fill in your name, email, phone and delivery address before checking out via WhatsApp.');
    const form = document.getElementById('checkout-form');
    if(form) form.scrollIntoView({behavior:'smooth'});
    return;
  }
  const orderNo = 'VT' + Math.floor(10000 + Math.random() * 90000);
  // Items
  const grouped = _cartQtyMap();
  let sub = 0;
  let lines = grouped.map(g => {
    const lineTotal = g.num * g.qty;
    sub += lineTotal;
    return '• ' + g.name + (g.colour ? ' (' + g.colour + ')' : '')
      + ' × ' + g.qty + ' — £' + lineTotal.toLocaleString('en-GB');
  }).join('\n');
  // Discount + total
  let discount = 0;
  if(_coupon && sub > 0) discount = Math.round(sub * _coupon.pct / 100);
  const total = Math.max(0, sub - discount);
  const payEl = document.querySelector('#checkout-form input[name="payment"]:checked');
  const waPayValue = payEl ? payEl.value : 'bank';
  const payment = waPayValue === 'bank' ? 'Direct Bank Transfer' : 'Credit / Debit Card';
  const waPi4Cb = document.getElementById('pi4-' + waPayValue + '-cb');
  const waPi4Selected = waPi4Cb ? waPi4Cb.checked : false;
  const waPi4Each = waPi4Selected ? (total / 4).toLocaleString('en-GB', {minimumFractionDigits:2, maximumFractionDigits:2}) : null;
  const notes = _coField('Order Notes (optional)');
  // Build message
  let m = '🛵 *NEW ORDER — VoltTrail*\n';
  m += 'Order Ref: ' + orderNo + '\n';
  m += '────────────────\n';
  m += '*Items:*\n' + lines + '\n';
  m += '────────────────\n';
  m += 'Subtotal: £' + sub.toLocaleString('en-GB') + '\n';
  if(discount > 0) m += 'Discount (' + _coupon.code + '): -£' + discount.toLocaleString('en-GB') + '\n';
  m += 'Delivery: FREE (UK mainland)\n';
  m += '*Total: £' + total.toLocaleString('en-GB') + '*\n';
  m += '────────────────\n';
  m += '*Customer:*\n';
  m += fname + ' ' + lname + '\n';
  m += '📧 ' + email + '\n';
  m += '📞 ' + phone + '\n';
  m += '🏠 ' + addr1;
  const addr2 = _coField('Address Line 2 (optional)');
  if(addr2) m += ', ' + addr2;
  m += ', ' + city + ', ' + post + '\n';
  m += '────────────────\n';
  m += '*Payment method:* ' + payment + (waPi4Selected ? ' — Pay in 4' : '') + '\n';
  if(waPi4Selected) {
    m += '*Pay in 4:* £' + waPi4Each + ' x 4 instalments\n';
    if(waPayValue === 'card') {
      m += 'Schedule: Today, Week 4, Week 8, Week 12 (charged automatically)\n';
    } else {
      m += 'Schedule: Instalment 1 now by bank transfer. Instalments 2-4 at Week 4, 8, 12 via email.\n';
    }
  }
  if(notes) m += '*Notes:* ' + notes + '\n';
  m += '────────────────\n';
  m += 'Please confirm my order and payment details. Thank you!';
  window.open(_waLink(m), '_blank');
  // Save order via API (KV + emails)
  var waPi4Data = null;
  if(waPi4Selected) { waPi4Data = { dueToday: total/4, instalment: total/4 }; }
  fetch('/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { name: fname+' '+lname, email: email, phone: phone, address1: addr1, address2: _coField('Address Line 2 (optional)'), city: city, postcode: post },
      order: {
        orderNumber: orderNo,
        items: grouped.map(function(g){ return { name: g.name+(g.colour?' ('+g.colour+')':''), price: g.num, quantity: g.qty }; }),
        subtotal: sub, discount: discount, grandTotal: total, shippingFree: true,
        paymentLabel: payment+(waPi4Selected?' — Pay in 4':''), payIn4: waPi4Data
      },
      channel: 'whatsapp'
    })
  }).catch(function(err){ console.error('WhatsApp order submit failed:', err); });
  // Fire Meta Pixel + GA Purchase event (WhatsApp checkout path)
  try {
    const _pIds = grouped.map(g => g.name);
    const _pItems = grouped.map(g => ({ item_name: g.name, price: g.num, quantity: g.qty }));
    if (typeof fbq === 'function') fbq('track', 'Purchase', {
      content_ids: _pIds,
      contents: grouped.map(g => ({ id: g.name, quantity: g.qty, item_price: g.num })),
      num_items: grouped.reduce((n,g)=>n+g.qty,0),
      value: total, currency: 'GBP'
    });
    if (typeof gtag === 'function') gtag('event', 'purchase', {
      transaction_id: orderNo, currency: 'GBP', value: total, items: _pItems
    });
  } catch(e) {}
}

// ── ADMIN DASHBOARD ──
var _adminPass = '';
function _adminHeaders() { return { 'Content-Type': 'application/json', 'X-Admin-Passcode': _adminPass }; }
function initAdmin() {
  if(_adminPass) { _adminEnterDash(); }
  else {
    document.getElementById('admin-login').style.display='';
    document.getElementById('admin-dash').style.display='none';
  }
}
function _adminEnterDash() {
  document.getElementById('admin-login').style.display='none';
  document.getElementById('admin-dash').style.display='block';
  var _params = new URLSearchParams(location.search);
  var _orderParam = _params.get('order');
  var _enqParam = _params.get('enquiry');
  if (_orderParam) { adminLoadOrders(_orderParam); }
  else if (_enqParam) { adminLoadEnquiries(_enqParam); }
  else { adminShowDashboardHub(); }
}
function adminLogin() {
  var p = document.getElementById('admin-pass').value.trim();
  if(!p) return;
  _adminPass = p;
  fetch('/api/admin/verify', { method:'POST', headers:{ 'Content-Type':'application/json','X-Admin-Passcode':p } })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.success) { _adminEnterDash(); }
      else { _adminPass=''; var e=document.getElementById('admin-err'); e.textContent='Invalid passcode'; e.style.display='block'; }
    }).catch(function(){ _adminPass=''; var e=document.getElementById('admin-err'); e.textContent='Connection error'; e.style.display='block'; });
}
function adminLogout() { _adminPass=''; initAdmin(); document.getElementById('admin-pass').value=''; }

function adminShowDashboardHub() {
  var el = document.getElementById('admin-content');
  el.innerHTML = '<p style="color:var(--muted)">Loading dashboard…</p>';
  Promise.all([
    fetch('/api/admin/enquiries', { headers:_adminHeaders() }).then(function(r){ return r.json(); }).catch(function(){ return { enquiries: [] }; }),
    fetch('/api/admin/orders', { headers:_adminHeaders() }).then(function(r){ return r.json(); }).catch(function(){ return { orders: [] }; }),
  ]).then(function(results) {
    var enquiries = (results[0] && results[0].enquiries) || [];
    var orders = (results[1] && results[1].orders) || [];
    var newEnq = enquiries.filter(function(e){ return e.status !== 'replied'; }).length;
    var pendingOrd = orders.filter(function(o){ return o.status !== 'payment-sent'; }).length;
    var cardStyle = 'background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:32px 24px;cursor:pointer;transition:border-color 0.15s;text-align:center;';
    el.innerHTML =
      '<h3 style="color:var(--volt);font-family:var(--font-c);font-size:12px;letter-spacing:0.1em;margin-bottom:20px">DASHBOARD</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
        '<div style="' + cardStyle + '" onclick="adminLoadOrders()" onmouseover="this.style.borderColor=\'rgba(170,255,0,0.3)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
          '<div style="font-size:32px;margin-bottom:10px">&#128230;</div>' +
          '<div style="font-family:var(--font-d);font-size:32px;font-weight:800;color:var(--white);margin-bottom:4px">' + orders.length + '</div>' +
          '<div style="font-family:var(--font-c);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted)">Orders</div>' +
          (pendingOrd ? '<div style="margin-top:12px;display:inline-block;font-family:var(--font-c);font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;background:rgba(170,255,0,0.1);color:var(--volt);border:1px solid rgba(170,255,0,0.25)">' + pendingOrd + ' pending</div>' : '') +
        '</div>' +
        '<div style="' + cardStyle + '" onclick="adminLoadEnquiries()" onmouseover="this.style.borderColor=\'rgba(170,255,0,0.3)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
          '<div style="font-size:32px;margin-bottom:10px">&#128172;</div>' +
          '<div style="font-family:var(--font-d);font-size:32px;font-weight:800;color:var(--white);margin-bottom:4px">' + enquiries.length + '</div>' +
          '<div style="font-family:var(--font-c);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted)">Enquiries</div>' +
          (newEnq ? '<div style="margin-top:12px;display:inline-block;font-family:var(--font-c);font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;background:rgba(170,255,0,0.1);color:var(--volt);border:1px solid rgba(170,255,0,0.25)">' + newEnq + ' new</div>' : '') +
        '</div>' +
      '</div>';
  }).catch(function(err){ el.innerHTML = '<p style="color:#f44">Failed to load dashboard: '+err.message+'</p>'; });
}

// ── SHARED HELPERS ──
var _adminEnqMap = {};
var _adminOrdMap = {};
function _esc(s) {
  return String(s||'').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function _fmtDate(ts) {
  try { return new Date(ts).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }
  catch(e) { return ''; }
}

// ── EMAIL PREVIEW (browser-side mirror of emailTemplate.js) ──
function _buildPreviewHtml(heading, intro, rows, ctaLabel, ctaHref) {
  var rowsHtml = (rows||[]).filter(function(r){ return r.value || r.html; }).map(function(r) {
    return '<tr>' +
      '<td style="padding:10px 0;border-bottom:1px solid #2A2A2A;font-family:Courier New,Courier,monospace;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#AAFF00;vertical-align:top;width:150px;">' + _esc(r.label) + '</td>' +
      '<td style="padding:10px 0 10px 16px;border-bottom:1px solid #2A2A2A;font-family:' + (r.mono ? 'Courier New,Courier,monospace' : 'Arial,Helvetica,sans-serif') + ';font-size:14px;line-height:1.55;color:#E0E0E0;">' +
      (r.html ? r.html : _esc(r.value||'').replace(/\n/g,'<br>')) + '</td></tr>';
  }).join('');
  return '<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + _esc(heading) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#0A0A0A;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;"><tr><td align="center" style="padding:32px 16px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#141414;border-radius:16px;overflow:hidden;border:1px solid #2A2A2A;">' +
    '<tr><td style="background:#1A1A1A;padding:28px 32px;border-bottom:1px solid #2A2A2A;">' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#AAFF00;">&#9889; VoltTrail</div>' +
    '<div style="font-family:Courier New,Courier,monospace;font-size:11px;color:#666;margin-top:6px;">The UK&apos;s Electric Off-Road Specialists &middot; volttrail.org</div>' +
    '</td></tr><tr><td style="padding:32px;">' +
    '<h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;color:#FFFFFF;">' + _esc(heading) + '</h1>' +
    (intro ? '<p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#999;">' + _esc(intro) + '</p>' : '') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + rowsHtml + '</table>' +
    (ctaHref ? '<a href="' + _esc(ctaHref) + '" style="display:inline-block;margin-top:24px;background:#AAFF00;color:#0A0A0A;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;padding:14px 26px;border-radius:10px;">' + _esc(ctaLabel||'Contact Us') + '</a>' : '') +
    '</td></tr><tr><td style="background:#1A1A1A;padding:20px 32px;border-top:1px solid #2A2A2A;">' +
    '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#666;">VoltTrail &middot; contact@volttrail.org<br>+44 7638 207659 &middot; WhatsApp +44 7638 207659</p>' +
    '</td></tr></table></td></tr></table></body></html>';
}

// ── PAYMENT TERMS ──
function _paymentTermsLines(orderId) {
  var ref = orderId || '[order number]';
  return [
    'Complete payment within 48 hours to confirm this order.',
    'Use your order number — ' + ref + ' — as the payment reference/description.',
    'Once paid, send a screenshot of the completed payment to contact@volttrail.org or WhatsApp +44 7638 207659 for confirmation.',
  ];
}
function _paymentTermsHtml(orderId) {
  var ref = _esc(orderId || '[order number]');
  var pts = [
    'Complete payment within <strong>48 hours</strong> to confirm this order.',
    'Use your order number — <strong>' + ref + '</strong> — as the payment reference/description.',
    'Once paid, send a screenshot of the completed payment to <a href="mailto:contact@volttrail.org" style="color:#AAFF00;font-weight:700;text-decoration:underline;">contact@volttrail.org</a> or WhatsApp <a href="https://wa.me/447638207659" style="color:#AAFF00;font-weight:700;text-decoration:underline;">+44\u00a07638\u00a0207659</a> for confirmation.',
  ];
  return '<ul style="margin:8px 0;padding:0 0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999;line-height:1.8;">' +
    pts.map(function(t){ return '<li style="margin-bottom:6px;">' + t + '</li>'; }).join('') + '</ul>';
}

// ── PAYMENT INSTRUCTIONS DEFAULTS ──
function _defaultInstructions(method, amount, orderId) {
  var amt = amount || '[amount]';
  var ref = orderId || '[order number]';
  if (method === 'Pay in 4') {
    return 'First instalment of ' + amt + ' is due now.\n\nThe remaining 3 fortnightly instalments follow automatically at 0% interest. Reply to this email or WhatsApp us and we will send a secure payment link.';
  }
  return 'Please transfer ' + amt + ' to:\n\nBank: [Bank Name]\nSort Code: [XX-XX-XX]\nAccount: [XXXXXXXX]\nReference: ' + ref + '\n\nFaster Payments usually clears within 2 hours.';
}

// ── WHATSAPP MESSAGE ──
function _buildWaMessage(orderId, amount, instructions, termsLines) {
  return [
    'Hi! Here are the payment details for your VoltTrail order ⚡',
    '',
    '*Order:* ' + (orderId || '[order number]'),
    '*Amount Due:* ' + (amount || '[amount]'),
    '',
    instructions || '[instructions]',
    '',
    '――――――――',
    'Payment Terms:',
  ].concat((termsLines || []).map(function(t){ return '• ' + t; })).join('\n');
}

// ── PAYMENT COMPOSER ──
var _payForm = { orderId:'', name:'', email:'', phone:'', amount:'', method:'Bank Transfer', mode:'template', instructions:'', pastedDetail:'', notes:'' };

function adminShowPayment(orderNum) {
  var o = _adminOrdMap[orderNum] || { orderNumber: orderNum };
  _payForm.orderId = o.orderNumber || '';
  _payForm.name = o.customerName || '';
  _payForm.email = o.customerEmail || '';
  _payForm.phone = o.customerPhone || '';
  _payForm.amount = o.amountDue || '';
  _payForm.method = (o.paymentLabel && o.paymentLabel.toLowerCase().indexOf('4') > -1) ? 'Pay in 4' : 'Bank Transfer';
  _payForm.mode = 'template';
  _payForm.instructions = _defaultInstructions(_payForm.method, _payForm.amount, _payForm.orderId);
  _payForm.pastedDetail = '';
  _payForm.notes = '';
  document.getElementById('admin-content').innerHTML = _renderPaymentForm();
  _updatePaymentPreview();
}

function adminNewPayment() {
  _payForm = { orderId:'', name:'', email:'', phone:'', amount:'', method:'Bank Transfer', mode:'template', instructions:'', pastedDetail:'', notes:'' };
  _payForm.instructions = _defaultInstructions('Bank Transfer', '', '');
  document.getElementById('admin-content').innerHTML = _renderPaymentForm();
  _updatePaymentPreview();
}

function _renderPaymentForm() {
  var f = _payForm;
  var IS = 'width:100%;background:#1a1e1a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--white);box-sizing:border-box;';
  var LS = 'display:block;font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;';
  var SS = 'background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;';
  var tplA = f.mode==='template' ? 'background:var(--volt);color:#000;' : 'color:var(--muted);';
  var pasteA = f.mode==='paste' ? 'background:var(--volt);color:#000;' : 'color:var(--muted);';
  var methodOpts = ['Bank Transfer','Pay in 4'].map(function(m){
    return '<option value="' + m + '"' + (f.method===m?' selected':'') + '>' + m + '</option>';
  }).join('');

  var out = '<button class="btn-outline" style="font-size:11px;padding:4px 12px;margin-bottom:16px" onclick="adminLoadOrders()">&#8592; All Orders</button>';
  out += '<h3 style="color:var(--white);font-family:var(--font-d);font-size:20px;margin-bottom:4px">Send Payment Details</h3>';
  out += '<p style="color:var(--muted);font-size:12px;margin-bottom:20px">Fill in the details, review the preview below, then send.</p>';
  out += '<div style="' + SS + '">';

  out += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">';
  out += '<div><label style="' + LS + '">Order #</label><input id="pf-order" class="form-input" style="' + IS + '" value="' + _esc(f.orderId) + '" oninput="_payForm.orderId=this.value;_updatePaymentPreview()"></div>';
  out += '<div><label style="' + LS + '">Amount Due</label><input id="pf-amount" class="form-input" style="' + IS + '" value="' + _esc(f.amount) + '" placeholder="e.g. \u00a31,299" oninput="_payForm.amount=this.value;_updatePaymentPreview()"></div>';
  out += '</div>';

  out += '<div style="margin-bottom:14px"><label style="' + LS + '">Customer Name</label><input id="pf-name" class="form-input" style="' + IS + '" value="' + _esc(f.name) + '" oninput="_payForm.name=this.value;_updatePaymentPreview()"></div>';

  out += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">';
  out += '<div><label style="' + LS + '">Customer Email *</label><input id="pf-email" type="email" class="form-input" style="' + IS + '" value="' + _esc(f.email) + '" oninput="_payForm.email=this.value"></div>';
  out += '<div><label style="' + LS + '">Customer Phone</label><input id="pf-phone" type="tel" class="form-input" style="' + IS + '" value="' + _esc(f.phone) + '" placeholder="+44 7xxx xxxxxx" oninput="_payForm.phone=this.value"></div>';
  out += '</div>';

  out += '<div style="margin-bottom:14px"><label style="' + LS + '">Payment Method</label>';
  out += '<select id="pf-method" class="form-input" style="' + IS + '" onchange="_payForm.method=this.value;_payForm.mode=\'template\';_payForm.instructions=_defaultInstructions(_payForm.method,_payForm.amount,_payForm.orderId);_payForm.pastedDetail=\'\';document.getElementById(\'admin-content\').innerHTML=_renderPaymentForm();_updatePaymentPreview()">' + methodOpts + '</select></div>';

  out += '<div style="margin-bottom:14px">';
  out += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  out += '<label style="' + LS + 'margin-bottom:0">Instructions *</label>';
  out += '<div style="display:flex;background:#1a1e1a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:2px;gap:2px">';
  out += '<button type="button" style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:4px 10px;border-radius:4px;border:none;cursor:pointer;' + tplA + '" onclick="adminPaySetMode(\'template\')">Template</button>';
  out += '<button type="button" style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:4px 10px;border-radius:4px;border:none;cursor:pointer;' + pasteA + '" onclick="adminPaySetMode(\'paste\')">Paste</button>';
  out += '</div></div>';

  if (f.mode === 'paste') {
    var openLine = f.method === 'Pay in 4' ? 'First instalment of ' + (f.amount||'[amount]') + ' is due now.' : 'Please transfer ' + (f.amount||'[amount]') + ' to:';
    var closeLine = f.method === 'Pay in 4' ? 'The remaining 3 fortnightly instalments follow at 0% interest.' : 'Faster Payments usually clears within 2 hours.';
    out += '<p id="pf-open-line" style="font-family:var(--font-c);font-size:11px;color:var(--dim);font-style:italic;margin-bottom:6px">' + _esc(openLine) + '</p>';
    out += '<textarea id="pf-instructions" class="form-textarea" style="' + IS + 'font-family:monospace;font-size:12px;min-height:100px;resize:vertical" placeholder="Paste payment detail here (sort code, account number, etc.)" oninput="_payForm.pastedDetail=this.value;_payForm.instructions=document.getElementById(\'pf-open-line\').textContent+\'\\n\\n\'+this.value+\'\\n\\n\'+document.getElementById(\'pf-close-line\').textContent;_updatePaymentPreview()">' + _esc(f.pastedDetail) + '</textarea>';
    out += '<p id="pf-close-line" style="font-family:var(--font-c);font-size:11px;color:var(--dim);font-style:italic;margin-top:6px">' + _esc(closeLine) + '</p>';
    out += '<p style="font-size:11px;color:var(--dim);margin-top:4px">Paste mode — the opening and closing lines wrap around it automatically.</p>';
  } else {
    out += '<textarea id="pf-instructions" class="form-textarea" style="' + IS + 'font-family:monospace;font-size:12px;min-height:130px;resize:vertical" oninput="_payForm.instructions=this.value;_updatePaymentPreview()">' + _esc(f.instructions) + '</textarea>';
    out += '<p style="font-size:11px;color:var(--dim);margin-top:6px">Auto-filled from the payment method — edit freely.</p>';
  }
  out += '</div>';

  out += '<div style="background:#1a1e1a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;margin-bottom:14px">';
  out += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  out += '<span style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted)">Payment Terms</span>';
  out += '<span style="font-size:10px;color:var(--dim);font-family:var(--font-c)">always included</span>';
  out += '</div>';
  out += '<ul style="margin:0;padding:0 0 0 16px;font-size:12px;color:var(--muted);line-height:1.7">' +
    _paymentTermsLines(f.orderId).map(function(t){ return '<li>' + _esc(t) + '</li>'; }).join('') + '</ul>';
  out += '</div>';

  out += '<div><label style="' + LS + '">Notes (optional)</label><textarea id="pf-notes" class="form-textarea" style="' + IS + 'min-height:60px;resize:vertical" placeholder="e.g. estimated dispatch date" oninput="_payForm.notes=this.value;_updatePaymentPreview()">' + _esc(f.notes) + '</textarea></div>';
  out += '</div>';

  out += '<h4 style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Email Preview</h4>';
  out += '<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;margin-bottom:20px">';
  out += '<iframe id="pay-preview-frame" title="Email preview" style="width:100%;height:520px;border:0" src="about:blank"></iframe>';
  out += '</div>';

  out += '<div id="pay-error" style="color:#f44;font-size:12px;text-align:center;display:none;margin-bottom:10px"></div>';
  out += '<button type="button" class="btn-primary" id="pay-send-btn" style="width:100%;justify-content:center;padding:14px;margin-bottom:20px" onclick="adminSendPayment()">Send to <span id="pay-send-email">' + _esc(f.email||'customer') + '</span></button>';

  out += '<div style="display:flex;align-items:center;gap:12px;margin:0 0 16px">';
  out += '<div style="flex:1;height:1px;background:rgba(255,255,255,0.08)"></div>';
  out += '<span style="font-family:var(--font-c);font-size:10px;color:var(--dim);letter-spacing:0.08em;text-transform:uppercase">or send via WhatsApp</span>';
  out += '<div style="flex:1;height:1px;background:rgba(255,255,255,0.08)"></div></div>';

  out += '<h4 style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin-bottom:10px">WhatsApp Message Preview</h4>';
  out += '<div style="border:1px solid var(--border);border-radius:12px;background:#0d1117;padding:16px;margin-bottom:12px">';
  out += '<pre id="wa-preview" style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#E9EDEF;white-space:pre-wrap;line-height:1.55"></pre>';
  out += '</div>';
  out += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">';
  out += '<button type="button" class="btn-outline" onclick="adminCopyWaMessage()" style="justify-content:center;font-size:13px"><span id="wa-copy-label">Copy Message</span></button>';
  out += '<button type="button" class="btn-primary" style="justify-content:center;font-size:13px;background:#25D366;border-color:#25D366;color:#000" onclick="adminSendWhatsApp()">';
  out += '<svg style="width:16px;height:16px;margin-right:6px;flex-shrink:0;vertical-align:middle" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.179.183-.077.359.101.176.449.741.964 1.201.662.591 1.221.774 1.394.861.173.086.275.072.376-.044.101-.116.433-.506.549-.679.116-.173.231-.145.39-.087s1.011.477 1.184.564c.173.087.289.13.332.202.043.073.043.419-.101.824z"/></svg>';
  out += 'Send via WhatsApp</button>';
  out += '</div>';
  out += '<p style="font-size:11px;color:var(--dim);text-align:center">Opens the customer\'s WhatsApp with the message ready — press send there.</p>';

  return out;
}

function adminPaySetMode(mode) {
  _payForm.mode = mode;
  if (mode === 'template') {
    _payForm.instructions = _defaultInstructions(_payForm.method, _payForm.amount, _payForm.orderId);
  } else {
    _payForm.pastedDetail = '';
  }
  document.getElementById('admin-content').innerHTML = _renderPaymentForm();
  _updatePaymentPreview();
}

function _updatePaymentPreview() {
  var f = _payForm;
  var frame = document.getElementById('pay-preview-frame');
  if (frame) {
    var tHtml = _paymentTermsHtml(f.orderId);
    var rows = [
      { label:'Order #', value:f.orderId, mono:true },
      { label:'Amount Due', value:f.amount, mono:true },
      { label:'Payment Method', value:f.method },
      { label:'Instructions', value:f.instructions, mono:true },
      { label:'Payment Terms', html:tHtml },
    ];
    if (f.notes) rows.push({ label:'Notes', value:f.notes });
    frame.srcdoc = _buildPreviewHtml(
      'Payment Details — ' + (f.orderId||'[order number]'),
      'Hi ' + (f.name||'[customer]') + ', thanks for your patience — here are the payment details to finalise Order ' + (f.orderId||'[order number]') + '. Once payment is received we will confirm and get it ready for dispatch.',
      rows, 'Questions? Contact Us', 'mailto:contact@volttrail.org'
    );
  }
  var waEl = document.getElementById('wa-preview');
  if (waEl) waEl.textContent = _buildWaMessage(f.orderId, f.amount, f.instructions, _paymentTermsLines(f.orderId));
  var sendEl = document.getElementById('pay-send-email');
  if (sendEl) sendEl.textContent = f.email || 'customer';
}

function adminCopyWaMessage() {
  var f = _payForm;
  var msg = _buildWaMessage(f.orderId, f.amount, f.instructions, _paymentTermsLines(f.orderId));
  if (navigator.clipboard) { navigator.clipboard.writeText(msg).catch(function(){}); }
  var lbl = document.getElementById('wa-copy-label');
  if (lbl) { lbl.textContent='Copied!'; setTimeout(function(){ lbl.textContent='Copy Message'; }, 2000); }
}

function adminSendWhatsApp() {
  var f = _payForm;
  if (!f.phone) { alert('Enter customer phone number first.'); return; }
  var msg = _buildWaMessage(f.orderId, f.amount, f.instructions, _paymentTermsLines(f.orderId));
  var phone = f.phone.replace(/[\s\-\(\)]/g,'').replace(/^\+/,'');
  window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
}

function adminSendPayment() {
  var f = _payForm;
  var errEl = document.getElementById('pay-error');
  if (!f.email) { if(errEl){errEl.textContent='Enter customer email first.';errEl.style.display='block';} return; }
  if (!f.instructions.trim()) { if(errEl){errEl.textContent='Enter payment instructions first.';errEl.style.display='block';} return; }
  var btn = document.getElementById('pay-send-btn');
  if (btn) { btn.disabled=true; btn.textContent='Sending…'; }
  fetch('/api/admin/send-payment-email', {
    method:'POST', headers:_adminHeaders(),
    body:JSON.stringify({ orderId:f.orderId, orderNumber:f.orderId, customerName:f.name, customerEmail:f.email, amountDue:f.amount, paymentMethod:f.method, instructions:f.instructions, notes:f.notes })
  }).then(function(r){ return r.json(); })
    .then(function(d){
      if(d.success) {
        document.getElementById('admin-content').innerHTML = '<div style="text-align:center;padding:48px 0">' +
          '<div style="width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:rgba(76,175,80,0.15);border:1px solid rgba(76,175,80,0.3);display:flex;align-items:center;justify-content:center;font-size:24px;color:#4caf50">&#10003;</div>' +
          '<h3 style="color:var(--white);margin-bottom:8px">Sent to ' + _esc(f.email) + '</h3>' +
          '<p style="color:var(--muted);font-size:13px;margin-bottom:20px">Payment details for Order ' + _esc(f.orderId) + ' are on their way.</p>' +
          '<div style="display:flex;flex-direction:column;gap:10px;max-width:260px;margin:0 auto">' +
          '<button class="btn-outline" onclick="adminNewPayment()">Send Another</button>' +
          '<button class="btn-outline" onclick="adminLoadOrders()">&#8592; Back to Orders</button>' +
          '</div></div>';
      } else {
        if(errEl){errEl.textContent=d.message||'Something went wrong.';errEl.style.display='block';}
        if(btn){btn.disabled=false;btn.innerHTML='Send to <span id="pay-send-email">' + _esc(f.email) + '</span>';}
      }
    }).catch(function(err){
      if(errEl){errEl.textContent='Error: '+err.message;errEl.style.display='block';}
      if(btn){btn.disabled=false;btn.innerHTML='Send to <span id="pay-send-email">' + _esc(f.email) + '</span>';}
    });
}

// ── ENQUIRY CARDS ──
function adminLoadEnquiries(autoOpenId) {
  var el = document.getElementById('admin-content');
  el.innerHTML = '<p style="color:var(--muted)">Loading enquiries…</p>';
  fetch('/api/admin/enquiries', { headers:_adminHeaders() }).then(function(r){ return r.json(); }).then(function(d){
    _adminEnqMap = {};
    if(!d.enquiries || !d.enquiries.length) { el.innerHTML = '<p style="color:var(--muted)">No enquiries yet.</p>'; return; }
    d.enquiries.forEach(function(eq){ _adminEnqMap[eq.id] = eq; });
    el.innerHTML = '<h3 style="color:var(--volt);font-family:var(--font-c);font-size:12px;letter-spacing:0.1em;margin-bottom:16px">ENQUIRIES (' + d.enquiries.length + ')</h3>' +
      d.enquiries.map(function(eq){
        var eid = _esc(JSON.stringify(eq.id));
        var statusBadge = eq.status === 'replied'
          ? '<span style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:rgba(76,175,80,0.15);color:#4caf50;border:1px solid rgba(76,175,80,0.3)">Replied</span>'
          : '<span style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:rgba(170,255,0,0.1);color:var(--volt);border:1px solid rgba(170,255,0,0.25)">New</span>';
        return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:10px;cursor:pointer;transition:border-color 0.15s" onclick="adminShowReply(' + eid + ')" onmouseover="this.style.borderColor=\'rgba(170,255,0,0.3)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;flex-wrap:wrap">' +
            '<div style="display:flex;align-items:center;gap:8px">' + statusBadge + '<span style="font-size:14px;font-weight:600;color:var(--white)">' + _esc(eq.name) + '</span></div>' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<span style="font-size:11px;color:var(--dim)">' + _fmtDate(eq.createdAt) + '</span>' +
              '<button style="background:none;border:none;color:rgba(244,67,54,0.5);cursor:pointer;padding:4px 6px;border-radius:6px;font-size:13px" onclick="event.stopPropagation();adminDeleteEnquiry(' + eid + ')">&#128465;</button>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:4px">' + _esc(eq.email) + (eq.phone ? ' &middot; ' + _esc(eq.phone) : '') + (eq.meta&&eq.meta.Interest ? ' &middot; ' + _esc(eq.meta.Interest) : '') + '</div>' +
          (eq.message ? '<div style="font-size:12px;color:var(--dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + _esc(eq.message.slice(0,100)) + (eq.message.length>100?'…':'') + '</div>' : '') +
        '</div>';
      }).join('');
    if (autoOpenId && _adminEnqMap[autoOpenId]) { adminShowReply(autoOpenId); }
  }).catch(function(err){ el.innerHTML = '<p style="color:#f44">Failed to load: '+err.message+'</p>'; });
}

// ── REPLY COMPOSER ──
function adminShowReply(eqId) {
  var eq = _adminEnqMap[eqId];
  if (!eq) { alert('Enquiry not found — try refreshing.'); return; }
  var IS = 'width:100%;background:#1a1e1a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--white);box-sizing:border-box;';
  var SS = 'background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;';
  var eid = JSON.stringify(eqId);
  var eidAttr = _esc(eid);
  var out = '<button class="btn-outline" style="font-size:11px;padding:4px 12px;margin-bottom:16px" onclick="adminLoadEnquiries()">&#8592; All Enquiries</button>';
  out += '<h3 style="color:var(--white);font-family:var(--font-d);font-size:20px;margin-bottom:4px">Reply to Enquiry</h3>';
  out += '<p style="color:var(--muted);font-size:12px;margin-bottom:20px">Review their message, write your reply, then send.</p>';
  out += '<div style="' + SS + '">';
  out += '<div style="font-size:14px;font-weight:600;color:var(--white);margin-bottom:4px">' + _esc(eq.name) + '</div>';
  out += '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">' + _esc(eq.email) + (eq.phone ? ' &middot; ' + _esc(eq.phone) : '') + '</div>';
  if (eq.message) {
    out += '<div style="background:#1a1e1a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px">';
    out += '<div style="font-family:var(--font-c);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--dim);margin-bottom:8px">Their Message</div>';
    out += '<p style="font-size:13px;color:var(--white);white-space:pre-wrap;margin:0">' + _esc(eq.message) + '</p>';
    out += '</div>';
  }
  out += '</div>';
  out += '<div style="' + SS + '"><label style="display:block;font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Your Reply *</label>';
  out += '<textarea id="reply-msg" class="form-textarea" data-eqid=' + eid + ' style="' + IS + 'min-height:140px;resize:vertical" placeholder="Type your reply — sent as a branded email with their original message quoted underneath." oninput="_updateReplyPreview(' + eidAttr + ')"></textarea></div>';
  out += '<h4 style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Preview</h4>';
  out += '<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;margin-bottom:20px">';
  out += '<iframe id="reply-preview-frame" title="Email preview" style="width:100%;height:500px;border:0" src="about:blank"></iframe>';
  out += '</div>';
  out += '<div id="reply-error" style="color:#f44;font-size:12px;text-align:center;display:none;margin-bottom:10px"></div>';
  out += '<button type="button" id="reply-send-btn" class="btn-primary" style="width:100%;justify-content:center;padding:14px" onclick="adminSendReply(' + eidAttr + ')">Send to ' + _esc(eq.email) + '</button>';
  document.getElementById('admin-content').innerHTML = out;
  _updateReplyPreview(eqId);
}

function _updateReplyPreview(eqId) {
  var eq = _adminEnqMap[eqId];
  var frame = document.getElementById('reply-preview-frame');
  var msgEl = document.getElementById('reply-msg');
  if (!eq || !frame) return;
  var msg = msgEl ? msgEl.value : '';
  var topic = (eq.meta && eq.meta.Interest) || eq.name || 'Your Enquiry';
  frame.srcdoc = _buildPreviewHtml(
    'Re: ' + topic,
    'Hi ' + (eq.name||'[customer]') + ',',
    [{ label:'Reply', value:msg||'[your reply]' }, { label:'Your Original Message', value:eq.message||'' }],
    'Reply to This Email', 'mailto:contact@volttrail.org'
  );
}

function adminSendReply(eqId) {
  var eq = _adminEnqMap[eqId];
  if (!eq) return;
  var msgEl = document.getElementById('reply-msg');
  var msg = msgEl ? msgEl.value.trim() : '';
  if (!msg) { var e=document.getElementById('reply-error'); if(e){e.textContent='Write a reply first.';e.style.display='block';} return; }
  var btn = document.getElementById('reply-send-btn');
  if (btn) { btn.disabled=true; btn.textContent='Sending…'; }
  fetch('/api/admin/reply-enquiry', {
    method:'POST', headers:_adminHeaders(),
    body:JSON.stringify({ id:eq.id, message:msg })
  }).then(function(r){ return r.json(); })
    .then(function(d){
      if(d.success) {
        document.getElementById('admin-content').innerHTML = '<div style="text-align:center;padding:48px 0">' +
          '<div style="width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:rgba(76,175,80,0.15);border:1px solid rgba(76,175,80,0.3);display:flex;align-items:center;justify-content:center;font-size:24px;color:#4caf50">&#10003;</div>' +
          '<h3 style="color:var(--white);margin-bottom:8px">Sent to ' + _esc(eq.email) + '</h3>' +
          '<p style="color:var(--muted);font-size:13px;margin-bottom:20px">Your reply to ' + _esc(eq.name) + ' is on its way.</p>' +
          '<button class="btn-outline" onclick="adminLoadEnquiries()">&#8592; Back to Enquiries</button></div>';
      } else {
        var e=document.getElementById('reply-error');
        if(e){e.textContent=d.message||'Failed to send.';e.style.display='block';}
        if(btn){btn.disabled=false;btn.textContent='Send to '+eq.email;}
      }
    }).catch(function(err){
      var e=document.getElementById('reply-error');
      if(e){e.textContent='Error: '+err.message;e.style.display='block';}
      if(btn){btn.disabled=false;btn.textContent='Send to '+eq.email;}
    });
}

function adminDeleteEnquiry(id) {
  if(!confirm('Delete this enquiry? This can\'t be undone.')) return;
  fetch('/api/admin/enquiries?id='+encodeURIComponent(id), { method:'DELETE', headers:_adminHeaders() })
    .then(function(r){ return r.json(); })
    .then(function(d){ if(d.success) adminLoadEnquiries(); else alert(d.message||'Could not delete.'); })
    .catch(function(err){ alert('Error: '+err.message); });
}

// ── ORDER CARDS ──
function adminLoadOrders(autoOpenOrder) {
  var el = document.getElementById('admin-content');
  el.innerHTML = '<p style="color:var(--muted)">Loading orders…</p>';
  fetch('/api/admin/orders', { headers:_adminHeaders() }).then(function(r){ return r.json(); }).then(function(d){
    _adminOrdMap = {};
    if(!d.orders || !d.orders.length) { el.innerHTML = '<p style="color:var(--muted)">No orders yet — they\'ll show up here as customers check out.</p>'; return; }
    d.orders.forEach(function(o){ _adminOrdMap[o.orderNumber] = o; });
    el.innerHTML = '<h3 style="color:var(--volt);font-family:var(--font-c);font-size:12px;letter-spacing:0.1em;margin-bottom:16px">ORDERS (' + d.orders.length + ')</h3>' +
      d.orders.map(function(o){
        var oid = _esc(JSON.stringify(o.orderNumber));
        var statusBadge = o.status === 'payment-sent'
          ? '<span style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:rgba(76,175,80,0.15);color:#4caf50;border:1px solid rgba(76,175,80,0.3)">Sent</span>'
          : '<span style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:rgba(170,255,0,0.1);color:var(--volt);border:1px solid rgba(170,255,0,0.25)">Pending</span>';
        var chanBadge = o.channel === 'whatsapp'
          ? '<span style="font-family:var(--font-c);font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:rgba(37,211,102,0.12);color:#25D366;border:1px solid rgba(37,211,102,0.25)">WhatsApp</span>'
          : '';
        return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:10px;display:flex;align-items:flex-start;gap:10px;transition:border-color 0.15s" onmouseover="this.style.borderColor=\'rgba(170,255,0,0.3)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
          '<div style="flex:1;min-width:0;cursor:pointer" onclick="adminShowPayment(' + oid + ')">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">' +
              '<span style="font-family:var(--font-c);font-size:13px;font-weight:700;color:var(--volt)">' + _esc(o.orderNumber) + '</span>' +
              statusBadge + chanBadge +
            '</div>' +
            '<div style="font-size:14px;font-weight:600;color:var(--white);margin-bottom:2px">' + _esc(o.customerName) + '</div>' +
            '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">' + _esc(o.customerEmail) + (o.customerPhone?' &middot; '+_esc(o.customerPhone):'') + '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">' +
              '<div style="font-size:11px;color:var(--dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1">' + _esc((o.itemsSummary||'').split('\n')[0]||'') + '</div>' +
              '<div style="text-align:right;flex-shrink:0">' +
                '<div style="font-family:var(--font-c);font-size:14px;font-weight:700;color:var(--white)">' + _esc(o.amountDue) + '</div>' +
                '<div style="font-size:10px;color:var(--dim);margin-top:2px">' + _fmtDate(o.createdAt) + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button style="flex-shrink:0;background:none;border:none;color:rgba(244,67,54,0.5);cursor:pointer;padding:6px 8px;border-radius:6px;font-size:14px;transition:all 0.15s;align-self:center" onclick="adminDeleteOrder(' + oid + ')" title="Delete order">&#128465;</button>' +
        '</div>';
      }).join('') +
      '<button class="btn-outline" style="width:100%;justify-content:center;margin-top:4px;font-size:12px" onclick="adminNewPayment()">Compose without an order &rarr;</button>';
    if (autoOpenOrder && _adminOrdMap[autoOpenOrder]) { adminShowPayment(autoOpenOrder); }
  }).catch(function(err){ el.innerHTML = '<p style="color:#f44">Failed to load: '+err.message+'</p>'; });
}

function adminDeleteOrder(orderNumber) {
  if(!confirm('Delete order ' + orderNumber + '? This can\'t be undone.')) return;
  fetch('/api/admin/orders?id=' + encodeURIComponent(orderNumber), { method:'DELETE', headers:_adminHeaders() })
    .then(function(r){ return r.json(); })
    .then(function(d){ if(d.success) adminLoadOrders(); else alert(d.message||'Could not delete order.'); })
    .catch(function(err){ alert('Error: '+err.message); });
}

// ── COMPARE PAGE BUILD ──
function buildComparePage() {
  const el = document.getElementById('compare-tool-content');
  if(!el) return;
  const compareData = [
    { brand:'Sur-Ron', name:'Light Bee X', power:'6 kW', topspeed:'45 mph', range:'47 mi', weight:'57 kg', price:'£3,199', seat:'810mm', battery:'60V 32Ah', regen:'3 levels', road:'✓ L1e version', warranty:'1 yr' },
    { brand:'Talaria', name:'Sting R', power:'8 kW', topspeed:'53 mph', range:'53 mi', weight:'66 kg', price:'£3,735', seat:'880mm', battery:'60V 38Ah', regen:'4 levels', road:'✓ L1e version', warranty:'1 yr' },
    { brand:'Stark Varg', name:'MX 1.2', power:'60 kW', topspeed:'—', range:'49 mi', weight:'110 kg', price:'£10,490', seat:'950mm', battery:'7.2 kWh', regen:'App-tuned', road:'No (EX version)', warranty:'2 yrs' },
  ];
  const fields = [
    ['Peak Power','power'],['Top Speed','topspeed'],['Range','range'],
    ['Weight','weight'],['Price','price'],['Seat Height','seat'],
    ['Battery','battery'],['Regen Braking','regen'],['Road Legal','road'],['Warranty','warranty']
  ];
  const headers = compareData.map(b => `<th style="text-align:center"><div style="font-family:var(--font-c);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--volt);margin-bottom:4px">${b.brand}</div><div style="font-family:var(--font-d);font-size:20px;color:var(--white)">${b.name}</div><button class="btn-primary" style="margin-top:12px;padding:8px 16px;font-size:12px" onclick="showPage('brand-${b.brand.toLowerCase().replace(' ','-')}')">View Brand →</button></th>`).join('');
  const rows = fields.map(([label, key]) => {
    const cells = compareData.map(b => `<td style="text-align:center;padding:14px 20px;border-bottom:1px solid var(--border);font-size:14px;color:var(--white)">${b[key]}</td>`).join('');
    return `<tr><td style="padding:14px 20px;border-bottom:1px solid var(--border);font-family:var(--font-c);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--dim)">${label}</td>${cells}</tr>`;
  }).join('');
  el.innerHTML = `<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th></th>${headers}</tr></thead><tbody>${rows}</tbody></table></div>
  <div style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap">
    <a class="btn-primary" style="text-decoration:none;" href="/guides/surron-vs-talaria-sting/" data-route="guide-surron-talaria">Full Sur-Ron vs Talaria Guide →</a>
    <a class="btn-outline" style="text-decoration:none;" href="/electric-dirt-bikes/" data-route="shop">Browse All Bikes</a>
  </div>`;
}

// ── SALE GRID INIT ──
function initSaleGrid() {
  const el = document.getElementById('sale-grid');
  if(!el || el.innerHTML.trim()) return;
  const saleItems = [
    {...bikes.find(b=>b.id==='funbikes-790'), oldPrice:'£495', badges:['sale','stock']},
    {...bikes.find(b=>b.id==='razor-mx350'), oldPrice:'£365', badges:['sale','stock']},
    {...quads.find(b=>b.id==='razor-quad'), oldPrice:'£349', badges:['sale','stock']},
    {...parts[1], oldPrice:'£109', badges:['sale','stock']},
  ].filter(Boolean);
  el.innerHTML = saleItems.map(i => renderCard(i, i.type || (i.id&&i.id.includes('quad') ? 'quad' : 'bike'))).join('');
}

// ── E RIDE PRO GRID ──
function initErideGrid() {
  const el = document.getElementById('eride-grid');
  if(!el || el.innerHTML.trim()) return;
  populateGrid('eride-grid', bikes.filter(b=>b.tags.includes('eride')), 'bike');
}

// ── RELATED GRIDS ──
function initRelatedTalaria() {
  const el = document.getElementById('related-talaria-grid');
  if(!el || el.innerHTML.trim()) return;
  populateGrid('related-talaria-grid', bikes.filter(b=>b.tags.includes('surron')||b.tags.includes('stark')).slice(0,3), 'bike');
}

// ── NEWSLETTER HANDLER ──
function handleNewsletter(e) {
  e.preventDefault();
  const form = e.target;
  const emailInput = form.querySelector('input[type=email]');
  const email = emailInput ? emailInput.value.trim() : '';
  const showSuccess = function(){
    const wrap = document.getElementById('newsletter-form-wrap');
    if(wrap) wrap.innerHTML = `<div class="tick">✅</div><h3>You're In!</h3><p style="color:var(--muted);font-size:15px">Thanks for subscribing. Watch your inbox for new bikes, deals and riding guides.</p><a class="btn-primary" style="text-decoration:none;margin-top:24px" href="/" data-route="home">Back to Home →</a>`;
  };
  if(email) {
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Newsletter Subscriber', email: email, message: 'Newsletter signup: ' + email, interest: 'Newsletter' })
    }).catch(function(err){ console.error('Newsletter submit failed:', err); })
      .finally(showSuccess);
  } else {
    showSuccess();
  }
}

// ── MASTER PAGE ROUTER (single authoritative definition) ──
const _baseShowPage = null; // unused — kept for reference only
function _showPageFull(id) {
  // Always close the cart panel and payment overlay on page navigation
  var _cp = document.getElementById('cart-panel');
  var _co = document.getElementById('cart-panel-overlay');
  var _fo = document.getElementById('fincra-overlay');
  if (_cp) _cp.classList.remove('open');
  if (_co) _co.classList.remove('open');
  if (_fo) _fo.classList.remove('open');
  // Demote any previously promoted H1 back to H2 so we keep exactly one H1 in the DOM
  document.querySelectorAll('h1.page-h1-promoted').forEach(el => {
    const h2 = document.createElement('h2');
    h2.className = el.className.replace('page-h1-promoted','').trim() + ' page-h1';
    h2.innerHTML = el.innerHTML;
    if (el.getAttribute('style')) h2.setAttribute('style', el.getAttribute('style'));
    el.parentNode.replaceChild(h2, el);
  });
  // If we're navigating to home, restore the hero H1 (demoted by the early bootstrap)
  if (id === 'home') {
    const demoted = document.querySelector('.hero-h1-demoted');
    if (demoted) {
      const h1 = document.createElement('h1');
      h1.className = demoted.className.replace('hero-h1-demoted','').trim();
      h1.innerHTML = demoted.innerHTML;
      demoted.parentNode.replaceChild(h1, demoted);
    }
  } else {
    // Going to a non-home page: ensure the hero H1 is demoted if it's currently an H1
    const heroH1 = document.querySelector('h1.hero-title');
    if (heroH1) {
      const div = document.createElement('div');
      div.className = heroH1.className + ' hero-h1-demoted';
      div.innerHTML = heroH1.innerHTML;
      heroH1.parentNode.replaceChild(div, heroH1);
    }
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-'+id);
  if(target) {
    target.classList.add('active');
    // If this page isn't the home page (which has its own real <h1>), promote the page's main heading to <h1>
    if(id !== 'home') {
      const h2 = target.querySelector('h2.page-h1');
      if(h2) {
        const h1 = document.createElement('h1');
        h1.className = h2.className.replace('page-h1','').trim() + ' page-h1-promoted';
        h1.innerHTML = h2.innerHTML;
        h2.parentNode.replaceChild(h1, h2);
      }
    }
    window.scrollTo({top:0,behavior:'smooth'});
    initGrids();
    initFAQ();
    if(typeof initFilterBars==='function') initFilterBars();
    if(id==='home' && typeof tpUpdateSlider==='function') { setTimeout(tpUpdateSlider, 50); }
    if(id==='cart') rebuildCartPage();
    if(id==='checkout') initCheckout();
    if(id==='admin') initAdmin();
    if(id==='blog') renderBlogIndex();
    if(id==='compare-tool') buildComparePage();
    if(id==='sale') initSaleGrid();
    if(id==='brand-eride') initErideGrid();
    if(id==='product-talaria-sting') initRelatedTalaria();
    if(id==='finance-calc') { setTimeout(initFinanceCalc, 50); }
    // SPA PageView — fire Meta Pixel + GA on every route change so analytics tracks every page,
    // not just the initial landing. Critical for ad-spend optimisation.
    try {
      if (typeof fbq === 'function') fbq('track', 'PageView');
      if (typeof gtag === 'function' && window.GA_MEASUREMENT_ID) gtag('config', window.GA_MEASUREMENT_ID, {
        page_path: window.location.pathname,
        page_title: document.title
      });
    } catch(e) {}
  } else {
    const fallback = document.getElementById('page-404');
    if(fallback) { fallback.classList.add('active'); window.scrollTo({top:0}); }
  }
}

// ── WIRE FOOTER LINKS WITH NEW PAGES ──
document.addEventListener('DOMContentLoaded', () => {
  // update footer compare/sale links
  const footerCompare = document.createElement('li');
  footerCompare.innerHTML = '<a href="/compare/" data-route="compare-tool">Compare Bikes</a>';
  const helpList = document.querySelectorAll('.footer-col')[3];
  if(helpList) {
    const ul = helpList.querySelector('.footer-links');
    if(ul) ul.appendChild(footerCompare);
  }
  // update nav search icon to open search page (leave the cart button intact)
  const navIconBtns = document.querySelectorAll('.nav-icon-btn');
  navIconBtns.forEach(btn => {
    if(btn.getAttribute('aria-label') === 'Shopping cart') return;
    if(btn.textContent.includes('🔒')) return;
    if(btn.textContent.includes('🛒')) return;
    btn.setAttribute('onclick', "showPage('search')");
  });
  // init finance calc if on that page
  initFinanceCalc();
  initGrids();
  initFAQ();
});

// ── ANNOUNCEMENT BAR SLIDER ──
(function initTopbarSlider(){
  const slides = document.querySelectorAll('.topbar-slide');
  if(slides.length < 2) return;
  let idx = 0;
  setInterval(function(){
    slides[idx].classList.remove('active');
    idx = (idx + 1) % slides.length;
    slides[idx].classList.add('active');
  }, 3500);
})();

// ── KEYBOARD NAVIGATION ──
document.addEventListener('keydown', e => {
  if(e.key==='Escape') {
    document.getElementById('mobileNav').classList.remove('open');
    document.body.style.overflow='';
    document.querySelector('.quick-modal-overlay.open')?.classList.remove('open');
    if(typeof closeFincraOverlay==='function') closeFincraOverlay();
  }
});

// ── FINCRA PAYMENT OVERLAY ──
function closeFincraOverlay() {
  document.getElementById('fincra-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function fincraPayClick() {
  // Fire the order email and go to confirmation when customer clicks Pay
  if (typeof window._fincraSendEmail === 'function') {
    window._fincraSendEmail();
    window._fincraSendEmail = null;
  }
  closeFincraOverlay();
}

// ── CART SIDE PANEL ──
function openCartPanel() {
  renderCartPanel();
  document.getElementById('cart-panel').classList.add('open');
  document.getElementById('cart-panel-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCartPanel() {
  document.getElementById('cart-panel').classList.remove('open');
  document.getElementById('cart-panel-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function renderCartPanel() {
  const itemsEl = document.getElementById('cart-panel-items');
  const footerEl = document.getElementById('cart-panel-footer');
  const countEl  = document.getElementById('cart-panel-count');
  const totalEl  = document.getElementById('cart-panel-total');
  if (!itemsEl) return;

  // Count
  countEl.textContent = cartItems.length;

  if (cartItems.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-panel-empty">
        <div class="cart-panel-empty-icon">🛒</div>
        <p>Your cart is empty</p>
        <a class="btn-primary" style="text-decoration:none" href="/electric-dirt-bikes/" data-route="shop" onclick="closeCartPanel()">Browse Bikes →</a>
      </div>`;
    footerEl.style.display = 'none';
    return;
  }

  // Group duplicate items
  const grouped = {};
  cartItems.forEach(item => {
    const key = item.name + '|' + (item.colour || '');
    if (!grouped[key]) grouped[key] = { ...item, qty: 0, idx: [] };
    grouped[key].qty++;
    grouped[key].idx.push(cartItems.indexOf(item));
  });

  let subtotal = 0;
  let html = '';
  Object.values(grouped).forEach(g => {
    const priceNum = typeof g.price === 'number' ? g.price :
      parseInt((g.price || '0').toString().replace(/[^0-9]/g, ''));
    const lineTotal = priceNum * g.qty;
    subtotal += lineTotal;

    // Find product image
    const allProds = typeof bikes !== 'undefined' ? [...bikes] : [];
    if (typeof quads !== 'undefined') allProds.push(...quads);
    if (typeof accessories !== 'undefined') allProds.push(...accessories);
    const prod = allProds.find(p => p.name === g.name);
    const imgSrc = prod && prod.img ? prod.img : null;
    const imgEl = imgSrc
      ? `<img src="${imgSrc}" class="cart-panel-item-img" alt="${g.name}" loading="lazy">`
      : `<div class="cart-panel-item-img-placeholder">🛒</div>`;

    html += `
      <div class="cart-panel-item">
        ${imgEl}
        <div class="cart-panel-item-info">
          <div class="cart-panel-item-name">${g.qty > 1 ? g.qty + '× ' : ''}${g.name}</div>
          ${g.colour ? `<div class="cart-panel-item-colour">${g.colour}</div>` : ''}
          <div class="cart-panel-item-price">£${lineTotal.toLocaleString('en-GB')}</div>
        </div>
        <button class="cart-panel-item-remove" onclick="removeFromCartPanel(${g.idx[g.idx.length-1]})" aria-label="Remove ${g.name}">✕</button>
      </div>`;
  });

  itemsEl.innerHTML = html;
  totalEl.textContent = '£' + subtotal.toLocaleString('en-GB');
  footerEl.style.display = 'block';

  // Update global cart count
  const countBadge = document.querySelector('.cart-count');
  if (countBadge) countBadge.textContent = cartItems.length;
}

function removeFromCartPanel(idx) {
  cartItems.splice(idx, 1);
  const countBadge = document.querySelector('.cart-count');
  if (countBadge) countBadge.textContent = cartItems.length;
  renderCartPanel();
}

// ══════════════════════════════════════════════════════════
//  TRUSTPILOT REVIEWS SLIDER REVOLUTION LOGIC
// ══════════════════════════════════════════════════════════
let tpCurrentIndex = 0;
let tpActiveCategory = 'all';
let tpAutoplayTimer = null;
let tpIsPaused = false;
let tpTouchStartX = 0;
let tpTouchStartY = 0;

function tpGetVisibleCards() {
  const allCards = Array.from(document.querySelectorAll('.tp-slider-track .tp-card'));
  if (tpActiveCategory === 'all') return allCards;
  return allCards.filter(card => {
    const cats = (card.getAttribute('data-category') || '').split(' ');
    return cats.includes(tpActiveCategory);
  });
}

function tpGetCardsPerView() {
  const w = window.innerWidth;
  if (w <= 640) return 1;
  if (w <= 960) return 2;
  return 3;
}

function tpUpdateSlider() {
  const track = document.getElementById('tp-slider-track');
  const viewport = document.getElementById('tp-slider-viewport');
  const counterEl = document.getElementById('tp-slider-counter');
  const prevBtn = document.getElementById('tp-prev-btn');
  const nextBtn = document.getElementById('tp-next-btn');
  const dotsWrap = document.getElementById('tp-dots-wrap');
  if (!track || !viewport) return;

  const visibleCards = tpGetVisibleCards();
  const cardsPerView = tpGetCardsPerView();
  const totalCount = visibleCards.length;

  if (totalCount === 0) {
    track.style.transform = 'translateX(0px)';
    if (counterEl) counterEl.textContent = 'No reviews found in this category';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (dotsWrap) dotsWrap.innerHTML = '';
    return;
  }

  const maxIndex = Math.max(0, totalCount - cardsPerView);
  if (tpCurrentIndex > maxIndex) {
    tpCurrentIndex = maxIndex;
  }
  if (tpCurrentIndex < 0) {
    tpCurrentIndex = 0;
  }

  // Calculate slide offset
  // Card width + 20px gap
  const viewportWidth = viewport.clientWidth;
  const gap = 20;
  let cardWidth = (viewportWidth - (cardsPerView - 1) * gap) / cardsPerView;
  if (visibleCards[0] && visibleCards[0].offsetWidth > 0) {
    cardWidth = visibleCards[0].offsetWidth;
  }
  const slideStep = cardWidth + gap;
  const targetX = tpCurrentIndex * slideStep;
  track.style.transform = `translateX(-${targetX}px)`;

  // Update counter
  if (counterEl) {
    const startNum = tpCurrentIndex + 1;
    const endNum = Math.min(tpCurrentIndex + cardsPerView, totalCount);
    counterEl.textContent = `Showing ${startNum}–${endNum} of ${totalCount} reviews`;
  }

  // Update navigation button states
  if (prevBtn) prevBtn.disabled = (totalCount <= cardsPerView);
  if (nextBtn) nextBtn.disabled = (totalCount <= cardsPerView);

  // Update Pagination Dots
  if (dotsWrap) {
    const totalPages = Math.ceil(totalCount / cardsPerView);
    const activePage = Math.min(Math.floor(tpCurrentIndex / cardsPerView), totalPages - 1);
    
    let dotsHtml = '';
    for (let p = 0; p < totalPages; p++) {
      const isAct = p === activePage ? ' active' : '';
      dotsHtml += `<button class="tp-dot${isAct}" onclick="tpGoToSlide(${p * cardsPerView})" type="button" aria-label="Go to reviews page ${p + 1}"></button>`;
    }
    dotsWrap.innerHTML = dotsHtml;
  }
}

function tpSlidePrev() {
  const visibleCards = tpGetVisibleCards();
  const cardsPerView = tpGetCardsPerView();
  const maxIndex = Math.max(0, visibleCards.length - cardsPerView);
  
  if (tpCurrentIndex > 0) {
    tpCurrentIndex = Math.max(0, tpCurrentIndex - 1);
  } else {
    tpCurrentIndex = maxIndex; // Wrap around to end
  }
  tpUpdateSlider();
}

function tpSlideNext() {
  const visibleCards = tpGetVisibleCards();
  const cardsPerView = tpGetCardsPerView();
  const maxIndex = Math.max(0, visibleCards.length - cardsPerView);

  if (tpCurrentIndex < maxIndex) {
    tpCurrentIndex = Math.min(maxIndex, tpCurrentIndex + 1);
  } else {
    tpCurrentIndex = 0; // Wrap around to start
  }
  tpUpdateSlider();
}

function tpGoToSlide(index) {
  const visibleCards = tpGetVisibleCards();
  const cardsPerView = tpGetCardsPerView();
  const maxIndex = Math.max(0, visibleCards.length - cardsPerView);
  tpCurrentIndex = Math.min(Math.max(0, index), maxIndex);
  tpUpdateSlider();
}

function tpFilterReviews(category, btn) {
  tpActiveCategory = category;
  
  // Update button active state
  const pills = document.querySelectorAll('.tp-filter-pill');
  pills.forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Filter cards
  const allCards = document.querySelectorAll('.tp-slider-track .tp-card');
  allCards.forEach(card => {
    const cats = (card.getAttribute('data-category') || '').split(' ');
    if (category === 'all' || cats.includes(category)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });

  tpCurrentIndex = 0;
  tpUpdateSlider();
}

function tpStartAutoplay() {
  if (tpAutoplayTimer) clearInterval(tpAutoplayTimer);
  tpAutoplayTimer = setInterval(() => {
    if (!tpIsPaused) {
      tpSlideNext();
    }
  }, 5000);
}

function tpPauseAutoplay() {
  tpIsPaused = true;
}

function tpResumeAutoplay() {
  tpIsPaused = false;
}

function tpInitSlider() {
  const viewport = document.getElementById('tp-slider-viewport');
  if (!viewport) return;

  // Add touch swipe listeners
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      tpTouchStartX = e.touches[0].clientX;
      tpTouchStartY = e.touches[0].clientY;
      tpPauseAutoplay();
    }
  }, { passive: true });

  viewport.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchEndX - tpTouchStartX;
      const diffY = touchEndY - tpTouchStartY;

      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          tpSlideNext();
        } else {
          tpSlidePrev();
        }
      }
      tpResumeAutoplay();
    }
  }, { passive: true });

  tpUpdateSlider();
  tpStartAutoplay();
}

// Bind initialization and resize
document.addEventListener('DOMContentLoaded', () => {
  tpInitSlider();
});

window.addEventListener('resize', () => {
  tpUpdateSlider();
});

var _fy = document.getElementById('footer-year');
if (_fy) _fy.textContent = new Date().getFullYear();
