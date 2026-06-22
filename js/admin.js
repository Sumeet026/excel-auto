/* ==========================================================================
   EXCEL AUTO - ADMIN BOARD CONTROLLER (admin.js)
   • Realtime snapshot listeners for all collections
   • Virtual scrolling on administrative tables
   • Optimistic UI updates
   • Clean, non-blocking filtering
   ========================================================================== */

let adminUsersList = [];
let adminFilesList = [];
let adminReportsList = [];
let adminLogsList = [];

let usersUnsubscribe = null;
let filesUnsubscribe = null;
let reportsUnsubscribe = null;
let logsUnsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
  initAdminGuard();
  initAdminTabs();
  initSearchFilters();
});

/**
 * Route guard: verify admin access bounds
 */
function initAdminGuard() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      let isAdmin = false;
      if (user.email === 'admin@excelauto.com' || localStorage.getItem(`is_admin_${user.uid}`) === 'true') {
        isAdmin = true;
      } else {
        try {
          const doc = await db.collection('users').doc(user.uid).get();
          if (doc.exists && doc.data().role === 'admin') {
            isAdmin = true;
          }
        } catch (e) {
          console.error("Auth check fail:", e);
        }
      }
      
      if (!isAdmin) {
        showToast("Access Denied. Redirecting to dashboard...", "error");
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1200);
      } else {
        initRealtimeStreams();
      }
    }
  });
}

/**
 * Switch tabs in Admin board
 */
function initAdminTabs() {
  const tabs = document.querySelectorAll('.workspace-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const target = tab.dataset.target;
      const sections = document.querySelectorAll('.workspace-section');
      sections.forEach(s => s.classList.remove('active'));
      
      const targetEl = document.getElementById(target);
      if (targetEl) targetEl.classList.add('active');
    });
  });
}

/**
 * Initialize all realtime stream listeners
 */
function initRealtimeStreams() {
  // 1. Users Stream
  usersUnsubscribe = db.collection('users').onSnapshot(snap => {
    adminUsersList = [];
    snap.forEach(doc => adminUsersList.push(doc.data()));
    renderUsersTable(adminUsersList);
  }, err => {
    console.error("Users stream error:", err);
  });
  
  // 2. Files Stream
  filesUnsubscribe = db.collection('files').onSnapshot(snap => {
    adminFilesList = [];
    snap.forEach(doc => adminFilesList.push(doc.data()));
    renderFilesTable(adminFilesList);
  }, err => {
    console.error("Files stream error:", err);
  });
  
  // 3. Reports Stream
  reportsUnsubscribe = db.collection('reports').onSnapshot(snap => {
    adminReportsList = [];
    snap.forEach(doc => adminReportsList.push(doc.data()));
    renderReportsTable(adminReportsList);
  }, err => {
    console.error("Reports stream error:", err);
  });
  
  // 4. Logs Stream
  logsUnsubscribe = db.collection('activities').orderBy('createdAt', 'desc').onSnapshot(snap => {
    adminLogsList = [];
    snap.forEach(doc => adminLogsList.push(doc.data()));
    renderLogsTable(adminLogsList);
  }, err => {
    console.error("Logs stream error:", err);
  });
}

/**
 * Table renderers using virtual scroll
 */
