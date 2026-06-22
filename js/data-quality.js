/* ==========================================================================
   EXCEL AUTO - DATA QUALITY CENTER v1.0 (data-quality.js)
   • Duplicate record detection
   • Missing value analysis per column
   • Invalid date detection
   • Invalid email detection
   • Invalid phone number detection
   • Composite data quality score
   ========================================================================== */

'use strict';

const DataQuality = (() => {

  // ─── REGEX PATTERNS ──────────────────────────────────────────────────────
  const _emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  const _phoneRegex = /^(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}$/;
  const _datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
    /^\d{2}\.\d{2}\.\d{4}$/,
    /^\d{4}\/\d{2}\/\d{2}$/
  ];
  const _dateParseable = (val) => {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed.length < 6 || trimmed.length > 20) return false;
    const d = new Date(trimmed);
    return !isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100;
  };

  // ─── DETECTION: Columns that LOOK like emails, phones, dates ────────────
  function _detectColumnTypes(headers, rows) {
    const types = {};
    const sampleSize = Math.min(rows.length, 20);

    headers.forEach(hdr => {
      const samples = rows.slice(0, sampleSize).map(r => r[hdr]).filter(v => v !== undefined && v !== null && v !== '');

      let emailHits = 0, phoneHits = 0, dateHits = 0, numHits = 0;

      samples.forEach(val => {
        const s = String(val).trim();
        if (_emailRegex.test(s)) emailHits++;
        if (_phoneRegex.test(s)) phoneHits++;
        if (_dateParseable(s)) dateHits++;
        if (!isNaN(Number(String(s).replace(/[^0-9.\-]/g, '')))) numHits++;
      });

      const threshold = Math.ceil(sampleSize * 0.5);
      if (emailHits >= threshold) types[hdr] = 'email';
      else if (phoneHits >= threshold) types[hdr] = 'phone';
      else if (dateHits >= threshold) types[hdr] = 'date';
      else if (numHits >= threshold) types[hdr] = 'numeric';
      else types[hdr] = 'text';
    });

    return types;
  }

  // ─── CHECK: Duplicates ──────────────────────────────────────────────────
  function _findDuplicates(rows, headers) {
    const seen = new Map();
    const duplicates = [];

    rows.forEach((row, idx) => {
      const key = headers.map(h => String(row[h] ?? '')).join('|||');
      if (seen.has(key)) {
        duplicates.push({
          rowIndex: idx + 1,
          data: { ...row },
          firstSeenAt: seen.get(key) + 1
        });
      } else {
        seen.set(key, idx);
      }
    });

    return {
      count: duplicates.length,
      percentage: rows.length > 0 ? parseFloat(((duplicates.length / rows.length) * 100).toFixed(1)) : 0,
      samples: duplicates.slice(0, 10),
      headers
    };
  }

  // ─── CHECK: Missing Values ──────────────────────────────────────────────
  function _findMissingValues(rows, headers) {
    const columnStats = {};

    headers.forEach(hdr => {
      let emptyCount = 0;
      const emptyRows = [];

      rows.forEach((row, idx) => {
        const val = row[hdr];
        if (val === undefined || val === null || val === '' || String(val).trim() === '') {
          emptyCount++;
          if (emptyRows.length < 5) emptyRows.push(idx + 1);
        }
      });

      columnStats[hdr] = {
        count: emptyCount,
        percentage: rows.length > 0 ? parseFloat(((emptyCount / rows.length) * 100).toFixed(1)) : 0,
        sampleRows: emptyRows
      };
    });

    const totalCells = rows.length * headers.length;
    const totalMissing = Object.values(columnStats).reduce((s, c) => s + c.count, 0);

    return {
      totalMissing,
      totalCells,
      percentage: totalCells > 0 ? parseFloat(((totalMissing / totalCells) * 100).toFixed(1)) : 0,
      byColumn: columnStats,
      worstColumns: Object.entries(columnStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, stats]) => ({ name, ...stats }))
    };
  }

  // ─── CHECK: Invalid Dates ───────────────────────────────────────────────
  function _findInvalidDates(rows, headers, columnTypes) {
    const dateColumns = headers.filter(h => columnTypes[h] === 'date');
    const issues = [];

    if (dateColumns.length === 0) {
      // Fallback: check any column that has "date" in header name
      headers.forEach(hdr => {
        if (/date|time|created|updated|dob|birth/i.test(hdr)) {
          dateColumns.push(hdr);
        }
      });
    }

    dateColumns.forEach(hdr => {
      rows.forEach((row, idx) => {
        const val = row[hdr];
        if (val === undefined || val === null || val === '') return;
        const s = String(val).trim();
        if (s.length < 6) return;
        if (!_dateParseable(s)) {
          if (issues.length < 20) {
            issues.push({ row: idx + 1, column: hdr, value: s });
          }
        }
      });
    });

    return {
      count: issues.length,
      samples: issues,
      dateColumnsChecked: dateColumns
    };
  }

  // ─── CHECK: Invalid Emails ──────────────────────────────────────────────
  function _findInvalidEmails(rows, headers, columnTypes) {
    const emailColumns = headers.filter(h => columnTypes[h] === 'email');
    const issues = [];

    if (emailColumns.length === 0) {
      headers.forEach(hdr => {
        if (/email|e-mail|mail/i.test(hdr)) {
          emailColumns.push(hdr);
        }
      });
    }

    emailColumns.forEach(hdr => {
      rows.forEach((row, idx) => {
        const val = row[hdr];
        if (val === undefined || val === null || val === '') return;
        const s = String(val).trim();
        if (s.length < 5) return;
        if (!_emailRegex.test(s)) {
          if (issues.length < 20) {
            issues.push({ row: idx + 1, column: hdr, value: s });
          }
        }
      });
    });

    return {
      count: issues.length,
      samples: issues,
      emailColumnsChecked: emailColumns
    };
  }

  // ─── CHECK: Invalid Phone Numbers ───────────────────────────────────────
  function _findInvalidPhones(rows, headers, columnTypes) {
    const phoneColumns = headers.filter(h => columnTypes[h] === 'phone');
    const issues = [];

    if (phoneColumns.length === 0) {
      headers.forEach(hdr => {
        if (/phone|mobile|contact|tel|cell/i.test(hdr)) {
          phoneColumns.push(hdr);
        }
      });
    }

    phoneColumns.forEach(hdr => {
      rows.forEach((row, idx) => {
        const val = row[hdr];
        if (val === undefined || val === null || val === '') return;
        const s = String(val).trim();
        if (s.length < 6) return;
        if (!_phoneRegex.test(s)) {
          if (issues.length < 20) {
            issues.push({ row: idx + 1, column: hdr, value: s });
          }
        }
      });
    });

    return {
      count: issues.length,
      samples: issues,
      phoneColumnsChecked: phoneColumns
    };
  }

  // ─── SCORE: Composite Quality Score ─────────────────────────────────────
  function _calculateScore(totalRows, duplicates, missing, invalidDates, invalidEmails, invalidPhones) {
    if (totalRows === 0) return 100;

    const totalCells = totalRows * 10; // assume ~10 columns average
    const issues = duplicates.count + missing.totalMissing + invalidDates.count + invalidEmails.count + invalidPhones.count;

    // Score starts at 100, deduct per issue
    const deduction = (issues / totalCells) * 100;
    const score = Math.max(0, Math.min(100, 100 - deduction));

    let grade, color;
    if (score >= 90) { grade = 'A+'; color = '#10b981'; }
    else if (score >= 80) { grade = 'A'; color = '#22c55e'; }
    else if (score >= 70) { grade = 'B'; color = '#06b6d4'; }
    else if (score >= 60) { grade = 'C'; color = '#f59e0b'; }
    else if (score >= 40) { grade = 'D'; color = '#f97316'; }
    else { grade = 'F'; color = '#ef4444'; }

    return {
      score: parseFloat(score.toFixed(1)),
      grade,
      color,
      totalIssues: issues,
      breakdown: {
        duplicates: duplicates.count,
        missing: missing.totalMissing,
        invalidDates: invalidDates.count,
        invalidEmails: invalidEmails.count,
        invalidPhones: invalidPhones.count
      }
    };
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────────────
  return {

    /**
     * Run full data quality analysis on the provided rows and headers.
     * @param {Array} rows - Array of row objects
     * @param {Array} headers - Array of column header strings
     * @returns {Object} Complete quality report
     */
    analyze(rows, headers) {
      if (!rows || rows.length === 0 || !headers || headers.length === 0) {
        return {
          score: { score: 100, grade: 'N/A', color: '#94a3b8', totalIssues: 0, breakdown: {} },
          columnTypes: {},
          duplicates: { count: 0, percentage: 0, samples: [], headers },
          missing: { totalMissing: 0, totalCells: 0, percentage: 0, byColumn: {}, worstColumns: [] },
          invalidDates: { count: 0, samples: [], dateColumnsChecked: [] },
          invalidEmails: { count: 0, samples: [], emailColumnsChecked: [] },
          invalidPhones: { count: 0, samples: [], phoneColumnsChecked: [] },
          totalRows: 0,
          totalColumns: 0
        };
      }

      const columnTypes = _detectColumnTypes(headers, rows);
      const duplicates = _findDuplicates(rows, headers);
      const missing = _findMissingValues(rows, headers);
      const invalidDates = _findInvalidDates(rows, headers, columnTypes);
      const invalidEmails = _findInvalidEmails(rows, headers, columnTypes);
      const invalidPhones = _findInvalidPhones(rows, headers, columnTypes);
      const score = _calculateScore(rows.length, duplicates, missing, invalidDates, invalidEmails, invalidPhones);

      return {
        score,
        columnTypes,
        duplicates,
        missing,
        invalidDates,
        invalidEmails,
        invalidPhones,
        totalRows: rows.length,
        totalColumns: headers.length
      };
    },

    /**
     * Render the full data quality report into the UI container.
     * @param {Object} report - Output from DataQuality.analyze()
     * @param {HTMLElement} container - Target DOM element
     */
    render(report, container) {
      if (!container) return;

      const { score, duplicates, missing, invalidDates, invalidEmails, invalidPhones, totalRows, totalColumns, columnTypes } = report;

      let html = '';

      // ── Score Card ──
      html += `
        <div style="display: flex; align-items: center; gap: 24px; padding: 20px; background: ${score.color}08; border: 1px solid ${score.color}25; border-radius: var(--border-radius-md); margin-bottom: 20px;">
          <div style="width: 72px; height: 72px; border-radius: 50%; border: 4px solid ${score.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <div style="text-align: center;">
              <div style="font-size: 1.4rem; font-weight: 800; color: ${score.color}; line-height: 1;">${score.score}</div>
              <div style="font-size: 0.55rem; color: var(--text-muted); font-weight: 600;">/100</div>
            </div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 1rem; font-weight: 700; margin-bottom: 4px;">Data Quality Score: <span style="color: ${score.color};">${score.grade}</span></div>
            <div style="font-size: 0.78rem; color: var(--text-secondary);">
              ${totalRows} rows × ${totalColumns} columns analyzed — ${score.totalIssues} total issue${score.totalIssues !== 1 ? 's' : ''} found
            </div>
          </div>
        </div>
      `;

      // ── Issue Breakdown Grid ──
      html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">`;

      const metrics = [
        { label: 'Duplicates', count: duplicates.count, icon: 'fa-copy', color: '#f59e0b' },
        { label: 'Missing Values', count: missing.totalMissing, icon: 'fa-circle-question', color: '#ef4444' },
        { label: 'Invalid Dates', count: invalidDates.count, icon: 'fa-calendar-xmark', color: '#f97316' },
        { label: 'Invalid Emails', count: invalidEmails.count, icon: 'fa-envelope-circle-xmark', color: '#a855f7' },
        { label: 'Invalid Phones', count: invalidPhones.count, icon: 'fa-phone-slash', color: '#ec4899' }
      ];

      metrics.forEach(m => {
        const ok = m.count === 0;
        html += `
          <div style="padding: 14px; border: 1px solid ${ok ? 'var(--card-border)' : m.color + '30'}; border-radius: var(--border-radius-sm); background: ${ok ? 'transparent' : m.color + '08'}; text-align: center;">
            <i class="fas ${m.icon}" style="font-size: 1.2rem; color: ${ok ? 'var(--text-muted)' : m.color}; margin-bottom: 6px; display: block;"></i>
            <div style="font-size: 1.3rem; font-weight: 800; color: ${ok ? 'var(--text-primary)' : m.color};">${m.count.toLocaleString()}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${m.label}</div>
          </div>
        `;
      });

      html += `</div>`;

      // ── Column Type Detection ──
      const typeCounts = {};
      Object.values(columnTypes).forEach(t => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
      if (Object.keys(typeCounts).length > 0) {
        html += `<div style="margin-bottom: 20px;">
          <h4 style="font-size: 0.82rem; font-weight: 700; margin-bottom: 10px;"><i class="fas fa-tags" style="color: var(--primary); margin-right: 6px;"></i>Column Type Detection</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${Object.entries(typeCounts).map(([type, count]) => {
              const colors = { text: '#94a3b8', numeric: '#3b82f6', date: '#f59e0b', email: '#a855f7', phone: '#ec4899' };
              return `<span style="padding: 4px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; background: ${colors[type] || '#94a3b8'}15; color: ${colors[type] || '#94a3b8'}; border: 1px solid ${colors[type] || '#94a3b8'}30;">${type}: ${count}</span>`;
            }).join('')}
          </div>
        </div>`;
      }

      // ── Missing Values Per Column ──
      const worstCols = missing.worstColumns.filter(c => c.count > 0);
      if (worstCols.length > 0) {
        html += `<div style="margin-bottom: 20px;">
          <h4 style="font-size: 0.82rem; font-weight: 700; margin-bottom: 10px;"><i class="fas fa-circle-exclamation" style="color: #ef4444; margin-right: 6px;"></i>Missing Values by Column</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${worstCols.map(col => `
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 0.78rem; color: var(--text-secondary); min-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${col.name}</span>
                <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                  <div style="width: ${Math.min(col.percentage, 100)}%; height: 100%; background: ${col.percentage > 50 ? '#ef4444' : col.percentage > 20 ? '#f59e0b' : '#06b6d4'}; border-radius: 3px;"></div>
                </div>
                <span style="font-size: 0.72rem; color: var(--text-muted); min-width: 60px; text-align: right;">${col.count} (${col.percentage}%)</span>
              </div>
            `).join('')}
          </div>
        </div>`;
      }

      // ── Duplicate Rows ──
      if (duplicates.count > 0) {
        html += `<div style="margin-bottom: 20px;">
          <h4 style="font-size: 0.82rem; font-weight: 700; margin-bottom: 10px;"><i class="fas fa-copy" style="color: #f59e0b; margin-right: 6px;"></i>Duplicate Records (${duplicates.count})</h4>
          <div style="max-height: 160px; overflow-y: auto; border: 1px solid var(--card-border); border-radius: var(--border-radius-sm);">
            <table class="custom-table" style="font-size: 0.72rem;">
              <thead><tr><th>Row #</th><th>First Seen At</th><th>Preview</th></tr></thead>
              <tbody>
                ${duplicates.samples.map(d => {
                  const preview = Object.values(d.data).slice(0, 3).map(v => String(v ?? '').substring(0, 30)).join(' | ');
                  return `<tr><td>${d.rowIndex}</td><td>Row ${d.firstSeenAt}</td><td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(preview)}</td></tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      }

      // ── Invalid Emails ──
      if (invalidEmails.count > 0) {
        html += `<div style="margin-bottom: 20px;">
          <h4 style="font-size: 0.82rem; font-weight: 700; margin-bottom: 10px;"><i class="fas fa-envelope-circle-xmark" style="color: #a855f7; margin-right: 6px;"></i>Invalid Emails (${invalidEmails.count})</h4>
          <div style="max-height: 120px; overflow-y: auto; border: 1px solid var(--card-border); border-radius: var(--border-radius-sm); padding: 8px;">
            ${invalidEmails.samples.map(ie => `
              <div style="display: flex; gap: 12px; padding: 4px 0; font-size: 0.72rem; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <span style="color: var(--text-muted); min-width: 50px;">Row ${ie.row}</span>
                <span style="color: #a855f7; min-width: 80px;">${ie.column}</span>
                <span style="color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(ie.value)}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
      }

      // ── Invalid Phones ──
      if (invalidPhones.count > 0) {
        html += `<div style="margin-bottom: 20px;">
          <h4 style="font-size: 0.82rem; font-weight: 700; margin-bottom: 10px;"><i class="fas fa-phone-slash" style="color: #ec4899; margin-right: 6px;"></i>Invalid Phone Numbers (${invalidPhones.count})</h4>
          <div style="max-height: 120px; overflow-y: auto; border: 1px solid var(--card-border); border-radius: var(--border-radius-sm); padding: 8px;">
            ${invalidPhones.samples.map(ip => `
              <div style="display: flex; gap: 12px; padding: 4px 0; font-size: 0.72rem; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <span style="color: var(--text-muted); min-width: 50px;">Row ${ip.row}</span>
                <span style="color: #ec4899; min-width: 80px;">${ip.column}</span>
                <span style="color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(ip.value)}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
      }

      // ── Invalid Dates ──
      if (invalidDates.count > 0) {
        html += `<div style="margin-bottom: 20px;">
          <h4 style="font-size: 0.82rem; font-weight: 700; margin-bottom: 10px;"><i class="fas fa-calendar-xmark" style="color: #f97316; margin-right: 6px;"></i>Invalid Dates (${invalidDates.count})</h4>
          <div style="max-height: 120px; overflow-y: auto; border: 1px solid var(--card-border); border-radius: var(--border-radius-sm); padding: 8px;">
            ${invalidDates.samples.map(id => `
              <div style="display: flex; gap: 12px; padding: 4px 0; font-size: 0.72rem; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <span style="color: var(--text-muted); min-width: 50px;">Row ${id.row}</span>
                <span style="color: #f97316; min-width: 80px;">${id.column}</span>
                <span style="color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(id.value)}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
      }

      // ── Clean Summary ──
      if (score.totalIssues === 0) {
        html += `
          <div style="text-align: center; padding: 20px; background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2); border-radius: var(--border-radius-md);">
            <i class="fas fa-circle-check" style="font-size: 2rem; color: #10b981; margin-bottom: 8px; display: block;"></i>
            <div style="font-weight: 700; color: #10b981;">Dataset is Clean</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">No quality issues detected across ${totalRows} records.</div>
          </div>
        `;
      }

      container.innerHTML = html;
    }
  };
})();

