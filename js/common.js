/* ==========================================================================
   EXCEL AUTO - SHARED UTILITIES v2.0 (common.js)
   ========================================================================== */
'use strict';

// ─── XSS PROTECTION ─────────────────────────────────────────────────────────
window.escapeHtml = function(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
};

// ─── TOAST ───────────────────────────────────────────────────────────────────
(function setupToast() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
})();

window.showToast = function(message, type = 'info', duration = 4000) {
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><div class="toast-message">${message}</div><button class="toast-close"><i class="fas fa-times"></i></button>`;
  document.getElementById('toast-container').appendChild(toast);
  const remove = () => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  toast.querySelector('.toast-close').onclick = remove;
  const t = setTimeout(remove, duration);
  toast.dataset.timer = t;
};

// ─── SKELETON LOADER ─────────────────────────────────────────────────────────
window.showSkeletons = function(container, count = 3, type = 'card') {
  if (!container) return;
  const templates = {
    card: `<div class="skeleton-card"><div class="skeleton-box" style="height:20px;width:60%;margin-bottom:12px"></div><div class="skeleton-box" style="height:14px;width:100%;margin-bottom:8px"></div><div class="skeleton-box" style="height:14px;width:80%"></div></div>`,
    row:  `<div class="skeleton-row"><div class="skeleton-box" style="height:16px;width:30%;margin-right:16px"></div><div class="skeleton-box" style="height:16px;width:50%"></div></div>`,
    stat: `<div class="skeleton-stat"><div class="skeleton-box" style="height:36px;width:60px;margin-bottom:8px"></div><div class="skeleton-box" style="height:14px;width:80px"></div></div>`
  };
  container.innerHTML = Array(count).fill(templates[type] || templates.card).join('');
};

window.hideSkeleton = function(container) {
  if (container) container.querySelectorAll('.skeleton-card,.skeleton-row,.skeleton-stat').forEach(el => el.remove());
};

// ─── RETRY WRAPPER ────────────────────────────────────────────────────────────
window.withRetry = async function(fn, retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
};

// ─── THEME ───────────────────────────────────────────────────────────────────
let _currentTheme = localStorage.getItem('excel_auto_theme') || 'dark';

function initTheme() {
  document.documentElement.setAttribute('data-theme', _currentTheme);
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const update = () => {
    btn.innerHTML = _currentTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    btn.title = _currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  };
  update();
  btn.addEventListener('click', () => {
    _currentTheme = _currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', _currentTheme);
    localStorage.setItem('excel_auto_theme', _currentTheme);
    update();
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: _currentTheme }));
  });
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const toggle = document.querySelector('.menu-toggle');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', e => { e.stopPropagation(); sidebar.classList.toggle('active'); });
  document.addEventListener('click', e => {
    if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('active');
    }
  });
  // Prefetch sidebar links
  document.querySelectorAll('.sidebar-menu-item a[href]').forEach(a => {
    a.addEventListener('mouseenter', () => window.prefetchPage && window.prefetchPage(a.href));
  });
}

// ─── AUTH OBSERVER ────────────────────────────────────────────────────────────
let currentUserObj = null;
window.getCurrentUser = () => currentUserObj;

function initAuthObserver() {
  const path = window.location.pathname;
  const isAuthPage = /login|signup|index/.test(path) || path === '/';
  const isSignupPage = /signup/.test(path);
  const isLoginPage = /login/.test(path);

  // Show page skeleton immediately — don't block on auth
  if (!isAuthPage) _showPageSkeleton();

  let authResolved = false;
  const authTimeout = setTimeout(() => {
    if (!authResolved && !isAuthPage) {
      window.location.href = 'login.html';
    }
  }, 5000);

  window.auth.onAuthStateChanged(async user => {
    authResolved = true;
    clearTimeout(authTimeout);

    if (user) {
      currentUserObj = user;
      _hidePageSkeleton();
      updateProfileUI(user);
      await _checkAdminStatus(user);
      if (isLoginPage) {
        window.location.replace('dashboard.html');
      }
    } else {
      currentUserObj = null;
      _hidePageSkeleton();
      if (!isAuthPage) {
        window.location.replace('login.html');
      }
    }
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        window.cleanupSnapshots && window.cleanupSnapshots();
        await window.auth.signOut();
        window.AppCache && window.AppCache.clear();
        localStorage.removeItem('excel_auto_files_cache');
        window.location.replace('login.html');
      } catch (err) { showToast(err.message, 'error'); }
    });
  }
}

function _showPageSkeleton() {
  const main = document.querySelector('.main-content');
  if (main && !main.dataset.loaded) {
    main.dataset.skeletonActive = 'true';
  }
}
function _hidePageSkeleton() {
  const main = document.querySelector('.main-content');
  if (main) delete main.dataset.skeletonActive;
}

function updateProfileUI(user) {
  const nameEl = document.querySelector('.profile-name');
  const avatarEl = document.querySelector('.profile-avatar');
  if (nameEl) nameEl.textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  if (avatarEl) {
    const src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=6366f1&color=fff&size=96`;
    avatarEl.src = src;
  }
}

