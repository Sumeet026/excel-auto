/* ==========================================================================
   EXCEL AUTO - DASHBOARD CONTROLLER (dashboard.js)
   • Parallel data loading via Promise.all
   • Background parsing & cleaning via Worker
   • PDF text extraction support
   • Realtime streams for files & activity logs
   • Virtual scrolling renderers
   • Optimistic UI updates
   • AI Chat Copilot interactive engine
   ========================================================================== */

'use strict';

// ─── Worker message helper with timeout to prevent listener leaks ──────────
function workerPostWithTimeout(worker, message, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const actionId = message.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    message.id = actionId;
    let settled = false;

    const listener = (e) => {
      if (e.data && e.data.id === actionId) {
        worker.removeEventListener('message', listener);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data);
        }
      }
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        worker.removeEventListener('message', listener);
        reject(new Error('Worker timeout'));
      }
    }, timeoutMs);

    worker.addEventListener('message', listener);
    worker.postMessage(message);
  });
}

let activeFileDoc = null;
let activeSheetData = [];
let activeHeaders = [];
let originalSheetData = [];
let uploadedFilesList = [];
let excelWorker = null;

// Worker initializer
function getExcelWorker() {
  if (!excelWorker) {
    excelWorker = new Worker('js/excel-worker.js');
  }
  return excelWorker;
}

document.addEventListener('DOMContentLoaded', () => {
  initDragAndDrop();
  initWorkspaceTabs();
  initFilesLoader();
  initCleaningOperations();
  initFormulaSolver();
  initLiveFeeds();
  initExportDropdown();
  initAiCopilot();
  initTopCustomers();
  initChartControls();
  initPivotControls();
  initHindiTranslation();
  initEmailManager();
});

if (window.isFirebaseMocked) {
  const connBadge = document.getElementById('firebase-connection-badge');
  if (connBadge) {
    connBadge.textContent = "Sandboxed";
    connBadge.className = "status-pill warning";
  }
}

/**
 * Drag and Drop File Upload
 */
function initDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  let fileInput = document.getElementById('file-input');
  if (!dropZone) {
    console.error('initDragAndDrop: drop-zone element not found');
    return;
  }
  if (!fileInput) {
    console.warn('initDragAndDrop: file-input not found, creating hidden input');
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'file-input';
    fileInput.multiple = true;
    fileInput.accept = '.xlsx,.xls,.csv,.pdf,.txt,.json,.xml';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  } else {
    fileInput.setAttribute('accept', '.xlsx,.xls,.csv,.pdf,.txt,.json,.xml');
  }
  dropZone.addEventListener('click', () => {
    console.log('Drop zone clicked - opening file selector');
    fileInput.click();
  });
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    console.log('File dragged over drop zone');
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    console.log('File left drop zone');
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    console.log('File dropped');
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFilesUpload(files);
    }
  });
  fileInput.addEventListener('change', () => {
    console.log('File input changed, selected files:', fileInput.files);
    if (fileInput.files.length > 0) {
      handleFilesUpload(fileInput.files);
    }
  });
}

/**
 * PDF Text Extractor Helper
 */
async function extractTextFromPdf(dataBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    text += strings.join(" ") + "\n";
  }
  return text;
}

/**
 * Handle Multiple File Uploads to Firebase Storage
 */
async function handleFilesUpload(files) {
  const user = auth.currentUser;
  if (!user) {
    showToast("Please log in to upload files.", "error");
    return;
  }

  const progressWrapper = document.getElementById('upload-progress-wrapper');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressPercent = document.getElementById('uploading-percentage');
  const progressName = document.getElementById('uploading-file-name');

  if (progressWrapper) progressWrapper.style.display = 'block';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    const allowedExts = ['xlsx', 'xls', 'csv', 'pdf', 'txt', 'json', 'xml'];
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(fileExt)) {
      showToast(`Unsupported format: ${file.name}. Allowed: Excel, CSV, PDF, TXT, JSON, XML.`, "error");
      continue;
    }

    if (file.size > 50 * 1024 * 1024) {
      showToast(`File too large: ${file.name}. Max limit is 50MB.`, "error");
      continue;
    }

    if (progressName) progressName.textContent = file.name;
    if (progressFill) progressFill.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';

    const timestamp = new Date().toISOString();
    const docId = db.collection('files').doc().id;
    const storagePath = `users/${user.uid}/files/${docId}_${file.name}`;
    const fileRef = (!window.isFirebaseMocked && storage) ? storage.ref(storagePath) : null;

    let fileMeta;
    let usedSandbox = false;

    if (progressFill) progressFill.style.width = '10%';
    if (progressPercent) progressPercent.textContent = '10%';

    if (fileRef) {
      try {
        if (progressFill) progressFill.style.width = '20%';
        if (progressPercent) progressPercent.textContent = '20%';

        const uploadTask = fileRef.put(file);

        await new Promise((resolve, reject) => {
          let resolved = false;
          const uploadTimeout = setTimeout(() => {
            if (!resolved) { resolved = true; reject(new Error('Storage timeout')); }
          }, 15000);

          let progressFired = false;

          uploadTask.on('state_changed',
            (snapshot) => {
              progressFired = true;
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              if (progressFill) progressFill.style.width = `${Math.max(progress, 20)}%`;
              if (progressPercent) progressPercent.textContent = `${Math.round(progress)}%`;
            },
            (error) => {
              if (!resolved) { resolved = true; clearTimeout(uploadTimeout); reject(error); }
            },
            async () => {
              if (!resolved) {
                resolved = true; clearTimeout(uploadTimeout);
                let downloadUrl;
                try { downloadUrl = await fileRef.getDownloadURL(); }
                catch (e) { downloadUrl = `sandbox://${storagePath}`; }
                fileMeta = {
                  id: docId, name: file.name, size: file.size, type: fileExt,
                  url: downloadUrl, storagePath: storagePath,
                  status: 'active', createdBy: user.uid,
                  createdAt: timestamp, updatedAt: timestamp
                };
                resolve();
              }
            }
          );

          setTimeout(() => {
            if (!resolved && !progressFired) {
              resolved = true; clearTimeout(uploadTimeout);
              try { uploadTask.cancel(); } catch(e) {}
              reject(new Error('Storage failed to start'));
            }
          }, 5000);
        });
      } catch (storageErr) {
        console.warn("[Upload] Firebase Storage failed, falling back to local:", storageErr.message);
        usedSandbox = true;
      }
    } else {
      usedSandbox = true;
    }

    if (usedSandbox) {
      try {
        if (progressFill) progressFill.style.width = '40%';
        if (progressPercent) progressPercent.textContent = '40%';

        await window.writeSandboxFile(storagePath, file);

        if (progressFill) progressFill.style.width = '80%';
        if (progressPercent) progressPercent.textContent = '80%';

        fileMeta = {
          id: docId, name: file.name, size: file.size, type: fileExt,
          url: `sandbox://${storagePath}`, storagePath: storagePath,
          status: 'active', createdBy: user.uid,
          createdAt: timestamp, updatedAt: timestamp
        };
      } catch (sandboxErr) {
        console.error("[Upload] Local save failed:", sandboxErr);
        if (progressFill) progressFill.style.width = '0%';
        if (progressPercent) progressPercent.textContent = 'Failed';
        showToast(`Upload failed: ${sandboxErr.message}`, "error");
        continue;
      }
    }

    try {
      if (progressFill) progressFill.style.width = '90%';
      if (progressPercent) progressPercent.textContent = '90%';

      try {
        await db.collection('files').doc(docId).set(fileMeta);
      } catch (fsErr) {
        console.warn("[Upload] Firestore write failed:", fsErr.message);
        if (fsErr.message && fsErr.message.includes('permission')) {
          window.isFirebaseMocked = true;
          console.warn("[Upload] Switching to local mode — Firestore rules not deployed.");
        }
        try {
          const localFiles = JSON.parse(localStorage.getItem('excelAuto_localFiles') || '[]');
          localFiles.push(fileMeta);
          localStorage.setItem('excelAuto_localFiles', JSON.stringify(localFiles));
        } catch (e) { console.warn('[Upload] Local cache write failed:', e); }
      }

      try {
        if (rtdb && rtdb.ref) {
          await rtdb.ref(`files/${user.uid}/${docId}`).set(fileMeta);
        }
      } catch (rtdbErr) {
        console.warn("[Upload] RTDB write skipped:", rtdbErr.message);
      }

      if (progressFill) progressFill.style.width = '100%';
      if (progressPercent) progressPercent.textContent = '100%';

      try { await logUserActivity(`Uploaded file: ${file.name}`); } catch(e) {}
      try { await pushNotification(`File ${file.name} uploaded successfully.`); } catch(e) {}

      const modeTag = usedSandbox ? ' (saved locally)' : '';
      showToast(`Uploaded ${file.name} successfully!${modeTag}`, "success");
      try { await processUploadedFile(fileMeta); } catch(e) { console.warn("[Upload] Process skipped:", e.message); }
    } catch (dbErr) {
      console.error("[Upload] Unexpected error:", dbErr);
      if (progressFill) progressFill.style.width = '0%';
      if (progressPercent) progressPercent.textContent = 'Failed';
      showToast(`Upload failed: ${dbErr.message}`, "error");
    }
  }

  setTimeout(() => {
    if (progressWrapper) progressWrapper.style.display = 'none';
  }, 2000);
  try {
    if (rtdb && rtdb.ref) {
      rtdb.ref(`live_processing/${user.uid}`).remove().catch(() => {});
    }
  } catch(e) {}
}

