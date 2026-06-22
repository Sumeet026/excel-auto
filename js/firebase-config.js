/* ==========================================================================
   EXCEL AUTO - OPTIMIZED FIREBASE CONFIG v2.0
   • Auth error recovery + retry logic
   • Offline persistence + IndexedDB caching
   • Batched writes + snapshot listeners
   • Parallel reads + query optimization
   ========================================================================== */

'use strict';

window.perfMark && window.perfMark('firebase-init-start');

// ─── CONFIG RESOLUTION (Env > localStorage > placeholder) ────────────────────
const _env = window.env || {};
const _savedCfg = (() => {
  try {
    const s = localStorage.getItem('excel_auto_firebase_config');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
})();

const _defaultCfg = {
  apiKey: "AIzaSyAAinTFMMj5bjhH4afmRXUlFP499nfPRSA",
  authDomain: "excel-5ce90.firebaseapp.com",
  databaseURL: "https://excel-5ce90-default-rtdb.firebaseio.com",
  projectId: "excel-5ce90",
  storageBucket: "excel-5ce90.firebasestorage.app",
  messagingSenderId: "480248303973",
  appId: "1:480248303973:web:4c1ff1e0e9113e2394918c",
  measurementId: "G-DMFNKF5NXD"
};

const _envCfg = {
  apiKey: _env.FIREBASE_API_KEY,
  projectId: _env.FIREBASE_PROJECT_ID,
  authDomain: _env.FIREBASE_AUTH_DOMAIN,
  databaseURL: _env.FIREBASE_DATABASE_URL || (_env.FIREBASE_PROJECT_ID ? `https://${_env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com` : null),
  storageBucket: _env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: _env.FIREBASE_MESSAGING_SENDER_ID,
  appId: _env.FIREBASE_APP_ID
};

const _hasEnv = !!(
  _envCfg.apiKey && _envCfg.projectId && !_envCfg.apiKey.includes('DummyKeyPlaceholder')
);

const finalConfig = _hasEnv
  ? _envCfg
  : (_savedCfg && _savedCfg.apiKey && !_savedCfg.apiKey.includes('DummyKeyPlaceholder') ? _savedCfg : _defaultCfg);

const _isPlaceholder = finalConfig.apiKey.includes('DummyKeyPlaceholder') ||
  finalConfig.projectId === 'excel-auto-demo';

// ─── API KEY VALIDATION ───────────────────────────────────────────────────────
function _isValidFirebaseApiKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.includes('DummyKeyPlaceholder')) return false;
  // Firebase Web API keys start with "AIzaSy" and are ~39 chars long
  if (!key.startsWith('AIzaSy')) return false;
  if (key.length < 30) return false;
  return true;
}

function _validateConfig(cfg) {
  const issues = [];
  if (!cfg.apiKey) issues.push('apiKey is missing');
  else if (!_isValidFirebaseApiKey(cfg.apiKey)) {
    issues.push('apiKey format is invalid (must start with "AIzaSy" and be ~39 chars)');
  }
  if (!cfg.projectId) issues.push('projectId is missing');
  if (!cfg.authDomain) issues.push('authDomain is missing');
  if (!cfg.storageBucket) issues.push('storageBucket is missing');
  return issues;
}

// ─── Clear invalid saved config from localStorage ─────────────────────────────
function _clearInvalidSavedConfig() {
  try {
    const saved = localStorage.getItem('excel_auto_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && !_isValidFirebaseApiKey(parsed.apiKey)) {
        console.warn('[Firebase] Clearing invalid saved config from localStorage');
        localStorage.removeItem('excel_auto_firebase_config');
        return true;
      }
    }
  } catch {}
  return false;
}

// ─── EXPORTED GLOBALS ─────────────────────────────────────────────────────────
let app, auth, db, rtdb, storage;
let isFirebaseMocked = false;
let _authInitialized = false;
let _authCallbacks = [];