async function _checkAdminStatus(user) {
  const isAdmin = user.email === 'admin@excelauto.com' ||
    localStorage.getItem(`is_admin_${user.uid}`) === 'true' ||
    await _fetchAdminRole(user);

  const roleEl = document.querySelector('.profile-role');
  if (roleEl) roleEl.textContent = isAdmin ? 'Administrator' : 'Premium Member';

  if (isAdmin) _injectAdminMenu();
}

async function _fetchAdminRole(user) {
  try {
    const doc = await window.db.collection('users').doc(user.uid).get();
    return doc.exists && doc.data() && doc.data().role === 'admin';
  } catch { return false; }
}

function _injectAdminMenu() {
  if (document.getElementById('admin-menu-link')) return;
  const menu = document.querySelector('.sidebar-menu');
  if (!menu) return;
  const li = document.createElement('li');
  li.className = 'sidebar-menu-item';
  li.id = 'admin-menu-link';
  if (window.location.pathname.includes('admin.html')) li.classList.add('active');
  li.innerHTML = `<a href="admin.html"><i class="fas fa-user-shield"></i><span>Admin Panel</span></a>`;
  menu.appendChild(li);
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function initNotificationsCenter() {
  const btn = document.getElementById('notification-bell-btn');
  const dropdown = document.getElementById('notification-dropdown');
  const badge = document.getElementById('notification-badge');
  const list = document.getElementById('notification-list');
  const markAllBtn = document.getElementById('mark-all-read-btn');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('active'); });
  document.addEventListener('click', e => {
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) dropdown.classList.remove('active');
  });

  window.auth.onAuthStateChanged(user => {
    if (!user) return;
    if (window.rtdb && window.rtdb.ref) {
      const unsubFn = window.rtdbListen
        ? window.rtdbListen(`notifications/${user.uid}`, snap => _renderNotifications(snap, list, badge))
        : (() => {
            window.rtdb.ref(`notifications/${user.uid}`).on('value', snap => _renderNotifications(snap, list, badge));
            return () => window.rtdb.ref(`notifications/${user.uid}`).off();
          })();
      window.registerSnapshot && window.registerSnapshot(unsubFn);
    }

    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        if (!rtdb || !rtdb.ref) return;
        const snap = await window.rtdb.ref(`notifications/${user.uid}`).once('value');
        const data = snap.val();
        if (!data) return;
        const updates = {};
        Object.keys(data).forEach(k => { updates[`${k}/isRead`] = true; });
        if (rtdb && rtdb.ref) {
          await window.rtdb.ref(`notifications/${user.uid}`).update(updates);
        }
        showToast('All notifications marked as read.', 'success');
      });
    }
  });
}