/**
 * Realtime Streams for Files & Activity list
 */
let filesUnsubscribe = null;
let activityUnsubscribe = null;

function initFilesLoader() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      loadDashboardStats();

      if (filesUnsubscribe) filesUnsubscribe();

      const filesQuery = db.collection('files')
        .where('createdBy', '==', user.uid)
        .where('status', '==', 'active');

      filesUnsubscribe = filesQuery.onSnapshot(snap => {
        uploadedFilesList = [];
        let totalSize = 0;
        snap.forEach(doc => {
          const file = doc.data();
          uploadedFilesList.push(file);
          totalSize += file.size || 0;
        });

        renderFilesListVirtual();

        const fileCountLabel = document.getElementById('file-count-label');
        if (fileCountLabel) {
          fileCountLabel.textContent = `${uploadedFilesList.length} file${uploadedFilesList.length !== 1 ? 's' : ''} saved`;
        }

        updateMetrics(uploadedFilesList.length, totalSize);
      }, err => {
        console.error("Realtime files listener error:", err);
        try {
          const localFiles = JSON.parse(localStorage.getItem('excelAuto_localFiles') || '[]');
          if (localFiles.length > 0) {
            uploadedFilesList = localFiles.filter(f => f.createdBy === user.uid && f.status === 'active');
          }
        } catch (e) {}
        renderFilesListVirtual();
        const fileCountLabel = document.getElementById('file-count-label');
        if (fileCountLabel) {
          fileCountLabel.textContent = `${uploadedFilesList.length} file${uploadedFilesList.length !== 1 ? 's' : ''} saved`;
        }
        updateMetrics(uploadedFilesList.length, uploadedFilesList.reduce((s, f) => s + (f.size || 0), 0));
        if (uploadedFilesList.length === 0) {
          const container = document.getElementById('files-list-container');
          if (container) {
            container.innerHTML = `
              <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                <i class="fas fa-exclamation-triangle" style="color: #f59e0b; margin-bottom: 8px; display: block; font-size: 1.2rem;"></i>
                Cannot load files from cloud. Deploy Firestore rules in Firebase Console.
                <br><small style="color:var(--text-secondary);margin-top:6px;display:block;">Firestore Rules: allow read, write: if request.auth != null;</small>
              </div>
            `;
          }
        }
      });

      initActivityFeedRealtime(user.uid);
    } else {
      if (filesUnsubscribe) { filesUnsubscribe(); filesUnsubscribe = null; }
      if (activityUnsubscribe) { activityUnsubscribe(); activityUnsubscribe = null; }
    }
  });
}

/**
 * Process uploaded file with FAST MODE: instant preview + background processing
 */
async function processUploadedFile(fileMeta) {
  const t0 = Date.now();
  try {
    const cacheKey = `parsed_${fileMeta.id}`;
    const cached = await window.indexedCacheGet(cacheKey);
    if (cached && cached.jsonData && cached.jsonData.length > 0) {
      showToast(`Loaded ${fileMeta.name} from cache (instant)`, "success");
      activeSheetData = cached.jsonData;
      activeHeaders = cached.headers || Object.keys(cached.jsonData[0] || {});
      renderWorkspacePreview();
      populateColumnMappingUI();
      runAutoAnalysis();
      try {
        localStorage.setItem('excelAuto_activeData', JSON.stringify({ data: activeSheetData.slice(0, 5000), headers: activeHeaders, fileName: fileMeta.name, timestamp: Date.now() }));
      } catch (e) { /* ignore */ }
      if (typeof window.runAutoWorkflows === 'function') {
        window.runAutoWorkflows(activeSheetData, activeHeaders, fileMeta.name);
      }
      return;
    }

    let buffer;
    if (fileMeta.storagePath && (!fileMeta.url || fileMeta.url.startsWith('sandbox://') || window.isFirebaseMocked)) {
      try {
        const data = await window.readSandboxFile(fileMeta.storagePath);
        if (!data) throw new Error("File not found in sandbox storage.");
        if (data instanceof ArrayBuffer) {
          buffer = data;
        } else if (data instanceof Blob) {
          buffer = await data.arrayBuffer();
        } else {
          throw new Error("Unexpected data format in sandbox.");
        }
      } catch (e) {
        console.error('Sandbox IndexedDB read failed:', e);
        showToast('Failed to read file in sandbox mode. Try re-uploading.', 'error');
        return;
      }
    } else if (fileMeta.url && !fileMeta.url.startsWith('sandbox://')) {
      const response = await fetch(fileMeta.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      buffer = await response.arrayBuffer();
    } else {
      showToast('File URL not available. Try re-uploading.', 'error');
      return;
    }

    const parseId = `parse_${Date.now()}`;
    const worker = getExcelWorker();
    worker.postMessage({ action: 'PARSE_FAST', payload: { buffer, fileName: fileMeta.name }, id: parseId });

    const fastResult = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { worker.removeEventListener('message', listener); reject(new Error('Fast parse timeout')); }, 15000);
      function listener(e) {
        if (e.data && e.data.id === parseId && e.data.action === 'PARSE_FAST_COMPLETE') {
          worker.removeEventListener('message', listener);
          clearTimeout(timer);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.data);
        }
      }
      worker.addEventListener('message', listener);
    });

    activeSheetData = fastResult.previewData;
    activeHeaders = fastResult.headers;
    renderWorkspacePreview();
    populateColumnMappingUI();
    if (typeof runDataQualityAnalysis === 'function') runDataQualityAnalysis();
    runAutoAnalysis();

    const duration = Date.now() - t0;
    showToast(`${fileMeta.name}: ${fastResult.totalRows} rows, ${fastResult.totalCols} columns (parsed in ${duration}ms)`, "success");

    const fullResult = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { worker.removeEventListener('message', listener); reject(new Error('Full parse timeout')); }, 60000);
      function listener(e) {
        if (e.data && e.data.id === parseId && e.data.action === 'PARSE_FULL_COMPLETE') {
          worker.removeEventListener('message', listener);
          clearTimeout(timer);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.data);
        }
      }
      worker.addEventListener('message', listener);
    });

    activeSheetData = fullResult.jsonData;
    activeHeaders = fullResult.headers;
    renderWorkspacePreview();
    if (typeof runDataQualityAnalysis === 'function') runDataQualityAnalysis();

    // Save data for AI Command Center
    try {
      localStorage.setItem('excelAuto_activeData', JSON.stringify({ data: activeSheetData.slice(0, 5000), headers: activeHeaders, fileName: activeFileDoc ? activeFileDoc.name : 'Unknown', timestamp: Date.now() }));
    } catch (e) { /* ignore quota */ }

    // Trigger auto-workflows if AI Command Center is loaded
    if (typeof window.runAutoWorkflows === 'function') {
      window.runAutoWorkflows(activeSheetData, activeHeaders, activeFileDoc ? activeFileDoc.name : 'Unknown');
    }

    await window.indexedCacheSet(cacheKey, { jsonData: fullResult.jsonData, headers: fullResult.headers, columnTypes: fullResult.columnTypes }, 30 * 60 * 1000);

    window.scheduleWork(async () => {
      try {
        const cleanId = `clean_${Date.now()}`;
        worker.postMessage({ action: 'CLEAN', payload: { data: activeSheetData, rules: { removeDuplicates: true, trimSpaces: true } }, id: cleanId });
        const cleanResult = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => { worker.removeEventListener('message', listener); reject(new Error('Clean timeout')); }, 30000);
          function listener(e) {
            if (e.data && e.data.id === cleanId) {
              worker.removeEventListener('message', listener);
              clearTimeout(timer);
              e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.data);
            }
          }
          worker.addEventListener('message', listener);
        });

        const aiId = `ai_${Date.now()}`;
        worker.postMessage({ action: 'AI_ANALYZE', payload: { data: cleanResult.cleaned }, id: aiId });
        const aiResult = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => { worker.removeEventListener('message', listener); reject(new Error('AI analyze timeout')); }, 30000);
          function listener(e) {
            if (e.data && e.data.id === aiId) {
              worker.removeEventListener('message', listener);
              clearTimeout(timer);
              e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.data);
            }
          }
          worker.addEventListener('message', listener);
        });

        const reportCacheKey = `report_${fileMeta.id}`;
        await window.indexedCacheSet(reportCacheKey, { fileMeta, cleanedData: cleanResult.cleaned, headers: Object.keys(cleanResult.cleaned[0] || {}), insights: aiResult.summary, compiledAt: new Date().toISOString() }, 60 * 60 * 1000);

        await generateBackgroundPDF(fileMeta, cleanResult.cleaned, aiResult.summary);
        await loadDashboardStats();
        showToast(`Full processing complete for ${fileMeta.name}`, "success");
      } catch (e) { console.warn('[Background processing]', e.message); }
    });
  } catch (err) {
    console.error('Processing error:', err);
    showToast(`Processing failed: ${err.message}`, 'error');
  }
}