// ─── SNAPSHOT LISTENER REGISTRY (for cleanup) ────────────────────────────────
window._snapshotListeners = [];
window.registerSnapshot = function(unsubFn) {
  window._snapshotListeners.push(unsubFn);
  return unsubFn;
};
window.cleanupSnapshots = function() {
  window._snapshotListeners.forEach(fn => { try { fn(); } catch {} });
  window._snapshotListeners = [];
};

// ─── FIREBASE INIT ────────────────────────────────────────────────────────────
(function initFirebase() {
  // ── Clear any previously saved invalid config ─────────────────────────────
  _clearInvalidSavedConfig();

  // ── Debug: print resolved config source and values ──────────────────────
  console.group('[Firebase] Config Resolution');
  console.log('Source:', _hasEnv ? 'Environment Variables' : (_savedCfg && _savedCfg.apiKey && !_savedCfg.apiKey.includes('DummyKeyPlaceholder') ? 'localStorage (Settings)' : 'Default (placeholder)'));
  console.log('apiKey:', finalConfig.apiKey ? finalConfig.apiKey.substring(0, 8) + '...' + finalConfig.apiKey.slice(-4) : 'MISSING');
  console.log('projectId:', finalConfig.projectId || 'MISSING');
  console.log('authDomain:', finalConfig.authDomain || 'MISSING');
  console.log('storageBucket:', finalConfig.storageBucket || 'MISSING');
  console.log('isPlaceholder:', _isPlaceholder);
  console.groupEnd();

  if (_isPlaceholder) {
    console.warn('[Firebase] Placeholder key detected — booting in Sandbox Mode');
    console.warn('[Firebase] ➜ To use real Firebase, go to Settings → Firebase Config and paste your config JSON.');
    console.warn('[Firebase] ➜ Get your config from: https://console.firebase.google.com → Project Settings → General → Your apps → Firebase SDK snippet');
    isFirebaseMocked = true;
    _initMockServices();
    window.perfMark && window.perfMark('firebase-mock-ready');
    return;
  }

  if (typeof firebase === 'undefined') {
    console.error('[Firebase] SDK not loaded — falling back to Sandbox Mode');
    isFirebaseMocked = true;
    _initMockServices();
    return;
  }

  // Validate config before init
  const validationIssues = _validateConfig(finalConfig);
  if (validationIssues.length > 0) {
    console.error('[Firebase] Config validation FAILED:');
    validationIssues.forEach(issue => console.error('  ✗', issue));
    console.error('[Firebase] ➜ Clearing invalid config and switching to Sandbox Mode.');
    localStorage.removeItem('excel_auto_firebase_config');
    isFirebaseMocked = true;
    _initMockServices();
    window.perfMark && window.perfMark('firebase-mock-ready');
    return;
  }

  try {
    // Prevent double init
    if (!firebase.apps.length) {
      app = firebase.initializeApp(finalConfig);
    } else {
      app = firebase.apps[0];
    }

    auth = firebase.auth();
    db   = firebase.firestore();
    rtdb = firebase.database();
    storage = firebase.storage();

    console.log('[Firebase] App initialized:', app.name);
    console.log('[Firebase] Project:', finalConfig.projectId);

    // ── Firestore Offline Persistence ──────────────────────────────────────
    db.enablePersistence({ synchronizeTabs: true })
      .then(() => console.log('[Firestore] Offline persistence enabled ✓'))
      .catch(err => {
        if (err.code === 'failed-precondition') {
          console.warn('[Firestore] Multiple tabs — persistence in one tab only');
        } else if (err.code === 'unimplemented') {
          console.warn('[Firestore] Browser does not support offline persistence');
        }
      });

    // ── Auth Persistence ───────────────────────────────────────────────────
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(e => console.warn('[Auth] Persistence set failed:', e));

    // ── Connection State Monitoring ────────────────────────────────────────
    if (rtdb && rtdb.ref) {
      try {
        rtdb.ref('.info/connected').on('value', snap => {
          const connected = snap.val();
          window._firebaseConnected = connected;
          const badge = document.getElementById('firebase-connection-badge');
          if (badge) {
            badge.textContent = connected ? 'Live' : 'Offline';
            badge.className = `status-pill ${connected ? 'success' : 'warning'}`;
          }
        });
      } catch (e) {
        console.warn('[Firebase] Connection monitoring failed:', e);
      }
    }

    console.log('[Firebase] Initialized in Live Mode ✓');
    window.perfMark && window.perfMark('firebase-live-ready');

  } catch (err) {
    console.error('[Firebase] Init failed — falling back to Sandbox:', err);
    console.error('[Firebase] Error code:', err.code);
    console.error('[Firebase] Error message:', err.message);
    if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || 
        err.message.includes('api-key-not-valid')) {
      console.error('[Firebase] ➜ Your API key is invalid. Clearing config and switching to Sandbox Mode.');
      console.error('  1. The API key matches your Firebase project');
      console.error('  2. The key starts with "AIzaSy"');
      console.error('  3. The key is not truncated or corrupted');
      console.error('  4. Go to https://console.firebase.google.com → Project Settings → General');
      localStorage.removeItem('excel_auto_firebase_config');
    }
    isFirebaseMocked = true;
    _initMockServices();
  }
})();