function _renderNotifications(snap, list, badge) {
  const data = snap.val();
  if (!list) return;
  list.innerHTML = '';
  const items = data ? Object.entries(data).map(([id, n]) => ({ id, ...n })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
  const unread = items.filter(i => !i.isRead).length;

  if (items.length === 0) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.8rem;">No notifications</div>';
  } else {
    items.slice(0, 10).forEach(item => {
      const div = document.createElement('div');
      div.className = `notification-item ${item.isRead ? '' : 'unread'}`;
      div.innerHTML = `<div class="notification-item-text">${item.message}</div><div class="notification-item-time">${formatTimeAgo(item.createdAt)}</div>`;
      div.onclick = () => {
        if (rtdb && rtdb.ref) {
          window.rtdb.ref(`notifications/${window.auth.currentUser.uid}/${item.id}`).update({ isRead: true });
        }
      };
      list.appendChild(div);
    });
  }

  if (badge) {
    badge.style.display = unread > 0 ? 'block' : 'none';
    badge.textContent = unread > 9 ? '9+' : (unread || '');
  }
}

// ─── ACTIVITY LOGGING ─────────────────────────────────────────────────────────
window.logUserActivity = async function(action) {
  if (!currentUserObj) return;
  const id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const data = {
    id, action, createdBy: currentUserObj.uid,
    createdAt: new Date().toISOString(), status: 'completed'
  };
  try {
    // Dual write (Firestore + RTDB) in parallel
    const writes = [window.db.collection('activities').doc(id).set(data)];
    if (window.rtdb && window.rtdb.ref) {
      writes.push(window.rtdb.ref(`activities/${currentUserObj.uid}/${id}`).set(data));
    }
    await Promise.all(writes);
  } catch (e) {
    console.warn('[Activity]', e.message);
    try {
      const local = JSON.parse(localStorage.getItem('excelAuto_localActivities') || '[]');
      local.unshift(data);
      if (local.length > 50) local.length = 50;
      localStorage.setItem('excelAuto_localActivities', JSON.stringify(local));
    } catch (e2) {}
  }
};