// ─── UI CONTROLLER: Auto-run on workspace data changes ────────────────────
let _dqLastAnalyzedCount = 0;

function runDataQualityAnalysis() {
  if (typeof activeSheetData === 'undefined' || activeSheetData.length === 0) return;

  // Skip if same data already analyzed
  if (activeSheetData.length === _dqLastAnalyzedCount) return;
  _dqLastAnalyzedCount = activeSheetData.length;

  const headers = typeof activeHeaders !== 'undefined' ? activeHeaders : Object.keys(activeSheetData[0] || {});

  const report = DataQuality.analyze(activeSheetData, headers);
  const container = document.getElementById('dq-results-container');
  if (container) {
    DataQuality.render(report, container);
  }

  // Update score badge in tab
  const badge = document.getElementById('dq-score-badge');
  if (badge) {
    badge.textContent = `${report.score.score}`;
    badge.style.color = report.score.color;
  }

  // Store for export
  window._lastDataQualityReport = report;
}

// Expose globally so dashboard.js can call it after data loads
window.runDataQualityAnalysis = runDataQualityAnalysis;

// Auto-trigger when data changes (poll for new data)
setInterval(() => {
  if (typeof activeSheetData !== 'undefined' && activeSheetData.length > 0 && activeSheetData.length !== _dqLastAnalyzedCount) {
    runDataQualityAnalysis();
  }
}, 2000);
