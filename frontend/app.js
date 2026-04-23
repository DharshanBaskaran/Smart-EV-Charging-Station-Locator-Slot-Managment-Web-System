const API_BASE = window.location.origin + '/api';

let token = localStorage.getItem('valence_token');
let currentUser = null;
try {
  currentUser = JSON.parse(localStorage.getItem('valence_user') || 'null');
} catch (_) { }

if (!token || !currentUser) {
  window.location.href = '/login.html';
  throw new Error('Redirecting to login');
}

// ── Custom Alert Override — replaces browser alert() with in-app modal ──
function showCustomAlert(msg, title, icon) {
  const modal = document.getElementById('modal-custom-alert');
  const titleEl = document.getElementById('custom-alert-title');
  const msgEl = document.getElementById('custom-alert-message');
  const iconEl = document.getElementById('custom-alert-icon');
  if (modal && msgEl) {
    if (iconEl) iconEl.textContent = icon || (msg.includes('❌') || msg.includes('Error') || msg.includes('fail') ? '⚠️' : msg.includes('✅') || msg.includes('saved') || msg.includes('added') || msg.includes('success') ? '✅' : 'ℹ️');
    if (titleEl) titleEl.textContent = title || 'Notification';
    msgEl.textContent = msg.replace(/^(❌|✅|⚠️|ℹ️)\s*/, '');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
  }
}
window.showCustomAlert = showCustomAlert;