async function generateBackgroundPDF(fileMeta, cleanedData, insights) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const reportId = db.collection('reports').doc().id;
    const reportMeta = { id: reportId, name: `${fileMeta.name}_report.pdf`, type: 'pdf', url: '#', createdBy: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'active', sourceFileId: fileMeta.id, hasData: true };
    await db.collection('reports').doc(reportId).set(reportMeta);

    if (typeof window.jspdf === 'undefined') {
      console.warn('[PDF] jsPDF not loaded, skipping background PDF');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Report for ${fileMeta.name}`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 30);
    if (insights && insights.insights && Array.isArray(insights.insights)) {
      doc.text('AI Insights:', 14, 38);
      const wrapped = doc.splitTextToSize(insights.insights.join('. '), 180);
      doc.text(wrapped.slice(0, 5), 14, 44);
    }
    if (cleanedData && cleanedData.length > 0) {
      const previewRows = cleanedData.slice(0, 5);
      const hdrs = Object.keys(previewRows[0] || {});
      if (hdrs.length > 0) {
        doc.autoTable({ startY: 60, head: [hdrs], body: previewRows.map(row => hdrs.map(h => row[h] !== undefined ? String(row[h]) : '')), theme: 'grid' });
      }
    }
    const pdfBlob = doc.output('blob');
    const storagePath = `users/${user.uid}/reports/${reportId}_report.pdf`;
    try {
      await storage.ref(storagePath).put(pdfBlob);
      const downloadUrl = await storage.ref(storagePath).getDownloadURL();
      await db.collection('reports').doc(reportId).update({ url: downloadUrl });
    } catch (e) {
      console.warn('[PDF] Could not store report in storage:', e.message);
    }
  } catch (e) { console.warn('[Background PDF]', e.message); }
}

// Duplicate listener removed — initFilesLoader() above already handles auth state,
// file snapshots, activity feed, and metrics. Keeping both caused DOUBLE processing.


function renderFilesListVirtual() {
  const container = document.getElementById('files-list-container');
  if (!container) return;

  if (uploadedFilesList.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted);">
        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
        No spreadsheets uploaded yet. Upload a file to start processing.
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '12px';
  container.style.position = '';
  container.style.overflowY = '';

  uploadedFilesList.forEach((file) => {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-item';

    let iconClass = 'fa-file-excel';
    let iconColor = '#10b981';

    if (file.type === 'csv') { iconClass = 'fa-file-csv'; iconColor = '#06b6d4'; }
    else if (file.type === 'pdf') { iconClass = 'fa-file-pdf'; iconColor = '#ef4444'; }
    else if (file.type === 'json') { iconClass = 'fa-file-code'; iconColor = '#a855f7'; }
    else if (file.type === 'xml') { iconClass = 'fa-file-alt'; iconColor = '#f59e0b'; }
    else if (file.type === 'txt') { iconClass = 'fa-file-alt'; iconColor = '#94a3b8'; }

    fileDiv.innerHTML = `
      <div class="file-item-info">
        <i class="fas ${iconClass} file-icon" style="color: ${iconColor};"></i>
        <div class="file-name-meta">
          <span class="file-name">${file.name}</span>
          <span class="file-meta">
            <span>${formatBytes(file.size)}</span>
            <span>•</span>
            <span>Uploaded ${new Date(file.createdAt).toLocaleDateString()}</span>
          </span>
        </div>
      </div>
      <div class="file-actions">
        <button class="action-icon-btn preview-btn" title="Open in Studio"><i class="fas fa-edit"></i></button>
        <button class="action-icon-btn download-btn" title="Download File"><i class="fas fa-download"></i></button>
        <button class="action-icon-btn rename-btn" title="Rename"><i class="fas fa-signature"></i></button>
        <button class="action-icon-btn delete-btn delete" title="Delete"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;

    fileDiv.querySelector('.preview-btn').addEventListener('click', () => loadFileToWorkspace(file));
    fileDiv.querySelector('.download-btn').addEventListener('click', () => {
      if (window.isFirebaseMocked || !file.url || file.url.startsWith('sandbox://')) {
        window.downloadSandboxFile(file.storagePath, file.name);
      } else {
        window.open(file.url, '_blank');
      }
    });
    fileDiv.querySelector('.rename-btn').addEventListener('click', () => showRenameModal(file));
    fileDiv.querySelector('.delete-btn').addEventListener('click', () => handleDeleteFile(file));

    container.appendChild(fileDiv);
  });
}

