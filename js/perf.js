/* ==========================================================================
   EXCEL AUTO - PERFORMANCE UTILITIES (perf.js)
   Debouncing, Throttling, Memoization, Cache, Virtual DOM helpers
   ========================================================================== */

'use strict';

// ─── DEBOUNCE ────────────────────────────────────────────────────────────────
window.debounce = function(fn, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};

// ─── THROTTLE ────────────────────────────────────────────────────────────────
window.throttle = function(fn, limit = 100) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// ─── MEMOIZE ─────────────────────────────────────────────────────────────────
window.memoize = function(fn) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
};

// ─── IN-MEMORY LRU CACHE ─────────────────────────────────────────────────────
class LRUCache {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  get(key) {
    if (!this.cache.has(key)) return null;
    const val = this.cache.get(key);
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }
  set(key, value, ttl = 300000) {
    if (this.cache.size >= this.maxSize) {
      // Delete least recently used (first entry)
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, { value, expires: Date.now() + ttl });
  }
  has(key) {
    if (!this.cache.has(key)) return false;
    const entry = this.cache.get(key);
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
  invalidate(key) { this.cache.delete(key); }
  clear() { this.cache.clear(); }
}
window.AppCache = new LRUCache(100);

// ─── REQUEST QUEUE (serial async queue) ──────────────────────────────────────
class RequestQueue {
  constructor() {
    this.queue = [];
    this.running = false;
  }
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._run();
    });
  }
  async _run() {
    if (this.running || this.queue.length === 0) return;
    this.running = true;
    const { fn, resolve, reject } = this.queue.shift();
    try { resolve(await fn()); }
    catch (e) { reject(e); }
    finally {
      this.running = false;
      this._run();
    }
  }
}
window.FirestoreQueue = new RequestQueue();

// ─── BATCH WRITE QUEUE ───────────────────────────────────────────────────────
class BatchWriteQueue {
  constructor(maxBatch = 450, flushInterval = 500) {
    this.ops = [];
    this.maxBatch = maxBatch;
    this.flushInterval = flushInterval;
    this._timer = null;
  }
  add(op) {
    this.ops.push(op);
    if (this.ops.length >= this.maxBatch) this.flush();
    else this._scheduleFlush();
  }
  _scheduleFlush() {
    if (this._timer) return;
    this._timer = setTimeout(() => this.flush(), this.flushInterval);
  }
  async flush() {
    clearTimeout(this._timer);
    this._timer = null;
    if (this.ops.length === 0) return;
    const batch = this.ops.splice(0, this.maxBatch);
    try {
      if (!window.isFirebaseMocked && window.db) {
        const firestoreBatch = window.db.batch();
        batch.forEach(op => {
          const ref = window.db.collection(op.collection).doc(op.id);
          if (op.type === 'set') firestoreBatch.set(ref, op.data, op.options || {});
          else if (op.type === 'update') firestoreBatch.update(ref, op.data);
          else if (op.type === 'delete') firestoreBatch.delete(ref);
        });
        await firestoreBatch.commit();
      } else {
        // Mock mode: run individually
        for (const op of batch) {
          if (op.type === 'set') await window.db.collection(op.collection).doc(op.id).set(op.data, op.options || {});
          else if (op.type === 'update') await window.db.collection(op.collection).doc(op.id).update(op.data);
        }
      }
    } catch (e) {
      console.error('[BatchWrite] Flush error:', e);
    }
  }
}
window.BatchWriter = new BatchWriteQueue();

// ─── VIRTUAL SCROLL / CHUNKED RENDERING ─────────────────────────────────────
window.renderInChunks = function(items, renderFn, container, chunkSize = 50, delay = 10) {
  container.innerHTML = '';
  let idx = 0;
  const fragment = document.createDocumentFragment();

  function renderChunk() {
    const end = Math.min(idx + chunkSize, items.length);
    for (; idx < end; idx++) {
      const el = renderFn(items[idx], idx);
      if (el) fragment.appendChild(el);
    }
    container.appendChild(fragment.cloneNode(true));
    // Clear fragment
    while (fragment.firstChild) fragment.removeChild(fragment.firstChild);
    if (idx < items.length) {
      requestAnimationFrame(() => setTimeout(renderChunk, delay));
    }
  }
  if (items.length > 0) requestAnimationFrame(renderChunk);
};

// ─── INTERSECTION OBSERVER (Lazy Load) ───────────────────────────────────────
window.lazyLoadObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      if (el.dataset.lazySrc) {
        el.src = el.dataset.lazySrc;
        el.removeAttribute('data-lazy-src');
      }
      if (el.dataset.lazyCallback) {
        const fn = window[el.dataset.lazyCallback];
        if (typeof fn === 'function') fn(el);
      }
      window.lazyLoadObserver.unobserve(el);
    }
  });
}, { rootMargin: '200px' });

// ─── PREFETCH PAGES ──────────────────────────────────────────────────────────
window.prefetchPage = function(href) {
  if (document.querySelector(`link[href="${href}"][rel="prefetch"]`)) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
};

// ─── ROUTE PRELOADING on hover ───────────────────────────────────────────────
document.addEventListener('mouseover', throttle(function(e) {
  const a = e.target.closest('a[href]');
  if (a && a.href && a.href.startsWith(location.origin)) {
    prefetchPage(a.href);
  }
}, 200));

// ─── RAF SCHEDULER ───────────────────────────────────────────────────────────
window.scheduleWork = function(fn) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn, { timeout: 5000 });
  } else {
    setTimeout(fn, 0);
  }
};

// ─── IndexedDB CACHE (parsed data, reports, exports) ────────────────────────
// NOTE: indexedCacheGet/Set are defined in common.js (loads after this file)
// and overwrite these versions. The functions below are unused but kept for
// potential standalone use (e.g., if perf.js is loaded without common.js).
const IDB_NAME = 'excel_auto_perf_cache';
const IDB_VERSION = 2;
const IDB_STORE = 'cache';

function openIDB() {
  return new Promise((resolve, reject) => {
    if (window._idbInstance) { resolve(window._idbInstance); return; }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = function(e) { window._idbInstance = e.target.result; resolve(window._idbInstance); };
    req.onerror = function(e) { reject(e.target.error); };
  });
}

window.indexedCacheSet = async function(key, value, ttlMs = 30 * 60 * 1000) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({ value, expires: Date.now() + ttlMs, key }, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (e) { console.warn('[IDB Set]', e); return false; }
};

window.indexedCacheGet = async function(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = function(e) {
        const entry = e.target.result;
        if (!entry) { resolve(null); return; }
        if (Date.now() > entry.expires) {
          // Expired, delete it
          const delTx = db.transaction(IDB_STORE, 'readwrite');
          delTx.objectStore(IDB_STORE).delete(key);
          resolve(null);
          return;
        }
        resolve(entry.value);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) { console.warn('[IDB Get]', e); return null; }
};

window.indexedCacheDelete = async function(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) { return false; }
};

window.indexedCacheClear = async function() {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) { return false; }
};

// ─── COMPRESSION (simple run-length for localStorage) ────────────────────────
window.compressData = function(data) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch { return null; }
};
window.decompressData = function(str) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch { return null; }
};

// ─── PERFORMANCE MARKS ───────────────────────────────────────────────────────
window.perfMark = function(name) {
  if (performance && performance.mark) performance.mark(name);
};
window.perfMeasure = function(name, start, end) {
  if (performance && performance.measure) {
    try { performance.measure(name, start, end); } catch {}
  }
};

console.log('[Perf] Performance utilities loaded ✓');