function renderUsersTable(list) {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">No users found.</td></tr>`;
    return;
  }
  
  window.renderInChunks(list, (usr) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; font-size: 0.8rem; width: 15%;">${usr.id ? usr.id.substring(0, 8) : ''}...</td>
      <td style="width: 25%;"><strong>${escapeHtml(usr.name || 'Anonymous')}</strong></td>
      <td style="width: 25%;">${escapeHtml(usr.email || '')}</td>
      <td style="width: 15%;"><span class="status-pill ${usr.role === 'admin' ? 'info' : 'warning'}" style="padding: 2px 8px; font-size: 0.7rem;">${(usr.role || 'user').toUpperCase()}</span></td>
      <td style="width: 10%;"><span class="status-pill ${usr.status === 'active' ? 'success' : 'danger'}" style="padding: 2px 8px; font-size: 0.7rem;">${usr.status || 'active'}</span></td>
      <td style="width: 10%;">
        <button class="btn btn-danger delete-usr-btn" data-id="${usr.id}" style="padding: 4px 10px; font-size: 0.75rem;" ${usr.email === 'admin@excelauto.com' ? 'disabled' : ''}>
          Delete
        </button>
      </td>
    `;
    
    const deleteBtn = tr.querySelector('.delete-usr-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => handleDeleteUser(usr.id, usr.name));
    }
    return tr;
  }, tbody, 30);
}

function renderFilesTable(list) {
  const tbody = document.getElementById('admin-files-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">No files found.</td></tr>`;
    return;
  }
  
  window.renderInChunks(list, (file) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; font-size: 0.8rem; width: 15%;">${file.id ? file.id.substring(0, 8) : ''}...</td>
      <td style="width: 30%;"><a href="${file.url}" target="_blank" style="color: var(--primary); text-decoration: underline;"><i class="fas fa-file-excel"></i> ${escapeHtml(file.name)}</a></td>
      <td style="width: 15%;">${formatBytes(file.size)}</td>
      <td style="font-family: monospace; font-size: 0.8rem; width: 15%;">${file.createdBy ? file.createdBy.substring(0, 8) : ''}...</td>
      <td style="width: 15%;">${new Date(file.createdAt).toLocaleDateString()}</td>
      <td style="width: 10%;"><span class="status-pill ${file.status === 'active' ? 'success' : 'danger'}" style="padding: 2px 8px; font-size: 0.7rem;">${file.status}</span></td>
      <td style="width: 10%;"><button class="btn btn-danger delete-file-btn" data-id="${file.id}" data-path="${file.storagePath}" style="padding: 4px 10px; font-size: 0.75rem;">Delete</button></td>
    `;
    const deleteBtn = tr.querySelector('.delete-file-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => handleDeleteFile(file.id, file.name, file.storagePath));
    }
    const fileLink = tr.querySelector('a');
    if (fileLink && window.isFirebaseMocked) {
      fileLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.downloadSandboxFile(file.storagePath, file.name);
      });
    }
    return tr;
  }, tbody, 30);
}

function renderReportsTable(list) {
  const tbody = document.getElementById('admin-reports-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">No reports compiled yet.</td></tr>`;
    return;
  }
  
  window.renderInChunks(list, (rep) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; font-size: 0.8rem; width: 15%;">${rep.id ? rep.id.substring(0, 8) : ''}...</td>
      <td style="width: 30%;"><strong>${escapeHtml(rep.name || rep.title || 'Custom Report')}</strong></td>
      <td style="width: 15%;"><span class="status-pill info" style="padding: 2px 8px; font-size: 0.7rem;">${(rep.type || 'pdf').toUpperCase()}</span></td>
      <td style="font-family: monospace; font-size: 0.8rem; width: 15%;">${rep.createdBy ? rep.createdBy.substring(0, 8) : ''}...</td>
      <td style="width: 15%;">${new Date(rep.createdAt).toLocaleDateString()}</td>
      <td style="width: 10%;"><span class="status-pill success" style="padding: 2px 8px; font-size: 0.7rem;">active</span></td>
    `;
    return tr;
  }, tbody, 30);
}

function renderLogsTable(list) {
  const tbody = document.getElementById('admin-logs-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">No activity logs found.</td></tr>`;
    return;
  }
  
  window.renderInChunks(list, (log) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; font-size: 0.8rem; width: 20%;">${log.id || 'N/A'}</td>
      <td style="width: 20%;">${new Date(log.createdAt).toLocaleString()}</td>
      <td style="font-family: monospace; font-size: 0.8rem; width: 20%;">${log.createdBy ? log.createdBy.substring(0, 8) : ''}...</td>
      <td style="width: 40%;"><strong>${log.action || ''}</strong></td>
    `;
    return tr;
  }, tbody, 30);
}

/**
 * Handle Delete user request (Soft delete and block user access)
 */
async function handleDeleteUser(userId, name) {
  if (!confirm(`Are you sure you want to delete user ${name}? This action marks their account as deleted.`)) return;
  
  const originalList = [...adminUsersList];
  adminUsersList = adminUsersList.map(u => u.id === userId ? { ...u, status: 'deleted' } : u);
  renderUsersTable(adminUsersList);
  
  await window.optimisticUpdate(async () => {
    try {
      await db.collection('users').doc(userId).update({
        status: 'deleted',
        updatedAt: new Date().toISOString()
      });
      showToast(`User ${name} marked deleted.`, "warning");
      await logUserActivity(`Deleted user account: ${name} (${userId})`);
    } catch (err) {
      adminUsersList = originalList;
      renderUsersTable(adminUsersList);
      throw err;
    }
  });
}

/**
 * Handle Delete file request
 */
async function handleDeleteFile(fileId, name, storagePath) {
  if (!confirm(`Are you sure you want to delete file ${name}?`)) return;
  
  const originalList = [...adminFilesList];
  adminFilesList = adminFilesList.filter(f => f.id !== fileId);
  renderFilesTable(adminFilesList);
  
  await window.optimisticUpdate(async () => {
    try {
      if (storagePath && window.storage && typeof window.storage.ref === 'function') {
        try {
          await window.storage.ref(storagePath).delete();
        } catch (e) {
          console.warn('Storage delete error (ignored):', e);
        }
      }

      const fileDoc = originalList.find(f => f.id === fileId);
      const ownerUid = fileDoc ? fileDoc.createdBy : null;

      await db.collection('files').doc(fileId).update({
        status: 'deleted',
        updatedAt: new Date().toISOString()
      });
      
      if (ownerUid && rtdb && rtdb.ref) {
        await rtdb.ref(`files/${ownerUid}/${fileId}`).remove();
      }
      
      showToast(`File ${name} deleted successfully.`, "warning");
      await logUserActivity(`Deleted file: ${name} via admin panel`);
    } catch (err) {
      adminFilesList = originalList;
      renderFilesTable(adminFilesList);
      throw err;
    }
  });
}

/**
 * Setup live filters across search bars
 */
function initSearchFilters() {
  // Users Search
  const searchUsers = document.getElementById('admin-search-users');
  if (searchUsers) {
    searchUsers.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = adminUsersList.filter(u => 
        (u.name || '').toLowerCase().includes(query) || 
        (u.email || '').toLowerCase().includes(query)
      );
      renderUsersTable(filtered);
    });
  }

  // Files Search
  const searchFiles = document.getElementById('admin-search-files');
  if (searchFiles) {
    searchFiles.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = adminFilesList.filter(f => (f.name || '').toLowerCase().includes(query));
      renderFilesTable(filtered);
    });
  }

  // Reports Search
  const searchReports = document.getElementById('admin-search-reports');
  if (searchReports) {
    searchReports.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = adminReportsList.filter(r => 
        (r.name || r.title || '').toLowerCase().includes(query)
      );
      renderReportsTable(filtered);
    });
  }

  // Logs Search
  const searchLogs = document.getElementById('admin-search-logs');
  if (searchLogs) {
    searchLogs.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = adminLogsList.filter(l => 
        (l.action || '').toLowerCase().includes(query) || 
        (l.createdBy || '').toLowerCase().includes(query)
      );
      renderLogsTable(filtered);
    });
  }
  
  // Clear Logs
  const clearBtn = document.getElementById('admin-btn-clear-logs');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm("Clear all global activity logs? This clears data across the dashboard too.")) return;
      
      try {
        const snap = await db.collection('activities').get();
        const batch = db.batch();
        
        snap.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        if (rtdb && rtdb.ref) {
          await rtdb.ref('activities').remove();
          await rtdb.ref('live_feed').remove();
        }
        
        showToast("Activity logs purged.", "warning");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
}