function initActivityFeedRealtime(uid) {
  const container = document.getElementById('activity-feed-container');
  if (!container) return;

  if (activityUnsubscribe) activityUnsubscribe();

  try {
    const query = db.collection('activities')
      .where('createdBy', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(30);

    activityUnsubscribe = query.onSnapshot(snap => {
      const activities = [];
      snap.forEach(doc => {
        if (doc && typeof doc.data === 'function') {
          activities.push(doc.data());
        }
      });

    if (activities.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 20px;">No recent activity</div>`;
      return;
    }

    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';
    container.style.position = '';
    container.style.overflowY = '';

    activities.forEach((act) => {
      const item = document.createElement('div');
      item.className = 'activity-item';

      let badgeClass = 'upload';
      let icon = 'fa-file-upload';

      if (act.action.includes('Cleaned') || act.action.includes('Formula') || act.action.includes('Mapped')) {
        badgeClass = 'clean';
        icon = 'fa-magic';
      } else if (act.action.includes('Export') || act.action.includes('Download') || act.action.includes('Saved')) {
        badgeClass = 'export';
        icon = 'fa-file-export';
      } else if (act.action.includes('Delete')) {
        badgeClass = 'delete';
        icon = 'fa-trash-alt';
      }

      item.innerHTML = `
        <div class="activity-badge ${badgeClass}"><i class="fas ${icon}"></i></div>
        <div class="activity-content">
          <span class="activity-text">${act.action}</span>
          <span class="activity-time">${formatTimeAgo(act.createdAt)}</span>
        </div>
      `;
      container.appendChild(item);
    });
  }, err => {
    console.error("Activity stream error:", err);
    try {
      const local = JSON.parse(localStorage.getItem('excelAuto_localActivities') || '[]');
      const userActivities = local.filter(a => a.createdBy === uid);
      if (userActivities.length > 0) {
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '12px';
        userActivities.forEach((act) => {
          const item = document.createElement('div');
          item.className = 'activity-item';
          let badgeClass = 'upload';
          let icon = 'fa-file-upload';
          if (act.action.includes('Cleaned') || act.action.includes('Formula')) { badgeClass = 'clean'; icon = 'fa-magic'; }
          else if (act.action.includes('Export') || act.action.includes('Download')) { badgeClass = 'export'; icon = 'fa-file-export'; }
          else if (act.action.includes('Delete')) { badgeClass = 'delete'; icon = 'fa-trash-alt'; }
          item.innerHTML = `
            <div class="activity-badge ${badgeClass}"><i class="fas ${icon}"></i></div>
            <div class="activity-content">
              <span class="activity-text">${act.action}</span>
              <span class="activity-time">${formatTimeAgo(act.createdAt)}</span>
            </div>
          `;
          container.appendChild(item);
        });
        return;
      }
    } catch (e) {}
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 20px;">
      <i class="fas fa-exclamation-triangle" style="color: #f59e0b; margin-bottom: 6px; display: block;"></i>
      Activity requires Firestore rules to be deployed.
    </div>`;
  });
  } catch (e) {
    console.error("Activity feed setup error:", e);
  }
}

/**
 * Load Dashboard stats cards in parallel
 */
async function loadDashboardStats() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const filesSnap = await db.collection('files').where('createdBy', '==', user.uid).where('status', '==', 'active').get();
    let reportsCount = 0;
    try {
      const reportsSnap = await db.collection('reports').where('createdBy', '==', user.uid).get();
      reportsCount = reportsSnap.size;
    } catch (e) {
      console.warn("Could not load reports count:", e);
    }

    const fileCount = filesSnap.size;

    const filesStat = document.getElementById('stat-total-files');
    const reportsStat = document.getElementById('stat-total-reports');

    if (filesStat) filesStat.textContent = fileCount;
    if (reportsStat) reportsStat.textContent = reportsCount;

    let totalStorageBytes = 0;
    filesSnap.forEach(doc => { totalStorageBytes += doc.data().size || 0; });

    updateMetrics(fileCount, totalStorageBytes);
  } catch (err) {
    console.warn("Error loading dashboard stats:", err);
  }
}

/**
 * Update stats indices
 */
async function updateMetrics(filesCount, totalStorageBytes) {
  const user = auth.currentUser;
  if (!user) return;

  const totalFilesStat = document.getElementById('stat-total-files');
  if (totalFilesStat) totalFilesStat.textContent = filesCount;

  const quotaLimit = 50 * 1024 * 1024;
  const storagePercent = (totalStorageBytes / quotaLimit) * 100;

  const storageLabel = document.getElementById('storage-stats-label');
  const storageProgress = document.getElementById('storage-stats-progress');
  const quotaText = document.getElementById('storage-percentage');

  if (storageLabel) storageLabel.textContent = `${formatBytes(totalStorageBytes)} / 50 MB`;
  if (storageProgress) storageProgress.style.width = `${Math.min(storagePercent, 100)}%`;
  if (quotaText) quotaText.textContent = `${storagePercent.toFixed(1)}%`;
}

/**
 * Optimistic File Deletion
 */
async function handleDeleteFile(file) {
  if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;

  const originalList = [...uploadedFilesList];
  uploadedFilesList = uploadedFilesList.filter(f => f.id !== file.id);
  renderFilesListVirtual();

  if (activeFileDoc && activeFileDoc.id === file.id) {
    const wsCard = document.getElementById('excel-workspace-card');
    if (wsCard) wsCard.style.display = 'none';
  }

  await window.optimisticUpdate(async () => {
    try {
      try {
        await storage.ref(file.storagePath).delete();
      } catch (e) {
        console.warn("Storage item skip:", e);
      }

      try {
        await db.collection('files').doc(file.id).update({
          status: 'deleted',
          updatedAt: new Date().toISOString()
        });
      } catch (fsErr) {
        console.warn("[Delete] Firestore update failed:", fsErr.message);
        try {
          let localFiles = JSON.parse(localStorage.getItem('excelAuto_localFiles') || '[]');
          localFiles = localFiles.filter(f => f.id !== file.id);
          localStorage.setItem('excelAuto_localFiles', JSON.stringify(localFiles));
        } catch (e) {}
      }
      if (rtdb && rtdb.ref) {
        await rtdb.ref(`files/${auth.currentUser.uid}/${file.id}`).remove().catch(() => {});
      }

      try { await window.deleteSandboxFile(file.storagePath); } catch (e) {}

      showToast(`Deleted ${file.name}.`, "warning");
      await logUserActivity(`Deleted file: ${file.name}`);
      await pushNotification(`File ${file.name} deleted.`);
    } catch (err) {
      uploadedFilesList = originalList;
      renderFilesListVirtual();
      throw err;
    }
  });
}

/**
 * Optimistic File Rename
 */
let fileToRename = null;
function showRenameModal(file) {
  fileToRename = file;
  const modal = document.getElementById('rename-file-modal');
  const renameInput = document.getElementById('rename-input');
  renameInput.value = file.name;
  modal.classList.add('active');
}

const renameModal = document.getElementById('rename-file-modal');
const renameClose = document.getElementById('rename-modal-close');
const renameCancel = document.getElementById('btn-rename-cancel');
const renameSubmit = document.getElementById('btn-rename-submit');

if (renameModal) {
  const closeModal = () => renameModal.classList.remove('active');
  if (renameClose) renameClose.addEventListener('click', closeModal);
  if (renameCancel) renameCancel.addEventListener('click', closeModal);

  if (renameSubmit) {
    renameSubmit.addEventListener('click', async () => {
      const newName = document.getElementById('rename-input').value.trim();
      if (!newName || !fileToRename) return;

      const originalList = [...uploadedFilesList];
      const originalName = fileToRename.name;

      uploadedFilesList = uploadedFilesList.map(f => f.id === fileToRename.id ? { ...f, name: newName } : f);
      renderFilesListVirtual();

      if (activeFileDoc && activeFileDoc.id === fileToRename.id) {
        const activeFilename = document.getElementById('active-filename');
        if (activeFilename) activeFilename.textContent = `Active: ${newName}`;
        activeFileDoc.name = newName;
      }

    closeModal();

    await window.optimisticUpdate(async () => {
      try {
        try {
          await db.collection('files').doc(fileToRename.id).update({
            name: newName,
            updatedAt: new Date().toISOString()
          });
        } catch (fsErr) {
          console.warn("[Rename] Firestore update failed:", fsErr.message);
          try {
            let localFiles = JSON.parse(localStorage.getItem('excelAuto_localFiles') || '[]');
            localFiles = localFiles.map(f => f.id === fileToRename.id ? { ...f, name: newName, updatedAt: new Date().toISOString() } : f);
            localStorage.setItem('excelAuto_localFiles', JSON.stringify(localFiles));
          } catch (e) {}
        }
        if (rtdb && rtdb.ref) {
          await rtdb.ref(`files/${auth.currentUser.uid}/${fileToRename.id}/name`).set(newName).catch(() => {});
        }

      showToast(`Renamed to ${newName}`, "success");
      await logUserActivity(`Renamed file ${originalName} to ${newName}`);
    } catch (err) {
      uploadedFilesList = originalList;
      renderFilesListVirtual();
      throw err;
    }
  });
});
  }
}

/**
 * Workspace Tab controls
 */
function initWorkspaceTabs() {
  const tabs = document.querySelectorAll('.workspace-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetSection = tab.dataset.target;
      const sections = document.querySelectorAll('.workspace-section');
      sections.forEach(sec => sec.classList.remove('active'));

      const targetEl = document.getElementById(targetSection);
      if (targetEl) targetEl.classList.add('active');
    });
  });
}

/**
 * Load selected file into workspace with INSTANT preview
 */
async function loadFileToWorkspace(file) {
  activeFileDoc = file;
  const activeFilename = document.getElementById('active-filename');
  const workspaceCard = document.getElementById('excel-workspace-card');
  if (activeFilename) activeFilename.textContent = `Active: ${file.name}`;
  if (workspaceCard) workspaceCard.style.display = 'block';
  if (workspaceCard) workspaceCard.scrollIntoView({ behavior: 'smooth' });

  // 1. Check cache first
  const cacheKey = `parsed_${file.id}`;
  const cached = await window.indexedCacheGet(cacheKey);
  if (cached && cached.jsonData && cached.jsonData.length > 0) {
    activeSheetData = cached.jsonData;
    originalSheetData = JSON.parse(JSON.stringify(cached.jsonData));
    activeHeaders = cached.headers || Object.keys(cached.jsonData[0] || {});
    renderWorkspacePreview();
    populateColumnMappingUI();
    runAutoAnalysis();
    if (typeof runDataQualityAnalysis === 'function') runDataQualityAnalysis();
    showToast(`Loaded ${file.name} from cache (instant)`, "success");
    return;
  }

  showToast(`Loading ${file.name}...`, "info");

  try {
    let dataBuffer;
    if (window.isFirebaseMocked && file.storagePath) {
      try {
        const data = await window.readSandboxFile(file.storagePath);
        if (!data) throw new Error("File not found in sandbox.");
        if (data instanceof ArrayBuffer) {
          dataBuffer = data;
        } else if (data instanceof Blob) {
          dataBuffer = await data.arrayBuffer();
        } else {
          throw new Error("Unexpected data format in sandbox.");
        }
      } catch (e) {
        console.error('Sandbox read failed:', e);
        showToast('Failed to read file. Try re-uploading.', 'error');
        return;
      }
    } else if (file.url && !file.url.startsWith('sandbox://')) {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      dataBuffer = await response.arrayBuffer();
    } else {
      showToast('File URL not available. Try re-uploading.', 'error');
      return;
    }

    let textContent = null;
    if (file.type === 'pdf') {
      try { textContent = await extractTextFromPdf(dataBuffer); }
      catch (e) { showToast("Failed to parse PDF.", "error"); return; }
    }

    const worker = getExcelWorker();
    const actionId = `parse_${Date.now()}`;
    worker.postMessage({ action: 'PARSE_FAST', payload: { buffer: dataBuffer, fileName: file.name, textContent }, id: actionId });

    // Get instant preview
    const fastResult = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { worker.removeEventListener('message', listener); reject(new Error('Timeout')); }, 15000);
      function listener(e) {
        if (e.data && e.data.id === actionId && e.data.action === 'PARSE_FAST_COMPLETE') {
          worker.removeEventListener('message', listener);
          clearTimeout(timer);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.data);
        }
      }
      worker.addEventListener('message', listener);
    });

    activeSheetData = fastResult.previewData;
    originalSheetData = JSON.parse(JSON.stringify(fastResult.previewData));
    activeHeaders = fastResult.headers;
    renderWorkspacePreview();
    populateColumnMappingUI();
    runAutoAnalysis();
    if (typeof runDataQualityAnalysis === 'function') runDataQualityAnalysis();
    showToast(`Preview: ${fastResult.totalRows} rows loaded`, "success");

    // Background: load full data
    const fullResult = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { worker.removeEventListener('message', listener); reject(new Error('Full parse timeout')); }, 60000);
      function listener(e) {
        if (e.data && e.data.id === actionId && e.data.action === 'PARSE_FULL_COMPLETE') {
          worker.removeEventListener('message', listener);
          clearTimeout(timer);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.data);
        }
      }
      worker.addEventListener('message', listener);
    });

    activeSheetData = fullResult.jsonData;
    originalSheetData = JSON.parse(JSON.stringify(fullResult.jsonData));
    activeHeaders = fullResult.headers;
    renderWorkspacePreview();
    if (typeof runDataQualityAnalysis === 'function') runDataQualityAnalysis();
    await window.indexedCacheSet(cacheKey, { jsonData: fullResult.jsonData, headers: fullResult.headers, columnTypes: fullResult.columnTypes }, 30 * 60 * 1000);
    showToast(`Full data loaded: ${fullResult.totalRows} rows`, "success");

  } catch (err) {
    console.error("Parse error:", err);
    showToast("Failed to load file.", "error");
  }
}

function renderWorkspacePreview() {
  const container = document.getElementById('preview-table-container');
  const countLabel = document.getElementById('preview-records-count');

  if (activeSheetData.length === 0) return;
  if (countLabel) countLabel.textContent = `Records parsed: ${activeSheetData.length}`;
  if (!container) return;

  let html = `<table class="custom-table"><thead><tr>`;
  activeHeaders.forEach(hdr => { html += `<th>${hdr}</th>`; });
  html += `</tr></thead><tbody>`;

  const previewRows = activeSheetData.slice(0, 15);
  previewRows.forEach(row => {
    html += `<tr>`;
    activeHeaders.forEach(hdr => {
      let displayVal = row[hdr] !== undefined ? row[hdr] : "";
      if (displayVal instanceof Date) {
        displayVal = displayVal.toISOString().split('T')[0];
      }
      const numVal = Number(String(displayVal).replace(/[^0-9.\-]/g, ''));
      const isNegative = !isNaN(numVal) && numVal < 0;
      const cellStyle = isNegative ? ' style="color:#ef4444;font-weight:700;background:rgba(239,68,68,0.08);"' : '';
      html += `<td${cellStyle}>${escapeHtml(String(displayVal))}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

function populateColumnMappingUI() {
  const container = document.getElementById('mapping-fields-list');
  if (!container) return;

  container.innerHTML = '';
  const standardFields = ['None', 'id', 'name', 'email', 'phone', 'revenue', 'cost', 'date', 'status', 'role'];

  activeHeaders.forEach(hdr => {
    const row = document.createElement('div');
    row.className = 'column-mapping-row';

    let options = '';
    standardFields.forEach(field => {
      const isSelected = hdr.toLowerCase().includes(field.toLowerCase()) && field !== 'None' ? 'selected' : '';
      options += `<option value="${field}" ${isSelected}>${field}</option>`;
    });

    row.innerHTML = `
      <span class="column-name"><i class="fas fa-tag" style="color: var(--primary); margin-right: 8px;"></i> ${hdr}</span>
      <select class="form-select column-map-select" data-column="${hdr}" style="padding: 6px 12px; font-size: 0.8rem;">
        ${options}
      </select>
    `;
    container.appendChild(row);
  });
}

const btnMappingApply = document.getElementById('btn-mapping-apply');
if (btnMappingApply) {
  btnMappingApply.addEventListener('click', () => {
    const selectors = document.querySelectorAll('.column-map-select');
    let mapCount = 0;

    selectors.forEach(select => {
      const originalHeader = select.dataset.column;
      const mappedVal = select.value;

      if (mappedVal !== 'None' && originalHeader !== mappedVal) {
        activeSheetData.forEach(row => {
          row[mappedVal] = row[originalHeader];
          delete row[originalHeader];
        });

        const idx = activeHeaders.indexOf(originalHeader);
        if (idx > -1) activeHeaders[idx] = mappedVal;
        mapCount++;
      }
    });

    if (mapCount > 0) {
      renderWorkspacePreview();
      populateColumnMappingUI();
      runAutoAnalysis();
      if (typeof runDataQualityAnalysis === 'function') runDataQualityAnalysis();
      showToast(`Mapped ${mapCount} fields successfully.`, "success");
    } else {
      showToast("No mapping changes detected.", "info");
    }
  });
}

/**
 * Worker-based Clean Operations
 */
function runCleanWorker(rules, msgSuccess) {
  if (activeSheetData.length === 0) return;

  showToast("Running clean routine in background...", "info");
  const worker = getExcelWorker();
  const actionId = `clean_${Date.now()}`;

  worker.postMessage({
    action: 'CLEAN',
    payload: { data: activeSheetData, rules },
    id: actionId
  });

  worker.addEventListener('message', function listener(e) {
    if (e.data.id === actionId) {
      worker.removeEventListener('message', listener);
      if (e.data.error) {
        showToast(e.data.error, "error");
        return;
      }
      const { cleaned, stats, duration } = e.data.data;
      activeSheetData = cleaned;
      activeHeaders = Object.keys(cleaned[0] || {});
      renderWorkspacePreview();
      populateColumnMappingUI();
      runAutoAnalysis();
      if (typeof runDataQualityAnalysis === 'function') runDataQualityAnalysis();

      showToast(`${msgSuccess} (Completed in ${duration}ms)`, "success");
    }
  });
}

function initCleaningOperations() {
  const cleanBtns = [
    ['clean-duplicates', { removeDuplicates: true }, "Purged duplicates"],
    ['clean-empty-rows', { removeEmpty: true }, "Purged blank rows"],
    ['clean-empty-cols', { removeEmptyCols: true }, "Purged blank columns"],
    ['clean-trim', { trimSpaces: true }, "Trimmed whitespaces"],
    ['clean-fix-dates', { normalizeDates: true }, "Normalized date entries"],
    ['clean-spec-chars', { stripSpecial: true }, "Stripped custom symbols"]
  ];
  cleanBtns.forEach(([id, opts, msg]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => runCleanWorker(opts, msg));
  });

  const discardBtn = document.getElementById('btn-cleaning-discard');
  if (discardBtn) discardBtn.addEventListener('click', () => {
    if (confirm("Discard all cleaning adjustments?")) {
      activeSheetData = JSON.parse(JSON.stringify(originalSheetData));
      activeHeaders = Object.keys(activeSheetData[0] || {});
      renderWorkspacePreview();
      populateColumnMappingUI();
      runAutoAnalysis();
      if (typeof runDataQualityAnalysis === 'function') runDataQualityAnalysis();
      showToast("Workspace adjustments reset.", "warning");
    }
  });

  const saveCleanBtn = document.getElementById('btn-cleaning-save');
  if (saveCleanBtn) {
    saveCleanBtn.addEventListener('click', async () => {
    if (!activeFileDoc) return;
    const saveBtn = document.getElementById('btn-cleaning-save');
    saveBtn.disabled = true;
    showToast("Re-compiling & uploading cleaned spreadsheet...", "info");

    try {
      const worker = getExcelWorker();
      const actionId = `export_${Date.now()}`;

      worker.postMessage({
        action: 'EXPORT',
        payload: { data: activeSheetData, format: 'xlsx' },
        id: actionId
      });

      const exportedBuffer = await new Promise((resolve, reject) => {
        worker.addEventListener('message', function listener(e) {
          if (e.data.id === actionId) {
            worker.removeEventListener('message', listener);
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data.data.buffer);
          }
        });
      });

      const cleanedBlob = new Blob([exportedBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const user = auth.currentUser;
      const cleanDocId = db.collection('files').doc().id;
      const cleanFileName = activeFileDoc.name.replace(/\.[^/.]+$/, "") + "_cleaned.xlsx";
      const storagePath = `users/${user.uid}/files/${cleanDocId}_${cleanFileName}`;
      const fileRef = storage.ref(storagePath);

      await fileRef.put(cleanedBlob);
      const downloadUrl = await fileRef.getDownloadURL();

      const cleanFileMeta = {
        id: cleanDocId,
        name: cleanFileName,
        size: cleanedBlob.size,
        type: 'xlsx',
        url: downloadUrl,
        storagePath: storagePath,
        status: 'active',
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.collection('files').doc(cleanDocId).set(cleanFileMeta);
      if (rtdb && rtdb.ref) {
        await rtdb.ref(`files/${user.uid}/${cleanDocId}`).set(cleanFileMeta);
      }

      showToast("Cleaned spreadsheet saved!", "success");
      await logUserActivity(`Cleaned & saved spreadsheet: ${cleanFileName}`);
      await pushNotification(`Spreadsheet ${cleanFileName} successfully cleaned.`);
    } catch (err) {
      console.error(err);
      showToast(`Failed to save: ${err.message}`, "error");
    } finally {
      saveCleanBtn.disabled = false;
    }
  });
  }
}

/**
 * Worker-based Formula Solver
 */
function initFormulaSolver() {
  const btnEvaluate = document.getElementById('btn-formula-evaluate');
  const formulaSelect = document.getElementById('formula-select');
  if (!btnEvaluate) return;

  btnEvaluate.addEventListener('click', () => {
    const op = formulaSelect.value;
    const targetColName = document.getElementById('formula-target-col').value.trim();
    const expression = document.getElementById('formula-expression').value.trim();

    if (!targetColName) {
      showToast("Please specify a target output column header.", "warning");
      return;
    }
    if (!expression) {
      showToast("Please specify formula parameters.", "warning");
      return;
    }

    showToast(`Evaluating formula ${op}...`, "info");

    const worker = getExcelWorker();
    const actionId = `formula_${Date.now()}`;

    worker.postMessage({
      action: 'FORMULA',
      payload: {
        data: activeSheetData,
        formula: expression,
        targetColumn: targetColName,
        operation: op
      },
      id: actionId
    });

    worker.addEventListener('message', function listener(e) {
      if (e.data.id === actionId) {
        worker.removeEventListener('message', listener);
        if (e.data.error) {
          showToast(e.data.error, "error");
          return;
        }
        const { result, duration } = e.data.data;
        activeSheetData = result;
        if (!activeHeaders.includes(targetColName)) {
          activeHeaders.push(targetColName);
        }

        renderWorkspacePreview();
        populateColumnMappingUI();
        runAutoAnalysis();
        if (typeof runDataQualityAnalysis === 'function') runDataQualityAnalysis();
        showToast(`Solved ${op} in ${duration}ms.`, "success");
      }
    });
  });
}

/**
 * AI tools results updater
 */
async function runAutoAnalysis() {
  if (activeSheetData.length === 0) return;

  const worker = getExcelWorker();
  const actionId = `analyze_${Date.now()}`;

  worker.postMessage({
    action: 'AI_ANALYZE',
    payload: { data: activeSheetData },
    id: actionId
  });

  worker.addEventListener('message', function listener(e) {
    if (e.data.id === actionId) {
      worker.removeEventListener('message', listener);
      if (e.data.error) return;
      displayAIAnalysisResults(e.data.data.summary);
    }
  });
}

function displayAIAnalysisResults(summary) {
  const forecastColSelect = document.getElementById('ai-forecast-col');
  if (forecastColSelect) {
    forecastColSelect.innerHTML = '<option value="">-- Choose Column --</option>';
    Object.keys(summary.predictions).forEach(col => {
      const opt = document.createElement('option');
      opt.value = col;
      opt.textContent = col;
      forecastColSelect.appendChild(opt);
    });

    const firstPredCol = Object.keys(summary.predictions)[0];
    if (firstPredCol) {
      forecastColSelect.value = firstPredCol;
      showForecastResult(summary.predictions[firstPredCol]);
    }

    forecastColSelect.onchange = () => {
      const col = forecastColSelect.value;
      if (col && summary.predictions[col]) {
        showForecastResult(summary.predictions[col]);
      } else {
        document.getElementById('ai-forecast-result-box').style.display = 'none';
      }
    };
  }

  const anomaliesList = document.getElementById('ai-anomalies-list');
  if (anomaliesList) {
    anomaliesList.innerHTML = '';
    if (summary.anomalies.length === 0) {
      anomaliesList.innerHTML = `<span style="color: var(--text-muted);">No anomalies detected. Dataset is clean!</span>`;
    } else {
      summary.anomalies.forEach(anom => {
        const item = document.createElement('div');
        item.style.padding = '8px 0';
        item.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <strong style="color: ${anom.severity === 'critical' ? 'var(--danger)' : anom.severity === 'high' ? 'var(--warning)' : 'var(--info)'}; text-transform: uppercase; font-size: 0.7rem;">${anom.type}</strong>
            <span style="font-size: 0.7rem; color: var(--text-muted);">Row ${anom.row}, ${anom.column}</span>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.75rem;">${anom.message}</div>
        `;
        anomaliesList.appendChild(item);
      });
    }
  }

  const insightsBox = document.getElementById('ai-insights-box');
  if (insightsBox) {
    insightsBox.innerHTML = '';
    const ul = document.createElement('ul');
    ul.style.paddingLeft = '16px';
    ul.style.display = 'flex';
    ul.style.flexDirection = 'column';
    ul.style.gap = '8px';

    summary.insights.forEach(insight => {
      const li = document.createElement('li');
      li.textContent = insight;
      ul.appendChild(li);
    });

    summary.suggestions.forEach(sugg => {
      const li = document.createElement('li');
      li.textContent = sugg;
      ul.appendChild(li);
    });

    if (summary.insights.length === 0 && summary.suggestions.length === 0) {
      insightsBox.textContent = "No scanned insights.";
    } else {
      insightsBox.appendChild(ul);
    }
  }
}

function showForecastResult(pred) {
  const resultBox = document.getElementById('ai-forecast-result-box');
  const valuesEl = document.getElementById('ai-forecast-values');
  const badgeEl = document.getElementById('ai-forecast-badge');

  if (resultBox && valuesEl && badgeEl) {
    valuesEl.textContent = pred.forecast.map(v => v.toLocaleString()).join(', ');
    badgeEl.textContent = pred.direction.toUpperCase();
    badgeEl.className = `status-pill ${pred.direction === 'growth' ? 'success' : pred.direction === 'decline' ? 'danger' : 'info'}`;
    resultBox.style.display = 'block';
  }
}

/**
 * Dropdown converts & exports
 */
function initExportDropdown() {
  const toggle = document.getElementById('btn-export-dropdown-toggle');
  const menu = document.getElementById('export-dropdown-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
  });

  document.addEventListener('click', () => { menu.style.display = 'none'; });

  const handleExportFormat = async (format) => {
    if (activeSheetData.length === 0) return;
    showToast(`Exporting in ${format.toUpperCase()} format...`, "info");

    const baseName = activeFileDoc.name.replace(/\.[^/.]+$/, "");

    if (format === 'pdf') {
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(18);
        doc.text("EXCELAUTO DATA REPORT", 14, 22);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 29);
        doc.text(`Source File: ${activeFileDoc.name} (${activeSheetData.length} records)`, 14, 34);

        doc.line(14, 38, 196, 38);

        const tableHeaders = activeHeaders.slice(0, 7);
        const tableBody = activeSheetData.slice(0, 30).map(row => {
          return tableHeaders.map(h => String(row[h] ?? ''));
        });

        doc.autoTable({
          head: [tableHeaders],
          body: tableBody,
          startY: 42,
          theme: 'striped',
          headStyles: { fillColor: [79, 70, 229] },
          styles: { fontSize: 8 },
          didParseCell: function(data) {
            if (data.section === 'body') {
              const cellVal = Number(String(data.cell.raw).replace(/[^0-9.\-]/g, ''));
              if (!isNaN(cellVal) && cellVal < 0) {
                data.cell.styles.textColor = [239, 68, 68];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        });

        doc.save(`${baseName}_report.pdf`);
        showToast("PDF report generated!", "success");
        await logUserActivity(`Exported sheet ${activeFileDoc.name} as PDF report`);
      } catch (err) {
        console.error(err);
        showToast("Failed to compile PDF.", "error");
      }
      return;
    }

    const worker = getExcelWorker();
    const actionId = `export_${Date.now()}`;

    worker.postMessage({
      action: 'EXPORT',
      payload: { data: activeSheetData, format },
      id: actionId
    });

    worker.addEventListener('message', function listener(e) {
      if (e.data.id === actionId) {
        worker.removeEventListener('message', listener);
        if (e.data.error) {
          showToast(e.data.error, "error");
          return;
        }

        const { buffer } = e.data.data;
        const mimeMap = {
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          csv: 'text/csv',
          json: 'application/json'
        };
        const extMap = { xlsx: 'xlsx', csv: 'csv', json: 'json' };

        const blob = new Blob([buffer], { type: mimeMap[format] || 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${baseName}_converted.${extMap[format]}`;
        link.click();

        showToast(`Converted & downloaded as ${format.toUpperCase()}`, "success");
        logUserActivity(`Exported sheet ${activeFileDoc.name} as ${format.toUpperCase()}`);
      }
    });
  };

  const exportBtns = {
    'export-as-xlsx': 'xlsx',
    'export-as-csv': 'csv',
    'export-as-pdf': 'pdf',
    'export-as-json': 'json'
  };
  Object.entries(exportBtns).forEach(([id, fmt]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => handleExportFormat(fmt));
  });
}

/**
 * AI Floating Chat Assistant
 */
function initAiCopilot() {
  const bubble = document.getElementById('ai-chat-bubble');
  const panel = document.getElementById('ai-chat-panel');
  const closeBtn = document.getElementById('ai-chat-close');
  const sendBtn = document.getElementById('ai-chat-send');
  const chatInput = document.getElementById('ai-chat-input');
  const chatBody = document.getElementById('ai-chat-body');

  if (!bubble || !panel || !closeBtn || !chatBody || !chatInput) return;

  bubble.addEventListener('click', () => {
    panel.classList.toggle('active');
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('active');
  });

  const addMessage = (text, sender) => {
    const msg = document.createElement('div');
    msg.className = `ai-chat-message ${sender}`;
    msg.textContent = text;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  const executeCommand = async (command) => {
    const cmd = command.toLowerCase().trim();

    if (cmd.includes('duplicate') || cmd.includes('remove dup')) {
      addMessage("Running duplicate removal on active sheet...", "system");
      const dupBtn = document.getElementById('clean-duplicates');
      if (dupBtn) dupBtn.click();
      return;
    }

    if (cmd.includes('forecast') || cmd.includes('predict')) {
      addMessage("Running regression models on columns...", "system");
      const forecastSelect = document.getElementById('ai-forecast-col');
      if (forecastSelect && forecastSelect.options.length > 1) {
        const aiTab = document.querySelector('[data-target="tab-ai-assistant"]');
        if (aiTab) aiTab.click();
        addMessage(`Linear forecasting trend analysis generated successfully!`, "system");
      } else {
        addMessage("Linear forecasting requires numerical columns. Please load a structured sheet.", "system");
      }
      return;
    }

    if (cmd.includes('error') || cmd.includes('anomaly') || cmd.includes('outlier')) {
      addMessage("Scanning workspace for outliers & threats...", "system");
      const aiTab = document.querySelector('[data-target="tab-ai-assistant"]');
      if (aiTab) aiTab.click();
      addMessage("Scan complete! View any warnings in the alerts panel.", "system");
      return;
    }

    if (cmd.includes('top 10') || cmd.includes('top customer') || cmd.includes('best customer')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Analyzing top 10 customers...", "system");
      const topTab = document.querySelector('[data-target="tab-top-customers"]');
      if (topTab) topTab.click();
      setTimeout(() => { const btn = document.getElementById('btn-top-customers'); if (btn) btn.click(); }, 300);
      return;
    }

    if (cmd.includes('chart') || cmd.includes('graph') || cmd.includes('visual')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Generating chart from data...", "system");
      const chartTab = document.querySelector('[data-target="tab-charts"]');
      if (chartTab) chartTab.click();
      setTimeout(() => { const btn = document.getElementById('btn-render-chart'); if (btn) btn.click(); }, 300);
      return;
    }

    if (cmd.includes('pivot') || cmd.includes('group by') || cmd.includes('aggregate')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Creating pivot table...", "system");
      const pivotTab = document.querySelector('[data-target="tab-pivot"]');
      if (pivotTab) pivotTab.click();
      setTimeout(() => { const btn = document.getElementById('btn-render-pivot'); if (btn) btn.click(); }, 300);
      return;
    }

    if (cmd.includes('hindi') || cmd.includes('translate')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Translating report to Hindi...", "system");
      const btn = document.getElementById('export-translate-hindi');
      if (btn) btn.click();
      return;
    }

    if (cmd.includes('email') || cmd.includes('mail') || cmd.includes('send report')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Opening email dialog...", "system");
      const btn = document.getElementById('export-email-manager');
      if (btn) btn.click();
      return;
    }

    if (cmd.includes('highlight') || cmd.includes('negative')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Negative values are automatically highlighted in red in the data preview table.", "system");
      const previewTab = document.querySelector('[data-target="tab-preview"]');
      if (previewTab) previewTab.click();
      return;
    }

    if (cmd.includes('missing') || cmd.includes('null') || cmd.includes('empty')) {
      addMessage("Running missing data analysis...", "system");
      const dqTab = document.querySelector('[data-target="tab-data-quality"]');
      if (dqTab) dqTab.click();
      addMessage("Data quality scan shows missing values. Check the Data Quality tab.", "system");
      return;
    }

    if (cmd.includes('report')) {
      if (!activeFileDoc) {
        addMessage("Please load a file into the studio first.", "system");
        return;
      }
      addMessage("Compiling sales & summary report...", "system");
      try {
        const user = auth.currentUser;
        const reportId = db.collection('reports').doc().id;
        const reportMeta = {
          id: reportId,
          title: `AI Copilot Generated Report - ${activeFileDoc.name}`,
          sourceFileId: activeFileDoc.id,
          sourceFileName: activeFileDoc.name,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          status: 'compiled'
        };
        await db.collection('reports').doc(reportId).set(reportMeta);
        if (rtdb && rtdb.ref) {
          await rtdb.ref(`reports/${user.uid}/${reportId}`).set(reportMeta);
        }
        addMessage(`Report created successfully! View and export it in the Reports tab.`, "system");
        showToast("Report compiled successfully", "success");
        await logUserActivity(`Created report from sheet ${activeFileDoc.name}`);
      } catch (err) {
        addMessage(`Report creation failed: ${err.message}`, "system");
      }
      return;
    }

    if (cmd.includes('summary') || cmd.includes('summarize')) {
      if (activeSheetData.length === 0) {
        addMessage("Please load a spreadsheet to run summaries.", "system");
        return;
      }
      addMessage("Generating summary statistics...", "system");
      const headers = Object.keys(activeSheetData[0]);
      let summaryText = `Dataset: ${activeFileDoc.name}\nTotal Rows: ${activeSheetData.length}\nColumns: ${headers.join(', ')}`;
      addMessage(summaryText, "system");
      return;
    }

    if (cmd.includes('profit') || cmd.includes('margin')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Calculating profit margins via AI Command Center...", "system");
      window.open('ai-center.html', '_blank');
      return;
    }

    if (cmd.includes('gst') || cmd.includes('tax')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Opening AI Command Center for GST calculation...", "system");
      window.open('ai-center.html', '_blank');
      return;
    }

    if (cmd.includes('pie chart') || cmd.includes('donut')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Opening AI Command Center for pie chart...", "system");
      window.open('ai-center.html', '_blank');
      return;
    }

    if (cmd.includes('monthly growth') || cmd.includes('yearly growth')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Opening AI Command Center for growth analysis...", "system");
      window.open('ai-center.html', '_blank');
      return;
    }

    if (cmd.includes('professional report') || cmd.includes('executive summary')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Opening AI Command Center for professional report...", "system");
      window.open('ai-center.html', '_blank');
      return;
    }

    if (cmd.includes('commission')) {
      if (activeSheetData.length === 0) { addMessage("Please load a spreadsheet first.", "system"); return; }
      addMessage("Opening AI Command Center for commission calculation...", "system");
      window.open('ai-center.html', '_blank');
      return;
    }

    addMessage("I'm sorry, I didn't catch that. Try: 'Find duplicates', 'Forecast sales', 'Show top 10 customers', 'Create chart', 'Create pivot table', 'Translate to Hindi', 'Email report', 'Highlight negatives', 'Find missing data', 'Profit margin', 'GST formula', 'Pie chart', 'Monthly growth', 'Professional report', 'Executive summary', 'Commission'. Or visit the <a href='ai-center.html' style='color:var(--primary);'>AI Command Center</a> for full natural language control.", "system");
  };

  const handleSend = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    chatInput.value = '';
    setTimeout(() => { executeCommand(text); }, 600);
  };

  sendBtn.addEventListener('click', handleSend);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
  });
}

/**
 * Top 10 Customers Analysis
 */
function initTopCustomers() {
  const btn = document.getElementById('btn-top-customers');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (activeSheetData.length === 0) { showToast("Load a spreadsheet first.", "warning"); return; }
    const worker = getExcelWorker();
    const actionId = `topcust_${Date.now()}`;
    worker.postMessage({ action: 'AI_TOP_CUSTOMERS', payload: { data: activeSheetData }, id: actionId });
    worker.addEventListener('message', function listener(e) {
      if (e.data.id === actionId) {
        worker.removeEventListener('message', listener);
        if (e.data.error) { showToast(e.data.error, "error"); return; }
        renderTopCustomers(e.data.data);
      }
    });
  });
}

function renderTopCustomers(result) {
  const container = document.getElementById('top-customers-container');
  if (!container || !result.topCustomers || result.topCustomers.length === 0) {
    if (container) container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);">No customer data found. Ensure your sheet has customer and value columns.</div>';
    return;
  }

  const colors = ['#6366f1','#a855f7','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6','#f97316'];
  let html = `<div style="margin-bottom:12px;font-size:0.8rem;color:var(--text-muted);">Detected: <strong>${result.nameCol}</strong> (name) vs <strong>${result.valueCol}</strong> (value) — ${result.totalCustomers} unique customers</div>`;

  result.topCustomers.forEach((c, i) => {
    html += `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < result.topCustomers.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.05);' : ''}">
        <div style="width:28px;height:28px;border-radius:50%;background:${colors[i % colors.length]}20;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;color:${colors[i % colors.length]};flex-shrink:0;">${i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.name)}</div>
          <div style="height:4px;background:rgba(255,255,255,0.05);border-radius:2px;margin-top:4px;overflow:hidden;">
            <div style="width:${c.percentage}%;height:100%;background:${colors[i % colors.length]};border-radius:2px;"></div>
          </div>
        </div>
        <div style="font-size:0.9rem;font-weight:700;color:${colors[i % colors.length]};white-space:nowrap;">${c.total.toLocaleString()}</div>
      </div>`;
  });

  container.innerHTML = html;
  showToast(`Top ${result.topCustomers.length} customers identified!`, "success");
}

