// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL — admin-app.js
// ══════════════════════════════════════════════════════════════════════════════
const API = window.location.origin + '/api';
const token = localStorage.getItem('valence_token');
const user = (() => { try { return JSON.parse(localStorage.getItem('valence_user') || 'null'); } catch { return null; } })();
if (!token || !user) { window.location.href = '/login.html'; throw new Error('redirect'); }
if (user.role !== 'admin') { window.location.href = '/'; throw new Error('not admin'); }
function H() { return { 'Content-Type':'application/json', Authorization:'Bearer '+token }; }

document.getElementById('admin-user').textContent = `👤 ${user.name || user.username}`;

let allUsers = [];

// ── Tab Navigation ──────────────────────────────────────────────────────────
const titles = { overview:'📊 Overview', users:'👥 User Management', stations:'⚡ Station Management', activity:'📋 Activity Log', system:'🎛️ System & Settings' };
document.querySelectorAll('#admin-nav a[data-tab]').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelectorAll('#admin-nav a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + a.dataset.tab).classList.add('active');
    document.getElementById('tab-title').textContent = titles[a.dataset.tab] || '';
    if (a.dataset.tab === 'users') loadUsers();
    if (a.dataset.tab === 'stations') loadStations();
    if (a.dataset.tab === 'activity') loadActivity();
    if (a.dataset.tab === 'system') loadSystem();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
async function loadOverview() {
  try {
    const res = await fetch(API + '/admin/stats', { headers: H() });
    if (!res.ok) throw new Error('Failed');
    const d = await res.json();

    document.getElementById('kpi-grid').innerHTML = [
      { l:'Users', v:d.totalUsers },
      { l:'Stations', v:d.totalStations },
      { l:'Ports', v:d.totalPorts },
      { l:'Reservations', v:d.totalReservations },
      { l:'Reviews', v:d.totalReviews },
    ].map(k => `<div class="kpi"><div class="label">${k.l}</div><div class="value">${k.v}</div></div>`).join('');

    // Reservations chart
    const days = Object.keys(d.reservationsPerDay);
    const vals = Object.values(d.reservationsPerDay);
    new Chart(document.getElementById('chart-reservations'), {
      type:'bar', data:{ labels:days.map(d=>d.slice(5)), datasets:[{ label:'Bookings', data:vals, backgroundColor:'rgba(0,230,118,0.6)', borderRadius:6 }] },
      options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ color:'#6b7fa3' } }, x:{ ticks:{ color:'#6b7fa3' } } } }
    });

    // Connector chart
    const cLabels = Object.keys(d.connectorDistribution);
    const cVals = Object.values(d.connectorDistribution);
    new Chart(document.getElementById('chart-connectors'), {
      type:'doughnut', data:{ labels:cLabels, datasets:[{ data:cVals, backgroundColor:['#00e676','#00b0ff','#7c4dff','#ffab00','#ff5252'] }] },
      options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ color:'#6b7fa3', font:{size:11} } } } }
    });

    // Top stations
    if (d.topStations.length > 0) {
      new Chart(document.getElementById('chart-top'), {
        type:'bar', data:{ labels:d.topStations.map(s=>s.name.slice(0,20)), datasets:[{ label:'Bookings', data:d.topStations.map(s=>s.count), backgroundColor:'rgba(0,176,255,0.6)', borderRadius:6 }] },
        options:{ indexAxis:'y', responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true, ticks:{color:'#6b7fa3'} }, y:{ ticks:{color:'#6b7fa3',font:{size:11}} } } }
      });
    }

    // Check pending count
    const pRes = await fetch(API + '/admin/pending-stations', { headers: H() });
    if (pRes.ok) {
      const pending = await pRes.json();
      const dot = document.getElementById('pending-count');
      if (pending.length > 0) { dot.textContent = pending.length; dot.style.display = ''; }
      else dot.style.display = 'none';
    }
  } catch (e) { console.error('Overview error:', e); }
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: USERS
// ══════════════════════════════════════════════════════════════════════════════
async function loadUsers() {
  try {
    const res = await fetch(API + '/users', { headers: H() });
    if (!res.ok) throw new Error('Failed');
    allUsers = await res.json();
    renderUsers(allUsers);
    updateUserCount(allUsers.length);
  } catch (e) { document.getElementById('user-table-wrap').innerHTML = '<p style="color:var(--danger);">'+e.message+'</p>'; }
}

