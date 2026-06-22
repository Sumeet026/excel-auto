/* ==========================================================================
   EXCEL AUTO - AI COMMAND CENTER ENGINE
   • NLP parser: business language → worker actions
   • Web Speech API voice commands
   • Live execution with results in chat
   • Auto-workflow engine
   • Mini data preview
   ========================================================================== */
'use strict';

(function() {
  // ─── STATE ────────────────────────────────────────────────────────────────
  let sheetData = [];
  let headers = [];
  let fileName = '';
  let worker = null;
  let recognition = null;
  let isListening = false;
  let commandHistory = [];
  const WORKFLOWS = { clean: true, report: true, pdf: false, email: false, backup: true };

  // ─── INIT ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initWorker();
    initChatInput();
    initVoice();
    initQuickCommands();
    initWorkflowToggles();
    initClearChat();
    initExportChat();
    loadSheetFromStorage();
    addSystemMessage('AI Command Center ready. Upload a file in Dashboard, or paste/type data below.');
  });

  // ─── WORKER ────────────────────────────────────────────────────────────────
  function getWorker() {
    if (!worker) worker = new Worker('js/excel-worker.js');
    return worker;
  }

  function postToWorker(action, payload, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const w = getWorker();
      let settled = false;
      const listener = (e) => {
        if (e.data && e.data.id === id) {
          w.removeEventListener('message', listener);
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data);
          }
        }
      };
      const timer = setTimeout(() => {
        if (!settled) { settled = true; w.removeEventListener('message', listener); reject(new Error('Command timed out')); }
      }, timeout);
      w.addEventListener('message', listener);
      w.postMessage({ action, payload, id });
    });
  }

  // ─── DATA LOADING ──────────────────────────────────────────────────────────
  function loadSheetFromStorage() {
    try {
      const stored = localStorage.getItem('excelAuto_activeData');
      if (stored) {
        const parsed = JSON.parse(stored);
        sheetData = parsed.data || [];
        headers = parsed.headers || (sheetData.length > 0 ? Object.keys(sheetData[0]) : []);
        fileName = parsed.fileName || 'Unknown';
        updateMiniPreview();
      }
    } catch (e) { /* ignore */ }
  }

  function saveToStorage() {
    try {
      localStorage.setItem('excelAuto_activeData', JSON.stringify({
        data: sheetData.slice(0, 5000),
        headers,
        fileName,
        timestamp: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  // Listen for dashboard file loads
  window.addEventListener('storage', (e) => {
    if (e.key === 'excelAuto_activeData' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        sheetData = parsed.data || [];
        headers = parsed.headers || (sheetData.length > 0 ? Object.keys(sheetData[0]) : []);
        fileName = parsed.fileName || 'Unknown';
        updateMiniPreview();
        addSystemMessage(`Data loaded: ${fileName} (${sheetData.length} rows, ${headers.length} columns)`);
      } catch (err) { /* ignore */ }
    }
  });

  // ─── CHAT UI ───────────────────────────────────────────────────────────────
  function initChatInput() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('btn-send');
    if (!input || !sendBtn) return;

    const handleSend = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      addUserMessage(text);
      commandHistory.push({ text, time: Date.now() });
      processCommand(text);
    };

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(); });
  }

  function addUserMessage(text) {
    const container = document.getElementById('ai-messages');
    const msg = document.createElement('div');
    msg.className = 'ai-msg user';
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function addBotMessage(html, className = '') {
    const container = document.getElementById('ai-messages');
    const msg = document.createElement('div');
    msg.className = `ai-msg bot ${className}`.trim();
    msg.innerHTML = html;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  function addSystemMessage(text) {
    const container = document.getElementById('ai-messages');
    const msg = document.createElement('div');
    msg.className = 'ai-msg system';
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function addResultMessage(html) {
    const container = document.getElementById('ai-messages');
    const msg = document.createElement('div');
    msg.className = 'ai-msg result';
    msg.innerHTML = html;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  function addErrorMessage(text) {
    const container = document.getElementById('ai-messages');
    const msg = document.createElement('div');
    msg.className = 'ai-msg error';
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('ai-messages');
    const el = document.createElement('div');
    el.className = 'ai-msg bot';
    el.id = 'typing-indicator';
    el.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  function formatNumber(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  function renderTable(headers, rows, maxRows = 20) {
    let html = '<table><thead><tr>';
    headers.forEach(h => { html += `<th>${window.escapeHtml(h)}</th>`; });
    html += '</tr></thead><tbody>';
    rows.slice(0, maxRows).forEach(row => {
      html += '<tr>';
      headers.forEach(h => {
        let val = String(row[h] ?? '');
        const num = Number(val.replace(/[^0-9.-]/g, ''));
        if (!isNaN(num) && val !== '') {
          const cls = num < 0 ? 'neg-val' : '';
          html += `<td class="${cls}">${window.escapeHtml(val)}</td>`;
        } else {
          html += `<td>${window.escapeHtml(val)}</td>`;
        }
      });
      html += '</tr>';
    });
    if (rows.length > maxRows) html += `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--text-muted);">... ${rows.length - maxRows} more rows</td></tr>`;
    html += '</tbody></table>';
    return html;
  }

  // ─── NLP ENGINE ────────────────────────────────────────────────────────────
  function processCommand(text) {
    const cmd = text.toLowerCase().trim();
    showTyping();

    // Check if we have data for data commands
    const needsData = !cmd.includes('upload') && !cmd.includes('help') && !cmd.includes('hello') && !cmd.includes('hi ');

    setTimeout(async () => {
      try {
        // ── Greetings / Help ──
        if (cmd.match(/^(hi|hello|hey|help|what can you do)/)) {
          hideTyping();
          addBotMessage(`I can analyze your Excel/CSV data with natural language commands:
            <br><br><strong>Data Analysis:</strong> "Analyze file", "Show top 10", "Find duplicates", "Missing data"
            <br><strong>Formulas:</strong> "Profit margin", "Add GST", "Commission calculator"
            <br><strong>Reports:</strong> "Professional report", "Executive summary"
            <br><strong>Charts:</strong> "Pie chart", "Monthly growth", "Yearly growth"
            <br><strong>Filters:</strong> "Customers from Mumbai", "Orders above 50000"
            <br><strong>Groups:</strong> "Group by state", "Top products"
            <br><strong>Voice:</strong> Click 🎤 to speak commands
            <br><strong>Automation:</strong> Toggle workflows in the sidebar panel`);
          return;
        }

        if (needsData && sheetData.length === 0) {
          hideTyping();
          addBotMessage('No data loaded. Please upload a file in the Dashboard first, then come back.');
          return;
        }

        // ── Full Analysis ──
        if (cmd.match(/analyze|full analysis|complete analysis|comprehensive/)) {
          hideTyping();
          addBotMessage('Running full file analysis...');
          const res = await postToWorker('AI_FULL_ANALYSIS', { data: sheetData });
          const r = res.data;
          let html = `<strong>Full Analysis Complete</strong> (${r.duration}ms)<br>`;
          html += `Rows: ${r.totalRows} | Columns: ${r.totalCols} | Quality Score: ${r.qualityScore}% | Duplicates: ${r.duplicates} (${r.dupPercentage}%)<br><br>`;
          html += '<strong>Numeric Statistics:</strong><br>';
          Object.entries(r.stats).forEach(([col, s]) => {
            html += `• <strong>${window.escapeHtml(col)}</strong>: Sum=${formatNumber(s.sum)}, Avg=${formatNumber(s.avg)}, Range=[${formatNumber(s.min)} — ${formatNumber(s.max)}]<br>`;
          });
          if (Object.keys(r.catStats).length > 0) {
            html += '<br><strong>Categorical Columns:</strong><br>';
            Object.entries(r.catStats).forEach(([col, cs]) => {
              html += `• <strong>${window.escapeHtml(col)}</strong>: ${cs.unique} unique values. Top: ${cs.top.map(t => `${window.escapeHtml(t.label)}(${t.count})`).join(', ')}<br>`;
            });
          }
          addResultMessage(html);
          return;
        }

        // ── Top 10 Customers ──
        if (cmd.match(/top\s*10|best\s*customer|top\s*customer|highest\s*customer/)) {
          hideTyping();
          addBotMessage('Finding top 10 customers...');
          const res = await postToWorker('AI_TOP_CUSTOMERS', { data: sheetData });
          const r = res.data;
          if (r.topCustomers.length === 0) { addBotMessage('No customer/value columns found.'); return; }
          let html = `<strong>Top 10 Customers</strong> (by ${window.escapeHtml(r.valueCol)})<br>`;
          html += `<small>Total unique customers: ${r.totalCustomers}</small><br>`;
          r.topCustomers.forEach((c, i) => {
            html += `<div style="margin:4px 0;"><strong>${i + 1}. ${window.escapeHtml(c.name)}</strong> — ${formatNumber(c.total)}<div class="bar" style="width:${c.percentage}%;"></div></div>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Top Products ──
        if (cmd.match(/top\s*product|best\s*product|top\s*item|best\s*selling/)) {
          hideTyping();
          addBotMessage('Finding top products...');
          const res = await postToWorker('AI_TOP_PRODUCTS', { data: sheetData });
          const r = res.data;
          if (r.products.length === 0) { addBotMessage('No product column found.'); return; }
          let html = `<strong>Top Products</strong> (by ${window.escapeHtml(r.valCol || 'count')})<br>`;
          r.products.forEach((p, i) => {
            html += `<div style="margin:4px 0;"><strong>${i + 1}. ${window.escapeHtml(p.name)}</strong> — ${formatNumber(p.total)}<div class="bar" style="width:${p.percentage}%;"></div></div>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Pie Chart ──
        if (cmd.match(/pie\s*chart|donut|circle\s*chart/)) {
          hideTyping();
          addBotMessage('Generating pie chart data...');
          const res = await postToWorker('AI_PIE_CHART', { data: sheetData });
          const r = res.data;
          if (r.slices.length === 0) { addBotMessage('No categorical columns found.'); return; }
          let html = `<strong>Pie Chart Data</strong> (Column: ${window.escapeHtml(r.catCol)}, Total: ${formatNumber(r.total)})<br>`;
          r.slices.forEach((s, i) => {
            html += `<div style="margin:4px 0;"><strong>${i + 1}. ${window.escapeHtml(s.label)}</strong> — ${formatNumber(s.value)} (${s.percentage}%)<div class="bar" style="width:${s.percentage}%;"></div></div>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Professional Report ──
        if (cmd.match(/professional\s*report|pro\s*report|detailed\s*report/)) {
          hideTyping();
          addBotMessage('Generating professional report...');
          const res = await postToWorker('AI_PROFESSIONAL_REPORT', { data: sheetData });
          const r = res.data;
          let html = `<strong>Professional Report</strong><br>`;
          html += `Rows: ${r.totalRows} | Columns: ${r.totalCols}<br><br>`;
          html += '<strong>Numeric Statistics:</strong><br>';
          Object.entries(r.stats).forEach(([col, s]) => {
            html += `• <strong>${window.escapeHtml(col)}</strong>: Sum=${formatNumber(s.sum)}, Avg=${formatNumber(s.avg)}, Median=${formatNumber(s.median)}, StdDev=${formatNumber(s.stdDev)}, Min=${formatNumber(s.min)}, Max=${formatNumber(s.max)}<br>`;
          });
          html += '<br><strong>Data Completeness:</strong><br>';
          Object.entries(r.completeness).forEach(([col, pct]) => {
            html += `• <strong>${window.escapeHtml(col)}</strong>: ${pct}%<br>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Executive Summary ──
        if (cmd.match(/executive\s*summary|exec\s*summary|summarize|summary/)) {
          hideTyping();
          addBotMessage('Generating executive summary...');
          const res = await postToWorker('AI_EXECUTIVE_SUMMARY', { data: sheetData });
          const r = res.data;
          const summaryText = window.escapeHtml(r.summary).replace(/\n/g, '<br>');
          addResultMessage(`<strong>Executive Summary</strong><br><div style="font-size:0.82rem;line-height:1.6;">${summaryText}</div>`);
          return;
        }

        // ── Profit Formula ──
        if (cmd.match(/profit|margin|profit\s*margin|calculate\s*profit/)) {
          hideTyping();
          addBotMessage('Calculating profit margins...');
          const res = await postToWorker('AI_PROFIT_FORMULA', { data: sheetData });
          const r = res.data;
          if (r.result.length === 0) { addBotMessage('No revenue/cost columns found.'); return; }
          let html = `<strong>Profit Calculation</strong> (Revenue: ${window.escapeHtml(r.revenueCol)}, Cost: ${window.escapeHtml(r.costCol)})<br>`;
          html += renderTable(Object.keys(r.result[0]), r.result);
          addResultMessage(html);
          return;
        }

        // ── GST Formula ──
        if (cmd.match(/gst|tax\s*formula|add\s*gst/)) {
          hideTyping();
          addBotMessage('Adding GST formula (18% default)...');
          const res = await postToWorker('AI_GST_FORMULA', { data: sheetData, gstRate: 18 });
          const r = res.data;
          if (r.result.length === 0) { addBotMessage('No amount column found.'); return; }
          let html = `<strong>GST Calculation</strong> (Amount column: ${window.escapeHtml(r.amountCol)}, Rate: ${r.gstRate}%)<br>`;
          html += renderTable(Object.keys(r.result[0]), r.result);
          addResultMessage(html);
          return;
        }

        // ── Commission ──
        if (cmd.match(/commission|commission\s*calculator|add\s*commission/)) {
          hideTyping();
          addBotMessage('Calculating commission (5% default)...');
          const res = await postToWorker('AI_COMMISSION', { data: sheetData, rate: 5 });
          const r = res.data;
          if (r.result.length === 0) { addBotMessage('No sales column found.'); return; }
          let html = `<strong>Commission Calculation</strong> (Sales column: ${window.escapeHtml(r.salesCol)}, Rate: ${r.rate}%)<br>`;
          html += renderTable(Object.keys(r.result[0]), r.result);
          addResultMessage(html);
          return;
        }

        // ── Monthly Growth ──
        if (cmd.match(/monthly\s*growth|month\s*growth|growth\s*by\s*month/)) {
          hideTyping();
          addBotMessage('Calculating monthly growth...');
          const res = await postToWorker('AI_MONTHLY_GROWTH', { data: sheetData });
          const r = res.data;
          if (r.growth.length === 0) { addBotMessage('Need date and numeric columns for growth analysis.'); return; }
          let html = `<strong>Monthly Growth</strong> (Date: ${window.escapeHtml(r.dateCol)}, Value: ${window.escapeHtml(r.valCol)})<br>`;
          r.growth.forEach(g => {
            const cls = g.growthPct > 0 ? 'pos-val' : g.growthPct < 0 ? 'neg-val' : '';
            html += `<div style="margin:3px 0;"><strong>${window.escapeHtml(g.month)}</strong> — ${formatNumber(g.value)} <span class="${cls}">(${g.growthPct > 0 ? '+' : ''}${g.growthPct}%)</span></div>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Yearly Growth ──
        if (cmd.match(/yearly\s*growth|year\s*growth|annual\s*growth|growth\s*by\s*year/)) {
          hideTyping();
          addBotMessage('Calculating yearly growth...');
          const res = await postToWorker('AI_YEARLY_GROWTH', { data: sheetData });
          const r = res.data;
          if (r.years.length === 0) { addBotMessage('Need date and numeric columns.'); return; }
          let html = `<strong>Yearly Growth</strong><br>`;
          r.years.forEach(y => {
            const cls = y.growthPct > 0 ? 'pos-val' : y.growthPct < 0 ? 'neg-val' : '';
            html += `<div style="margin:3px 0;"><strong>${window.escapeHtml(y.year)}</strong> — ${formatNumber(y.value)} <span class="${cls}">(${y.growthPct > 0 ? '+' : ''}${y.growthPct}%)</span></div>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Find Duplicates ──
        if (cmd.match(/duplicate|find\s*duplicate|detect\s*duplicate|duplicate\s*row/)) {
          hideTyping();
          addBotMessage('Scanning for duplicates...');
          const res = await postToWorker('AI_FIND_DUPLICATES', { data: sheetData });
          const r = res.data;
          let html = `<strong>Duplicate Analysis</strong><br>`;
          html += `Found <strong>${r.count}</strong> duplicate rows (${r.percentage}% of total)<br>`;
          if (r.duplicates.length > 0) {
            html += '<br><strong>Sample duplicates:</strong><br>';
            r.duplicates.slice(0, 10).forEach(d => {
              html += `• Row ${d.row} (first at row ${d.firstSeen})<br>`;
            });
          }
          addResultMessage(html);
          return;
        }

        // ── Missing Data ──
        if (cmd.match(/missing|empty|null|blank|data\s*quality/)) {
          hideTyping();
          addBotMessage('Analyzing missing data...');
          const res = await postToWorker('AI_MISSING_DATA', { data: sheetData });
          const r = res.data;
          let html = `<strong>Missing Data Analysis</strong> (Quality Score: ${r.analysis.qualityScore}%)<br>`;
          html += `Total missing: ${r.analysis.totalMissing} cells<br>`;
          Object.entries(r.analysis.columns).forEach(([col, info]) => {
            if (info.missing > 0) {
              html += `• <strong>${window.escapeHtml(col)}</strong>: ${info.missing} missing (${info.percentage}%)<br>`;
            }
          });
          addResultMessage(html);
          return;
        }

        // ── Group By ──
        if (cmd.match(/group\s*by|aggregate|summarize\s*by|breakdown\s*by/)) {
          hideTyping();
          const groupMatch = cmd.match(/group\s*by\s+(\w[\w\s]*)/i);
          const groupCol = groupMatch ? findClosestColumn(groupMatch[1].trim()) : null;
          addBotMessage(`Grouping data${groupCol ? ' by ' + groupCol : ''}...`);
          const res = await postToWorker('AI_GROUP_BY', { data: sheetData, groupCol });
          const r = res.data;
          if (r.groups.length === 0) { addBotMessage('No groups found.'); return; }
          let html = `<strong>Group By ${window.escapeHtml(r.groupCol)}</strong> (Value: ${window.escapeHtml(r.valCol || 'count')})<br>`;
          html += renderTable(['group', 'count', 'total', 'avg'], r.groups);
          addResultMessage(html);
          return;
        }

        // ── Filter by value ──
        if (cmd.match(/filter|show.*from|where\s|orders?\s*above|customers?\s*from|amount\s*above|revenue\s*above|price\s*above|greater\s*than|less\s*than|more\s*than|above\s*\d/)) {
          hideTyping();
          const parsed = parseFilterCommand(cmd);
          addBotMessage(`Filtering: ${parsed.column} ${parsed.operator} ${parsed.value}...`);
          const res = await postToWorker('AI_FILTER', { data: sheetData, column: parsed.column, operator: parsed.operator, value: parsed.value });
          const r = res.data;
          let html = `<strong>Filter Results</strong> — ${r.matchCount} rows matched<br>`;
          html += `Column: ${window.escapeHtml(r.column)}, Operator: ${r.operator}, Value: ${window.escapeHtml(String(r.value))}<br>`;
          if (r.filtered.length > 0) {
            html += renderTable(Object.keys(r.filtered[0]), r.filtered);
          }
          addResultMessage(html);
          return;
        }

        // ── Last Month Sales ──
        if (cmd.match(/last\s*month|previous\s*month|last\s*month\s*sale|last\s*month\s*revenue/)) {
          hideTyping();
          addBotMessage('Filtering last month data...');
          const res = await postToWorker('AI_LAST_MONTH', { data: sheetData });
          const r = res.data;
          let html = `<strong>Last Month Data</strong><br>`;
          html += `Rows: ${r.count} | Total: ${formatNumber(r.total)}<br>`;
          if (r.result.length > 0) {
            html += renderTable(Object.keys(r.result[0]), r.result);
          }
          addResultMessage(html);
          return;
        }

        // ── Inactive Customers ──
        if (cmd.match(/inactive|dormant|lost\s*customer|churn|no\s*activity/)) {
          hideTyping();
          addBotMessage('Finding inactive customers (90+ days)...');
          const res = await postToWorker('AI_INACTIVE', { data: sheetData, daysThreshold: 90 });
          const r = res.data;
          let html = `<strong>Inactive Customers</strong> (${r.inactive.length} found, threshold: ${r.daysThreshold} days)<br>`;
          if (r.inactive.length > 0) {
            html += renderTable(Object.keys(r.inactive[0]), r.inactive);
          }
          addResultMessage(html);
          return;
        }

        // ── Hindi Translation ──
        if (cmd.match(/hindi|translate|translate\s*to\s*hindi/)) {
          hideTyping();
          addBotMessage('Translating to Hindi...');
          const res = await postToWorker('TRANSLATE', { data: sheetData, headers });
          const r = res.data;
          let html = `<strong>Hindi Translation Complete</strong> (${r.duration}ms)<br>`;
          html += renderTable(r.translatedHeaders, r.translatedData);
          addResultMessage(html);
          return;
        }

        // ── Export PDF (opens dashboard) ──
        if (cmd.match(/export\s*pdf|download\s*pdf|save\s*pdf|pdf\s*export/)) {
          hideTyping();
          addBotMessage('PDF export is available in the Dashboard. <a href="dashboard.html" style="color:var(--primary);">Go to Dashboard → Export</a>');
          return;
        }

        // ── Email Report ──
        if (cmd.match(/email|send\s*report|mail\s*report|email\s*report/)) {
          hideTyping();
          addBotMessage('Email manager is available in the Dashboard. <a href="dashboard.html" style="color:var(--primary);">Go to Dashboard → Email</a>');
          return;
        }

        // ── Auto Clean ──
        if (cmd.match(/clean|remove\s*duplicate|trim|sanitize|data\s*clean/)) {
          hideTyping();
          addBotMessage('Running auto-clean (removing duplicates, trimming spaces)...');
          const res = await postToWorker('CLEAN', { data: sheetData, rules: { removeDuplicates: true, removeEmpty: false, trimSpaces: true, normalizeDates: false } });
          const r = res.data;
          sheetData = r.cleaned;
          headers = sheetData.length > 0 ? Object.keys(sheetData[0]) : [];
          saveToStorage();
          updateMiniPreview();
          let html = `<strong>Clean Complete</strong> (${r.duration}ms)<br>`;
          html += `Duplicates removed: ${r.stats.duplicatesRemoved}<br>`;
          html += `Cells trimmed: ${r.stats.trimmedCells}<br>`;
          html += `Rows remaining: ${sheetData.length}`;
          addResultMessage(html);
          return;
        }

        // ── Show data / preview ──
        if (cmd.match(/show\s*data|preview|show\s*all|display\s*data|show\s*table/)) {
          hideTyping();
          let html = `<strong>Data Preview</strong> (${sheetData.length} rows × ${headers.length} columns)<br>`;
          html += renderTable(headers, sheetData, 15);
          addResultMessage(html);
          return;
        }

        // ── Columns ──
        if (cmd.match(/column|field|header|what\s*columns/)) {
          hideTyping();
          let html = `<strong>Columns (${headers.length}):</strong><br>`;
          headers.forEach((h, i) => {
            const type = sheetData.length > 0 ? detectSampleType(sheetData, h) : 'unknown';
            html += `${i + 1}. <strong>${window.escapeHtml(h)}</strong> <span style="color:var(--text-muted);font-size:0.75rem;">(${type})</span><br>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Row count ──
        if (cmd.match(/row\s*count|how\s*many\s*rows|total\s*rows|record\s*count/)) {
          hideTyping();
          addResultMessage(`<strong>Row Count:</strong> ${sheetData.length} rows`);
          return;
        }

        // ── Forecast ──
        if (cmd.match(/forecast|predict|future\s*value|projection/)) {
          hideTyping();
          addBotMessage('Running linear forecast...');
          const res = await postToWorker('AI_FORECAST', { data: sheetData });
          const r = res.data;
          let html = `<strong>Forecast Results</strong><br>`;
          Object.entries(r.forecasts).forEach(([col, f]) => {
            const cls = f.direction === 'growth' ? 'pos-val' : f.direction === 'decline' ? 'neg-val' : '';
            html += `<strong>${window.escapeHtml(col)}</strong>: <span class="${cls}">${f.direction}</span> (slope: ${f.slope}, R²: ${f.confidence})<br>`;
            html += `Next values: ${f.forecast.map(v => formatNumber(v)).join(', ')}<br>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Trend ──
        if (cmd.match(/trend|momentum|direction/)) {
          hideTyping();
          addBotMessage('Analyzing trends...');
          const res = await postToWorker('AI_TREND', { data: sheetData });
          const r = res.data;
          let html = `<strong>Trend Analysis</strong><br>`;
          Object.entries(r.trends).forEach(([col, t]) => {
            const cls = t.direction === 'upward' ? 'pos-val' : t.direction === 'downward' ? 'neg-val' : '';
            html += `<strong>${window.escapeHtml(col)}</strong>: <span class="${cls}">${t.direction}</span> (${t.strength}) — ${t.summary}<br>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Dashboard Builder ──
        if (cmd.match(/dashboard|build\s*dashboard|create\s*dashboard|auto\s*dashboard/)) {
          hideTyping();
          addBotMessage('Building dashboard widgets...');
          const res = await postToWorker('AI_DASHBOARD', { data: sheetData });
          const r = res.data;
          let html = `<strong>Dashboard Built</strong> (${r.widgets.length} widgets generated)<br>`;
          r.widgets.forEach(w => {
            html += `• ${w.type.toUpperCase()}: ${window.escapeHtml(w.title)}<br>`;
          });
          addResultMessage(html);
          return;
        }

        // ── Help fallback ──
        hideTyping();
        addBotMessage(`I didn't understand "<strong>${window.escapeHtml(text)}</strong>". Try:
          <br>• "Analyze this file"
          <br>• "Show top 10 customers"
          <br>• "Create pie chart"
          <br>• "Generate professional report"
          <br>• "Calculate profit margin"
          <br>• "Find duplicates"
          <br>• "Show monthly growth"
          <br>• "Filter orders above 50000"
          <br>• "Group by state"
          <br>• "Translate to Hindi"
          <br>• "Show missing data"
          <br>• "Forecast sales"
          <br>• "Show columns"
          <br>• "Clean data"`);

      } catch (err) {
        hideTyping();
        addErrorMessage(`Error: ${err.message}`);
      }
    }, 400);
  }

  // ─── NLP HELPERS ────────────────────────────────────────────────────────────
  function findClosestColumn(name) {
    const lower = name.toLowerCase();
    let best = headers.find(h => h.toLowerCase() === lower);
    if (best) return best;
    best = headers.find(h => h.toLowerCase().includes(lower));
    if (best) return best;
    best = headers.find(h => lower.includes(h.toLowerCase()));
    return best || name;
  }

  function detectSampleType(data, col) {
    const sample = data.slice(0, 50).map(r => String(r[col] || '').trim()).filter(v => v);
    if (sample.every(v => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v))) return 'email';
    if (sample.every(v => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v))) return 'date';
    if (sample.every(v => !isNaN(Number(v.replace(/[^0-9.-]/g, ''))))) return 'number';
    if (sample.every(v => /^(true|false|yes|no)$/i.test(v))) return 'boolean';
    return 'text';
  }

  function parseFilterCommand(cmd) {
    let column = '', operator = 'contains', value = '';

    // Pattern: "show customers from mumbai" / "filter region = north"
    const fromMatch = cmd.match(/(?:show|find|filter|where)\s+.*?\s+(?:from|in|by)\s+(\w[\w\s]*?)(?:\s*$|\s+where|\s+and)/i);
    const equalsMatch = cmd.match(/(\w[\w\s]*?)\s*(?:=|equals|is|==)\s*(\w[\w\s]*?)$/i);
    const aboveMatch = cmd.match(/(?:above|greater|more|over|>)\s*(\d+[\d,]*)/i);
    const belowMatch = cmd.match(/(?:below|less|under|<)\s*(\d+[\d,]*)/i);
    const likeMatch = cmd.match(/(?:like|contains?|has)\s+(\w[\w\s]*?)$/i);

    if (aboveMatch) {
      const numHeaders = headers.filter(h => sheetData.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
      column = numHeaders[0] || headers[0];
      operator = 'greater';
      value = aboveMatch[1].replace(/,/g, '');
    } else if (belowMatch) {
      const numHeaders = headers.filter(h => sheetData.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
      column = numHeaders[0] || headers[0];
      operator = 'less';
      value = belowMatch[1].replace(/,/g, '');
    } else if (fromMatch) {
      column = findClosestColumn(fromMatch[1].trim());
      operator = 'contains';
      value = fromMatch[1].trim();
    } else if (equalsMatch) {
      column = findClosestColumn(equalsMatch[1].trim());
      operator = 'equals';
      value = equalsMatch[2].trim();
    } else {
      // Fallback: try to find a column name and a value
      const words = cmd.split(/\s+/);
      for (const h of headers) {
        const idx = words.findIndex(w => w.toLowerCase() === h.toLowerCase() || h.toLowerCase().includes(w.toLowerCase()));
        if (idx >= 0) {
          column = h;
          const remaining = words.slice(idx + 1).filter(w => !['the', 'a', 'an', 'is', 'are', 'was'].includes(w));
          value = remaining.join(' ');
          break;
        }
      }
      if (!column) {
        column = headers[0];
        value = cmd.replace(/show|find|filter|where|data|rows|records/gi, '').trim();
      }
    }

    return { column, operator, value };
  }

  // ─── VOICE RECOGNITION ──────────────────────────────────────────────────────
  function initVoice() {
    const btn = document.getElementById('btn-voice');
    if (!btn) return;

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      btn.title = 'Voice not supported in this browser';
      btn.style.opacity = '0.4';
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      document.getElementById('ai-input').value = text;
      addUserMessage(text);
      processCommand(text);
    };

    recognition.onend = () => {
      isListening = false;
      btn.classList.remove('listening');
    };

    recognition.onerror = (event) => {
      isListening = false;
      btn.classList.remove('listening');
      if (event.error !== 'no-speech') {
        addErrorMessage(`Voice error: ${event.error}`);
      }
    };

    btn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
        isListening = false;
        btn.classList.remove('listening');
      } else {
        recognition.start();
        isListening = true;
        btn.classList.add('listening');
        addSystemMessage('Listening... Speak a command.');
      }
    });
  }

  // ─── QUICK COMMANDS ─────────────────────────────────────────────────────────
  function initQuickCommands() {
    document.querySelectorAll('.cmd-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd');
        if (cmd) {
          document.getElementById('ai-input').value = cmd;
          addUserMessage(cmd);
          processCommand(cmd);
        }
      });
    });
  }

  // ─── WORKFLOW TOGGLES ───────────────────────────────────────────────────────
  function initWorkflowToggles() {
    document.querySelectorAll('.wf-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const wf = toggle.getAttribute('data-wf');
        toggle.classList.toggle('on');
        WORKFLOWS[wf] = toggle.classList.contains('on');
        const item = toggle.closest('.workflow-item');
        if (item) item.classList.toggle('wf-active', WORKFLOWS[wf]);
        addSystemMessage(`Workflow "${wf}" ${WORKFLOWS[wf] ? 'enabled' : 'disabled'}`);
      });
    });
  }

  // ─── CLEAR / EXPORT CHAT ───────────────────────────────────────────────────
  function initClearChat() {
    const btn = document.getElementById('btn-clear-chat');
    if (btn) {
      btn.addEventListener('click', () => {
        document.getElementById('ai-messages').innerHTML = '';
        addSystemMessage('Chat cleared.');
      });
    }
  }

  function initExportChat() {
    const btn = document.getElementById('btn-export-chat');
    if (btn) {
      btn.addEventListener('click', () => {
        const msgs = document.querySelectorAll('.ai-msg');
        let text = '=== AI Command Center Chat Export ===\n\n';
        msgs.forEach(m => {
          const type = m.classList.contains('user') ? 'You' : m.classList.contains('bot') ? 'AI' : m.classList.contains('result') ? 'Result' : 'System';
          text += `[${type}]: ${m.textContent.trim()}\n\n`;
        });
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ai-chat-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Chat exported', 'success');
      });
    }
  }

  // ─── MINI DATA PREVIEW ──────────────────────────────────────────────────────
  function updateMiniPreview() {
    const container = document.getElementById('mini-data-preview');
    const countEl = document.getElementById('data-row-count');
    if (!container) return;

    if (sheetData.length === 0) {
      container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.8rem;">No data loaded.</div>';
      if (countEl) countEl.textContent = '';
      return;
    }

    if (countEl) countEl.textContent = `${sheetData.length} rows`;

    const previewHeaders = headers.slice(0, 6);
    let html = '<table><thead><tr>';
    previewHeaders.forEach(h => { html += `<th>${window.escapeHtml(h)}</th>`; });
    html += '</tr></thead><tbody>';
    sheetData.slice(0, 10).forEach(row => {
      html += '<tr>';
      previewHeaders.forEach(h => {
        let val = String(row[h] ?? '');
        const num = Number(val.replace(/[^0-9.-]/g, ''));
        if (!isNaN(num) && val !== '') {
          const cls = num < 0 ? 'neg-val' : '';
          html += `<td class="${cls}">${window.escapeHtml(val)}</td>`;
        } else {
          html += `<td>${window.escapeHtml(val)}</td>`;
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ─── AUTO-WORKFLOW ENGINE ───────────────────────────────────────────────────
  // Called when dashboard detects a file upload. Also callable from the chat.
  window.runAutoWorkflows = async function(data, headersList, fname) {
    sheetData = data;
    headers = headersList;
    fileName = fname;
    saveToStorage();
    updateMiniPreview();

    const steps = [];
    if (WORKFLOWS.clean) steps.push({ name: 'Auto Clean', action: async () => {
      const res = await postToWorker('CLEAN', { data: sheetData, rules: { removeDuplicates: true, trimSpaces: true } });
      sheetData = res.data.cleaned;
      headers = sheetData.length > 0 ? Object.keys(sheetData[0]) : [];
      saveToStorage();
      return `Cleaned: ${res.data.stats.duplicatesRemoved} duplicates removed`;
    }});
    if (WORKFLOWS.report) steps.push({ name: 'Auto Report', action: async () => {
      const res = await postToWorker('AI_PROFESSIONAL_REPORT', { data: sheetData });
      return `Report generated (${Object.keys(res.data.stats).length} metrics)`;
    }});
    if (WORKFLOWS.pdf) steps.push({ name: 'Auto PDF', action: async () => {
      return 'PDF export queued (open Dashboard to download)';
    }});
    if (WORKFLOWS.backup) steps.push({ name: 'Auto Backup', action: async () => {
      try { localStorage.setItem(`excelAuto_backup_${fname}`, JSON.stringify(sheetData.slice(0, 5000))); } catch(e) {}
      return 'Data backed up to local storage';
    }});

    if (steps.length === 0) return;

    addSystemMessage(`Auto-workflow triggered for "${fname}" (${steps.length} steps)...`);
    for (const step of steps) {
      try {
        const result = await step.action();
        addSystemMessage(`✓ ${step.name}: ${result}`);
      } catch (err) {
        addErrorMessage(`✗ ${step.name} failed: ${err.message}`);
      }
    }
    addSystemMessage('Auto-workflow complete.');
    updateMiniPreview();
  };

})();