/**
 * Data Chart Renderer (Chart.js)
 */
let dataChartInstance = null;

function initChartControls() {
  const xSelect = document.getElementById('chart-x-col');
  const ySelect = document.getElementById('chart-y-col');
  const btnRender = document.getElementById('btn-render-chart');
  if (!xSelect || !ySelect || !btnRender) return;

  const populateChartCols = () => {
    xSelect.innerHTML = '<option value="">-- Auto Detect --</option>';
    ySelect.innerHTML = '<option value="">-- Auto Detect --</option>';
    if (activeSheetData.length === 0) return;

    const headers = Object.keys(activeSheetData[0]);
    const numHeaders = headers.filter(h => activeSheetData.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));

    headers.forEach(h => {
      xSelect.innerHTML += `<option value="${h}">${h}</option>`;
    });
    numHeaders.forEach(h => {
      ySelect.innerHTML += `<option value="${h}">${h}</option>`;
    });

    const dateCol = headers.find(h => /date|time|month|year|day/i.test(h));
    const numCol = numHeaders.find(h => /revenue|sales|amount|total|price|cost|profit|spent/i.test(h)) || numHeaders[0];
    if (dateCol) xSelect.value = dateCol;
    if (numCol) ySelect.value = numCol;
  };

  populateChartCols();

  const observer = new MutationObserver(populateChartCols);
  const previewContainer = document.getElementById('preview-table-container');
  if (previewContainer) observer.observe(previewContainer, { childList: true });

  btnRender.addEventListener('click', () => {
    if (activeSheetData.length === 0) { showToast("Load data first.", "warning"); return; }
    const xCol = xSelect.value;
    const yCol = ySelect.value;
    if (!xCol || !yCol) { showToast("Select both X and Y columns.", "warning"); return; }

    const groups = {};
    activeSheetData.forEach(row => {
      const key = String(row[xCol] || 'Unknown');
      const val = Number(String(row[yCol] || 0).replace(/[^0-9.-]/g, ''));
      if (!isNaN(val)) groups[key] = (groups[key] || 0) + val;
    });

    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const labels = sorted.map(e => e[0]);
    const values = sorted.map(e => parseFloat(e[1].toFixed(2)));

    if (dataChartInstance) dataChartInstance.destroy();
    const ctx = document.getElementById('data-chart-canvas').getContext('2d');
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    dataChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: yCol,
          data: values,
          backgroundColor: '#6366f1',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } },
          y: { grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } }
        }
      }
    });

    showToast("Chart rendered!", "success");
  });
}