function filterUsers() {
  const q = document.getElementById('user-search').value.toLowerCase();
  const filtered = allUsers.filter(u => (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || (u.username||'').toLowerCase().includes(q));
  renderUsers(filtered);
  updateUserCount(filtered.length);
}

function updateUserCount(n) {
  const el = document.getElementById('user-count');
  if (el) el.textContent = n + ' user' + (n !== 1 ? 's' : '');
}

function renderUsers(users) {
  document.getElementById('user-table-wrap').innerHTML = `
    <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.5rem;">${users.length} users found</p>
    <table class="admin-table"><thead><tr>
      <th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Vehicle</th><th>Joined</th><th>Actions</th>
    </tr></thead><tbody>
    ${users.map(u => `<tr>
      <td style="font-weight:600;">${u.username||'-'}</td>
      <td>${u.name||'-'}</td>
      <td>${u.email||'-'}</td>
      <td><span class="badge ${u.role==='admin'?'badge-admin':'badge-user'}">${u.role}</span></td>
      <td style="font-size:0.78rem;">${(u.vehicleType||'')+' '+(u.vehicleModel||'')||'-'}</td>
      <td style="font-size:0.75rem;color:var(--text-muted);">${u.createdAt?new Date(u.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'}):'-'}</td>
      <td>
        ${u.userId===user.userId ? '<span style="font-size:0.72rem;color:var(--text-muted);">You</span>' : `
          <button class="act-btn" onclick="toggleRole('${u.userId}')">${u.role==='admin'?'Demote':'Promote'}</button>
          <button class="act-btn reject" onclick="deleteUser('${u.userId}','${(u.name||u.username).replace(/'/g,"\\'")}')">Delete</button>
        `}
      </td>
    </tr>`).join('')}
    </tbody></table>`;
}

async function toggleRole(uid) {
  if (!confirm('Change this user\'s role?')) return;
  await fetch(API+'/admin/user/'+uid+'/role', { method:'PUT', headers:H() });
  loadUsers();
}

async function deleteUser(uid, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  await fetch(API+'/admin/user/'+uid, { method:'DELETE', headers:H() });
  loadUsers();
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: STATIONS (with approval)
// ══════════════════════════════════════════════════════════════════════════════
async function loadStations() {
  try {
    // Pending stations
    const pRes = await fetch(API+'/admin/pending-stations', { headers:H() });
    const pending = pRes.ok ? await pRes.json() : [];
    const dot = document.getElementById('pending-count');
    if (pending.length > 0) { dot.textContent = pending.length; dot.style.display = ''; }
    else dot.style.display = 'none';

    document.getElementById('pending-section').innerHTML = pending.length === 0
      ? '<div style="background:var(--surface);border:1px solid var(--surface2);border-radius:12px;padding:1rem;margin-bottom:0.75rem;text-align:center;color:var(--text-muted);">✅ No stations pending approval</div>'
      : `<h3 style="color:#ffab00;margin-bottom:0.5rem;">⏳ Pending Approval (${pending.length})</h3>
        <table class="admin-table"><thead><tr><th>Name</th><th>Address</th><th>Added By</th><th>Date</th><th>Actions</th></tr></thead><tbody>
        ${pending.map(s=>`<tr style="background:rgba(255,171,0,0.04);">
          <td style="font-weight:600;">⚡ ${s.name}</td>
          <td style="font-size:0.78rem;">${s.address}</td>
          <td style="font-size:0.78rem;">${s.addedBy}</td>
          <td style="font-size:0.75rem;color:var(--text-muted);">${new Date(s.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td>
          <td>
            <button class="act-btn approve" onclick="approveStation('${s.stationId}')">✅ Approve</button>
            <button class="act-btn reject" onclick="rejectStation('${s.stationId}','${s.name.replace(/'/g,"\\'")}')">❌ Reject</button>
          </td>
        </tr>`).join('')}
        </tbody></table>`;

    // All stations
    const sRes = await fetch(API+'/stations', { headers:H() });
    const all = sRes.ok ? await sRes.json() : [];
    document.getElementById('all-stations-wrap').innerHTML = `
      <table class="admin-table"><thead><tr><th>Name</th><th>City</th><th>Operator</th><th>Status</th><th>Added By</th><th>Actions</th></tr></thead><tbody>
      ${all.map(s=>`<tr>
        <td style="font-weight:600;">⚡ ${s.name}</td>
        <td>${s.city||'-'}</td>
        <td>${s.operator||'-'}</td>
        <td><span class="badge ${s.status==='approved'?'badge-approved':'badge-pending'}">${s.status||'approved'}</span></td>
        <td style="font-size:0.78rem;">${s.addedBy||'system'}</td>
        <td><button class="act-btn reject" onclick="deleteStation('${s.stationId}','${s.name.replace(/'/g,"\\'")}')">🗑️ Delete</button></td>
      </tr>`).join('')}
      </tbody></table>`;
  } catch (e) { console.error('Stations error:', e); }
}

async function approveStation(id) {
  await fetch(API+'/admin/approve-station/'+id, { method:'POST', headers:H() });
  loadStations();
}
async function rejectStation(id, name) {
  if (!confirm(`Reject "${name}"? It will be deleted permanently.`)) return;
  await fetch(API+'/admin/reject-station/'+id, { method:'POST', headers:H() });
  loadStations();
}
async function deleteStation(id, name) {
  if (!confirm(`Delete station "${name}"?`)) return;
  await fetch(API+'/stations/'+id, { method:'DELETE', headers:H() });
  loadStations();
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4: ACTIVITY
// ══════════════════════════════════════════════════════════════════════════════
async function loadActivity() {
  try {
    const res = await fetch(API+'/admin/activity', { headers:H() });
    if (!res.ok) return;
    const d = await res.json();
    const fmt = dt => dt ? new Date(dt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '-';

    document.getElementById('act-reservations').innerHTML = d.recentReservations.length === 0 ? '<p style="color:var(--text-muted);font-size:0.8rem;">No reservations yet</p>' :
      `<div style="max-height:250px;overflow-y:auto;">${d.recentReservations.map(r=>`
        <div style="padding:0.35rem 0;border-bottom:1px solid var(--surface2);font-size:0.78rem;">
          <span style="font-weight:600;">${r.userId}</span> · Port ${r.portId} · <span class="badge ${r.status==='confirmed'?'badge-approved':'badge-pending'}">${r.status}</span> · ${fmt(r.createdAt)}
        </div>`).join('')}</div>`;

    document.getElementById('act-reviews').innerHTML = d.recentReviews.length === 0 ? '<p style="color:var(--text-muted);font-size:0.8rem;">No reviews yet</p>' :
      `<div style="max-height:250px;overflow-y:auto;">${d.recentReviews.map(r=>`
        <div style="padding:0.35rem 0;border-bottom:1px solid var(--surface2);font-size:0.78rem;">
          ${'⭐'.repeat(r.rating)} · ${r.stationId} · "${(r.comment||'').slice(0,40)}" · ${fmt(r.createdAt)}
        </div>`).join('')}</div>`;

    document.getElementById('act-signups').innerHTML = d.recentUsers.length === 0 ? '<p style="color:var(--text-muted);font-size:0.8rem;">No signups</p>' :
      `<div style="max-height:250px;overflow-y:auto;">${d.recentUsers.map(u=>`
        <div style="padding:0.35rem 0;border-bottom:1px solid var(--surface2);font-size:0.78rem;">
          <span style="font-weight:600;">${u.name||u.username}</span> · ${u.email||'-'} · ${fmt(u.createdAt)}
        </div>`).join('')}</div>`;

    document.getElementById('act-chats').innerHTML = d.openChats.length === 0 ? '<p style="color:var(--text-muted);font-size:0.8rem;">No open chats</p>' :
      `<div style="max-height:250px;overflow-y:auto;">${d.openChats.map(c=>`
        <div style="padding:0.35rem 0;border-bottom:1px solid var(--surface2);font-size:0.78rem;">
          <span style="font-weight:600;">${c.username}</span> · ${c.messages?.length||0} msgs · ${fmt(c.updatedAt)}
        </div>`).join('')}</div>`;
  } catch (e) { console.error('Activity error:', e); }
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 5: SYSTEM
// ══════════════════════════════════════════════════════════════════════════════
async function loadSystem() {
  try {
    const res = await fetch(API+'/health');
    const d = res.ok ? await res.json() : {};
    document.getElementById('sys-health').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.82rem;">
        <div>🟢 Status</div><div style="font-weight:700;">${d.status||'unknown'}</div>
        <div>⏱️ Uptime</div><div style="font-weight:700;">${d.uptime ? Math.floor(d.uptime/60)+'m '+d.uptime%60+'s' : '-'}</div>
        <div>🗄️ Database</div><div style="font-weight:700;color:${d.database==='connected'?'#00e676':'#ff5252'};">${d.database||'unknown'}</div>
        <div>🌐 Environment</div><div style="font-weight:700;">${d.environment||'-'}</div>
        <div>🕐 Server Time</div><div style="font-weight:700;">${d.timestamp ? new Date(d.timestamp).toLocaleString('en-IN') : '-'}</div>
      </div>`;
  } catch (e) { document.getElementById('sys-health').innerHTML = '<p style="color:var(--danger);">Unable to reach server</p>'; }
}

async function sendBroadcast() {
  const title = document.getElementById('bc-title').value.trim();
  const message = document.getElementById('bc-message').value.trim();
  if (!title || !message) { alert('Title and message required'); return; }
  if (!confirm(`Send announcement "${title}" to ALL users?`)) return;
  const res = await fetch(API+'/admin/broadcast', { method:'POST', headers:H(), body:JSON.stringify({title,message}) });
  const d = await res.json();
  alert(d.message || 'Sent!');
  document.getElementById('bc-title').value = '';
  document.getElementById('bc-message').value = '';
}

// ── Init ────────────────────────────────────────────────────────────────────
loadOverview();