window.pushNotification = async function(message, userId) {
  const uid = userId || (currentUserObj ? currentUserObj.uid : null);
  if (!uid) return;
  const id = `notif_${Date.now()}`;
  try {
    if (window.rtdb && window.rtdb.ref) {
      await window.rtdb.ref(`notifications/${uid}/${id}`).set({
        id, message, isRead: false, createdAt: new Date().toISOString()
      });
    }
  } catch (e) { console.warn('[Notification]', e.message); }
};

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
window.formatBytes = function(bytes, d = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(d)} ${s[i]}`;
};

window.formatTimeAgo = function(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// Alias for internal use
function formatTimeAgo(dateStr) { return window.formatTimeAgo(dateStr); }
// ─── UTILS ─────────────────────────────────────────────────────────────────
// Simple localStorage cache with optional TTL (ms)
window.cacheGet = function(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj._ts && obj._ttl && Date.now() > obj._ts + obj._ttl) {
      // expired
      localStorage.removeItem(key);
      return null;
    }
    return obj.data;
  } catch (e) { return null; }
};

window.cacheSet = function(key, data, ttlMs = 5 * 60 * 1000) {
  const payload = { data, _ts: Date.now(), _ttl: ttlMs };
  try { localStorage.setItem(key, JSON.stringify(payload)); } catch (e) { console.warn('Cache set failed', e); }
};

// IndexedDB fallback for large payloads (>100KB)
const getIDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('excelAutoCache', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

window.indexedCacheGet = async function(key) {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const req = store.get(key);
      req.onsuccess = () => {
        if (!req.result) return resolve(null);
        try {
          const payload = JSON.parse(req.result);
          if (payload._ts && payload._ttl && Date.now() > payload._ts + payload._ttl) {
            const writeTx = db.transaction('kv', 'readwrite');
            writeTx.objectStore('kv').delete(key);
            resolve(null);
          } else {
            resolve(payload.data);
          }
        } catch { resolve(null); }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
};

window.indexedCacheSet = async function(key, data, ttlMs = 30 * 60 * 1000) {
  try {
    const db = await getIDB();
    const payload = { data, _ts: Date.now(), _ttl: ttlMs };
    return new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      store.put(JSON.stringify(payload), key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) { /* ignore */ }
};

// Fetch wrapper that uses cache (localStorage or IndexedDB) automatically
window.fetchWithCache = async function(key, fetchFn, ttlMs = 5 * 60 * 1000) {
  // Try localStorage first
  const cached = window.cacheGet(key);
  if (cached) return cached;
  // Try IndexedDB second
  const dbCached = await window.indexedCacheGet(key);
  if (dbCached) return dbCached;

  const data = await fetchFn();
  try {
    const serialized = JSON.stringify(data);
    if (serialized.length > 100 * 1024) {
      await window.indexedCacheSet(key, data, ttlMs);
    } else {
      window.cacheSet(key, data, ttlMs);
    }
  } catch (e) { /* ignore */ }
  return data;
};

// Optimistic UI update helper
window.optimisticUpdate = async function(updateFn) {
  try {
    await updateFn();
  } catch (e) {
    console.error('Optimistic update failed', e);
    showToast(e.message || 'Operation failed', 'error');
    throw e;
  }
};

// Realtime listener wrapper (auto-unsubscribe on page unload)
window.initRealtime = function(collectionPath, onData) {
  const unsub = window.db.collection(collectionPath).onSnapshot(snap => {
    const data = snap.docs.map(d => d.data());
    onData(data);
  });
  window.addEventListener('beforeunload', () => unsub());
  return unsub;
};

// Virtual Scrolling Helper
window.createVirtualScroll = function(container, items, renderRowFn, rowHeight = 60) {
  if (!container) return;
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.overflowY = 'auto';

  const spacer = document.createElement('div');
  spacer.style.height = `${items.length * rowHeight}px`;
  spacer.style.width = '100%';
  spacer.style.position = 'absolute';
  spacer.style.top = '0';
  spacer.style.left = '0';
  spacer.style.zIndex = '1';
  container.appendChild(spacer);

  const holder = document.createElement('div');
  holder.style.position = 'absolute';
  holder.style.top = '0';
  holder.style.left = '0';
  holder.style.width = '100%';
  holder.style.zIndex = '2';
  container.appendChild(holder);

  const updateVisibleItems = () => {
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    
    let startIndex = Math.floor(scrollTop / rowHeight);
    let endIndex = Math.ceil((scrollTop + clientHeight) / rowHeight);
    
    startIndex = Math.max(0, startIndex - 2);
    endIndex = Math.min(items.length - 1, endIndex + 2);
    
    holder.innerHTML = '';
    
    for (let i = startIndex; i <= endIndex; i++) {
      const rowData = items[i];
      const rowElement = renderRowFn(rowData, i);
      if (rowElement) {
        rowElement.style.position = 'absolute';
        rowElement.style.top = '0';
        rowElement.style.left = '0';
        rowElement.style.width = '100%';
        rowElement.style.height = `${rowHeight}px`;
        rowElement.style.transform = `translateY(${i * rowHeight}px)`;
        holder.appendChild(rowElement);
      }
    }
  };

  updateVisibleItems();
  let _vscrollTicking = false;
  container.onscroll = () => {
    if (!_vscrollTicking) {
      _vscrollTicking = true;
      requestAnimationFrame(() => { updateVisibleItems(); _vscrollTicking = false; });
    }
  };
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => updateVisibleItems());
    ro.observe(container);
  }
};

// End of UTILS

// ─── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();
  initAuthObserver();
  initNotificationsCenter();

  // Update Firebase connection badge for mock mode
  if (window.isFirebaseMocked) {
    const badge = document.getElementById('firebase-connection-badge');
    if (badge) { badge.textContent = 'Sandbox'; badge.className = 'status-pill warning'; }
  }
});