/**
 * Pivot Table Renderer
 */
function initPivotControls() {
  const rowSelect = document.getElementById('pivot-row-col');
  const valSelect = document.getElementById('pivot-value-col');
  const btnPivot = document.getElementById('btn-render-pivot');
  if (!rowSelect || !valSelect || !btnPivot) return;

  const populatePivotCols = () => {
    rowSelect.innerHTML = '<option value="">-- Select --</option>';
    valSelect.innerHTML = '<option value="">-- Select --</option>';
    if (activeSheetData.length === 0) return;
    const headers = Object.keys(activeSheetData[0]);
    const numHeaders = headers.filter(h => activeSheetData.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
    headers.forEach(h => { rowSelect.innerHTML += `<option value="${h}">${h}</option>`; });
    numHeaders.forEach(h => { valSelect.innerHTML += `<option value="${h}">${h}</option>`; });

    const catCol = headers.find(h => /category|product|status|region|department|segment|type/i.test(h)) || headers[0];
    const numCol = numHeaders.find(h => /revenue|sales|amount|total|price|cost|spent/i.test(h)) || numHeaders[0];
    if (catCol) rowSelect.value = catCol;
    if (numCol) valSelect.value = numCol;
  };

  populatePivotCols();

  const observer = new MutationObserver(populatePivotCols);
  const previewContainer = document.getElementById('preview-table-container');
  if (previewContainer) observer.observe(previewContainer, { childList: true });

  btnPivot.addEventListener('click', () => {
    if (activeSheetData.length === 0) { showToast("Load data first.", "warning"); return; }
    const rowCol = rowSelect.value;
    const valueCol = valSelect.value;
    const aggFunc = document.getElementById('pivot-agg-func').value;
    if (!rowCol || !valueCol) { showToast("Select both columns.", "warning"); return; }

    const worker = getExcelWorker();
    const actionId = `pivot_${Date.now()}`;
    worker.postMessage({ action: 'AI_PIVOT', payload: { data: activeSheetData, rowCol, valueCol, aggFunc }, id: actionId });
    worker.addEventListener('message', function listener(e) {
      if (e.data.id === actionId) {
        worker.removeEventListener('message', listener);
        if (e.data.error) { showToast(e.data.error, "error"); return; }
        renderPivotResult(e.data.data);
      }
    });
  });
}

function renderPivotResult(result) {
  const container = document.getElementById('pivot-result-container');
  if (!container || !result.pivot || result.pivot.length === 0) {
    if (container) container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);">No data to pivot.</div>';
    return;
  }

  let html = `<table class="custom-table" style="font-size:0.82rem;">
    <thead><tr><th>${escapeHtml(result.rowCol)}</th><th>${result.aggFunc} of ${escapeHtml(result.valueCol)}</th><th>Count</th></tr></thead><tbody>`;

  result.pivot.forEach(row => {
    const neg = row.value < 0;
    const valStyle = neg ? ' color:#ef4444;font-weight:700;' : '';
    html += `<tr><td>${escapeHtml(row.label)}</td><td style="${valStyle}">${row.value.toLocaleString()}</td><td>${row.count}</td></tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
  showToast(`Pivot table generated: ${result.pivot.length} groups`, "success");
}

/**
 * Hindi Translation
 */
function initHindiTranslation() {
  const btn = document.getElementById('export-translate-hindi');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (activeSheetData.length === 0) { showToast("Load data first.", "warning"); return; }
    showToast("Translating to Hindi...", "info");
    const worker = getExcelWorker();
    const actionId = `translate_${Date.now()}`;
    worker.postMessage({ action: 'TRANSLATE', payload: { data: activeSheetData, headers: activeHeaders, targetLang: 'hi' }, id: actionId });
    worker.addEventListener('message', function listener(e) {
      if (e.data.id === actionId) {
        worker.removeEventListener('message', listener);
        if (e.data.error) { showToast(e.data.error, "error"); return; }
        const { translatedData, translatedHeaders } = e.data.data;
        activeSheetData = translatedData;
        activeHeaders = translatedHeaders;
        renderWorkspacePreview();
        showToast("Report translated to Hindi!", "success");

        const wsCard = document.getElementById('excel-workspace-card');
        if (wsCard) wsCard.style.display = 'block';
        const aiTab = document.querySelector('[data-target="tab-preview"]');
        if (aiTab) aiTab.click();
      }
    });
  });
}

/**
 * Email Report to Manager
 */
function initEmailManager() {
  const btn = document.getElementById('export-email-manager');
  const modal = document.getElementById('email-manager-modal');
  const closeBtn = document.getElementById('email-modal-close');
  const cancelBtn = document.getElementById('btn-email-cancel');
  const sendBtn = document.getElementById('btn-email-send');

  if (!btn || !modal) return;

  btn.addEventListener('click', () => {
    if (activeSheetData.length === 0) { showToast("Load data first.", "warning"); return; }
    modal.classList.add('active');
  });

  const closeModal = () => modal.classList.remove('active');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const email = document.getElementById('email-manager-addr').value.trim();
      const subject = document.getElementById('email-subject').value.trim() || 'ExcelAuto Report';
      const message = document.getElementById('email-message').value.trim() || 'Please find the report below.';

      if (!email || !email.includes('@')) {
        showToast("Enter a valid email address.", "warning");
        return;
      }

      let csvContent = activeHeaders.join(',') + '\n';
      activeSheetData.forEach(row => {
        const vals = activeHeaders.map(h => {
          const v = row[h] !== undefined ? String(row[h]) : '';
          return v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v;
        });
        csvContent += vals.join(',') + '\n';
      });

      const body = message + '\n\n--- Report Data (CSV) ---\n\n' + csvContent;
      const mailtoLink = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink, '_blank');

      closeModal();
      showToast("Email client opened with report data!", "success");
      logUserActivity(`Emailed report to ${email}`);
    });
  }
}

/**
 * Realtime Database live banner processing
 */
function initLiveFeeds() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      const banner = document.getElementById('live-progress-banner');
      const bannerText = document.getElementById('live-progress-text');

      if (rtdb && rtdb.ref) {
        rtdb.ref(`live_processing/${user.uid}`).on('value', (snapshot) => {
          const val = snapshot.val();
          if (val) {
            if (bannerText) bannerText.textContent = `Live Status: File ${val.fileName} is being processed - ${val.status}`;
            if (banner) banner.style.display = 'block';
          } else {
            if (banner) banner.style.display = 'none';
          }
        });
      }
    }
  });
}