// Export globals
window.auth    = auth;
window.db      = db;
window.rtdb    = rtdb;
window.storage = storage;
window.isFirebaseMocked = isFirebaseMocked;

// ─── OPTIMIZED FIRESTORE HELPERS ──────────────────────────────────────────────
window.fsGet = async function(collection, id, useCache = true) {
  if (!db) return null;
  const cacheKey = `fs_${collection}_${id}`;
  if (useCache && window.AppCache && window.AppCache.has(cacheKey)) {
    return window.AppCache.get(cacheKey).value;
  }
  const snap = await db.collection(collection).doc(id).get();
  const data = snap.exists ? { id: snap.id, ...snap.data() } : null;
  if (useCache && window.AppCache && data) {
    window.AppCache.set(cacheKey, data, 60000);
  }
  return data;
};

window.fsSet = async function(collection, id, data, merge = false) {
  if (!db) return;
  window.AppCache && window.AppCache.invalidate(`fs_${collection}_${id}`);
  if (window.BatchWriter) {
    window.BatchWriter.add({ type: 'set', collection, id, data, options: { merge } });
    return;
  }
  return db.collection(collection).doc(id).set(data, { merge });
};

window.fsUpdate = async function(collection, id, data) {
  if (!db) return;
  window.AppCache && window.AppCache.invalidate(`fs_${collection}_${id}`);
  return db.collection(collection).doc(id).update(data);
};

window.fsQuery = async function(collection, conditions = [], orderBy = null, limitN = 50) {
  if (!db) return [];
  const cacheKey = `fsq_${collection}_${JSON.stringify(conditions)}_${orderBy}_${limitN}`;
  if (window.AppCache && window.AppCache.has(cacheKey)) {
    return window.AppCache.get(cacheKey).value;
  }

  let ref = db.collection(collection);
  conditions.forEach(([field, op, val]) => { ref = ref.where(field, op, val); });
  if (orderBy) ref = ref.orderBy(orderBy.field, orderBy.dir || 'asc');
  if (limitN) ref = ref.limit(limitN);

  const snap = await ref.get();
  const docs = [];
  snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));

  if (window.AppCache) window.AppCache.set(cacheKey, docs, 30000);
  return docs;
};

// ─── PARALLEL READS ───────────────────────────────────────────────────────────
window.fsParallelGet = async function(queries) {
  return Promise.all(queries.map(q => {
    if (q.id) return window.fsGet(q.collection, q.id, q.cache !== false);
    return window.fsQuery(q.collection, q.conditions || [], q.orderBy, q.limit);
  }));
};