// Override native alert() globally — no more "localhost says"
window.alert = function(msg) {
  showCustomAlert(msg);
};
window.closeCustomAlert = function() {
  const modal = document.getElementById('modal-custom-alert');
  if (modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
};

window.showToast = function(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return showCustomAlert(msg);
  
  const toast = document.createElement('div');
  let bg = 'var(--surface2)';
  let color = 'var(--text)';
  let border = 'var(--surface2)';
  if (type === 'success') { bg = 'rgba(0,200,83,0.9)'; color = '#fff'; border = 'var(--accent)'; }
  if (type === 'error') { bg = 'rgba(255,82,82,0.9)'; color = '#fff'; border = 'var(--danger)'; }
  if (type === 'info') { bg = 'var(--accent)'; color = '#000'; border = 'var(--accent-dim)'; }

  toast.style.cssText = `
    background: ${bg};
    color: ${color};
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    border: 1px solid ${border};
    opacity: 0;
    transform: translateY(-20px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;
  toast.innerText = msg;
  container.appendChild(toast);
  
  // animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 50);

  // animate out
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

window.alert = function(msg) {
  const modal = document.getElementById('modal-custom-alert');
  if (modal) {
    document.getElementById('custom-alert-message').textContent = msg;
    const icon = document.getElementById('custom-alert-icon');
    const title = document.getElementById('custom-alert-title');
    
    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('unable')) {
      icon.textContent = '❌';
      title.textContent = 'Error';
      title.style.color = 'var(--danger)';
    } else if (msg.toLowerCase().includes('success') || msg.toLowerCase().includes('added') || msg.toLowerCase().includes('saved')) {
      icon.textContent = '✅';
      title.textContent = 'Success';
      title.style.color = 'var(--accent)';
    } else {
      icon.textContent = 'ℹ️';
      title.textContent = 'Notification';
      title.style.color = '';
    }

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
  } else {
    // fallback
    console.log("ALERT:", msg);
  }
};

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

let map;
let markers = [];
let routeLine = null;
let selectedStation = null;
let currentLatLng = [12.9716, 77.5946];
let userMarker = null;
let lastStations = [];

async function fetchStations(opts = {}) {
  const url = new URL(API_BASE + '/stations');
  if (opts.lat != null && opts.lng != null && opts.rangeKm != null) {
    url.searchParams.set('lat', opts.lat);
    url.searchParams.set('lng', opts.lng);
    url.searchParams.set('rangeKm', opts.rangeKm);
  }
  if (opts.connectorType) url.searchParams.set('connectorType', opts.connectorType);
  if (opts.minPowerKw) url.searchParams.set('minPowerKw', opts.minPowerKw);
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load stations');
  return res.json();
}

async function fetchReviews(stationId) {
  const res = await fetch(`${API_BASE}/stations/${stationId}/reviews`, { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

async function postReview(stationId, rating, comment) {
  const res = await fetch(`${API_BASE}/stations/${stationId}/reviews`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ rating, comment }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to post review');
  }
  return res.json();
}

async function toggleFavorite(stationId) {
  const res = await fetch(`${API_BASE}/favorites/${stationId}`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to toggle favorite');
  return res.json();
}

async function fetchCostEstimate(portId, durationMin) {
  const res = await fetch(`${API_BASE}/cost-estimate?portId=${portId}&durationMin=${durationMin}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function fetchNotificationCount() {
  try {
    const res = await fetch(`${API_BASE}/notifications`, { headers: authHeaders() });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.unreadCount || 0;
  } catch(_) { return 0; }
}

async function fetchStationDetail(id) {
  const res = await fetch(`${API_BASE}/stations/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load station');
  return res.json();
}

async function fetchSlots(portId) {
  const res = await fetch(`${API_BASE}/ports/${portId}/slots`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load slots');
  return res.json();
}

async function createReservation(portId, startTime, endTime) {
  const res = await fetch(`${API_BASE}/reservations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ portId, startTime, endTime }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Reservation failed');
  }
  return res.json();
}

async function fetchReservations() {
  const res = await fetch(`${API_BASE}/reservations?_t=${Date.now()}`, { 
    headers: authHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Failed to load reservations');
  const data = await res.json();
  // Backend now returns { reservations: [...], expiredCount: N }
  if (data.reservations) {
    return { list: data.reservations, expiredCount: data.expiredCount || 0 };
  }
  // Fallback for old format (plain array)
  return { list: data.filter(r => r.status && r.status !== 'cancelled'), expiredCount: 0 };
}

async function cancelReservation(id) {
  const res = await fetch(`${API_BASE}/reservations/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('Cancel failed');
  return res.json();
}

async function fetchMe() {
  const res = await fetch(`${API_BASE}/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

async function updateProfile(data) {
  const res = await fetch(`${API_BASE}/me`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

async function addStation(data) {
  const res = await fetch(`${API_BASE}/stations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add station');
  }
  return res.json();
}

function initMap() {
  map = L.map('map').setView(currentLatLng, 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);
}

function addStationMarkers(stations) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  stations.forEach(s => {
    const icon = L.divIcon({
      className: 'station-marker',
      html: `<span style="background:#00c853;color:#0f1419;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;">⚡</span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const marker = L.marker([s.lat, s.lng], { icon })
      .addTo(map)
      .on('click', () => selectStation(s));
    marker.stationId = s.id;
    markers.push(marker);
  });
  if (markers.length > 0) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
  }
}

function selectStation(station) {
  selectedStation = station;
  document.querySelectorAll('.station-card').forEach(el => {
    el.classList.toggle('active', el.dataset.id === station.id);
  });
  showStationDetail(station.id);
  map.panTo([station.lat, station.lng]);
}

function showStationDetail(stationId) {
  const panel = document.getElementById('detail-panel');
  const title = document.getElementById('detail-title');
  const body = document.getElementById('detail-body');
  panel.hidden = false;
  title.textContent = 'Loading…';
  body.innerHTML = '';

  fetchStationDetail(stationId).then(async station => {
    // Check if favorited
    const isFav = currentUser.favorites && currentUser.favorites.includes(stationId);

    title.innerHTML = `
      ${station.name}
      <button type="button" id="fav-btn" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" style="background:none;border:none;cursor:pointer;font-size:1.2rem;margin-left:0.4rem;vertical-align:middle;transition:transform 0.2s;">${isFav ? '❤️' : '🤍'}</button>
      ${station.avgRating ? `<span style="font-size:0.8rem;color:var(--accent);margin-left:0.5rem;">⭐ ${station.avgRating} (${station.reviewCount})</span>` : ''}
    `;

    // Favorite toggle handler
    document.getElementById('fav-btn').onclick = async () => {
      try {
        const result = await toggleFavorite(stationId);
        currentUser.favorites = result.favorites;
        localStorage.setItem('valence_user', JSON.stringify(currentUser));
        document.getElementById('fav-btn').textContent = result.isFavorite ? '❤️' : '🤍';
        window.showToast(result.isFavorite ? 'Added to favorites!' : 'Removed from favorites', 'success');
      } catch(e) { window.showToast('Failed to update favorite', 'error'); }
    };

    body.innerHTML = `
      <p class="address" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem;">${station.address}</p>
      <p style="font-size:0.9rem;margin-bottom:0.5rem;">Ports (real-time status):</p>
    `;
    const portList = document.createElement('div');
    (station.ports || []).forEach(port => {
      const status = port.functional
        ? (port.occupancy === 'free' ? 'free' : 'occupied')
        : 'defective';
      const row = document.createElement('div');
      row.className = 'port-row';
      row.setAttribute('data-port-id', port.id);
      row.innerHTML = `
        <span>${port.connectorType} ${port.powerKw} kW <span style="font-size:0.72rem;color:var(--text-muted);">₹${port.pricePerKwh || 12}/kWh</span></span>
        <span class="port-badge ${status}">
          <span class="port-dot" style="background:currentColor"></span>
          ${port.functional ? (port.occupancy === 'free' ? 'Free' : 'Occupied') : 'Defective'}
        </span>
        ${port.functional && port.occupancy === 'free' ? `
          <button type="button" class="btn btn-small btn-primary reserve-port-btn" data-port-id="${port.id}">Reserve</button>
          <button type="button" class="btn btn-small charge-port-btn" data-port-id="${port.id}" style="background: linear-gradient(135deg, #00e676, #00b0ff); color: #000; font-weight: 700;">⚡ Charge</button>
        ` : ''}
      `;
      const reserveBtn = row.querySelector('.reserve-port-btn');
      if (reserveBtn) reserveBtn.addEventListener('click', () => openReserveModal(port.id, station));
      const chargeBtn = row.querySelector('.charge-port-btn');
      if (chargeBtn) chargeBtn.addEventListener('click', () => openChargingModal(port.id, port.connectorType, port.powerKw, port.pricePerKwh || 12, station.name));
      portList.appendChild(row);
    });
    body.appendChild(portList);

    // Navigation button
    const navBtn = document.createElement('button');
    navBtn.className = 'btn btn-secondary';
    navBtn.style.marginTop = '1rem';
    navBtn.style.width = '100%';
    navBtn.textContent = 'Navigate to Station (Google Maps)';
    navBtn.onclick = () => {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`, '_blank');
    };
    body.appendChild(navBtn);

    // ── Reviews Section ──
    const reviewSection = document.createElement('div');
    reviewSection.style.cssText = 'margin-top:1.25rem;border-top:1px solid var(--surface2);padding-top:1rem;';
    reviewSection.innerHTML = `<h3 style="font-size:0.85rem;font-weight:700;margin-bottom:0.75rem;">⭐ Reviews & Ratings</h3>`;

    // Review form
    const reviewForm = document.createElement('div');
    reviewForm.style.cssText = 'background:var(--surface2);border-radius:8px;padding:0.75rem;margin-bottom:0.75rem;';
    reviewForm.innerHTML = `
      <div style="display:flex;gap:0.3rem;margin-bottom:0.4rem;" id="star-picker">
        ${[1,2,3,4,5].map(n => `<span data-star="${n}" style="cursor:pointer;font-size:1.3rem;transition:transform 0.15s;">☆</span>`).join('')}
      </div>
      <div style="display:flex;gap:0.4rem;">
        <input type="text" id="review-comment" placeholder="Write a review (optional)" style="flex:1;padding:0.4rem 0.6rem;background:var(--bg);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:var(--text);font-size:0.82rem;">
        <button type="button" class="btn btn-small btn-primary" id="submit-review-btn">Post</button>
      </div>
    `;
    reviewSection.appendChild(reviewForm);

    // Star picker logic
    let selectedRating = 0;
    const stars = reviewForm.querySelectorAll('#star-picker span');
    stars.forEach(star => {
      star.addEventListener('mouseenter', () => {
        const val = parseInt(star.dataset.star);
        stars.forEach(s => { s.textContent = parseInt(s.dataset.star) <= val ? '★' : '☆'; s.style.color = parseInt(s.dataset.star) <= val ? '#ffab00' : ''; });
      });
      star.addEventListener('mouseleave', () => {
        stars.forEach(s => { s.textContent = parseInt(s.dataset.star) <= selectedRating ? '★' : '☆'; s.style.color = parseInt(s.dataset.star) <= selectedRating ? '#ffab00' : ''; });
      });
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.star);
        stars.forEach(s => { s.textContent = parseInt(s.dataset.star) <= selectedRating ? '★' : '☆'; s.style.color = parseInt(s.dataset.star) <= selectedRating ? '#ffab00' : ''; });
      });
    });

    // Submit review
    reviewForm.querySelector('#submit-review-btn').onclick = async () => {
      if (selectedRating === 0) { window.showToast('Please select a star rating', 'error'); return; }
      const comment = reviewForm.querySelector('#review-comment').value.trim();
      try {
        await postReview(stationId, selectedRating, comment);
        window.showToast('Review posted! ⭐', 'success');
        showStationDetail(stationId); // Refresh
      } catch(e) { window.showToast(e.message, 'error'); }
    };

    // Existing reviews
    const reviews = await fetchReviews(stationId);
    const reviewListEl = document.createElement('div');
    if (reviews.length > 0) {
      reviewListEl.innerHTML = reviews.slice(0, 5).map(r => `
        <div style="padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <span style="font-weight:600;font-size:0.82rem;">${r.username || 'User'}</span>
            <span style="color:#ffab00;font-size:0.78rem;">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
          </div>
          ${r.comment ? `<p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.2rem;">${r.comment}</p>` : ''}
        </div>
      `).join('');
    } else {
      reviewListEl.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);">No reviews yet. Be the first!</p>';
    }
    reviewSection.appendChild(reviewListEl);
    body.appendChild(reviewSection);

  }).catch(() => {
    title.textContent = 'Error';
    body.textContent = 'Could not load station details.';
  });
}

let currentReserveModalData = null;

function openReserveModal(portId, station) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  title.textContent = `Reserve slot – ${station.name}`;
  body.innerHTML = 'Loading available times…';
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  currentReserveModalData = { portId, station };

  const fallbackTimer = setTimeout(() => {
    if (!document.getElementById('slot-start-select')) renderSlotPicker(body, null);
  }, 3000);

  fetchSlots(portId)
    .then(slots => {
      clearTimeout(fallbackTimer);
      const available = slots.filter(s => s.status === 'available').slice(0, 30);
      if (available.length === 0) {
        renderSlotPicker(body, null);
        return;
      }
      renderSlotPicker(body, available);
    })
    .catch(() => {
      clearTimeout(fallbackTimer);
      renderSlotPicker(body, null);
    });
}

function renderSlotPicker(body, availableSlots) {
  // Build start time options
  let startOptions = '';
  if (availableSlots && availableSlots.length > 0) {
    startOptions = availableSlots.map(s =>
      `<option value="${s.startTime}">${formatSlotTime(s.startTime)}</option>`
    ).join('');
  } else {
    // Fallback: generate start times every 30 min for next 12 hours
    const now = new Date();
    const base = new Date(now);
    base.setMinutes(Math.ceil(base.getMinutes() / 30) * 30, 0, 0);
    for (let i = 1; i <= 24; i++) {
      const t = new Date(base.getTime() + i * 30 * 60 * 1000);
      startOptions += `<option value="${t.toISOString()}">${formatSlotTime(t.toISOString())}</option>`;
    }
  }

  body.innerHTML = `
    <div style="margin-bottom: 0.75rem;">
      <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.3px; margin-bottom:0.3rem; display:block;">Start Time</label>
      <select id="slot-start-select" style="width:100%; padding:0.6rem 0.8rem; background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:var(--text); font-size:0.9rem;">
        ${startOptions}
      </select>
    </div>
    <div style="margin-bottom: 0.5rem;">
      <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.3px; margin-bottom:0.3rem; display:block;">Duration</label>
      <select id="slot-duration-select" style="width:100%; padding:0.6rem 0.8rem; background:var(--surface2); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:var(--text); font-size:0.9rem;">
        <option value="15">15 minutes</option>
        <option value="30">30 minutes</option>
        <option value="45">45 minutes</option>
        <option value="60" selected>1 hour</option>
        <option value="75">1 hour 15 minutes</option>
        <option value="90">1 hour 30 minutes</option>
        <option value="105">1 hour 45 minutes</option>
        <option value="120">2 hours</option>
        <option value="135">2 hours 15 minutes</option>
        <option value="150">2 hours 30 minutes</option>
        <option value="165">2 hours 45 minutes</option>
        <option value="180">3 hours (max)</option>
      </select>
    </div>
    <div id="slot-summary" style="font-size:0.82rem; color:var(--accent); margin-top:0.5rem; padding:0.5rem 0.7rem; background:rgba(0,230,118,0.06); border-radius:6px; border:1px solid rgba(0,230,118,0.15);"></div>
    <div id="cost-estimate" style="font-size:0.82rem; color:var(--accent2,#00b0ff); margin-top:0.4rem; padding:0.5rem 0.7rem; background:rgba(0,176,255,0.06); border-radius:6px; border:1px solid rgba(0,176,255,0.15); display:none;"></div>
  `;

  // Update summary and cost on change
  async function updateSummary() {
    const startSel = document.getElementById('slot-start-select');
    const durSel = document.getElementById('slot-duration-select');
    const summary = document.getElementById('slot-summary');
    const costEl = document.getElementById('cost-estimate');
    if (!startSel || !durSel || !summary) return;
    const startDt = new Date(startSel.value);
    const durMin = parseInt(durSel.value, 10);
    const endDt = new Date(startDt.getTime() + durMin * 60 * 1000);
    summary.innerHTML = `⚡ <strong>${formatSlotTime(startDt.toISOString())}</strong> → <strong>${formatSlotTime(endDt.toISOString())}</strong> (${durMin >= 60 ? Math.floor(durMin/60) + 'h' + (durMin%60 ? ' ' + durMin%60 + 'm' : '') : durMin + ' min'})`;

    // Cost estimation
    if (currentReserveModalData && currentReserveModalData.portId) {
      try {
        const cost = await fetchCostEstimate(currentReserveModalData.portId, durMin);
        if (cost && costEl) {
          costEl.style.display = 'block';
          costEl.innerHTML = `💰 Est. Cost: <strong>₹${cost.estimatedCostINR}</strong> (${cost.energyKwh} kWh @ ₹${cost.pricePerKwh}/kWh)`;
        }
      } catch(_) {}
    }
  }

  document.getElementById('slot-start-select').addEventListener('change', updateSummary);
  document.getElementById('slot-duration-select').addEventListener('change', updateSummary);
  updateSummary();
}


function formatSlotTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderStationList(stations) {
  lastStations = stations;
  const list = document.getElementById('station-list');
  const countEl = document.getElementById('station-count');
  if (countEl) countEl.textContent = stations.length ? `(${stations.length})` : '';
  list.innerHTML = stations.length ? stations.map(s => `
    <div class="station-card" data-id="${s.id}">
      <div class="name">${s.name}</div>
      <div class="address">${s.address}</div>
    </div>
  `).join('') : '<p class="empty-msg">Enter battery range and click "Locate stations" to see nearby stations.</p>';
  list.querySelectorAll('.station-card').forEach(el => {
    el.addEventListener('click', () => {
      const station = stations.find(st => st.id === el.dataset.id);
      if (station) selectStation(station);
    });
  });
}

function renderReservations(list) {
  const el = document.getElementById('reservations-list');
  if (!list || list.length === 0) {
    el.innerHTML = '<p class="empty-msg">No reservations yet.</p>';
    return;
  }
  el.innerHTML = list.map(r => `
    <div class="reservation-card" data-id="${r.id}">
      <div class="slot">Port ${r.portId}</div>
      <div class="time">${formatSlotTime(r.startTime)} – ${formatSlotTime(r.endTime)}</div>
      <button type="button" class="btn btn-small btn-secondary cancel-btn" onclick="handleCancelReservation('${r.id}')">Cancel</button>
    </div>
  `).join('');
}

window.handleCancelReservation = function(id) {
  const modal = document.getElementById('modal-confirm-cancel');
  const confirmBtn = document.getElementById('btn-confirm-cancel');
  
  // Show the modal
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  
  // Reset confirm button state just in case
  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Yes, Cancel';

  // Overwrite the onclick to ensure it's bound to THIS specific reservation ID
  confirmBtn.onclick = async function() {
    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Cancelling...';
      
      const btnInList = document.querySelector(`.cancel-btn[onclick="handleCancelReservation('${id}')"]`);
      if (btnInList) {
        btnInList.disabled = true;
        btnInList.textContent = 'Cancelling...';
      }

      await cancelReservation(id);
      
      // Remove it from the DOM immediately for a faster visually responsive experience
      const deletedCard = document.querySelector(`.reservation-card[data-id="${id}"]`);
      if (deletedCard) deletedCard.remove();

      // Close modal
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      
      refreshReservations();
    } catch (e) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Yes, Cancel';
      alert(e.message);
    }
  };
};

async function refreshReservations() {
  const { list, expiredCount } = await fetchReservations();
  renderReservations(list);

  // Show an attractive toast when sessions have expired
  if (expiredCount > 0) {
    showExpiredToast(expiredCount);
  }
}

// ── Expired-session toast ─────────────────────────────────────────────────────
function showExpiredToast(count) {
  // Remove existing toast if any
  const existing = document.getElementById('expired-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'expired-toast';
  toast.innerHTML = `
    <div style="
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: linear-gradient(135deg, #1a2940 0%, #0c1520 100%);
      border: 1px solid rgba(0,230,118,0.3);
      border-radius: 16px; padding: 1.2rem 1.5rem;
      max-width: 380px; box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      animation: slideInToast 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: 'Inter', system-ui, sans-serif;
    ">
      <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem;">
        <span style="font-size:1.8rem;">⚡</span>
        <div>
          <div style="font-weight:700; color:#00e676; font-size:0.95rem;">
            ${count === 1 ? 'Session Complete!' : count + ' Sessions Complete!'}
          </div>
          <div style="color:#6b7fa3; font-size:0.78rem; margin-top:2px;">
            ${count === 1 ? 'Your charging session has ended.' : 'Your charging sessions have ended.'}
          </div>
        </div>
      </div>
      <p style="color:#e8f0fe; font-size:0.85rem; margin:0.5rem 0; line-height:1.5;">
        🔋 Great charge! Your EV is powered up and ready to go. Need another session? Book your next slot now!
      </p>
      <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
        <button onclick="this.closest('#expired-toast').remove()" style="
          flex:1; padding:0.5rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1);
          background:transparent; color:#6b7fa3; font-weight:600; cursor:pointer; font-size:0.8rem;
          font-family:'Inter',sans-serif;
        ">Dismiss</button>
        <button onclick="this.closest('#expired-toast').remove(); document.querySelector('.station-marker')?.click();" style="
          flex:1; padding:0.5rem; border-radius:8px; border:none;
          background:linear-gradient(135deg,#00e676,#00b85c); color:#000; font-weight:700;
          cursor:pointer; font-size:0.8rem; font-family:'Inter',sans-serif;
        ">Book Again 🚀</button>
      </div>
    </div>
  `;
  document.body.appendChild(toast);

  // Auto-dismiss after 10 seconds
  setTimeout(() => { if (document.getElementById('expired-toast')) toast.remove(); }, 10000);
}

function drawRoute(toLat, toLng) {
  if (routeLine) map.removeLayer(routeLine);
  routeLine = L.polyline([currentLatLng, [toLat, toLng]], {
    color: '#00c853',
    weight: 4,
    opacity: 0.8,
  }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.body.classList.remove('modal-open');
  currentReserveModalData = null;
}

function handleReserveClick() {
  const data = currentReserveModalData;
  const startSelect = document.getElementById('slot-start-select');
  const durationSelect = document.getElementById('slot-duration-select');
  if (!startSelect || !durationSelect) {
    alert('Please wait for time slots to load.');
    return;
  }
  if (!data || !data.portId) return;

  const startTime = startSelect.value;
  const durationMin = parseInt(durationSelect.value, 10);
  const startDt = new Date(startTime);
  const endDt = new Date(startDt.getTime() + durationMin * 60 * 1000);
  const endTime = endDt.toISOString();

  createReservation(data.portId, startTime, endTime)
    .then(() => {
      closeModal();
      refreshReservations();
      // Show custom success popup
      document.getElementById('modal-success-reserve').style.display = 'flex';
      document.body.classList.add('modal-open');
    })
    .catch(err => {
      closeModal();
      alert(err.message);
    });
}

window.voltPathCloseModal = closeModal;
window.voltPathReserve = handleReserveClick;

function renderHeader() {
  const fullnameEl = document.getElementById('header-fullname');
  const usernameEl = document.getElementById('header-username');
  const adminBtn   = document.getElementById('btn-admin');
  if (fullnameEl) fullnameEl.textContent = currentUser ? (currentUser.name || currentUser.username || '') : '';
  if (usernameEl) usernameEl.textContent = currentUser ? ('@' + (currentUser.username || '')) : '';
  if (adminBtn)   adminBtn.style.display = (currentUser && currentUser.role === 'admin') ? '' : 'none';

  // Add Dashboard + Notification bell to header-right if not already there
  const headerRight = document.querySelector('.header-right');
  if (headerRight && !document.getElementById('btn-dashboard')) {
    const dashBtn = document.createElement('a');
    dashBtn.href = '/dashboard.html';
    dashBtn.id = 'btn-dashboard';
    dashBtn.className = 'btn btn-small btn-secondary';
    dashBtn.textContent = '📊 Dashboard';
    dashBtn.style.marginRight = '0.25rem';
    headerRight.insertBefore(dashBtn, headerRight.firstChild);

    const notifBtn = document.createElement('a');
    notifBtn.href = '/dashboard.html';
    notifBtn.id = 'btn-notif';
    notifBtn.className = 'btn btn-small btn-secondary';
    notifBtn.innerHTML = '🔔 <span id="notif-count-badge" style="background:var(--danger);color:#fff;font-size:0.65rem;padding:0.05rem 0.35rem;border-radius:8px;margin-left:0.2rem;display:none;"></span>';
    notifBtn.style.marginRight = '0.25rem';
    headerRight.insertBefore(notifBtn, dashBtn.nextSibling);

    // Load notification count
    fetchNotificationCount().then(count => {
      if (count > 0) {
        const badge = document.getElementById('notif-count-badge');
        if (badge) { badge.textContent = count; badge.style.display = 'inline'; }
      }
    });
  }
}

function setupLogout() {
  const btn = document.getElementById('btn-logout');
  if (btn) btn.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await fetch(API_BASE + '/auth/logout', { method: 'POST', headers: authHeaders() }); } catch (_) { }
    localStorage.removeItem('valence_token');
    localStorage.removeItem('valence_user');
    window.location.href = '/login.html';
  });
}

function setupProfile() {
  const btn = document.getElementById('btn-profile');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openProfileModal();
  });
}

function openProfileModal() {
  const modal = document.getElementById('modal-profile');
  const body = document.getElementById('profile-form-body');
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  fetchMe().then(profile => {
    body.innerHTML = `
      <label>Name</label>
      <input type="text" id="profile-name" value="${(profile.name || '').replace(/"/g, '&quot;')}" />
      <label>Email</label>
      <input type="email" id="profile-email" value="${(profile.email || '').replace(/"/g, '&quot;')}" />
      <label>Vehicle type</label>
      <input type="text" id="profile-vehicleType" placeholder="e.g. bike" value="${(profile.vehicleType || '').replace(/"/g, '&quot;')}" />
      <label>Vehicle model</label>
      <input type="text" id="profile-vehicleModel" placeholder="e.g. Ather 450X" value="${(profile.vehicleModel || '').replace(/"/g, '&quot;')}" />
      <label>Battery range (km)</label>
      <input type="number" id="profile-batteryRangeKm" min="1" max="500" value="${profile.batteryRangeKm ?? ''}" />
    `;
  }).catch(() => {
    body.innerHTML = '<p class="empty-msg">Could not load profile.</p>';
  });
}

window.voltPathCloseProfile = function () {
  document.getElementById('modal-profile').style.display = 'none';
  document.body.classList.remove('modal-open');
};

document.getElementById('profile-save').addEventListener('click', async () => {
  const name = document.getElementById('profile-name')?.value?.trim();
  const email = document.getElementById('profile-email')?.value?.trim();
  const vehicleType = document.getElementById('profile-vehicleType')?.value?.trim();
  const vehicleModel = document.getElementById('profile-vehicleModel')?.value?.trim();
  const batteryRangeKm = document.getElementById('profile-batteryRangeKm')?.value;
  try {
    const updated = await updateProfile({ name, email, vehicleType, vehicleModel, batteryRangeKm: batteryRangeKm ? Number(batteryRangeKm) : undefined });
    currentUser = updated;
    localStorage.setItem('valence_user', JSON.stringify(updated));
    document.getElementById('input-range-km').value = updated.batteryRangeKm ?? '';
    renderHeader();
    window.voltPathCloseProfile();
    alert('Profile saved.');
  } catch (e) {
    alert(e.message);
  }
});

function setupAddStation() {
  document.getElementById('btn-add-station').addEventListener('click', () => {
    const modal = document.getElementById('modal-add-station');
    const body = document.getElementById('add-station-form-body');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    body.innerHTML = `
      <label>Station name</label>
      <input type="text" id="add-name" placeholder="e.g. Community Charger" required />
      <label>Address</label>
      <input type="text" id="add-address" placeholder="Full address" required />
      <label>Latitude</label>
      <input type="number" id="add-lat" step="any" placeholder="e.g. 12.9716" required />
      <label>Longitude</label>
      <input type="number" id="add-lng" step="any" placeholder="e.g. 77.5946" required />
      <label>Operator (optional)</label>
      <input type="text" id="add-operator" placeholder="e.g. Community" />
    `;
  });
}

window.voltPathCloseAddStation = function () {
  document.getElementById('modal-add-station').style.display = 'none';
  document.body.classList.remove('modal-open');
};

document.getElementById('add-station-submit').addEventListener('click', async () => {
  const name = document.getElementById('add-name')?.value?.trim();
  const address = document.getElementById('add-address')?.value?.trim();
  const lat = document.getElementById('add-lat')?.value;
  const lng = document.getElementById('add-lng')?.value;
  const operator = document.getElementById('add-operator')?.value?.trim();
  if (!name || !address || lat === '' || lng === '') {
    alert('Please fill name, address, lat and lng.');
    return;
  }
  try {
    await addStation({ name, address, lat: Number(lat), lng: Number(lng), operator: operator || 'Community' });
    window.voltPathCloseAddStation();
    alert('Station added. It will appear on the map.');
    doLocateStations();
  } catch (e) {
    alert(e.message);
  }
});

async function doLocateStations() {
  const rangeInput = document.getElementById('input-range-km');
  const rangeKm = parseInt(rangeInput?.value, 10);
  if (!rangeKm || rangeKm < 1) {
    alert('Please enter your battery range (km) first.');
    return;
  }
  try {
    const stations = await fetchStations({ lat: currentLatLng[0], lng: currentLatLng[1], rangeKm });
    addStationMarkers(stations);
    renderStationList(stations);
  } catch (e) {
    document.getElementById('station-list').innerHTML = '<p class="empty-msg">Could not load stations. ' + e.message + '</p>';
  }
}


function doLocateMe() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      currentLatLng = [latitude, longitude];
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker(currentLatLng, {
        icon: L.divIcon({
          className: 'user-marker',
          html: '🔴',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map).bindPopup('You are here').openPopup();
      map.setView(currentLatLng, 12);
      doLocateStations(); // Auto-search near new location
    },
    () => {
      alert('Unable to retrieve your location');
    }
  );
}

// ----- Trip Planner Logic -----
let destinationMarker = null;
let tripRouteLine = null;
let tripStopMarkers = [];

function openTripModal() {
  const modal = document.getElementById('modal-trip');
  if (modal) modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}

function closeTripModal() {
  const modal = document.getElementById('modal-trip');
  if (modal) modal.style.display = 'none';
  document.body.classList.remove('modal-open');
}

window.voltPathCloseTrip = closeTripModal;

function handleTripPlanClick() {
  const range = document.getElementById('input-range-km')?.value;
  const tripRange = document.getElementById('trip-range');
  if (range && tripRange) tripRange.value = range;
  openTripModal();
}

async function geocodeLocation(text) {
  // Check if it's lat,lng format
  const parts = text.split(',');
  if (parts.length === 2) {
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng, name: text };
  }
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
    }
  } catch(e) {}
  return null;
}

async function handleCalculateTripClick() {
  const startText = document.getElementById('trip-start-text')?.value?.trim();
  const endText = document.getElementById('trip-end-text')?.value?.trim();
  const tripRangeInput = document.getElementById('trip-range');
  const tripRange = parseFloat(tripRangeInput ? tripRangeInput.value : 80) || 0;

  if (tripRange < 50) {
    if (tripRangeInput) {
      tripRangeInput.style.borderColor = 'var(--danger)';
      tripRangeInput.classList.add('shake-anim');
      setTimeout(() => tripRangeInput.classList.remove('shake-anim'), 500);
    }
    window.showToast('Minimum battery range for long trips is 50 km.', 'error');
    return;
  }

  if (!startText || !endText) {
    alert('Please enter both Start and End locations.');
    return;
  }

  const resultsDiv = document.getElementById('trip-results');
  const loading = document.getElementById('trip-loading');

  if (loading) loading.style.display = 'block';
  if (resultsDiv) resultsDiv.style.display = 'none';
  const navBtn = document.getElementById('btn-navigate-trip');
  if (navBtn) navBtn.style.display = 'none';

  let startLoc = null;
  let endLoc = null;

  try {
    startLoc = await geocodeLocation(startText);
    if (!startLoc) throw new Error("Could not find start location: " + startText);
    
    endLoc = await geocodeLocation(endText);
    if (!endLoc) throw new Error("Could not find end location: " + endText);
  } catch(e) {
    if (loading) loading.style.display = 'none';
    alert(e.message);
    return;
  }

  await calculateTrip(L.latLng(startLoc.lat, startLoc.lng), L.latLng(endLoc.lat, endLoc.lng), startLoc.name, endLoc.name);
}

async function calculateTrip(startLatLng, destLatLng, startName, destName) {
  const rangeInput = document.getElementById('trip-range');
  let rangeKm = parseFloat(rangeInput ? rangeInput.value : 80) || 80;
  if (rangeKm < 50) rangeKm = 50; // Fallback, UI block handles the primary guard

  // Total straight-line distance
  const totalDist = startLatLng.distanceTo(destLatLng) / 1000;

  const resultsDiv = document.getElementById('trip-results');
  const stopsDiv = document.getElementById('trip-stops-list');
  const loading = document.getElementById('trip-loading');

  // We want a charging station roughly every (rangeKm) km, with a safety margin.
  // Use 80% of range as the target interval so user has buffer.
  const safeRange = rangeKm * 0.8;

  // Build ideal checkpoint positions along the straight line
  const dLat = destLatLng.lat - startLatLng.lat;
  const dLng = destLatLng.lng - startLatLng.lng;

  // Clean up previous trip markers
  if (destinationMarker) map.removeLayer(destinationMarker);
  tripStopMarkers.forEach(m => map.removeLayer(m));
  tripStopMarkers = [];

  destinationMarker = L.marker(destLatLng).addTo(map).bindPopup('Destination').openPopup();

  // ── Phase 1: Find stations along the route ──
  // We walk along the route from the start, and every `safeRange` km we search
  // for the closest charging station within a search radius.
  let stops = [];              // { station, cumulativeDist, distFromPrev }
  let curLatLng = startLatLng; // current position (start or last found station)
  let cumulativeRouteDist = 0; // total route distance covered so far
  let waypoints = [[startLatLng.lat, startLatLng.lng]];

  // How many ideal checkpoints can we have?
  const numCheckpoints = Math.max(0, Math.floor(totalDist / safeRange));

  for (let i = 1; i <= numCheckpoints; i++) {
    // Ideal point along the line at i*safeRange from start
    const idealFraction = Math.min((i * safeRange) / totalDist, 1);
    const idealLat = startLatLng.lat + dLat * idealFraction;
    const idealLng = startLatLng.lng + dLng * idealFraction;

    try {
      // Search within a radius around the ideal point
      const stations = await fetchStations({ lat: idealLat, lng: idealLng, rangeKm: 25 });

      if (stations && stations.length > 0) {
        // Pick the best station that:
        // 1) is not already in our stops list (avoid duplicates)
        // 2) is closest to the ideal point
        const best = stations.find(st => {
          const stLatLng = L.latLng(st.lat, st.lng);
          return !stops.some(s => s.station.id === st.id || L.latLng(s.station.lat, s.station.lng).distanceTo(stLatLng) / 1000 < 5);
        });

        if (best) {
          const bestLatLng = L.latLng(best.lat, best.lng);
          const distFromPrev = curLatLng.distanceTo(bestLatLng) / 1000;
          cumulativeRouteDist += distFromPrev;

          stops.push({
            station: best,
            cumulativeDist: cumulativeRouteDist,
            distFromPrev: distFromPrev
          });

          waypoints.push([best.lat, best.lng]);
          curLatLng = bestLatLng;

          const m = L.marker([best.lat, best.lng]).addTo(map)
            .bindPopup(`Stop #${stops.length}: ${best.name} (${best.operator})`);
          tripStopMarkers.push(m);
        }
      }
    } catch (e) {
      console.error('Error finding stop at checkpoint', i, e);
    }
  }

  // Final leg: distance from last stop (or start) to destination
  const lastLegDist = curLatLng.distanceTo(destLatLng) / 1000;
  const totalRouteDist = cumulativeRouteDist + lastLegDist;

  waypoints.push([destLatLng.lat, destLatLng.lng]);

  // Draw route line
  if (tripRouteLine && map) map.removeLayer(tripRouteLine);
  if (map) {
    tripRouteLine = L.polyline(waypoints, { color: '#1976d2', weight: 4, dashArray: '10, 10' }).addTo(map);
    map.fitBounds(tripRouteLine.getBounds(), { padding: [50, 50] });
  }

  if (loading) loading.style.display = 'none';
  if (resultsDiv) resultsDiv.style.display = 'block';

  // ── Phase 2: Analyse each segment for battery feasibility ──
  // Build segments: start → stop1 → stop2 → ... → destination
  const segments = [];
  let prevName = startName || 'Start';
  let prevLoc = startLatLng;

  stops.forEach((stop, idx) => {
    const segDist = stop.distFromPrev;
    segments.push({
      from: prevName,
      to: stop.station.name,
      distance: segDist,
      station: stop.station,
      stopIndex: idx + 1,
      cumulativeDist: stop.cumulativeDist,
    });
    prevName = stop.station.name;
    prevLoc = L.latLng(stop.station.lat, stop.station.lng);
  });

  // Last segment to destination
  segments.push({
    from: prevName,
    to: destName || 'Destination',
    distance: lastLegDist,
    station: null,
    stopIndex: null,
    cumulativeDist: totalRouteDist,
  });

  // ── Phase 3: Render results ──
  if (stopsDiv) {
    // Header card
    let html = `
      <div style="background:var(--surface2); padding: 0.8rem; border-radius:8px; margin-bottom:1rem;">
        <div style="font-size:0.85em; color:var(--text-muted); margin-bottom:0.25rem;">From: <strong>${startName || 'Start'}</strong></div>
        <div style="font-size:0.85em; color:var(--text-muted); margin-bottom:0.5rem;">To: <strong>${destName || 'Destination'}</strong></div>
        <div style="font-size:1.1em; color:var(--accent); margin-bottom:0.25rem;">Total Route Distance: <strong>${totalRouteDist.toFixed(1)} km</strong></div>
        <div style="font-size:0.8em; color:var(--text-muted);">(Straight-line: ${totalDist.toFixed(1)} km) &nbsp;|&nbsp; Battery Range: <strong>${rangeKm} km</strong></div>
      </div>
    `;

    if (stops.length === 0 && totalDist <= rangeKm) {
      html += `<div style="background:rgba(0,200,83,0.1); border:1px solid rgba(0,200,83,0.3); border-radius:8px; padding:0.8rem; text-align:center;">
        <div style="font-size:1.3em; margin-bottom:0.3rem;">✅</div>
        <strong>Direct trip possible!</strong><br>
        <span style="font-size:0.85em; color:var(--text-muted);">No charging stops required. Your battery range (${rangeKm} km) covers the entire distance.</span>
      </div>`;
    } else if (stops.length === 0 && totalDist > rangeKm) {
      // No stations found but distance exceeds range
      const chargesNeeded = Math.ceil(totalDist / rangeKm);
      html += `<div style="background:rgba(255,152,0,0.1); border:1px solid rgba(255,152,0,0.4); border-radius:8px; padding:0.8rem;">
        <div style="font-size:1.3em; margin-bottom:0.3rem;">⚠️</div>
        <strong>No charging stations found along this route!</strong><br>
        <span style="font-size:0.85em; color:var(--text-muted);">
          The total distance is <strong>${totalDist.toFixed(1)} km</strong> but your battery range is only <strong>${rangeKm} km</strong>.<br>
          You would need <strong style="color:var(--danger);">${chargesNeeded} full battery charge${chargesNeeded > 1 ? 's' : ''}</strong> to cover this distance.
        </span>
      </div>`;
    } else {
      // ── Trip timeline ──
      html += `<p><strong>Trip Breakdown (${stops.length} charging stop${stops.length !== 1 ? 's' : ''}):</strong></p>`;
      html += `<div style="padding-left:0;">`;

      let cumulativeShown = 0;

      segments.forEach((seg, idx) => {
        const isLastSeg = idx === segments.length - 1;
        const exceedsRange = seg.distance > rangeKm;
        const chargesNeeded = exceedsRange ? Math.ceil(seg.distance / rangeKm) : 0;
        cumulativeShown += seg.distance;

        // Segment distance bar
        const pct = Math.min((seg.distance / rangeKm) * 100, 100);
        const barColor = exceedsRange ? '#ff5252' : '#00c853';

        html += `<div style="margin-bottom: 0.75rem; border: 1px solid var(--surface2); border-radius:8px; padding: 0.6rem; ${exceedsRange ? 'border-color: rgba(255,82,82,0.5); background:rgba(255,82,82,0.05);' : ''}">`;

        // Segment header
        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
          <span style="font-size:0.8em; color:var(--text-muted);">${seg.from}</span>
          <span style="font-size:0.75em; color:var(--text-muted);">→</span>
          <span style="font-size:0.8em; color:var(--text-muted);">${seg.to}</span>
        </div>`;

        // Distance bar
        html += `<div style="background:rgba(255,255,255,0.05); border-radius:4px; height:6px; margin-bottom:0.4rem; overflow:hidden;">
          <div style="background:${barColor}; height:100%; width:${pct}%; border-radius:4px; transition: width 0.3s;"></div>
        </div>`;

        // Distance info
        html += `<div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.85em; font-weight:600;">${seg.distance.toFixed(1)} km</span>
          <span style="font-size:0.75em; color:var(--text-muted);">Cumulative: ${cumulativeShown.toFixed(1)} km</span>
        </div>`;

        // Warning if exceeds range
        if (exceedsRange) {
          html += `<div style="margin-top:0.4rem; padding:0.4rem 0.6rem; background:rgba(255,82,82,0.1); border-radius:6px; border-left: 3px solid #ff5252;">
            <span style="font-size:0.8em; color:#ff5252; font-weight:600;">⚠️ This segment (${seg.distance.toFixed(1)} km) exceeds your battery range (${rangeKm} km)!</span><br>
            <span style="font-size:0.8em; color:var(--text-muted);">You need <strong style="color:#ff5252;">${chargesNeeded} battery charge${chargesNeeded > 1 ? 's' : ''}</strong> for this segment. Consider carrying a portable charger or plan an alternate route.</span>
          </div>`;
        }

        // Station info (if this segment ends in a stop, not the destination)
        if (seg.station && !isLastSeg) {
          html += `<div style="margin-top:0.5rem; padding:0.4rem 0.6rem; background:rgba(0,200,83,0.05); border-radius:6px; border-left: 3px solid #00c853;">
            <div style="font-weight:bold; font-size:0.85rem;">⚡ ${seg.station.name} <span style="font-size:0.75em; color:var(--text-muted);">(${seg.station.operator})</span></div>
            <div style="font-size:0.8em; color:var(--text-muted);">${seg.station.address}</div>
          </div>`;
        }

        html += `</div>`; // end segment card
      });

      html += `</div>`; // end segments container

      // ── Trip summary box ──
      const problematicSegments = segments.filter(s => s.distance > rangeKm);
      const totalChargesNeeded = problematicSegments.reduce((sum, s) => sum + Math.ceil(s.distance / rangeKm), 0);
      const normalCharges = segments.filter(s => s.distance <= rangeKm && s.distance > 0).length;

      html += `<div style="background:var(--surface2); padding: 0.8rem; border-radius:8px; margin-top:0.5rem;">
        <div style="font-weight:bold; font-size:0.95em; margin-bottom:0.4rem;">📊 Trip Summary</div>
        <div style="font-size:0.85em; display:grid; grid-template-columns: 1fr 1fr; gap: 0.3rem;">
          <span>Total Distance:</span><span style="font-weight:600;">${totalRouteDist.toFixed(1)} km</span>
          <span>Charging Stops:</span><span style="font-weight:600;">${stops.length}</span>
          <span>Segments:</span><span style="font-weight:600;">${segments.length}</span>
          <span>Battery Range:</span><span style="font-weight:600;">${rangeKm} km</span>
        </div>`;

      if (problematicSegments.length > 0) {
        html += `<div style="margin-top:0.5rem; padding:0.4rem 0.6rem; background:rgba(255,152,0,0.1); border-radius:6px;">
          <span style="font-size:0.8em; color:#ff9800; font-weight:600;">⚠️ ${problematicSegments.length} segment${problematicSegments.length > 1 ? 's' : ''} exceed${problematicSegments.length === 1 ? 's' : ''} your battery range.</span><br>
          <span style="font-size:0.8em; color:var(--text-muted);">Total charges needed for those segments: <strong style="color:#ff5252;">${totalChargesNeeded}</strong></span>
        </div>`;
      } else {
        html += `<div style="margin-top:0.5rem; padding:0.4rem 0.6rem; background:rgba(0,200,83,0.08); border-radius:6px;">
          <span style="font-size:0.8em; color:#00c853; font-weight:600;">✅ All segments are within your battery range. Safe trip!</span>
        </div>`;
      }

      html += `</div>`; // end summary box
    }

    stopsDiv.innerHTML = html;

    // Navigate route button
    const navBtn = document.getElementById('btn-navigate-trip');
    if (navBtn) {
      const origin = `${startLatLng.lat},${startLatLng.lng}`;
      const destination = `${destLatLng.lat},${destLatLng.lng}`;
      let mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
      if (stops.length > 0) {
        const wps = stops.map(s => `${s.station.lat},${s.station.lng}`).join('|');
        mapsUrl += `&waypoints=${wps}`;
      }
      navBtn.onclick = () => window.open(mapsUrl, '_blank');
      navBtn.style.display = 'inline-block';
    }
  }
}



function init() {
  renderHeader();
  setupLogout();
  setupProfile();
  setupAddStation();

  document.getElementById('btn-admin').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/admin.html';
  });

  // Trip Planner
  const btnTrip = document.getElementById('btn-open-trip');
  if (btnTrip) btnTrip.addEventListener('click', handleTripPlanClick);

  const btnCalc = document.getElementById('btn-calc-trip-route');
  if (btnCalc) btnCalc.addEventListener('click', handleCalculateTripClick);

  const btnMyLocTrips = document.getElementById('btn-use-my-loc-trip');
  if (btnMyLocTrips) btnMyLocTrips.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        document.getElementById('trip-start-text').value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      },
      () => {
        alert('Unable to retrieve your location');
      }
    );
  });

  const tripRangeInputEl = document.getElementById('trip-range');
  const tripRangeWarn = document.getElementById('trip-range-warning');
  if (tripRangeInputEl && tripRangeWarn) {
    tripRangeInputEl.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      if (val < 50) {
        tripRangeWarn.style.display = 'block';
        tripRangeInputEl.style.borderColor = 'var(--danger)';
      } else {
        tripRangeWarn.style.display = 'none';
        tripRangeInputEl.style.borderColor = '';
      }
    });
  }

  const rangeInput = document.getElementById('input-range-km');
  if (rangeInput && currentUser && currentUser.batteryRangeKm) {
    rangeInput.value = currentUser.batteryRangeKm;
  }

  document.getElementById('btn-locate').addEventListener('click', doLocateStations);
  const btnLocateMe = document.getElementById('btn-my-location');
  if (btnLocateMe) btnLocateMe.addEventListener('click', doLocateMe);

  initMap();



  document.getElementById('modal').addEventListener('click', function (e) {
    if (e.target.id === 'modal') closeModal();
  });
  document.getElementById('modal-profile').addEventListener('click', function (e) {
    if (e.target.id === 'modal-profile') window.voltPathCloseProfile();
  });
  document.getElementById('modal-add-station').addEventListener('click', function (e) {
    if (e.target.id === 'modal-add-station') window.voltPathCloseAddStation();
  });

  const tripModal = document.getElementById('modal-trip');
  if (tripModal) {
    tripModal.addEventListener('click', function (e) {
      if (e.target.id === 'modal-trip') closeTripModal();
    });
  }

  fetchStations()
    .then(stations => {
      addStationMarkers(stations);
      renderStationList(stations);
    })
    .catch(() => {
      document.getElementById('station-list').innerHTML = '<p class="empty-msg">Enter battery range and click "Locate stations", or wait for load.</p>';
    });

  refreshReservations();

  setInterval(() => {
    if (selectedStation) showStationDetail(selectedStation.id);
  }, 12000);
}

init();

// ═══════════════════════════════════════════════════════════════════════════
//  NAV TABS — Map / Stations
// ═══════════════════════════════════════════════════════════════════════════

let allStationsCache = [];
let sflFiltered      = [];   // current filtered set
let sflPage          = 1;
const SFL_PAGE_SIZE  = 10;

function switchNavTab(tab) {
  const mapPanel      = document.getElementById('map-tab-panel');
  const stationsPanel = document.getElementById('stations-tab-panel');
  const tabMap        = document.getElementById('navtab-map');
  const tabStations   = document.getElementById('navtab-stations');

  if (tab === 'map') {
    mapPanel.style.display      = '';
    stationsPanel.classList.remove('active');
    tabMap.classList.add('active');
    tabStations.classList.remove('active');
    // Invalidate map size after showing it again
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
  } else {
    mapPanel.style.display      = 'none';
    stationsPanel.classList.add('active');
    tabMap.classList.remove('active');
    tabStations.classList.add('active');
    loadStationsTab();
  }
}

async function loadStationsTab() {
  const list = document.getElementById('sfl-list');
  if (allStationsCache.length > 0) {
    renderSflList(allStationsCache);
    return;
  }
  list.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted)">
    <div style="font-size:1.5rem;margin-bottom:0.5rem">⚡</div>Loading stations…</div>`;
  try {
    const stations = await fetchStations();

    // Sort: Tamil Nadu first, then other states alphabetically, within each state sort by name
    stations.sort((a, b) => {
      const aTN = (a.state || '').toLowerCase().includes('tamil') ? 0 : 1;
      const bTN = (b.state || '').toLowerCase().includes('tamil') ? 0 : 1;
      if (aTN !== bTN) return aTN - bTN;           // TN first
      const stateCompare = (a.state || '').localeCompare(b.state || '');  // then state A-Z
      if (stateCompare !== 0) return stateCompare;
      return (a.name || '').localeCompare(b.name || '');  // then name A-Z
    });

    allStationsCache = stations;
    renderSflList(allStationsCache);
  } catch (e) {
    list.innerHTML = `<div style="color:var(--danger);padding:1rem">Failed to load: ${e.message}</div>`;
  }
}

function renderSflList(stations) {
  const list    = document.getElementById('sfl-list');
  const countEl = document.getElementById('sfl-count');

  sflFiltered = stations;
  if (countEl) countEl.textContent = stations.length;

  if (stations.length === 0) {
    list.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:2rem">No stations found.</div>`;
    updateSflPagination(0);
    return;
  }

  const totalPages = Math.ceil(stations.length / SFL_PAGE_SIZE);
  sflPage = Math.max(1, Math.min(sflPage, totalPages));

  const start = (sflPage - 1) * SFL_PAGE_SIZE;
  const slice = stations.slice(start, start + SFL_PAGE_SIZE);

  list.innerHTML = slice.map((s, i) => {
    const globalIdx = start + i;
    return `
      <div class="sfl-item" onclick="showSflDetail('${s.id || s.stationId}', ${globalIdx})">
        <div class="sfl-item-name">${s.name}</div>
        <div class="sfl-item-meta">
          <span class="sfl-operator">${s.operator || '—'}</span>
          ${s.city  ? `<span class="sfl-city">📍 ${s.city}</span>` : ''}
          ${s.state ? `<span style="font-size:0.7rem;color:var(--text-muted)">${s.state}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  updateSflPagination(totalPages);
}

function updateSflPagination(totalPages) {
  const prevBtn  = document.getElementById('sfl-prev');
  const nextBtn  = document.getElementById('sfl-next');
  const pageInfo = document.getElementById('sfl-page-info');

  if (prevBtn)  prevBtn.disabled  = sflPage <= 1;
  if (nextBtn)  nextBtn.disabled  = sflPage >= totalPages;
  if (pageInfo) pageInfo.textContent = totalPages > 0 ? `Page ${sflPage} / ${totalPages}` : '';

  // Style disabled state
  [prevBtn, nextBtn].forEach(btn => {
    if (!btn) return;
    btn.style.opacity = btn.disabled ? '0.35' : '1';
    btn.style.cursor  = btn.disabled ? 'not-allowed' : 'pointer';
  });
}

function sflChangePage(direction) {
  const totalPages = Math.ceil(sflFiltered.length / SFL_PAGE_SIZE);
  sflPage = Math.max(1, Math.min(sflPage + direction, totalPages));
  renderSflList(sflFiltered);
  document.getElementById('sfl-list').scrollTop = 0;
}

function filterStationsList() {
  const q = document.getElementById('sfl-search-input').value.toLowerCase().trim();
  sflPage = 1;   // reset to page 1 on new search
  if (!q) {
    renderSflList(allStationsCache);
    return;
  }
  const filtered = allStationsCache.filter(s =>
    (s.name     || '').toLowerCase().includes(q) ||
    (s.city     || '').toLowerCase().includes(q) ||
    (s.operator || '').toLowerCase().includes(q) ||
    (s.state    || '').toLowerCase().includes(q) ||
    (s.address  || '').toLowerCase().includes(q)
  );
  renderSflList(filtered);
}

async function showSflDetail(stationId, idx) {
  // Highlight selected
  document.querySelectorAll('.sfl-item').forEach((el, i) => {
    el.style.borderColor = i === idx ? 'var(--accent)' : 'transparent';
    el.style.background  = i === idx ? 'rgba(0,230,118,0.07)' : '';
  });

  const detail = document.getElementById('sfl-detail');
  detail.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted)">
    <div style="font-size:1.5rem;margin-bottom:0.5rem">⚡</div>Loading…</div>`;

  try {
    const s = await fetchStationDetail(stationId);

    const ports = (s.ports || []).map(p => {
      const status    = p.functional ? (p.occupancy === 'free' ? 'free' : 'occupied') : 'defective';
      const statusTxt = p.functional ? (p.occupancy === 'free' ? '✅ Free' : '🔴 Occupied') : '⚠️ Defective';
      return `
        <div class="port-card">
          <div class="port-card-type">🔌 ${p.connectorType}</div>
          <div class="port-card-power">${p.powerKw} <span>kW</span></div>
          <div class="port-status ${status}">${statusTxt}</div>
        </div>`;
    }).join('');

    detail.innerHTML = `
      <div class="sfl-detail-card">
        <div class="sfl-detail-title">${s.name}</div>
        <div class="sfl-detail-address">📍 ${s.address}</div>

        <div class="sfl-detail-tags">
          ${s.operator ? `<span class="tag tag-operator">⚡ ${s.operator}</span>` : ''}
          ${s.city     ? `<span class="tag tag-city">${s.city}</span>` : ''}
          ${s.state    ? `<span class="tag tag-state">${s.state}</span>` : ''}
          <span class="tag tag-coord">${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}</span>
        </div>

        <div class="sfl-detail-section">
          <h4>Charging Ports (${(s.ports || []).length})</h4>
          ${ports ? `<div class="port-grid">${ports}</div>` : '<p style="color:var(--text-muted);font-size:0.85rem">No ports listed.</p>'}
        </div>

        <div class="sfl-detail-section">
          <h4>Actions</h4>
          <button class="btn btn-primary" style="margin-right:0.5rem"
            onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}','_blank')">
            🗺 Navigate
          </button>
          <button class="btn btn-secondary"
            onclick="switchNavTab('map');setTimeout(()=>selectStation({id:'${s.id}',lat:${s.lat},lng:${s.lng},name:'${(s.name||'').replace(/'/g,"\\'")}'}),300)">
            View on Map
          </button>
        </div>
      </div>`;
  } catch (e) {
    detail.innerHTML = `<div style="color:var(--danger);padding:1.5rem">❌ Could not load station: ${e.message}</div>`;
  }
}

// Expose to HTML onclick
window.switchNavTab       = switchNavTab;
window.filterStationsList = filterStationsList;
window.showSflDetail      = showSflDetail;
window.sflChangePage      = sflChangePage;

// ═══════════════════════════════════════════════════════════════════════════════
//  MONTH 2 — CHARGING SESSIONS & WEBSOCKET
// ═══════════════════════════════════════════════════════════════════════════════

let activeChargingSession = null;
let chargingPortInfo = null;

// ── Socket.io Integration ────────────────────────────────────────────────────
let socket = null;
try {
  if (typeof io !== 'undefined') {
    socket = io();
    
    // Join user room for personal notifications
    if (currentUser && currentUser.userId) {
      socket.emit('join-user', currentUser.userId);
    } else if (currentUser && currentUser.id) {
      socket.emit('join-user', currentUser.id);
    }

    // Listen for real-time port status updates
    socket.on('port-status-update', (statusUpdates) => {
      // Update port badges in the station detail panel if visible
      if (statusUpdates && Array.isArray(statusUpdates)) {
        statusUpdates.forEach(update => {
          const badge = document.querySelector(`[data-port-id="${update.portId}"] .port-badge`);
          if (badge) {
            badge.className = `port-badge ${update.occupancy}`;
            badge.textContent = update.occupancy === 'free' ? '● Free' : '● Occupied';
          }
        });
      }
    });

    // Listen for charging progress updates
    socket.on('charging-progress', (data) => {
      updateChargingProgress(data);
    });

    // Listen for charging complete
    socket.on('charging-complete', (data) => {
      showChargingComplete(data);
    });

    // Listen for real-time notifications
    socket.on('notification', (notif) => {
      if (notif && notif.title) {
        showToast(notif.title, 'info');
      }
    });

    console.log('🔌 WebSocket connected');
  }
} catch (e) {
  console.log('WebSocket not available:', e.message);
}

// ── Open Charging Modal ──────────────────────────────────────────────────────
function openChargingModal(portId, connectorType, powerKw, pricePerKwh, stationName) {
  chargingPortInfo = { portId, connectorType, powerKw, pricePerKwh, stationName };
  
  // Set port info text
  const info = document.getElementById('charging-port-info');
  if (info) info.textContent = `${stationName || ''} • ${connectorType} • ${powerKw} kW • ₹${pricePerKwh || 12}/kWh`;

  // Show start form, hide others
  const startForm = document.getElementById('charging-start-form');
  const progressView = document.getElementById('charging-progress-view');
  const completeView = document.getElementById('charging-complete-view');
  if (startForm) startForm.style.display = 'block';
  if (progressView) progressView.style.display = 'none';
  if (completeView) completeView.style.display = 'none';

  // Update cost preview
  updateCostPreview();

  // Bind events
  const durationInput = document.getElementById('charging-duration');
  if (durationInput) durationInput.oninput = updateCostPreview;

  const startBtn = document.getElementById('btn-start-charging');
  if (startBtn) startBtn.onclick = startChargingSession;

  // Show modal
  document.getElementById('modal-charging').style.display = 'flex';
  document.body.classList.add('modal-open');
}
window.openChargingModal = openChargingModal;

function closeChargingModal() {
  document.getElementById('modal-charging').style.display = 'none';
  document.body.classList.remove('modal-open');
}
window.closeChargingModal = closeChargingModal;

function updateCostPreview() {
  if (!chargingPortInfo) return;
  const durationMin = parseInt(document.getElementById('charging-duration')?.value) || 30;
  const energyKwh = (chargingPortInfo.powerKw * (durationMin / 60)).toFixed(2);
  const cost = (energyKwh * (chargingPortInfo.pricePerKwh || 12)).toFixed(2);

  const energyEl = document.getElementById('preview-energy');
  const costEl = document.getElementById('preview-cost');
  if (energyEl) energyEl.textContent = `${energyKwh} kWh`;
  if (costEl) costEl.textContent = `₹${cost}`;
}

// ── Start Charging Session ───────────────────────────────────────────────────
async function startChargingSession() {
  if (!chargingPortInfo) return;

  const durationMin = parseInt(document.getElementById('charging-duration')?.value) || 30;
  const batteryStart = parseInt(document.getElementById('charging-battery-start')?.value) || 20;
  const batteryTarget = parseInt(document.getElementById('charging-battery-target')?.value) || 80;

  const btn = document.getElementById('btn-start-charging');
  if (btn) { btn.disabled = true; btn.textContent = 'Starting...'; }

  try {
    const res = await fetch(API_BASE + '/sessions/start', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        portId: chargingPortInfo.portId,
        durationMin,
        batteryStartPct: batteryStart,
        batteryTargetPct: batteryTarget,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start charging');

    activeChargingSession = data;

    // Switch to progress view
    document.getElementById('charging-start-form').style.display = 'none';
    document.getElementById('charging-progress-view').style.display = 'block';
    document.getElementById('charging-progress-port').textContent =
      `${chargingPortInfo.stationName} • ${chargingPortInfo.connectorType} • ${chargingPortInfo.powerKw} kW`;

    // Show floating indicator
    document.getElementById('floating-session').style.display = 'block';

    // Bind stop button
    const stopBtn = document.getElementById('btn-stop-charging');
    if (stopBtn) stopBtn.onclick = stopChargingSession;

    showToast('⚡ Charging started!', 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Start Charging'; }
  }
}

// ── Update Charging Progress (from WebSocket) ────────────────────────────────
function updateChargingProgress(data) {
  // Update modal progress
  const bar = document.getElementById('charging-bar');
  const barLabel = document.getElementById('charging-bar-label');
  if (bar) bar.style.width = data.progressPct + '%';
  if (barLabel) barLabel.textContent = data.progressPct + '%';

  const liveEnergy = document.getElementById('live-energy');
  const liveCost = document.getElementById('live-cost');
  const liveBattery = document.getElementById('live-battery');
  const liveRemaining = document.getElementById('live-remaining');

  if (liveEnergy) liveEnergy.textContent = data.energyKwh + ' kWh';
  if (liveCost) liveCost.textContent = '₹' + data.totalCostINR;
  if (liveBattery) liveBattery.textContent = data.batteryPct + '%';
  if (liveRemaining) liveRemaining.textContent = data.remainingMin + ' min';

  // Update floating indicator
  const floatProgress = document.getElementById('float-progress');
  const floatEnergy = document.getElementById('float-energy');
  const floatCost = document.getElementById('float-cost');
  const floatBar = document.getElementById('float-bar');

  if (floatProgress) floatProgress.textContent = data.progressPct + '%';
  if (floatEnergy) floatEnergy.textContent = data.energyKwh + ' kWh';
  if (floatCost) floatCost.textContent = '₹' + data.totalCostINR;
  if (floatBar) floatBar.style.width = data.progressPct + '%';
}

// ── Show Charging Complete ───────────────────────────────────────────────────
function showChargingComplete(data) {
  activeChargingSession = null;

  // Hide floating indicator
  document.getElementById('floating-session').style.display = 'none';

  // Switch views in modal
  const progressView = document.getElementById('charging-progress-view');
  const completeView = document.getElementById('charging-complete-view');
  if (progressView) progressView.style.display = 'none';
  if (completeView) completeView.style.display = 'block';

  // Set completion stats
  const completeEnergy = document.getElementById('complete-energy');
  const completeCost = document.getElementById('complete-cost');
  if (completeEnergy) completeEnergy.textContent = (data.energyKwh || 0) + ' kWh';
  if (completeCost) completeCost.textContent = '₹' + (data.totalCostINR || 0);

  // If modal was closed, show it
  document.getElementById('modal-charging').style.display = 'flex';
  document.body.classList.add('modal-open');

  showToast('✅ Charging complete!', 'success');
}

// ── Stop Charging Session ────────────────────────────────────────────────────
async function stopChargingSession() {
  if (!activeChargingSession) return;

  const btn = document.getElementById('btn-stop-charging');
  if (btn) { btn.disabled = true; btn.textContent = 'Stopping...'; }

  try {
    const res = await fetch(API_BASE + '/sessions/' + activeChargingSession.sessionId + '/stop', {
      method: 'POST',
      headers: authHeaders(),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to stop session');

    showChargingComplete({
      energyKwh: data.energyKwh,
      totalCostINR: data.totalCostINR,
    });
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⏹ Stop Charging'; }
  }
}

// ── Open Progress Modal (from floating indicator) ────────────────────────────
function openChargingProgress() {
  const modal = document.getElementById('modal-charging');
  const startForm = document.getElementById('charging-start-form');
  const progressView = document.getElementById('charging-progress-view');
  const completeView = document.getElementById('charging-complete-view');

  if (startForm) startForm.style.display = 'none';
  if (progressView) progressView.style.display = 'block';
  if (completeView) completeView.style.display = 'none';

  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}
window.openChargingProgress = openChargingProgress;

// ── Check for Active Session on Page Load ────────────────────────────────────
async function checkActiveSession() {
  try {
    const res = await fetch(API_BASE + '/sessions/active', { headers: authHeaders() });
    const session = await res.json();
    if (session && session.sessionId && session.status === 'charging') {
      activeChargingSession = session;
      document.getElementById('floating-session').style.display = 'block';

      // Update floating indicator with current values
      updateChargingProgress({
        progressPct: session.progressPct || 0,
        energyKwh: session.energyKwh || 0,
        totalCostINR: session.totalCostINR || 0,
        batteryPct: session.batteryEndPct || session.batteryStartPct || 0,
        remainingMin: Math.max(0, session.durationMin - Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000)),
      });
    }
  } catch (e) {
    // Silent — session API might not be available yet
  }
}

// Run on page load
checkActiveSession();
