/* ==========================================================================
   EXCEL AUTO - ENTERPRISE FILE MANAGER v1.0
   Grid/List views, folder tree, drag-drop, search, favorites,
   trash, archive, version history, AI assistant, Firebase sync
   ========================================================================== */
'use strict';

(function() {
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let files = [];
  let currentFolder = '/';
  let currentView = 'grid';
  let currentNavView = 'all';
  let selectedFiles = new Set();
  let sortBy = 'date';
  let sortDir = 'desc';
  let searchQuery = '';
  let clipboard = null;
  let aiMessages = [];

  const MAX_STORAGE = 5 * 1024 * 1024 * 1024; // 5GB
  const TRASH_DAYS = 30;
  const STORAGE_KEY = 'excelAuto_files';
  const REPORT_KEY = 'excelAuto_reports';

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  const $ = (id) => document.getElementById(id);
  const esc = (s) => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';

  function uid() { return 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff/86400000) + 'd ago';
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year: d.getFullYear()!==now.getFullYear()?'numeric':undefined });
  }

  function getFileType(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (['xlsx','xls','xlsm'].includes(ext)) return 'excel';
    if (ext === 'csv') return 'csv';
    if (ext === 'pdf') return 'pdf';
    if (['png','jpg','jpeg','gif','svg','webp'].includes(ext)) return 'image';
    if (['json'].includes(ext)) return 'json';
    if (['doc','docx'].includes(ext)) return 'word';
    return 'other';
  }

  function getFileIcon(type) {
    const icons = { folder:'fa-folder', excel:'fa-file-excel', csv:'fa-file-csv', pdf:'fa-file-pdf', image:'fa-file-image', json:'fa-file-code', word:'fa-file-word', report:'fa-file-lines', other:'fa-file' };
    return icons[type] || 'fa-file';
  }

  function getFileIconClass(type) {
    const cls = { folder:'folder', excel:'excel', csv:'csv', pdf:'pdf', report:'report', other:'other' };
    return cls[type] || 'other';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════════════════════
  function loadFiles() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) files = JSON.parse(s);
      else files = [];
    } catch { files = []; }
  }

  function saveFiles() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(files)); } catch(e) {}
    updateStorageInfo();
    syncToDashboard();
  }

  function loadReports() {
    try {
      const s = localStorage.getItem(REPORT_KEY);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  }

  function saveReports(reports) {
    try { localStorage.setItem(REPORT_KEY, JSON.stringify(reports)); } catch(e) {}
  }

  function syncToDashboard() {
    try {
      const active = files.find(f => f.isActive && !f.isFolder);
      if (active) {
        const reports = loadReports();
        const report = reports.find(r => r.fileId === active.id);
        if (report) {
          localStorage.setItem('excelAuto_activeData', JSON.stringify({ data: report.data || [], headers: report.headers || [], fileName: active.name, timestamp: Date.now() }));
        }
      }
    } catch(e) {}
  }

  function updateStorageInfo() {
    const totalBytes = files.reduce((s, f) => s + (f.size || 0), 0);
    const pct = Math.min((totalBytes / MAX_STORAGE) * 100, 100);
    const fill = $('ws-storage-fill');
    const text = $('ws-storage-text');
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = formatSize(totalBytes) + ' / ' + formatSize(MAX_STORAGE);
    const allCount = $('ws-count-all');
    if (allCount) allCount.textContent = files.filter(f => !f.trashed && !f.archived).length;
    const favCount = $('ws-count-fav');
    if (favCount) favCount.textContent = files.filter(f => f.favorite && !f.trashed).length;
    const trashCount = $('ws-count-trash');
    if (trashCount) trashCount.textContent = files.filter(f => f.trashed).length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  function createFile(name, size, data, headers) {
    const file = {
      id: uid(), name, type: getFileType(name), size: size || 0,
      isFolder: false, parent: currentFolder, data: data || null,
      headers: headers || null, createdAt: Date.now(), modifiedAt: Date.now(),
      favorite: false, pinned: false, locked: false, shared: false,
      archived: false, trashed: false, deletedAt: null, tags: [],
      version: 1, versions: []
    };
    files.push(file);
    saveFiles();
    return file;
  }

  function createFolder(name) {
    const folder = {
      id: uid(), name, type: 'folder', size: 0,
      isFolder: true, parent: currentFolder, data: null, headers: null,
      createdAt: Date.now(), modifiedAt: Date.now(),
      favorite: false, pinned: false, locked: false, shared: false,
      archived: false, trashed: false, deletedAt: null, tags: [],
      version: 1, versions: []
    };
    files.push(folder);
    saveFiles();
    return folder;
  }

  function deleteFile(id) {
    const file = files.find(f => f.id === id);
    if (!file) return;
    if (file.trashed) {
      files = files.filter(f => f.id !== id);
    } else {
      file.trashed = true;
      file.deletedAt = Date.now();
    }
    saveFiles();
  }

  function restoreFile(id) {
    const file = files.find(f => f.id === id);
    if (file) { file.trashed = false; file.deletedAt = null; saveFiles(); }
  }

  function archiveFile(id) {
    const file = files.find(f => f.id === id);
    if (file) { file.archived = !file.archived; saveFiles(); }
  }

  function favoriteFile(id) {
    const file = files.find(f => f.id === id);
    if (file) { file.favorite = !file.favorite; saveFiles(); }
  }

  function pinFile(id) {
    const file = files.find(f => f.id === id);
    if (file) { file.pinned = !file.pinned; saveFiles(); }
  }

  function lockFile(id) {
    const file = files.find(f => f.id === id);
    if (file) { file.locked = !file.locked; saveFiles(); }
  }

  function renameFile(id, newName) {
    const file = files.find(f => f.id === id);
    if (file && newName.trim()) {
      file.name = newName.trim();
      file.modifiedAt = Date.now();
      if (file.type !== 'folder') file.type = getFileType(newName);
      saveFiles();
    }
  }

  function moveFile(id, newParent) {
    const file = files.find(f => f.id === id);
    if (file) { file.parent = newParent; file.modifiedAt = Date.now(); saveFiles(); }
  }

  function duplicateFile(id) {
    const orig = files.find(f => f.id === id);
    if (!orig) return;
    const dup = { ...orig, id: uid(), name: orig.name.replace(/(\.[^.]+)?$/, ' (copy)$1'),
      createdAt: Date.now(), modifiedAt: Date.now(), version: 1, versions: [] };
    files.push(dup);
    saveFiles();
    return dup;
  }

  function saveVersion(id) {
    const file = files.find(f => f.id === id);
    if (!file) return;
    file.versions = file.versions || [];
    file.versions.push({ timestamp: Date.now(), data: file.data, headers: file.headers, version: file.version });
    file.version++;
    file.modifiedAt = Date.now();
    saveFiles();
  }

  function restoreVersion(id, versionIndex) {
    const file = files.find(f => f.id === id);
    if (!file || !file.versions[versionIndex]) return;
    const v = file.versions[versionIndex];
    file.data = v.data;
    file.headers = v.headers;
    file.modifiedAt = Date.now();
    saveFiles();
  }

  function getVisibleFiles() {
    let list = files.filter(f => !f.trashed);
    if (currentNavView === 'favorites') list = files.filter(f => f.favorite && !f.trashed);
    else if (currentNavView === 'recent') list = files.filter(f => !f.trashed && !f.isFolder).sort((a,b) => b.modifiedAt - a.modifiedAt).slice(0, 20);
    else if (currentNavView === 'pinned') list = files.filter(f => f.pinned && !f.trashed);
    else if (currentNavView === 'shared') list = files.filter(f => f.shared && !f.trashed);
    else if (currentNavView === 'trash') list = files.filter(f => f.trashed);
    else if (currentNavView === 'archive') list = files.filter(f => f.archived && !f.trashed);
    else list = list.filter(f => f.parent === currentFolder);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(q) || (f.tags && f.tags.some(t => t.toLowerCase().includes(q))));
    }

    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'date') cmp = a.modifiedAt - b.modifiedAt;
      else if (sortBy === 'size') cmp = (a.size || 0) - (b.size || 0);
      else if (sortBy === 'type') cmp = a.type.localeCompare(b.type);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════════════
  function renderFiles() {
    const list = getVisibleFiles();
    const grid = $('ws-grid');
    const listBody = $('ws-list-body');
    const empty = $('ws-empty');
    const count = $('ws-area-count');
    const title = $('ws-area-title');

    const titles = { all:'All Files', recent:'Recent Files', favorites:'Favorites', shared:'Shared', pinned:'Pinned', trash:'Trash', archive:'Archive' };
    if (title) title.textContent = titles[currentNavView] || 'Files';
    if (count) count.textContent = list.length + ' item' + (list.length !== 1 ? 's' : '');

    if (list.length === 0) {
      if (grid) grid.innerHTML = '';
      if (listBody) listBody.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';

    // GRID
    if (grid) {
      grid.innerHTML = list.map(f => {
        const icon = f.isFolder ? 'fa-folder' : getFileIcon(f.type);
        const iconCls = f.isFolder ? 'folder' : getFileIconClass(f.type);
        const sel = selectedFiles.has(f.id) ? ' selected' : '';
        const pin = f.pinned ? '<span class="pin-indicator"><i class="fas fa-thumbtack"></i></span>' : '';
        const fav = f.favorite ? '<span class="fav-indicator"><i class="fas fa-heart"></i></span>' : '';
        const lock = f.locked ? ' <i class="fas fa-lock" style="font-size:0.6rem;color:var(--warning);"></i>' : '';
        return `<div class="ws-file-card${sel}" data-id="${f.id}" draggable="${!f.locked}">
          <div class="select-check"><i class="fas fa-check"></i></div>
          ${pin}${fav}
          <div class="file-icon ${iconCls}"><i class="fas ${icon}"></i></div>
          <div class="file-name">${esc(f.name)}${lock}</div>
          <div class="file-meta">${f.isFolder ? (files.filter(x => x.parent === f.id).length + ' items') : formatSize(f.size)}</div>
          <div class="file-actions"><button data-action="more" title="More"><i class="fas fa-ellipsis"></i></button></div>
        </div>`;
      }).join('');
    }

    // LIST
    if (listBody) {
      listBody.innerHTML = list.map(f => {
        const icon = f.isFolder ? 'fa-folder' : getFileIcon(f.type);
        const iconCls = f.isFolder ? 'folder' : getFileIconClass(f.type);
        const sel = selectedFiles.has(f.id) ? ' selected' : '';
        const pin = f.pinned ? '<span class="pin"><i class="fas fa-thumbtack"></i></span>' : '';
        const fav = f.favorite ? '<span class="fav"><i class="fas fa-heart"></i></span>' : '';
        return `<div class="ws-list-row${sel}" data-id="${f.id}" draggable="${!f.locked}">
          <div class="list-icon ${iconCls}"><i class="fas ${icon}"></i></div>
          <div class="list-name">${esc(f.name)}${pin}${fav}</div>
          <div class="list-meta">${f.isFolder ? '-' : formatSize(f.size)}</div>
          <div class="list-meta">${f.type}</div>
          <div class="list-meta">${formatDate(f.modifiedAt)}</div>
          <div class="list-actions">
            <button data-action="rename" title="Rename"><i class="fas fa-pen"></i></button>
            <button data-action="delete" title="Delete"><i class="fas fa-trash"></i></button>
            <button data-action="more" title="More"><i class="fas fa-ellipsis"></i></button>
          </div>
        </div>`;
      }).join('');
    }

    bindFileEvents();
  }

  function renderFolderTree() {
    const tree = $('ws-folder-tree');
    if (!tree) return;
    const rootFolders = files.filter(f => f.isFolder && f.parent === '/' && !f.trashed);
    tree.innerHTML = rootFolders.map(f => buildTreeNode(f, 0)).join('');
  }

  function buildTreeNode(folder, depth) {
    const children = files.filter(f => f.isFolder && f.parent === folder.id && !f.trashed);
    const hasChildren = children.length > 0;
    const isActive = currentFolder === folder.id;
    const indent = depth * 16;
    let html = `<div class="ws-tree-item${isActive ? ' active' : ''}" data-folder="${folder.id}" style="padding-left:${indent + 8}px;">
      ${hasChildren ? '<i class="fas fa-caret-right expand"></i>' : '<span style="width:14px;"></span>'}
      <i class="fas fa-folder" style="color:var(--warning);"></i>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(folder.name)}</span>
    </div>`;
    if (hasChildren) {
      html += `<div class="ws-tree-children${isActive ? ' open' : ''}" data-parent="${folder.id}">`;
      html += children.map(c => buildTreeNode(c, depth + 1)).join('');
      html += '</div>';
    }
    return html;
  }

  function renderBreadcrumb() {
    const bc = $('ws-breadcrumb');
    if (!bc) return;
    const parts = [];
    let path = currentFolder;
    while (path && path !== '/') {
      const folder = files.find(f => f.id === path);
      if (folder) { parts.unshift({ id: folder.id, name: folder.name }); path = folder.parent; }
      else break;
    }
    let html = `<span data-path="/">All Files</span>`;
    parts.forEach((p, i) => {
      html += `<span class="sep"><i class="fas fa-chevron-right"></i></span>`;
      html += i === parts.length - 1
        ? `<span class="current">${esc(p.name)}</span>`
        : `<span data-path="${p.id}">${esc(p.name)}</span>`;
    });
    bc.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT BINDING
  // ═══════════════════════════════════════════════════════════════════════════
  function bindFileEvents() {
    // Card/row click
    document.querySelectorAll('.ws-file-card, .ws-list-row').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.file-actions') || e.target.closest('.list-actions')) return;
        const id = el.dataset.id;
        const file = files.find(f => f.id === id);
        if (!file) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          if (selectedFiles.has(id)) selectedFiles.delete(id);
          else selectedFiles.add(id);
          el.classList.toggle('selected');
          updateBulkBar();
        } else if (file.isFolder) {
          navigateToFolder(file.id);
        } else if (file.type === 'report' || file.data) {
          openReport(file);
        }
      });

      el.addEventListener('dblclick', () => {
        const id = el.dataset.id;
        const file = files.find(f => f.id === id);
        if (file && !file.isFolder) openReport(file);
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, el.dataset.id);
      });

      // Drag start
      el.addEventListener('dragstart', (e) => {
        const id = el.dataset.id;
        e.dataTransfer.setData('text/plain', id);
        el.classList.add('dragging');
      });

      el.addEventListener('dragend', () => el.classList.remove('dragging'));

      // Drop target (folders only)
      if (el.classList.contains('ws-file-card')) {
        el.addEventListener('dragover', (e) => {
          const id = el.dataset.id;
          const file = files.find(f => f.id === id);
          if (file && file.isFolder) { e.preventDefault(); el.classList.add('drag-over'); }
        });
        el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
        el.addEventListener('drop', (e) => {
          e.preventDefault();
          el.classList.remove('drag-over');
          const dragId = e.dataTransfer.getData('text/plain');
          const targetId = el.dataset.id;
          if (dragId && targetId && dragId !== targetId) {
            const target = files.find(f => f.id === targetId);
            if (target && target.isFolder) { moveFile(dragId, targetId); renderFiles(); toast('File moved', 'success'); }
          }
        });
      }
    });

    // Card action buttons
    document.querySelectorAll('.ws-file-card .file-actions button, .ws-list-row .list-actions button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('.ws-file-card, .ws-list-row');
        if (row) showContextMenu(e, row.dataset.id);
      });
    });
  }

  function updateBulkBar() {
    const bar = $('ws-bulk-bar');
    const count = $('ws-selected-count');
    if (bar && count) {
      if (selectedFiles.size > 0) {
        bar.classList.add('show');
        count.textContent = selectedFiles.size + ' selected';
      } else {
        bar.classList.remove('show');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT MENU
  // ═══════════════════════════════════════════════════════════════════════════
  function showContextMenu(e, fileId) {
    const menu = $('ws-context-menu');
    if (!menu) return;
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    // Adjust menu items based on file type
    const openItem = menu.querySelector('[data-action="open"]');
    if (openItem) openItem.style.display = file.isFolder ? '' : 'none';

    menu.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 400) + 'px';
    menu.classList.add('show');
    menu.dataset.fileId = fileId;

    // Favorite label
    const favItem = menu.querySelector('[data-action="favorite"]');
    if (favItem) favItem.innerHTML = `<i class="fas fa-star"></i>${file.favorite ? 'Unfavorite' : 'Favorite'}`;

    // Pin label
    const pinItem = menu.querySelector('[data-action="pin"]');
    if (pinItem) pinItem.innerHTML = `<i class="fas fa-thumbtack"></i>${file.pinned ? 'Unpin' : 'Pin'}`;

    // Lock label
    const lockItem = menu.querySelector('[data-action="lock"]');
    if (lockItem) lockItem.innerHTML = `<i class="fas fa-${file.locked ? 'unlock' : 'lock'}"></i>${file.locked ? 'Unlock' : 'Lock'}`;

    // Archive/Restore
    const archiveItem = menu.querySelector('[data-action="archive"]');
    if (archiveItem) archiveItem.innerHTML = `<i class="fas fa-box-archive"></i>${file.trashed ? 'Restore' : (file.archived ? 'Unarchive' : 'Archive')}`;

    // Delete label
    const deleteItem = menu.querySelector('[data-action="delete"]');
    if (deleteItem) deleteItem.innerHTML = `<i class="fas fa-trash"></i>${file.trashed ? 'Delete Permanently' : 'Move to Trash'}`;
  }

  function handleContextAction(action) {
    const menu = $('ws-context-menu');
    const fileId = menu?.dataset.fileId;
    if (!fileId) return;
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    switch (action) {
      case 'open':
        if (file.isFolder) navigateToFolder(file.id);
        else openReport(file);
        break;
      case 'rename': showRenameModal(file); break;
      case 'duplicate': duplicateFile(file.id); renderFiles(); toast('File duplicated', 'success'); break;
      case 'move': showMoveModal(file); break;
      case 'copy': clipboard = { action: 'copy', ids: [file.id] }; toast('Copied to clipboard', 'info'); break;
      case 'favorite': favoriteFile(file.id); renderFiles(); break;
      case 'pin': pinFile(file.id); renderFiles(); break;
      case 'lock': lockFile(file.id); renderFiles(); break;
      case 'download': downloadFile(file); break;
      case 'archive':
        if (file.trashed) { restoreFile(file.id); toast('File restored', 'success'); }
        else archiveFile(file.id);
        renderFiles();
        break;
      case 'share': shareFile(file); break;
      case 'delete':
        if (file.trashed) {
          if (confirm('Delete "' + file.name + '" permanently?')) { deleteFile(file.id); toast('File deleted permanently', 'success'); }
        } else { deleteFile(file.id); toast('Moved to trash', 'success'); }
        renderFiles();
        break;
    }
    menu.classList.remove('show');
  }

  function downloadFile(file) {
    if (!file.data) { toast('No data to download', 'error'); return; }
    try {
      const ws = XLSX.utils.json_to_sheet(file.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, file.name);
      toast('Downloaded ' + file.name, 'success');
    } catch(e) { toast('Download failed: ' + e.message, 'error'); }
  }

  function shareFile(file) {
    file.shared = !file.shared;
    saveFiles();
    toast(file.shared ? 'File shared' : 'Share removed', 'success');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════
  function showModal(title, body, footer) {
    const overlay = $('ws-modal-overlay');
    const titleEl = $('ws-modal-title');
    const bodyEl = $('ws-modal-body');
    const footerEl = $('ws-modal-footer');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = body;
    if (footerEl) footerEl.innerHTML = footer;
    if (overlay) overlay.classList.add('show');
  }

  function hideModal() {
    const overlay = $('ws-modal-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  function showRenameModal(file) {
    showModal('Rename', `<label>New name</label><input type="text" id="ws-rename-input" value="${esc(file.name)}">`,
      `<button class="ws-btn" onclick="document.getElementById('ws-modal-overlay').classList.remove('show')">Cancel</button>
       <button class="ws-btn primary" id="ws-rename-confirm">Rename</button>`);
    setTimeout(() => {
      const input = $('ws-rename-input');
      const btn = $('ws-rename-confirm');
      if (input) { input.focus(); input.select(); }
      if (btn) btn.addEventListener('click', () => { renameFile(file.id, input.value); hideModal(); renderFiles(); renderFolderTree(); toast('Renamed', 'success'); });
      if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
    }, 50);
  }

  function showMoveModal(file) {
    const folders = files.filter(f => f.isFolder && !f.trashed && f.id !== file.id);
    const options = folders.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
    showModal('Move "' + esc(file.name) + '"', `<label>Destination folder</label><select id="ws-move-dest"><option value="/">/ (Root)</option>${options}</select>`,
      `<button class="ws-btn" onclick="document.getElementById('ws-modal-overlay').classList.remove('show')">Cancel</button>
       <button class="ws-btn primary" id="ws-move-confirm">Move</button>`);
    setTimeout(() => {
      const btn = $('ws-move-confirm');
      if (btn) btn.addEventListener('click', () => { moveFile(file.id, $('ws-move-dest').value); hideModal(); renderFiles(); toast('File moved', 'success'); });
    }, 50);
  }

  function showNewFolderModal() {
    showModal('New Folder', `<label>Folder name</label><input type="text" id="ws-folder-name-input" placeholder="My Folder">`,
      `<button class="ws-btn" onclick="document.getElementById('ws-modal-overlay').classList.remove('show')">Cancel</button>
       <button class="ws-btn primary" id="ws-folder-create">Create</button>`);
    setTimeout(() => {
      const input = $('ws-folder-name-input');
      const btn = $('ws-folder-create');
      if (input) input.focus();
      if (btn) btn.addEventListener('click', () => { if (input.value.trim()) { createFolder(input.value.trim()); hideModal(); renderFiles(); renderFolderTree(); toast('Folder created', 'success'); } });
      if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
    }, 50);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════
  function navigateToFolder(folderId) {
    currentFolder = folderId;
    currentNavView = 'all';
    selectedFiles.clear();
    updateBulkBar();
    renderFiles();
    renderBreadcrumb();
    renderFolderTree();
    updateNavActive();
  }

  function updateNavActive() {
    document.querySelectorAll('.ws-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === currentNavView);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════
  async function handleFileUpload(fileList) {
    const panel = $('ws-upload-panel');
    const list = $('ws-upload-list');
    if (!panel || !list) return;

    panel.classList.add('show');
    list.innerHTML = '';

    for (const file of fileList) {
      const itemId = 'up_' + uid();
      list.innerHTML += `<div class="ws-upload-item" id="${itemId}">
        <i class="fas fa-file" style="color:var(--text-muted);"></i>
        <span class="upload-name">${esc(file.name)}</span>
        <div class="upload-bar"><div class="fill" style="width:0%"></div></div>
        <span class="upload-status">Uploading...</span>
      </div>`;

      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        const headers = data.length > 0 ? Object.keys(data[0]) : [];

        createFile(file.name, file.size, data, headers);

        const el = document.getElementById(itemId);
        if (el) {
          el.querySelector('.fill').style.width = '100%';
          el.querySelector('.upload-status').textContent = 'Done';
          el.querySelector('.upload-status').classList.add('done');
        }
      } catch(e) {
        const el = document.getElementById(itemId);
        if (el) {
          el.querySelector('.upload-status').textContent = 'Failed: ' + e.message;
          el.querySelector('.upload-status').classList.add('error');
        }
      }
    }

    renderFiles();
    renderFolderTree();
    setTimeout(() => { panel.classList.remove('show'); }, 2000);
    toast(fileList.length + ' file(s) uploaded', 'success');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT OPENING
  // ═══════════════════════════════════════════════════════════════════════════
  function openReport(file) {
    if (!file || file.isFolder) return;
    file.isActive = true;
    files.forEach(f => { if (f.id !== file.id) f.isActive = false; });
    saveFiles();

    // Load report data into localStorage for report studio
    if (file.data) {
      localStorage.setItem('excelAuto_activeData', JSON.stringify({ data: file.data, headers: file.headers || Object.keys(file.data[0] || {}), fileName: file.name, timestamp: Date.now() }));
    }

    // Switch to report studio view
    $('ws-file-manager').style.display = 'none';
    $('ws-report-studio').classList.add('active');
    $('ws-report-studio').style.display = 'flex';

    // Trigger report studio to load
    if (window.ReportStudio) window.ReportStudio.loadReport(file);
  }

  function closeReportStudio() {
    $('ws-file-manager').style.display = 'flex';
    $('ws-report-studio').classList.remove('active');
    $('ws-report-studio').style.display = 'none';
    renderFiles();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI FILE ASSISTANT
  // ═══════════════════════════════════════════════════════════════════════════
  function handleAICommand(text) {
    const lower = text.toLowerCase();
    addAIMessage(text, 'user');

    // Create folder
    if (lower.includes('create') && lower.includes('folder')) {
      const nameMatch = text.match(/(?:folder|folders?)\s+(?:for\s+)?["']?([^"']+?)["']?\s*$/i);
      const name = nameMatch ? nameMatch[1].trim() : 'New Folder';
      if (lower.includes('for')) {
        const parts = name.split(/\s+and\s+|\s*,\s*/);
        parts.forEach(p => createFolder(p.trim()));
        addAIMessage(`Created ${parts.length} folder(s): ${parts.map(p => esc(p.trim())).join(', ')}`, 'bot');
      } else {
        createFolder(name);
        addAIMessage(`Created folder "<strong>${esc(name)}</strong>"`, 'bot');
      }
      renderFiles(); renderFolderTree();
      return;
    }

    // Delete duplicates
    if (lower.includes('delete') && lower.includes('duplicate')) {
      const names = new Map();
      let deleted = 0;
      files.filter(f => !f.isFolder && !f.trashed).forEach(f => {
        const base = f.name.replace(/\s*\(copy\)\s*/i, '').toLowerCase();
        if (names.has(base)) { deleteFile(f.id); deleted++; }
        else names.set(base, true);
      });
      addAIMessage(`Deleted <strong>${deleted}</strong> duplicate file(s)`, 'bot');
      renderFiles();
      return;
    }

    // Show largest files
    if (lower.includes('largest') || lower.includes('biggest')) {
      const largest = files.filter(f => !f.isFolder && !f.trashed).sort((a,b) => b.size - a.size).slice(0, 5);
      if (largest.length === 0) { addAIMessage('No files found', 'bot'); return; }
      const html = largest.map((f,i) => `${i+1}. <strong>${esc(f.name)}</strong> — ${formatSize(f.size)}`).join('<br>');
      addAIMessage(`<strong>Top 5 Largest Files:</strong><br>${html}`, 'bot');
      return;
    }

    // Archive old reports
    if (lower.includes('archive') && lower.includes('old')) {
      const threshold = Date.now() - 30 * 86400000;
      let count = 0;
      files.filter(f => !f.isFolder && !f.trashed && !f.archived && f.modifiedAt < threshold).forEach(f => { archiveFile(f.id); count++; });
      addAIMessage(`Archived <strong>${count}</strong> old file(s) (older than 30 days)`, 'bot');
      renderFiles();
      return;
    }

    // Show missing data / empty files
    if (lower.includes('missing') || lower.includes('empty')) {
      const empty = files.filter(f => !f.isFolder && !f.trashed && (!f.data || f.data.length === 0));
      if (empty.length === 0) { addAIMessage('All files have data', 'bot'); return; }
      const html = empty.map(f => `• <strong>${esc(f.name)}</strong>`).join('<br>');
      addAIMessage(`<strong>Files with missing data:</strong><br>${html}`, 'bot');
      return;
    }

    // Search
    if (lower.startsWith('find') || lower.startsWith('search')) {
      const query = text.replace(/^(?:find|search)\s+/i, '').trim();
      searchQuery = query;
      $('ws-search-input').value = query;
      renderFiles();
      addAIMessage(`Showing results for "<strong>${esc(query)}</strong>"`, 'bot');
      return;
    }

    // List all files
    if (lower.includes('show') && lower.includes('file')) {
      const all = files.filter(f => !f.isFolder && !f.trashed);
      if (all.length === 0) { addAIMessage('No files found', 'bot'); return; }
      const html = all.slice(0, 10).map(f => `• <strong>${esc(f.name)}</strong> (${formatSize(f.size)})`).join('<br>');
      addAIMessage(`<strong>All Files (${all.length}):</strong><br>${html}${all.length > 10 ? '<br>...and ' + (all.length - 10) + ' more' : ''}`, 'bot');
      return;
    }

    // Trash all
    if (lower.includes('trash') && lower.includes('all')) {
      let count = 0;
      files.filter(f => !f.trashed && !f.isFolder).forEach(f => { deleteFile(f.id); count++; });
      addAIMessage(`Moved <strong>${count}</strong> file(s) to trash`, 'bot');
      renderFiles();
      return;
    }

    // Restore all trash
    if (lower.includes('restore') && lower.includes('trash')) {
      let count = 0;
      files.filter(f => f.trashed).forEach(f => { restoreFile(f.id); count++; });
      addAIMessage(`Restored <strong>${count}</strong> file(s) from trash`, 'bot');
      renderFiles();
      return;
    }

    // Help
    if (lower.includes('help') || lower === '?') {
      addAIMessage(`<strong>AI File Assistant Commands:</strong><br>
        • Create folder for [name]<br>
        • Delete duplicate files<br>
        • Show largest files<br>
        • Archive old reports<br>
        • Find [search term]<br>
        • Show all files<br>
        • Trash all files<br>
        • Restore trash`, 'bot');
      return;
    }

    addAIMessage(`I can help with file management. Try: "Create folder for invoices", "Show largest files", "Delete duplicates"`, 'bot');
  }

  function addAIMessage(text, type) {
    aiMessages.push({ text, type, time: Date.now() });
    const container = $('ws-ai-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ai-msg ' + type;
    div.innerHTML = type === 'user' ? esc(text) : text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════════════════════
  function toast(msg, type = 'info') {
    const t = $('ws-toast');
    if (!t) return;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${esc(msg)}`;
    t.className = 'ws-toast show ' + type;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════
  function init() {
    loadFiles();
    renderFiles();
    renderFolderTree();
    renderBreadcrumb();
    updateStorageInfo();

    // Nav items
    document.querySelectorAll('.ws-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        currentNavView = item.dataset.view;
        currentFolder = '/';
        selectedFiles.clear();
        updateBulkBar();
        renderFiles();
        renderBreadcrumb();
        updateNavActive();
      });
    });

    // View toggle
    document.querySelectorAll('.ws-view-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        currentView = btn.dataset.view;
        document.querySelectorAll('.ws-view-toggle button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const grid = $('ws-grid');
        const list = $('ws-list');
        if (currentView === 'grid') { grid.classList.remove('hidden'); list.classList.remove('active'); }
        else { grid.classList.add('hidden'); list.classList.add('active'); }
      });
    });

    // Search
    const searchInput = $('ws-search-input');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { searchQuery = searchInput.value; renderFiles(); }, 200);
      });
    }

    // Sort button
    const sortBtn = $('ws-sort-btn');
    const sortMenu = $('ws-sort-menu');
    if (sortBtn && sortMenu) {
      sortBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortMenu.style.left = sortBtn.getBoundingClientRect().left + 'px';
        sortMenu.style.top = sortBtn.getBoundingClientRect().bottom + 4 + 'px';
        sortMenu.classList.toggle('show');
      });
    }
    document.querySelectorAll('#ws-sort-menu .ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        sortBy = item.dataset.sort;
        sortMenu.classList.remove('show');
        renderFiles();
      });
    });

    // Upload buttons
    const fileInput = $('ws-file-input');
    ['ws-upload-btn', 'ws-upload-main-btn'].forEach(id => {
      const btn = $(id);
      if (btn) btn.addEventListener('click', () => fileInput?.click());
    });
    if (fileInput) fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileUpload(e.target.files); e.target.value = ''; });

    // New folder
    const newFolderBtn = $('ws-new-folder-btn');
    if (newFolderBtn) newFolderBtn.addEventListener('click', showNewFolderModal);

    // Context menu actions
    document.querySelectorAll('#ws-context-menu .ctx-item').forEach(item => {
      item.addEventListener('click', () => handleContextAction(item.dataset.action));
    });

    // Close context menus on click outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.ws-context-menu.show').forEach(m => m.classList.remove('show'));
    });

    // Breadcrumb navigation
    const bc = $('ws-breadcrumb');
    if (bc) bc.addEventListener('click', (e) => {
      const span = e.target.closest('[data-path]');
      if (span) navigateToFolder(span.dataset.path);
    });

    // Folder tree navigation
    const tree = $('ws-folder-tree');
    if (tree) tree.addEventListener('click', (e) => {
      const item = e.target.closest('.ws-tree-item');
      if (item) {
        const folderId = item.dataset.folder;
        navigateToFolder(folderId);
      }
    });

    // Bulk actions
    $('ws-bulk-clear')?.addEventListener('click', () => { selectedFiles.clear(); updateBulkBar(); renderFiles(); });
    $('ws-bulk-delete')?.addEventListener('click', () => {
      if (confirm(`Delete ${selectedFiles.size} file(s)?`)) {
        selectedFiles.forEach(id => deleteFile(id));
        selectedFiles.clear();
        updateBulkBar();
        renderFiles();
        toast('Files deleted', 'success');
      }
    });
    $('ws-bulk-favorite')?.addEventListener('click', () => {
      selectedFiles.forEach(id => favoriteFile(id));
      selectedFiles.clear();
      updateBulkBar();
      renderFiles();
      toast('Files favorited', 'success');
    });
    $('ws-bulk-move')?.addEventListener('click', () => {
      if (selectedFiles.size === 1) {
        const file = files.find(f => f.id === [...selectedFiles][0]);
        if (file) showMoveModal(file);
      }
    });

    // Drag and drop on file area
    const fileArea = $('ws-file-area');
    const dropzone = $('ws-dropzone');
    if (fileArea && dropzone) {
      let dragCounter = 0;
      document.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; dropzone.classList.add('show'); });
      document.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; dropzone.classList.remove('show'); } });
      document.addEventListener('dragover', (e) => e.preventDefault());
      document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropzone.classList.remove('show');
        if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
      });
    }

    // Close modal
    $('ws-modal-close')?.addEventListener('click', hideModal);
    $('ws-modal-overlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) hideModal(); });

    // Report back button
    $('ws-report-back')?.addEventListener('click', closeReportStudio);

    // AI panel
    $('ws-ai-toggle')?.addEventListener('click', () => $('ws-ai-panel')?.classList.toggle('show'));
    $('ws-ai-send')?.addEventListener('click', () => {
      const input = $('ws-ai-input');
      if (input?.value.trim()) { handleAICommand(input.value.trim()); input.value = ''; }
    });
    $('ws-ai-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('ws-ai-send')?.click();
    });

    // Upload close
    $('ws-upload-close')?.addEventListener('click', () => $('ws-upload-panel')?.classList.remove('show'));

    // Versions panel
    $('ws-report-versions')?.addEventListener('click', () => $('ws-versions-panel')?.classList.toggle('show'));
    $('ws-versions-close')?.addEventListener('click', () => $('ws-versions-panel')?.classList.remove('show'));

    // Mobile menu toggle
    const menuToggle = $('ws-menu-toggle');
    if (menuToggle && window.innerWidth <= 900) {
      menuToggle.style.display = '';
      menuToggle.addEventListener('click', () => document.querySelector('.ws-sidebar')?.classList.toggle('open'));
    }
    window.addEventListener('resize', () => {
      if (menuToggle) menuToggle.style.display = window.innerWidth <= 900 ? '' : 'none';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input,textarea,[contenteditable]')) return;
      if (e.key === 'Delete' && selectedFiles.size > 0) {
        $('ws-bulk-delete')?.click();
      }
      if (e.key === 'F2' && selectedFiles.size === 1) {
        const file = files.find(f => f.id === [...selectedFiles][0]);
        if (file) showRenameModal(file);
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        getVisibleFiles().forEach(f => selectedFiles.add(f.id));
        renderFiles();
        updateBulkBar();
      }
      if (e.key === 'Escape') {
        selectedFiles.clear();
        updateBulkBar();
        renderFiles();
        document.querySelectorAll('.ws-context-menu.show').forEach(m => m.classList.remove('show'));
        hideModal();
      }
    });

    // Paste handler
    document.addEventListener('paste', (e) => {
      if (clipboard && clipboard.ids) {
        clipboard.ids.forEach(id => {
          const dup = duplicateFile(id);
          if (dup) moveFile(dup.id, currentFolder);
        });
        clipboard = null;
        renderFiles();
        toast('Pasted', 'success');
      }
    });

    // Expose for Report Studio
    window.FileManager = {
      openReport, closeReportStudio, files, getFiles: () => files,
      createFile, saveFiles, renderFiles, toast
    };
  }

  // Start
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
