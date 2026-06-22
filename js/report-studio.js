/* ==========================================================================
   EXCEL AUTO - REPORT STUDIO v1.0
   Inline live report editor with drag-drop sections, auto-save,
   version history, Firebase sync, export
   ========================================================================== */
'use strict';

const ReportStudio = (function() {
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let currentFile = null;
  let reportData = { title: '', sections: [] };
  let autoSaveTimer = null;
  let saveStatus = 'saved';
  let charts = {};
  let dragSrcIndex = null;

  const REPORT_KEY = 'excelAuto_reports';
  const SAVE_DEBOUNCE = 800;

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  const $ = (id) => document.getElementById(id);
  const esc = (s) => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
  const uid = () => 'sec_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD / SAVE
  // ═══════════════════════════════════════════════════════════════════════════
  function loadReports() {
    try { return JSON.parse(localStorage.getItem(REPORT_KEY) || '[]'); }
    catch { return []; }
  }

  function saveReports(reports) {
    try { localStorage.setItem(REPORT_KEY, JSON.stringify(reports)); } catch(e) {}
  }

  function loadReport(file) {
    currentFile = file;
    const reports = loadReports();
    let report = reports.find(r => r.fileId === file.id);

    if (!report) {
      report = generateAutoReport(file);
      reports.push(report);
      saveReports(reports);
    }

    reportData = { title: report.title || file.name.replace(/\.[^.]+$/, ''), sections: report.sections || [] };
    renderReport();
    updateSaveStatus('saved');
    $('ws-report-title').value = reportData.title;
  }

  function autoSave() {
    if (!currentFile) return;
    setSaveStatus('saving');
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      const reports = loadReports();
      const idx = reports.findIndex(r => r.fileId === currentFile.id);
      const report = {
        fileId: currentFile.id,
        title: reportData.title,
        sections: reportData.sections,
        data: currentFile.data,
        headers: currentFile.headers,
        modifiedAt: Date.now()
      };
      if (idx >= 0) reports[idx] = report;
      else reports.push(report);
      saveReports(reports);

      // Save version periodically
      if (currentFile.version && (!currentFile.versions || currentFile.versions.length === 0 || Date.now() - (currentFile.versions[currentFile.versions.length-1]?.timestamp || 0) > 60000)) {
        if (window.FileManager) {
          window.FileManager.files.forEach(f => {
            if (f.id === currentFile.id) {
              f.versions = f.versions || [];
              f.versions.push({ timestamp: Date.now(), data: reportData.sections, version: f.version });
              f.version++;
              f.modifiedAt = Date.now();
            }
          });
          window.FileManager.saveFiles();
        }
      }

      setSaveStatus('saved');
    }, SAVE_DEBOUNCE);
  }

  function setSaveStatus(status) {
    saveStatus = status;
    const el = $('ws-save-status');
    if (!el) return;
    const dot = el.querySelector('.dot');
    if (status === 'saving') {
      el.innerHTML = '<span class="dot saving"></span> Saving...';
    } else {
      el.innerHTML = '<span class="dot"></span> Saved';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-GENERATE REPORT FROM DATA
  // ═══════════════════════════════════════════════════════════════════════════
  function generateAutoReport(file) {
    const data = file.data || [];
    const headers = file.headers || (data.length > 0 ? Object.keys(data[0]) : []);
    const sections = [];

    // Title
    sections.push({ id: uid(), type: 'title', content: { text: file.name.replace(/\.[^.]+$/, ''), subtitle: 'Auto-generated report' } });

    // KPIs
    if (data.length > 0 && headers.length > 0) {
      const numCols = headers.filter(h => data.some(r => !isNaN(parseFloat(r[h])) && r[h] !== ''));
      if (numCols.length > 0) {
        const kpis = numCols.slice(0, 4).map(h => {
          const vals = data.map(r => parseFloat(r[h])).filter(v => !isNaN(v));
          const sum = vals.reduce((a,b) => a+b, 0);
          const avg = vals.length ? sum / vals.length : 0;
          return { value: formatNum(sum), label: h, color: 'var(--primary)' };
        });
        sections.push({ id: uid(), type: 'kpi', content: { items: kpis } });
      }
    }

    // Data Table
    if (data.length > 0) {
      sections.push({ id: uid(), type: 'table', content: { headers: headers.slice(0, 8), rows: data.slice(0, 20).map(r => headers.slice(0, 8).map(h => String(r[h] ?? ''))) } });
    }

    // AI Insight
    if (data.length > 0) {
      const insights = generateInsights(data, headers);
      if (insights) sections.push({ id: uid(), type: 'insight', content: { text: insights } });
    }

    // Chart (if numeric data exists)
    if (data.length > 1) {
      const numCols = headers.filter(h => data.some(r => !isNaN(parseFloat(r[h])) && r[h] !== ''));
      if (numCols.length > 0) {
        sections.push({ id: uid(), type: 'chart', content: { chartType: 'bar', catCol: headers[0], valCol: numCols[0], data: data.slice(0, 15) } });
      }
    }

    return { fileId: file.id, title: file.name.replace(/\.[^.]+$/, ''), sections, data, headers, modifiedAt: Date.now() };
  }

  function generateInsights(data, headers) {
    if (data.length === 0 || headers.length === 0) return '';
    const insights = [];
    insights.push(`Dataset contains <strong>${data.length}</strong> rows and <strong>${headers.length}</strong> columns.`);
    const numCols = headers.filter(h => data.some(r => !isNaN(parseFloat(r[h])) && r[h] !== ''));
    if (numCols.length > 0) {
      const h = numCols[0];
      const vals = data.map(r => parseFloat(r[h])).filter(v => !isNaN(v));
      if (vals.length > 0) {
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
        insights.push(`<strong>${h}</strong> ranges from ${formatNum(min)} to ${formatNum(max)} (avg: ${formatNum(avg)}).`);
      }
    }
    const empty = headers.filter(h => data.filter(r => r[h] === '' || r[h] === null || r[h] === undefined).length);
    if (empty.length > 0) insights.push(`Missing data in columns: ${empty.map(h => '<strong>'+h+'</strong>').join(', ')}.`);
    return insights.join(' ');
  }

  function formatNum(n) {
    if (typeof n !== 'number' || isNaN(n)) return '0';
    if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n/1000).toFixed(1) + 'K';
    return n % 1 === 0 ? n.toString() : n.toFixed(2);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  function renderReport() {
    const container = $('ws-report-content');
    if (!container) return;
    destroyCharts();

    container.innerHTML = reportData.sections.map((section, idx) => renderSection(section, idx)).join('');

    // Bind editable events
    bindEditableEvents();
    // Init charts
    initCharts();
    // Bind drag handles
    bindDragHandles();
  }

  function renderSection(section, index) {
    const actions = `<div class="section-actions">
      <button onclick="ReportStudio.moveSection(${index}, -1)" title="Move Up"><i class="fas fa-arrow-up"></i></button>
      <button onclick="ReportStudio.moveSection(${index}, 1)" title="Move Down"><i class="fas fa-arrow-down"></i></button>
      <button onclick="ReportStudio.duplicateSection(${index})" title="Duplicate"><i class="fas fa-copy"></i></button>
      <button class="delete" onclick="ReportStudio.removeSection(${index})" title="Delete"><i class="fas fa-trash"></i></button>
    </div>`;
    const handle = `<div class="section-handle" draggable="true" data-index="${index}"><i class="fas fa-grip-vertical"></i></div>`;

    switch (section.type) {
      case 'title':
        return `<div class="ws-report-section" data-index="${index}" data-type="title">
          ${handle}${actions}
          <div class="ws-section-title">
            <h1 contenteditable="true" data-field="text">${esc(section.content.text || 'Untitled Report')}</h1>
            <input class="subtitle" contenteditable="true" data-field="subtitle" value="${esc(section.content.subtitle || '')}" placeholder="Subtitle...">
          </div>
        </div>`;

      case 'text':
        return `<div class="ws-report-section" data-index="${index}" data-type="text">
          ${handle}${actions}
          <div class="ws-section-text">
            <textarea class="editable" data-field="text" placeholder="Write something...">${esc(section.content.text || '')}</textarea>
          </div>
        </div>`;

      case 'kpi':
        const kpiItems = (section.content.items || []).map(k =>
          `<div class="ws-kpi-item">
            <input class="kpi-value" data-field="value" value="${esc(k.value)}" style="color:${k.color || 'var(--primary)'}">
            <input class="kpi-label" data-field="label" value="${esc(k.label)}">
          </div>`
        ).join('');
        return `<div class="ws-report-section" data-index="${index}" data-type="kpi">
          ${handle}${actions}
          <div class="ws-section-kpi"><div class="ws-kpi-grid">${kpiItems}</div></div>
        </div>`;

      case 'table':
        const hdrs = section.content.headers || [];
        const rows = section.content.rows || [];
        const thtml = `<table>
          <thead><tr>${hdrs.map(h => `<th contenteditable="true">${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td contenteditable="true">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`;
        return `<div class="ws-report-section" data-index="${index}" data-type="table">
          ${handle}${actions}
          <div class="ws-section-table">${thtml}</div>
        </div>`;

      case 'chart':
        const canvasId = 'chart_' + section.id;
        return `<div class="ws-report-section" data-index="${index}" data-type="chart">
          ${handle}${actions}
          <div class="ws-section-chart"><canvas id="${canvasId}" height="250"></canvas></div>
        </div>`;

      case 'insight':
        return `<div class="ws-report-section" data-index="${index}" data-type="insight">
          ${handle}${actions}
          <div class="ws-section-insight">
            <div class="ws-insight-box">
              <span class="insight-icon"><i class="fas fa-lightbulb"></i></span>
              <textarea class="insight-text editable" data-field="text" placeholder="AI Insight...">${esc(section.content.text || '')}</textarea>
            </div>
          </div>
        </div>`;

      case 'divider':
        return `<div class="ws-report-section" data-index="${index}" data-type="divider">
          ${handle}${actions}
          <hr style="border:none;border-top:1px solid var(--card-border);margin:16px 24px;">
        </div>`;

      default:
        return '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDITABLE EVENTS (LIVE EDITING)
  // ═══════════════════════════════════════════════════════════════════════════
  function bindEditableEvents() {
    const container = $('ws-report-content');
    if (!container) return;

    // Title edit
    container.querySelectorAll('.ws-section-title h1[contenteditable]').forEach(el => {
      el.addEventListener('input', () => {
        const idx = el.closest('.ws-report-section')?.dataset.index;
        if (idx !== undefined) {
          reportData.sections[idx].content.text = el.textContent;
          autoSave();
        }
      });
    });

    // Subtitle edit
    container.querySelectorAll('.ws-section-title .subtitle[contenteditable]').forEach(el => {
      el.addEventListener('input', () => {
        const idx = el.closest('.ws-report-section')?.dataset.index;
        if (idx !== undefined) {
          reportData.sections[idx].content.subtitle = el.textContent;
          autoSave();
        }
      });
    });

    // Text edit
    container.querySelectorAll('.ws-section-text .editable, .ws-section-insight .editable').forEach(el => {
      el.addEventListener('input', () => {
        const section = el.closest('.ws-report-section');
        const idx = section?.dataset.index;
        if (idx !== undefined) {
          reportData.sections[idx].content.text = el.value;
          autoSave();
        }
      });
      // Auto-resize textarea
      el.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; });
    });

    // KPI edit
    container.querySelectorAll('.ws-kpi-item input').forEach(el => {
      el.addEventListener('input', () => {
        const section = el.closest('.ws-report-section');
        const idx = section?.dataset.index;
        if (idx === undefined) return;
        const kpiIdx = [...section.querySelectorAll('.ws-kpi-item')].indexOf(el.closest('.ws-kpi-item'));
        if (kpiIdx >= 0) {
          const field = el.dataset.field;
          reportData.sections[idx].content.items[kpiIdx][field] = el.value;
          autoSave();
        }
      });
    });

    // Table cell edit
    container.querySelectorAll('.ws-section-table td[contenteditable]').forEach(td => {
      td.addEventListener('blur', () => {
        const section = td.closest('.ws-report-section');
        const idx = section?.dataset.index;
        if (idx === undefined) return;
        const tr = td.closest('tr');
        const rowIdx = [...tr.parentElement.children].indexOf(tr);
        const colIdx = [...tr.children].indexOf(td);
        if (reportData.sections[idx].content.rows[rowIdx]) {
          reportData.sections[idx].content.rows[rowIdx][colIdx] = td.textContent;
          autoSave();
        }
      });
    });

    // Table header edit
    container.querySelectorAll('.ws-section-table th[contenteditable]').forEach(th => {
      th.addEventListener('blur', () => {
        const section = th.closest('.ws-report-section');
        const idx = section?.dataset.index;
        if (idx === undefined) return;
        const colIdx = [...th.parentElement.children].indexOf(th);
        reportData.sections[idx].content.headers[colIdx] = th.textContent;
        autoSave();
      });
    });

    // Report title
    const titleInput = $('ws-report-title');
    if (titleInput) {
      titleInput.addEventListener('input', () => {
        reportData.title = titleInput.value;
        autoSave();
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHARTS
  // ═══════════════════════════════════════════════════════════════════════════
  function initCharts() {
    reportData.sections.forEach(section => {
      if (section.type === 'chart') {
        const canvas = document.getElementById('chart_' + section.id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const c = section.content;
        const data = c.data || currentFile?.data || [];
        const catCol = c.catCol || (currentFile?.headers || [])[0] || '';
        const valCol = c.valCol || (currentFile?.headers || []).find(h => data.some(r => !isNaN(parseFloat(r[h])))) || '';

        const labels = data.slice(0, 15).map(r => String(r[catCol] || ''));
        const values = data.slice(0, 15).map(r => parseFloat(r[valCol]) || 0);

        charts[section.id] = new Chart(ctx, {
          type: c.chartType || 'bar',
          data: {
            labels,
            datasets: [{ label: valCol, data: values, backgroundColor: 'rgba(99,102,241,0.6)', borderColor: '#6366f1', borderWidth: 1 }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
      }
    });
  }

  function destroyCharts() {
    Object.values(charts).forEach(c => c?.destroy?.());
    charts = {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG & DROP SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  function bindDragHandles() {
    const container = $('ws-report-content');
    if (!container) return;

    container.querySelectorAll('.section-handle').forEach(handle => {
      handle.addEventListener('dragstart', (e) => {
        dragSrcIndex = parseInt(handle.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
        handle.closest('.ws-report-section').style.opacity = '0.4';
      });

      handle.addEventListener('dragend', () => {
        handle.closest('.ws-report-section').style.opacity = '';
        container.querySelectorAll('.ws-report-section').forEach(s => s.classList.remove('drag-over'));
      });
    });

    container.querySelectorAll('.ws-report-section').forEach(section => {
      section.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        section.classList.add('drag-over');
      });

      section.addEventListener('dragleave', () => section.classList.remove('drag-over'));

      section.addEventListener('drop', (e) => {
        e.preventDefault();
        section.classList.remove('drag-over');
        const targetIndex = parseInt(section.dataset.index);
        if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
          const [moved] = reportData.sections.splice(dragSrcIndex, 1);
          reportData.sections.splice(targetIndex, 0, moved);
          renderReport();
          autoSave();
        }
        dragSrcIndex = null;
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  function addSection(type, afterIndex) {
    const templates = {
      title: { type: 'title', content: { text: 'New Section', subtitle: '' } },
      text: { type: 'text', content: { text: '' } },
      kpi: { type: 'kpi', content: { items: [{ value: '0', label: 'Metric', color: 'var(--primary)' }] } },
      table: { type: 'table', content: { headers: ['Column 1', 'Column 2'], rows: [['', '']] } },
      chart: { type: 'chart', content: { chartType: 'bar', catCol: '', valCol: '', data: [] } },
      insight: { type: 'insight', content: { text: 'AI will analyze your data and provide insights here.' } },
      divider: { type: 'divider', content: {} }
    };
    const section = { id: uid(), ...templates[type] || templates.text };
    if (afterIndex !== undefined && afterIndex >= 0) {
      reportData.sections.splice(afterIndex + 1, 0, section);
    } else {
      reportData.sections.push(section);
    }
    renderReport();
    autoSave();
  }

  function removeSection(index) {
    reportData.sections.splice(index, 1);
    renderReport();
    autoSave();
  }

  function moveSection(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= reportData.sections.length) return;
    const [section] = reportData.sections.splice(index, 1);
    reportData.sections.splice(newIndex, 0, section);
    renderReport();
    autoSave();
  }

  function duplicateSection(index) {
    const original = reportData.sections[index];
    if (!original) return;
    const dup = JSON.parse(JSON.stringify(original));
    dup.id = uid();
    reportData.sections.splice(index + 1, 0, dup);
    renderReport();
    autoSave();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  function exportPDF() {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 15;

      doc.setFontSize(18);
      doc.text(reportData.title || 'Report', 14, y);
      y += 10;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('Generated: ' + new Date().toLocaleString(), 14, y);
      y += 10;

      reportData.sections.forEach(section => {
        if (y > 270) { doc.addPage(); y = 15; }
        switch (section.type) {
          case 'title':
            doc.setFontSize(16);
            doc.setTextColor(0);
            doc.text(section.content.text || '', 14, y);
            y += 8;
            if (section.content.subtitle) { doc.setFontSize(9); doc.setTextColor(100); doc.text(section.content.subtitle, 14, y); y += 8; }
            break;
          case 'text':
            doc.setFontSize(10);
            doc.setTextColor(60);
            const lines = doc.splitTextToSize(section.content.text || '', 180);
            doc.text(lines, 14, y);
            y += lines.length * 5 + 6;
            break;
          case 'kpi':
            (section.content.items || []).forEach(k => {
              doc.setFontSize(14);
              doc.setTextColor(99, 102, 241);
              doc.text(k.value || '', 14, y);
              doc.setFontSize(8);
              doc.setTextColor(100);
              doc.text(k.label || '', 14, y + 5);
              y += 12;
            });
            y += 4;
            break;
          case 'table':
            doc.autoTable({
              head: [section.content.headers || []],
              body: section.content.rows || [],
              startY: y,
              styles: { fontSize: 7 },
              margin: { left: 14 }
            });
            y = doc.lastAutoTable.finalY + 8;
            break;
          case 'insight':
            doc.setFontSize(9);
            doc.setTextColor(6, 182, 212);
            const insightText = (section.content.text || '').replace(/<[^>]*>/g, '');
            const iLines = doc.splitTextToSize(insightText, 170);
            doc.text(iLines, 18, y);
            y += iLines.length * 4 + 8;
            break;
        }
      });

      doc.save((reportData.title || 'report') + '.pdf');
      if (window.FileManager) window.FileManager.toast('PDF exported', 'success');
    } catch(e) {
      if (window.FileManager) window.FileManager.toast('PDF export failed: ' + e.message, 'error');
    }
  }

  function exportHTML() {
    const container = $('ws-report-content');
    if (!container) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(reportData.title)}</title>
      <style>body{font-family:sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#1e293b;}
      table{width:100%;border-collapse:collapse;margin:16px 0;}th,td{padding:8px 12px;border:1px solid #e2e8f0;text-align:left;font-size:0.85rem;}
      th{background:#f1f5f9;font-weight:600;}.kpi{text-align:center;padding:12px;}.kpi-val{font-size:1.5rem;font-weight:800;color:#6366f1;}
      .kpi-label{font-size:0.8rem;color:#64748b;}.insight{background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:12px;margin:12px 0;}</style></head><body>
      <h1>${esc(reportData.title)}</h1><p style="color:#64748b;">Generated ${new Date().toLocaleString()}</p><hr>`;
    let body = '';
    reportData.sections.forEach(s => {
      switch(s.type) {
        case 'title': body += `<h2>${esc(s.content.text)}</h2>${s.content.subtitle ? '<p>'+esc(s.content.subtitle)+'</p>' : ''}`; break;
        case 'text': body += `<p>${esc(s.content.text)}</p>`; break;
        case 'kpi': body += '<div style="display:flex;gap:16px;flex-wrap:wrap;">' + (s.content.items||[]).map(k => `<div class="kpi"><div class="kpi-val">${esc(k.value)}</div><div class="kpi-label">${esc(k.label)}</div></div>`).join('') + '</div>'; break;
        case 'table': body += '<table><thead><tr>' + (s.content.headers||[]).map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>' + (s.content.rows||[]).map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>'; break;
        case 'insight': body += `<div class="insight">💡 ${esc(s.content.text)}</div>`; break;
        case 'divider': body += '<hr>'; break;
      }
    });
    const blob = new Blob([html + body + '</body></html>'], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (reportData.title || 'report') + '.html';
    a.click();
    if (window.FileManager) window.FileManager.toast('HTML exported', 'success');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION HISTORY
  // ═══════════════════════════════════════════════════════════════════════════
  function renderVersions() {
    const list = $('ws-version-list');
    if (!list || !currentFile) return;
    const versions = currentFile.versions || [];
    if (versions.length === 0) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.82rem;">No versions saved yet</div>'; return; }
    list.innerHTML = versions.slice().reverse().map((v, i) => {
      const realIdx = versions.length - 1 - i;
      const time = new Date(v.timestamp).toLocaleString();
      return `<div class="ws-version-item" data-idx="${realIdx}">
        <div class="version-time">${time}</div>
        <div class="version-changes">Version ${v.version || (realIdx + 1)}</div>
      </div>`;
    }).join('');
    list.querySelectorAll('.ws-version-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx);
        if (confirm('Restore this version? Current changes will be lost.')) {
          const v = versions[idx];
          reportData.sections = v.data || [];
          renderReport();
          autoSave();
          if (window.FileManager) window.FileManager.toast('Version restored', 'success');
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION PICKER
  // ═══════════════════════════════════════════════════════════════════════════
  function showSectionPicker(e) {
    const picker = $('ws-section-picker');
    if (!picker) return;
    const rect = e.target.getBoundingClientRect();
    picker.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
    picker.style.top = (rect.top - 220) + 'px';
    picker.classList.add('show');
    picker.dataset.afterIndex = e.target.closest('.ws-report-section')?.dataset.index ?? '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════
  function init() {
    // Add section button
    $('ws-add-section')?.addEventListener('click', showSectionPicker);

    // Section picker items
    document.querySelectorAll('#ws-section-picker .picker-item').forEach(item => {
      item.addEventListener('click', () => {
        const afterIndex = parseInt($('ws-section-picker').dataset.afterIndex);
        addSection(item.dataset.type, isNaN(afterIndex) ? undefined : afterIndex);
        $('ws-section-picker').classList.remove('show');
      });
    });

    // Close picker on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#ws-section-picker') && !e.target.closest('#ws-add-section')) {
        $('ws-section-picker')?.classList.remove('show');
      }
    });

    // Export buttons
    $('ws-report-export')?.addEventListener('click', () => {
      const menu = $('ws-sort-menu');
      if (menu) {
        menu.innerHTML = `
          <div class="ctx-item" data-action="pdf"><i class="fas fa-file-pdf" style="color:var(--danger);"></i>PDF</div>
          <div class="ctx-item" data-action="html"><i class="fas fa-file-code" style="color:var(--info);"></i>HTML</div>
          <div class="ctx-item" data-action="xlsx"><i class="fas fa-file-excel" style="color:var(--success);"></i>Excel</div>`;
        const btn = $('ws-report-export');
        const rect = btn.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        menu.style.top = rect.bottom + 4 + 'px';
        menu.classList.add('show');
        menu.querySelectorAll('.ctx-item').forEach(mi => {
          mi.addEventListener('click', () => {
            const action = mi.dataset.action;
            if (action === 'pdf') exportPDF();
            else if (action === 'html') exportHTML();
            else if (action === 'xlsx') {
              if (currentFile && currentFile.data) {
                try {
                  const ws = XLSX.utils.json_to_sheet(currentFile.data);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Data');
                  XLSX.writeFile(wb, (reportData.title || 'report') + '.xlsx');
                  if (window.FileManager) window.FileManager.toast('Excel exported', 'success');
                } catch(e) { if (window.FileManager) window.FileManager.toast('Export failed', 'error'); }
              }
            }
            menu.classList.remove('show');
          });
        });
      }
    });

    // Version history
    $('ws-report-versions')?.addEventListener('click', () => {
      renderVersions();
      $('ws-versions-panel')?.classList.toggle('show');
    });

    // Share button
    $('ws-report-share')?.addEventListener('click', () => {
      if (currentFile) {
        currentFile.shared = !currentFile.shared;
        if (window.FileManager) {
          window.FileManager.saveFiles();
          window.FileManager.toast(currentFile.shared ? 'Report shared' : 'Share removed', 'success');
        }
      }
    });

    // Expose API
    window.ReportStudio = {
      loadReport, renderReport, addSection, removeSection,
      moveSection, duplicateSection, autoSave, exportPDF, exportHTML
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { loadReport, renderReport, addSection, removeSection, moveSection, duplicateSection, autoSave, exportPDF, exportHTML };
})();