// ─── RTDB HELPERS ─────────────────────────────────────────────────────────────
window.rtdbSet = function(path, data) {
  if (!rtdb) return;
  try { return rtdb.ref(path).set(data); }
  catch (e) { console.warn('[RTDB] Set failed:', path, e); }
};
window.rtdbUpdate = function(path, data) {
  if (!rtdb) return;
  try { return rtdb.ref(path).update(data); }
  catch (e) { console.warn('[RTDB] Update failed:', path, e); }
};
window.rtdbRemove = function(path) {
  if (!rtdb) return;
  try { return rtdb.ref(path).remove(); }
  catch (e) { console.warn('[RTDB] Remove failed:', path, e); }
};
window.rtdbListen = function(path, cb) {
  if (!rtdb) return () => {};
  try {
    const ref = rtdb.ref(path);
    ref.on('value', cb);
    return () => ref.off('value', cb);
  } catch (e) {
    console.warn('[RTDB] Listen failed:', path, e);
    return () => {};
  }
};


/* ============================================================================
   SANDBOX MOCK SERVICES (localStorage emulation)
   ============================================================================ */
/* ============================================================================
   SANDBOX MOCK SERVICES (localStorage emulation & IndexedDB File Storage)
   ============================================================================ */

const _sandboxDbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('excel_auto_sandbox_storage', 1);
  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('files')) {
      db.createObjectStore('files');
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

window.writeSandboxFile = async function(path, blobOrBuffer) {
  const db = await _sandboxDbPromise;
  let dataToStore = blobOrBuffer;
  if (blobOrBuffer instanceof Blob && typeof blobOrBuffer.arrayBuffer === 'function') {
    dataToStore = await blobOrBuffer.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    const request = store.put(dataToStore, path);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

window.readSandboxFile = async function(path) {
  const db = await _sandboxDbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const request = store.get(path);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

window.deleteSandboxFile = async function(path) {
  const db = await _sandboxDbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    const request = store.delete(path);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

window.downloadSandboxFile = async function(storagePath, fileName) {
  try {
    const data = await window.readSandboxFile(storagePath);
    if (!data) throw new Error("File not found in sandbox storage.");
    let blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (data instanceof ArrayBuffer) {
      blob = new Blob([data]);
    } else {
      blob = new Blob([data]);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Failed to download sandbox file:", e);
    showToast("Failed to download file in sandbox mode.", "error");
  }
};

function _initMockServices() {
  const _mockStore = (key) => JSON.parse(localStorage.getItem(key) || '[]');
  const _mockSave  = (key, arr) => localStorage.setItem(key, JSON.stringify(arr));
  const _uid       = () => 'mock_' + Math.random().toString(36).substr(2, 9);

  // Helper to create fully compatible user instance
  const _createMockUserObject = (data) => {
    if (!data) return null;
    return {
      uid: data.uid,
      email: data.email,
      displayName: data.displayName || data.email.split('@')[0],
      emailVerified: data.emailVerified !== false,
      photoURL: data.photoURL || null,
      async updateProfile(profile) {
        if (profile.displayName) this.displayName = profile.displayName;
        if (profile.photoURL) this.photoURL = profile.photoURL;
        localStorage.setItem('mock_user', JSON.stringify({
          uid: this.uid, email: this.email, displayName: this.displayName,
          emailVerified: this.emailVerified, photoURL: this.photoURL
        }));
        const users = _mockStore('mock_db_users');
        const idx = users.findIndex(u => u.uid === this.uid);
        if (idx > -1) {
          users[idx].displayName = this.displayName;
          users[idx].photoURL = this.photoURL;
          _mockSave('mock_db_users', users);
        }
      },
      async updateEmail(newEmail) {
        this.email = newEmail;
        localStorage.setItem('mock_user', JSON.stringify({
          uid: this.uid, email: this.email, displayName: this.displayName,
          emailVerified: this.emailVerified, photoURL: this.photoURL
        }));
        const users = _mockStore('mock_db_users');
        const idx = users.findIndex(u => u.uid === this.uid);
        if (idx > -1) {
          users[idx].email = newEmail;
          _mockSave('mock_db_users', users);
        }
      },
      async updatePassword(newPassword) {
        console.log('[Mock User] password updated');
      },
      async sendEmailVerification() {
        console.log('[Mock User] email verification sent');
      },
      async reauthenticateWithCredential(cred) {
        console.log('[Mock User] reauthenticated');
      }
    };
  };

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  auth = {
    currentUser: null,
    _listeners: [],

    onAuthStateChanged(cb) {
      this._listeners.push(cb);
      const savedUser = (() => {
        try {
          const u = JSON.parse(localStorage.getItem('mock_user'));
          return _createMockUserObject(u);
        } catch { return null; }
      })();
      this.currentUser = savedUser;
      Promise.resolve().then(() => cb(savedUser));
      return () => {
        this._listeners = this._listeners.filter(l => l !== cb);
      };
    },

    _notifyListeners(user) {
      this.currentUser = user;
      this._listeners.forEach(cb => { try { cb(user); } catch {} });
    },

    async createUserWithEmailAndPassword(email, password) {
      const users = _mockStore('mock_db_users');
      if (users.some(u => u.email === email)) {
        const err = new Error('Email already in use.');
        err.code = 'auth/email-already-in-use';
        throw err;
      }
      const userData = {
        uid: _uid(), email, displayName: email.split('@')[0],
        emailVerified: false, photoURL: null
      };
      users.push({ ...userData, createdAt: new Date().toISOString() });
      _mockSave('mock_db_users', users);
      const user = _createMockUserObject(userData);
      localStorage.setItem('mock_user', JSON.stringify(userData));
      this._notifyListeners(user);
      return { user };
    },

    async signInWithEmailAndPassword(email, password) {
      const users = _mockStore('mock_db_users');
      const found = users.find(u => u.email === email);
      if (!found) {
        const err = new Error('No user with that email.');
        err.code = 'auth/user-not-found';
        throw err;
      }
      const userData = { uid: found.uid, email: found.email, displayName: found.displayName, emailVerified: !!found.emailVerified, photoURL: found.photoURL || null };
      const user = _createMockUserObject(userData);
      localStorage.setItem('mock_user', JSON.stringify(userData));
      this._notifyListeners(user);
      return { user };
    },

    async signInWithPopup() {
      const userData = {
        uid: 'mock_google_' + _uid(), email: 'demo@excelauto.com',
        displayName: 'Demo User', emailVerified: true,
        photoURL: 'https://ui-avatars.com/api/?name=Demo+User&background=6366f1&color=fff'
      };
      const users = _mockStore('mock_db_users');
      if (!users.some(u => u.email === userData.email)) {
        users.push({ ...userData, createdAt: new Date().toISOString() });
        _mockSave('mock_db_users', users);
      }
      const user = _createMockUserObject(userData);
      localStorage.setItem('mock_user', JSON.stringify(userData));
      this._notifyListeners(user);
      return { user };
    },

    async sendPasswordResetEmail(email) {
      console.log(`[Mock Auth] Password reset email sent to: ${email}`);
    },

    async signOut() {
      localStorage.removeItem('mock_user');
      this._notifyListeners(null);
    },

    GoogleAuthProvider: class { constructor() {} }
  };

  // ─── FIRESTORE ─────────────────────────────────────────────────────────────
  db = {
    batch() {
      const ops = [];
      return {
        set(ref, data, opts) { ops.push({ type: 'set', ref, data, opts }); return this; },
        update(ref, data) { ops.push({ type: 'update', ref, data }); return this; },
        delete(ref) { ops.push({ type: 'delete', ref }); return this; },
        async commit() {
          for (const op of ops) {
            if (op.type === 'set') await op.ref.set(op.data, op.opts);
            else if (op.type === 'update') await op.ref.update(op.data);
            else if (op.type === 'delete') await op.ref.delete();
          }
        }
      };
    },

    collection(name) {
      const key = `mock_db_${name}`;

      const createQueryBuilder = (filters = [], orderByVal = null, limitVal = null) => {
        const qObj = {
          where(field, op, val) {
            return createQueryBuilder([...filters, { field, op, val }], orderByVal, limitVal);
          },
          orderBy(field, dir = 'asc') {
            return createQueryBuilder(filters, { field, dir }, limitVal);
          },
          limit(n) {
            return createQueryBuilder(filters, orderByVal, n);
          },
          async get() {
            let items = _mockStore(key);
            filters.forEach(({ field, op, val }) => {
              items = items.filter(item => {
                const v = item[field];
                if (op === '==') return v === val;
                if (op === '!=') return v !== val;
                if (op === '>') return v > val;
                if (op === '<') return v < val;
                if (op === '>=') return v >= val;
                if (op === '<=') return v <= val;
                if (op === 'in') return Array.isArray(val) && val.includes(v);
                return false;
              });
            });
            if (orderByVal) {
              const { field, dir } = orderByVal;
              items.sort((a, b) => {
                const valA = a[field];
                const valB = b[field];
                if (valA === undefined || valA === null) return 1;
                if (valB === undefined || valB === null) return -1;
                return dir === 'asc' 
                  ? (valA > valB ? 1 : -1) 
                  : (valA < valB ? 1 : -1);
              });
            }
            if (limitVal) items = items.slice(0, limitVal);
            return {
              docs: items.map(i => ({ id: i.id, data: () => i, exists: true, ref: colObj.doc(i.id) })),
              forEach(cb) { items.forEach(i => cb({ id: i.id, data: () => i, exists: true, ref: colObj.doc(i.id) })); },
              size: items.length,
              empty: items.length === 0
            };
          },
          onSnapshot(cb, errCb) {
            const id = setInterval(async () => {
              try {
                const snap = await qObj.get();
                cb(snap);
              } catch (e) {
                if (errCb) errCb(e);
              }
            }, 1000);
            const unsub = () => clearInterval(id);
            window._snapshotListeners.push(unsub);
            return unsub;
          }
        };
        return qObj;
      };

      const colObj = {
        doc(id) {
          const docId = id || _uid();
          const self = {
            id: docId,
            ref: { id: docId },
            async set(data, opts = {}) {
              let items = _mockStore(key);
              const idx = items.findIndex(i => i.id === docId);
              const now = new Date().toISOString();
              if (idx > -1) {
                items[idx] = opts.merge
                  ? { ...items[idx], ...data, updatedAt: now }
                  : { id: docId, ...data, updatedAt: now };
              } else {
                items.push({ id: docId, ...data, createdAt: now, updatedAt: now });
              }
              _mockSave(key, items);
              window.AppCache && window.AppCache.invalidate(`fs_${name}_${docId}`);
            },
            async get() {
              const items = _mockStore(key);
              const item = items.find(i => i.id === docId);
              return { exists: !!item, id: docId, data: () => item, ref: self };
            },
            async update(data) {
              let items = _mockStore(key);
              const idx = items.findIndex(i => i.id === docId);
              if (idx < 0) throw new Error('Document not found: ' + docId);
              items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
              _mockSave(key, items);
              window.AppCache && window.AppCache.invalidate(`fs_${name}_${docId}`);
            },
            async delete() {
              let items = _mockStore(key);
              _mockSave(key, items.filter(i => i.id !== docId));
              window.AppCache && window.AppCache.invalidate(`fs_${name}_${docId}`);
            }
          };
          return self;
        },
        where(field, op, val) {
          return createQueryBuilder([{ field, op, val }]);
        },
        orderBy(field, dir = 'asc') {
          return createQueryBuilder([], { field, dir });
        },
        limit(n) {
          return createQueryBuilder([], null, n);
        },
        async get() {
          return createQueryBuilder().get();
        },
        onSnapshot(cb, errCb) {
          return createQueryBuilder().onSnapshot(cb, errCb);
        }
      };

      return colObj;
    }
  };

  // ─── REALTIME DATABASE ─────────────────────────────────────────────────────
  rtdb = {
    _listeners: {},
    ref(path) {
      const rtdbKey = `mock_rtdb_${path.replace(/\//g, '__')}`;
      const self = {
        async set(data) { localStorage.setItem(rtdbKey, JSON.stringify(data)); self._notify(data); },
        async update(data) {
          let cur = JSON.parse(localStorage.getItem(rtdbKey) || '{}');
          cur = { ...cur, ...data };
          localStorage.setItem(rtdbKey, JSON.stringify(cur));
          self._notify(cur);
        },
        async remove() { localStorage.removeItem(rtdbKey); self._notify(null); },
        async once() {
          const val = JSON.parse(localStorage.getItem(rtdbKey) || 'null');
          return { val: () => val, exists: () => val !== null };
        },
        on(event, cb) {
          if (!rtdb._listeners[rtdbKey]) rtdb._listeners[rtdbKey] = [];
          rtdb._listeners[rtdbKey].push(cb);
          const val = JSON.parse(localStorage.getItem(rtdbKey) || 'null');
          setTimeout(() => cb({ val: () => val, exists: () => val !== null }), 30);
        },
        off(event, cb) {
          if (!rtdb._listeners[rtdbKey]) return;
          if (cb) rtdb._listeners[rtdbKey] = rtdb._listeners[rtdbKey].filter(l => l !== cb);
          else delete rtdb._listeners[rtdbKey];
        },
        _notify(val) {
          const listeners = rtdb._listeners[rtdbKey] || [];
          listeners.forEach(cb => cb({ val: () => val, exists: () => val !== null }));
        },
        child(subpath) { return rtdb.ref(`${path}/${subpath}`); },
        push() {
          const newKey = _uid();
          return { key: newKey, ...rtdb.ref(`${path}/${newKey}`) };
        }
      };
      return self;
    }
  };

  // ─── STORAGE ───────────────────────────────────────────────────────────────
  storage = {
    ref(path) {
      return {
        put(file) {
          let _cancelled = false;
          const task = {
            on(event, progressCb, errCb, successCb) {
              let prog = 0;
              const iv = setInterval(async () => {
                if (_cancelled) { clearInterval(iv); return; }
                prog = Math.min(prog + 20, 100);
                if (progressCb) progressCb({ bytesTransferred: (prog / 100) * (file.size || 1024), totalBytes: file.size || 1024 });
                if (prog >= 100) {
                  clearInterval(iv);
                  try {
                    await window.writeSandboxFile(path, file);
                  } catch (e) {
                    console.error('[Mock Storage] Failed to write sandbox file to IndexedDB:', e);
                    if (errCb) errCb(e);
                    return;
                  }
                  if (successCb) successCb();
                }
              }, 80);
              return () => { _cancelled = true; clearInterval(iv); };
            },
            cancel() { _cancelled = true; }
          };
          return task;
        },
        async getDownloadURL() { return `blob:mock/${path}`; },
        async delete() {
          try {
            await window.deleteSandboxFile(path);
          } catch (e) {
            console.error('[Mock Storage] Failed to delete sandbox file:', e);
          }
          return true;
        }
      };
    }
  };

  // Export mocked globals
  window.auth    = auth;
  window.db      = db;
  window.rtdb    = rtdb;
  window.storage = storage;
  window.isFirebaseMocked = true;

  // Expose firestore.batch via db
  if (!db.batch._isMock) Object.defineProperty(db.batch, '_isMock', { value: true });

  console.log('[Firebase] Sandbox Mock Services initialized ✓');
  window.perfMark && window.perfMark('firebase-mock-ready');
}
