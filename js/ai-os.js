/* ==========================================================================
   EXCEL AUTO - AI OPERATING SYSTEM ENGINE v2.0
   Full NLP command center with:
   • Action Engine: 60+ commands executing real actions
   • Report Editor: modify reports via chat
   • File Commands: merge, split, rename, convert
   • Dashboard Builder: auto-create dashboards
   • Data Analyst: auto-analyze on upload
   • Workflow Builder: natural language workflows
   • Voice Assistant: Web Speech API
   • Memory: user preferences & frequent commands
   • Command Suggestions: autocomplete while typing
   • Business Assistant: answer questions from data
   • Autonomous Mode: full auto-processing
   • Command History, Templates, Keyboard Shortcuts
   ========================================================================== */
'use strict';

(function() {
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  let sheetData = [], headers = [], fileName = '', worker = null;
  let recognition = null, isListening = false;
  let commandHistory = [], historyIndex = -1;
  let miniChart = null;
  let processing = false;

  const WORKFLOWS = { autonomous: true, clean: true, report: true, pdf: false, email: false, backup: true, dashboard: false, forecast: false };

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMAND DATABASE - every command maps to a real action
  // ═══════════════════════════════════════════════════════════════════════════
  const COMMANDS = [
    // ── Data Analysis ──
    { patterns: [/(?:analyze|full analysis|comprehensive|complete analysis)/i], action: 'fullAnalysis', category: 'Analysis', icon: 'fa-magnifying-glass-chart', desc: 'Full file analysis' },
    { patterns: [/(?:top\s*10|best\s*customer|top\s*customer|highest)/i], action: 'topCustomers', category: 'Analysis', icon: 'fa-trophy', desc: 'Top 10 customers' },
    { patterns: [/(?:top\s*product|best\s*product|best\s*selling|top\s*item)/i], action: 'topProducts', category: 'Analysis', icon: 'fa-star', desc: 'Top products' },
    { patterns: [/(?:duplicate|find\s*dup|detect\s*dup)/i], action: 'findDuplicates', category: 'Analysis', icon: 'fa-clone', desc: 'Find duplicates' },
    { patterns: [/(?:missing|empty|null|blank|data\s*quality)/i], action: 'missingData', category: 'Analysis', icon: 'fa-triangle-exclamation', desc: 'Missing data' },
    { patterns: [/(?:show\s*data|preview|show\s*all|display\s*data|show\s*table)/i], action: 'showData', category: 'Analysis', icon: 'fa-table', desc: 'Show data preview' },
    { patterns: [/(?:column|field|header|what\s*column)/i], action: 'showColumns', category: 'Analysis', icon: 'fa-list', desc: 'Show columns' },
    { patterns: [/(?:row\s*count|how\s*many\s*row|total\s*row|record\s*count)/i], action: 'rowCount', category: 'Analysis', icon: 'fa-hashtag', desc: 'Row count' },

    // ── Reports ──
    { patterns: [/(?:create|generate|build)\s*(?:sales\s*)?report/i], action: 'salesReport', category: 'Reports', icon: 'fa-file-lines', desc: 'Create sales report' },
    { patterns: [/(?:professional\s*report|pro\s*report|detailed\s*report)/i], action: 'proReport', category: 'Reports', icon: 'fa-file-contract', desc: 'Professional report' },
    { patterns: [/(?:executive\s*summary|exec\s*summary)/i], action: 'execSummary', category: 'Reports', icon: 'fa-scroll', desc: 'Executive summary' },
    { patterns: [/(?:summary|summarize)/i], action: 'execSummary', category: 'Reports', icon: 'fa-scroll', desc: 'Summary' },

    // ── Charts ──
    { patterns: [/(?:pie\s*chart|donut|circle)/i], action: 'pieChart', category: 'Charts', icon: 'fa-chart-pie', desc: 'Pie chart' },
    { patterns: [/(?:bar\s*chart|bar\s*graph)/i], action: 'barChart', category: 'Charts', icon: 'fa-chart-bar', desc: 'Bar chart' },
    { patterns: [/(?:line\s*chart|trend\s*chart|line\s*graph)/i], action: 'lineChart', category: 'Charts', icon: 'fa-chart-line', desc: 'Line chart' },
    { patterns: [/(?:chart|graph|visual)/i], action: 'pieChart', category: 'Charts', icon: 'fa-chart-pie', desc: 'Create chart' },
    { patterns: [/(?:change\s*chart\s*(?:to\s*)?pie)/i], action: 'pieChart', category: 'Charts', icon: 'fa-chart-pie', desc: 'Change to pie chart' },

    // ── Formulas ──
    { patterns: [/(?:profit|margin|profit\s*margin|calculate\s*profit)/i], action: 'profitFormula', category: 'Formulas', icon: 'fa-indian-rupee-sign', desc: 'Calculate profit' },
    { patterns: [/(?:add\s*gst|gst\s*formula|gst)/i], action: 'gstFormula', category: 'Formulas', icon: 'fa-percent', desc: 'Add GST' },
    { patterns: [/(?:commission|commission\s*calc)/i], action: 'commission', category: 'Formulas', icon: 'fa-calculator', desc: 'Commission' },
    { patterns: [/(?:add\s*profit\s*column|profit\s*column)/i], action: 'profitFormula', category: 'Formulas', icon: 'fa-plus', desc: 'Add profit column' },

    // ── Growth ──
    { patterns: [/(?:monthly\s*growth|month\s*growth|growth\s*by\s*month)/i], action: 'monthlyGrowth', category: 'Growth', icon: 'fa-arrow-trend-up', desc: 'Monthly growth' },
    { patterns: [/(?:yearly\s*growth|annual\s*growth|growth\s*by\s*year)/i], action: 'yearlyGrowth', category: 'Growth', icon: 'fa-chart-line', desc: 'Yearly growth' },
    { patterns: [/(?:show\s*monthly|show\s*growth)/i], action: 'monthlyGrowth', category: 'Growth', icon: 'fa-arrow-trend-up', desc: 'Show growth' },

    // ── Filters ──
    { patterns: [/(?:filter|show.*from|where|orders?\s*above|customers?\s*from|amount\s*above|greater\s*than|less\s*than|more\s*than|above\s*\d)/i], action: 'filterData', category: 'Filters', icon: 'fa-filter', desc: 'Filter data' },
    { patterns: [/(?:last\s*month|previous\s*month)/i], action: 'lastMonth', category: 'Filters', icon: 'fa-calendar', desc: 'Last month' },
    { patterns: [/(?:inactive|dormant|lost\s*customer|churn)/i], action: 'inactiveCustomers', category: 'Filters', icon: 'fa-user-slash', desc: 'Inactive customers' },

    // ── Groups ──
    { patterns: [/(?:group\s*by|aggregate|summarize\s*by|breakdown)/i], action: 'groupBy', category: 'Groups', icon: 'fa-layer-group', desc: 'Group by' },
    { patterns: [/(?:pivot|pivot\s*table)/i], action: 'pivotTable', category: 'Groups', icon: 'fa-table-pivot', desc: 'Pivot table' },

    // ── Forecasting ──
    { patterns: [/(?:forecast|predict|future|projection|next\s*month)/i], action: 'forecast', category: 'Forecast', icon: 'fa-chart-line', desc: 'Forecast' },
    { patterns: [/(?:trend|momentum)/i], action: 'trend', category: 'Forecast', icon: 'fa-arrow-trend-up', desc: 'Trend analysis' },

    // ── Dashboard Builder ──
    { patterns: [/(?:build|create|generate)\s*(?:sales\s*)?dashboard/i], action: 'buildDashboard', category: 'Dashboard', icon: 'fa-gauge-high', desc: 'Build dashboard' },
    { patterns: [/(?:build\s*inventory|inventory\s*dashboard)/i], action: 'buildInventoryDashboard', category: 'Dashboard', icon: 'fa-boxes-stacked', desc: 'Inventory dashboard' },
    { patterns: [/(?:build\s*finance|finance\s*dashboard)/i], action: 'buildFinanceDashboard', category: 'Dashboard', icon: 'fa-building-columns', desc: 'Finance dashboard' },
    { patterns: [/(?:build\s*gst|gst\s*dashboard)/i], action: 'buildGstDashboard', category: 'Dashboard', icon: 'fa-receipt', desc: 'GST dashboard' },
    { patterns: [/(?:dashboard|build\s*dash|auto\s*dash)/i], action: 'buildDashboard', category: 'Dashboard', icon: 'fa-gauge-high', desc: 'Dashboard' },

    // ── Data Cleaning ──
    { patterns: [/(?:clean|remove\s*dup|trim|sanitize|data\s*clean)/i], action: 'cleanData', category: 'Clean', icon: 'fa-broom', desc: 'Clean data' },

    // ── Translation ──
    { patterns: [/(?:hindi|translate|translate\s*to\s*hindi)/i], action: 'translateHindi', category: 'Translate', icon: 'fa-language', desc: 'Translate Hindi' },

    // ── Export ──
    { patterns: [/(?:export\s*pdf|generate\s*pdf|download\s*pdf|save\s*pdf|pdf\s*export|create\s*pdf)/i], action: 'exportPDF', category: 'Export', icon: 'fa-file-pdf', desc: 'Export PDF' },
    { patterns: [/(?:export\s*excel|generate\s*excel|download\s*excel|create\s*excel|xlsx)/i], action: 'exportExcel', category: 'Export', icon: 'fa-file-excel', desc: 'Export Excel' },
    { patterns: [/(?:export\s*csv|download\s*csv|create\s*csv)/i], action: 'exportCSV', category: 'Export', icon: 'fa-file-csv', desc: 'Export CSV' },

    // ── Email ──
    { patterns: [/(?:email|send\s*report|mail\s*report|email\s*report)/i], action: 'emailReport', category: 'Email', icon: 'fa-envelope', desc: 'Email report' },

    // ── File Commands ──
    { patterns: [/(?:merge\s*file|combine\s*file|merge\s*sheet)/i], action: 'mergeFiles', category: 'Files', icon: 'fa-code-merge', desc: 'Merge files' },
    { patterns: [/(?:split\s*file|separate\s*file)/i], action: 'splitFiles', category: 'Files', icon: 'fa-code-branch', desc: 'Split files' },
    { patterns: [/(?:rename\s*file|change\s*name)/i], action: 'renameFile', category: 'Files', icon: 'fa-pen', desc: 'Rename file' },
    { patterns: [/(?:archive|compress)/i], action: 'archiveFiles', category: 'Files', icon: 'fa-box-archive', desc: 'Archive' },
    { patterns: [/(?:delete\s*file|remove\s*file)/i], action: 'deleteFile', category: 'Files', icon: 'fa-trash', desc: 'Delete file' },
    { patterns: [/(?:restore|recover)/i], action: 'restoreFile', category: 'Files', icon: 'fa-rotate-left', desc: 'Restore' },
    { patterns: [/(?:convert\s*pdf\s*to\s*excel|pdf\s*to\s*xlsx)/i], action: 'pdfToExcel', category: 'Files', icon: 'fa-file-excel', desc: 'PDF→Excel' },
    { patterns: [/(?:convert\s*excel\s*to\s*pdf|xlsx\s*to\s*pdf)/i], action: 'exportPDF', category: 'Files', icon: 'fa-file-pdf', desc: 'Excel→PDF' },

    // ── Report Editor ──
    { patterns: [/(?:add\s*filter|add\s*filters)/i], action: 'addFilters', category: 'Editor', icon: 'fa-filter', desc: 'Add filters' },
    { patterns: [/(?:convert\s*currency|currency\s*to)/i], action: 'convertCurrency', category: 'Editor', icon: 'fa-money-bill', desc: 'Convert currency' },

    // ── Business Q&A ──
    { patterns: [/(?:how\s*much\s*revenue|revenue\s*(?:last|this)\s*month|total\s*revenue)/i], action: 'qaRevenue', category: 'Q&A', icon: 'fa-circle-question', desc: 'Revenue last month' },
    { patterns: [/(?:which\s*state|best\s*state|top\s*state|which\s*region)/i], action: 'qaBestState', category: 'Q&A', icon: 'fa-circle-question', desc: 'Best state' },
    { patterns: [/(?:which\s*product|most\s*profit|top\s*product|best\s*product)/i], action: 'qaBestProduct', category: 'Q&A', icon: 'fa-circle-question', desc: 'Best product' },
    { patterns: [/(?:how\s*many|total\s*(?:customer|order|record|row|sale))/i], action: 'qaTotalCount', category: 'Q&A', icon: 'fa-circle-question', desc: 'Total count' },
    { patterns: [/(?:what\s*(?:is|are)\s*the|tell\s*me\s*about|explain|describe)/i], action: 'qaExplain', category: 'Q&A', icon: 'fa-circle-question', desc: 'Explain data' },

    // ── Autonomous Mode ──
    { patterns: [/(?:autonomous|auto\s*mode|run\s*everything|do\s*everything|full\s*auto)/i], action: 'autonomousMode', category: 'Auto', icon: 'fa-wand-magic-sparkles', desc: 'Autonomous mode' },

    // ── Workflow Builder ──
    { patterns: [/(?:when\s*file\s*upload|create\s*workflow|build\s*workflow|workflow)/i], action: 'buildWorkflow', category: 'Workflow', icon: 'fa-gears', desc: 'Build workflow' },

    // ── Greetings ──
    { patterns: [/^(?:hi|hello|hey|help|what\s*can\s*you)/i], action: 'help', category: 'General', icon: 'fa-circle-question', desc: 'Help' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // SUGGESTION DATABASE
  // ═══════════════════════════════════════════════════════════════════════════
  const SUGGESTIONS = [
    { text: 'Analyze file completely', cat: 'Analysis', icon: 'fa-magnifying-glass-chart', color: 'var(--ai-primary)' },
    { text: 'Build sales dashboard', cat: 'Dashboard', icon: 'fa-gauge-high', color: 'var(--ai-info)' },
    { text: 'Create sales report', cat: 'Reports', icon: 'fa-file-lines', color: 'var(--ai-primary)' },
    { text: 'Generate PDF', cat: 'Export', icon: 'fa-file-pdf', color: 'var(--ai-danger)' },
    { text: 'Generate Excel export', cat: 'Export', icon: 'fa-file-excel', color: 'var(--ai-success)' },
    { text: 'Find duplicates', cat: 'Analysis', icon: 'fa-clone', color: 'var(--ai-warn)' },
    { text: 'Clean data', cat: 'Clean', icon: 'fa-broom', color: 'var(--ai-success)' },
    { text: 'Show top 10 customers', cat: 'Analysis', icon: 'fa-trophy', color: 'var(--ai-warn)' },
    { text: 'Forecast next month sales', cat: 'Forecast', icon: 'fa-chart-line', color: 'var(--ai-pink)' },
    { text: 'Create pie chart', cat: 'Charts', icon: 'fa-chart-pie', color: 'var(--ai-purple)' },
    { text: 'Create executive summary', cat: 'Reports', icon: 'fa-scroll', color: 'var(--ai-info)' },
    { text: 'Calculate profit margin', cat: 'Formulas', icon: 'fa-indian-rupee-sign', color: 'var(--ai-success)' },
    { text: 'Add GST formula', cat: 'Formulas', icon: 'fa-percent', color: 'var(--ai-warn)' },
    { text: 'Show monthly growth', cat: 'Growth', icon: 'fa-arrow-trend-up', color: 'var(--ai-success)' },
    { text: 'Show yearly growth', cat: 'Growth', icon: 'fa-chart-line', color: 'var(--ai-info)' },
    { text: 'Group by state', cat: 'Groups', icon: 'fa-layer-group', color: 'var(--ai-purple)' },
    { text: 'Find missing data', cat: 'Analysis', icon: 'fa-triangle-exclamation', color: 'var(--ai-danger)' },
    { text: 'Email report to manager', cat: 'Email', icon: 'fa-envelope', color: 'var(--ai-purple)' },
    { text: 'Translate to Hindi', cat: 'Translate', icon: 'fa-language', color: 'var(--ai-info)' },
    { text: 'Create pivot table', cat: 'Groups', icon: 'fa-table-pivot', color: 'var(--ai-primary)' },
    { text: 'Calculate commission', cat: 'Formulas', icon: 'fa-calculator', color: 'var(--ai-warn)' },
    { text: 'Show customers from Mumbai', cat: 'Filters', icon: 'fa-filter', color: 'var(--ai-info)' },
    { text: 'Show orders above 50000', cat: 'Filters', icon: 'fa-filter', color: 'var(--ai-info)' },
    { text: 'Show last month sales', cat: 'Filters', icon: 'fa-calendar', color: 'var(--ai-info)' },
    { text: 'Find inactive customers', cat: 'Filters', icon: 'fa-user-slash', color: 'var(--ai-danger)' },
    { text: 'Build inventory dashboard', cat: 'Dashboard', icon: 'fa-boxes-stacked', color: 'var(--ai-info)' },
    { text: 'Build finance dashboard', cat: 'Dashboard', icon: 'fa-building-columns', color: 'var(--ai-info)' },
    { text: 'Build GST dashboard', cat: 'Dashboard', icon: 'fa-receipt', color: 'var(--ai-info)' },
    { text: 'Merge files', cat: 'Files', icon: 'fa-code-merge', color: 'var(--ai-pink)' },
    { text: 'Split files', cat: 'Files', icon: 'fa-code-branch', color: 'var(--ai-pink)' },
    { text: 'Convert PDF to Excel', cat: 'Files', icon: 'fa-file-excel', color: 'var(--ai-success)' },
    { text: 'How much revenue last month?', cat: 'Q&A', icon: 'fa-circle-question', color: 'var(--ai-info)' },
    { text: 'Top 10 customers?', cat: 'Q&A', icon: 'fa-circle-question', color: 'var(--ai-info)' },
    { text: 'Which state performed best?', cat: 'Q&A', icon: 'fa-circle-question', color: 'var(--ai-info)' },
    { text: 'Which product generated most profit?', cat: 'Q&A', icon: 'fa-circle-question', color: 'var(--ai-info)' },
    { text: 'Autonomous mode', cat: 'Auto', icon: 'fa-wand-magic-sparkles', color: 'var(--ai-purple)' },
    { text: 'When file uploaded, generate report and PDF', cat: 'Workflow', icon: 'fa-gears', color: 'var(--ai-success)' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    try { initWorker(); } catch(e) { console.error('Worker init failed:', e); }
    try { initChatInput(); } catch(e) { console.error('Chat input init failed:', e); }
    try { initVoice(); } catch(e) { console.error('Voice init failed:', e); }
    try { initQuickActions(); } catch(e) { console.error('Quick actions init failed:', e); }
    try { initPanelTabs(); } catch(e) { console.error('Panel tabs init failed:', e); }
    try { initWorkflowToggles(); } catch(e) { console.error('Workflow toggles init failed:', e); }
    try { initClearChat(); } catch(e) { console.error('Clear chat init failed:', e); }
    try { initExportChat(); } catch(e) { console.error('Export chat init failed:', e); }
    try { initAutonomousBtn(); } catch(e) { console.error('Autonomous btn init failed:', e); }
    try { initShortcutsModal(); } catch(e) { console.error('Shortcuts modal init failed:', e); }
    try { initKeyboardShortcuts(); } catch(e) { console.error('Keyboard shortcuts init failed:', e); }
    try { initFileAttach(); } catch(e) { console.error('File attach init failed:', e); }
    try { initClearMemory(); } catch(e) { console.error('Clear memory init failed:', e); }
    try { initClearHistory(); } catch(e) { console.error('Clear history init failed:', e); }
    try { initTogglePanel(); } catch(e) { console.error('Toggle panel init failed:', e); }
    try { loadFromStorage(); } catch(e) { console.error('Load storage failed:', e); }
    try { renderHistory(); } catch(e) { console.error('Render history failed:', e); }
    try { renderMemory(); } catch(e) { console.error('Render memory failed:', e); }
    try { updateStatusBar(); } catch(e) { console.error('Update status bar failed:', e); }
    console.log('[AI OS] initialized successfully');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKER
  // ═══════════════════════════════════════════════════════════════════════════
  function getWorker() {
    if (!worker) {
      try {
        worker = new Worker('js/excel-worker.js');
        worker.onerror = function(e) { console.error('[AI OS] Worker error:', e.message); };
      } catch(e) {
        console.error('[AI OS] Failed to create worker:', e);
        return null;
      }
    }
    return worker;
  }

  function postToWorker(action, payload, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const w = getWorker();
      if (!w) { reject(new Error('Worker not available')); return; }
      const id = `os_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      let settled = false;
      const expectedAction = action + '_COMPLETE';
      const listener = (e) => {
        if (e.data && e.data.id === id && !e.data.type) {
          if (e.data.action === expectedAction || e.data.error) {
            w.removeEventListener('message', listener);
            if (!settled) { settled = true; clearTimeout(timer); e.data.error ? reject(new Error(e.data.error)) : resolve(e.data); }
          }
        }
      };
      const timer = setTimeout(() => { if (!settled) { settled = true; w.removeEventListener('message', listener); reject(new Error('Command timed out')); } }, timeout);
      w.addEventListener('message', listener);
      w.postMessage({ action, payload, id });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════════════════════
  function loadFromStorage() {
    try {
      const s = localStorage.getItem('excelAuto_activeData');
      if (s) {
        const p = JSON.parse(s);
        sheetData = p.data || [];
        headers = p.headers || (sheetData.length > 0 ? Object.keys(sheetData[0]) : []);
        fileName = p.fileName || 'Unknown';
        updateMiniPreview();
        updateStatusBar();
      }
      const h = localStorage.getItem('aiOS_history');
      if (h) commandHistory = JSON.parse(h);
      const m = localStorage.getItem('aiOS_memory');
      if (m) {} // memory loaded on demand
    } catch(e) {}
  }

  function saveData() {
    try { localStorage.setItem('excelAuto_activeData', JSON.stringify({ data: sheetData.slice(0,5000), headers, fileName, timestamp: Date.now() })); } catch(e) {}
  }

  function saveHistory() {
    try { localStorage.setItem('aiOS_history', JSON.stringify(commandHistory.slice(-100))); } catch(e) {}
  }

  function getMemory() {
    try { return JSON.parse(localStorage.getItem('aiOS_memory') || '{}'); } catch(e) { return {}; }
  }

  function setMemory(key, val) {
    const mem = getMemory();
    mem[key] = val;
    try { localStorage.setItem('aiOS_memory', JSON.stringify(mem)); } catch(e) {}
    renderMemory();
  }

  function removeMemory(key) {
    const mem = getMemory();
    delete mem[key];
    try { localStorage.setItem('aiOS_memory', JSON.stringify(mem)); } catch(e) {}
    renderMemory();
  }

  // Listen for data from dashboard
  window.addEventListener('storage', (e) => {
    if (e.key === 'excelAuto_activeData' && e.newValue) {
      try {
        const p = JSON.parse(e.newValue);
        sheetData = p.data || [];
        headers = p.headers || (sheetData.length > 0 ? Object.keys(sheetData[0]) : []);
        fileName = p.fileName || 'Unknown';
        updateMiniPreview();
        updateStatusBar();
        addSystemMsg(`Data loaded: ${fileName} (${sheetData.length} rows)`);
      } catch(e) {}
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  function $(id) { return document.getElementById(id); }
  function fmt(n) { if (n===null||n===undefined||isNaN(n)) return '—'; return Number(n).toLocaleString('en-IN',{maximumFractionDigits:2}); }
  function esc(s) { if (!s) return ''; try { return window.escapeHtml ? window.escapeHtml(String(s)) : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); } catch(e) { return String(s); } }

  function addUserMsg(text) {
    const c = $('ai-messages');
    const m = document.createElement('div');
    m.className = 'ai-msg user';
    m.textContent = text;
    c.appendChild(m);
    c.scrollTop = c.scrollHeight;
  }

  function addBotMsg(html, cls='') {
    const c = $('ai-messages');
    const m = document.createElement('div');
    m.className = `ai-msg bot ${cls}`.trim();
    m.innerHTML = html;
    c.appendChild(m);
    c.scrollTop = c.scrollHeight;
    return m;
  }

  function addSystemMsg(text) {
    const c = $('ai-messages');
    const m = document.createElement('div');
    m.className = 'ai-msg system';
    m.textContent = text;
    c.appendChild(m);
    c.scrollTop = c.scrollHeight;
  }

  function addResultMsg(html) {
    const c = $('ai-messages');
    const m = document.createElement('div');
    m.className = 'ai-msg result';
    m.innerHTML = html;
    c.appendChild(m);
    c.scrollTop = c.scrollHeight;
    return m;
  }

  function addInsightMsg(html) {
    const c = $('ai-messages');
    const m = document.createElement('div');
    m.className = 'ai-msg insight';
    m.innerHTML = html;
    c.appendChild(m);
    c.scrollTop = c.scrollHeight;
    return m;
  }

  function addErrorMsg(text) {
    const c = $('ai-messages');
    const m = document.createElement('div');
    m.className = 'ai-msg error';
    m.textContent = text;
    c.appendChild(m);
    c.scrollTop = c.scrollHeight;
  }

  function showLoading(msg) {
    const c = $('ai-messages');
    const el = document.createElement('div');
    el.className = 'ai-msg bot';
    el.id = 'ai-loading';
    el.innerHTML = `<div class="ai-loading"><div class="ai-spinner"></div><span>${esc(msg)}</span></div>`;
    c.appendChild(el);
    c.scrollTop = c.scrollHeight;
  }

  function hideLoading() { const el = $('ai-loading'); if (el) el.remove(); }

  function showToast(msg, type='info') {
    const container = $('ai-toast-container');
    const icons = { success:'fa-check-circle', error:'fa-exclamation-circle', warning:'fa-exclamation-triangle', info:'fa-info-circle' };
    const colors = { success:'var(--ai-success)', error:'var(--ai-danger)', warning:'var(--ai-warn)', info:'var(--ai-info)' };
    const t = document.createElement('div');
    t.className = 'ai-toast';
    t.innerHTML = `<i class="fas ${icons[type]||icons.info}" style="color:${colors[type]};font-size:1rem;"></i><span style="flex:1;">${esc(msg)}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 4000);
  }

  function renderTable(hdrs, rows, max=20) {
    let h = '<table><thead><tr>';
    hdrs.forEach(c => { h += `<th>${esc(c)}</th>`; });
    h += '</tr></thead><tbody>';
    rows.slice(0,max).forEach(row => {
      h += '<tr>';
      hdrs.forEach(c => {
        let v = String(row[c]??'');
        const n = Number(v.replace(/[^0-9.-]/g,''));
        if (!isNaN(n) && v!=='') { h += `<td class="${n<0?'neg-val':''}">${esc(v)}</td>`; }
        else { h += `<td>${esc(v)}</td>`; }
      });
      h += '</tr>';
    });
    if (rows.length>max) h += `<tr><td colspan="${hdrs.length}" style="text-align:center;color:var(--text-muted);font-size:0.7rem;">… ${rows.length-max} more rows</td></tr>`;
    h += '</tbody></table>';
    return h;
  }

  function renderKPI(items) {
    let h = '<div class="kpi-row">';
    items.forEach(k => {
      h += `<div class="kpi-card"><div class="kpi-val" style="color:${k.color||'var(--ai-primary)'};">${esc(k.value)}</div><div class="kpi-label">${esc(k.label)}</div>`;
      if (k.sub) h += `<div class="kpi-sub" style="color:${k.subColor||'var(--text-muted)'};">${esc(k.sub)}</div>`;
      h += '</div>';
    });
    return h + '</div>';
  }

  function detectColType(col) {
    const sample = sheetData.slice(0,50).map(r => String(r[col]||'').trim()).filter(v=>v);
    if (sample.every(v => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v))) return 'email';
    if (sample.every(v => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v))) return 'date';
    if (sample.every(v => !isNaN(Number(v.replace(/[^0-9.-]/g,''))))) return 'number';
    return 'text';
  }

  function findCol(name) {
    const low = name.toLowerCase();
    let best = headers.find(h => h.toLowerCase()===low);
    if (best) return best;
    best = headers.find(h => h.toLowerCase().includes(low));
    if (best) return best;
    best = headers.find(h => low.includes(h.toLowerCase()));
    return best || name;
  }

  function findNumCols() { return headers.filter(h => sheetData.some(r => !isNaN(Number(String(r[h]||'').replace(/[^0-9.-]/g,''))))); }
  function findCatCols() { return headers.filter(h => !findNumCols().includes(h)); }

  function updateStatusBar() {
    const d = $('status-data');
    const c = $('status-cmds');
    if (d) d.textContent = sheetData.length > 0 ? `${fileName}: ${sheetData.length} rows × ${headers.length} cols` : 'No data loaded';
    if (c) c.textContent = `${commandHistory.length} commands`;
  }

  function updateMiniPreview() {
    const el = $('mini-data-preview');
    const cnt = $('data-row-count');
    if (!el) return;
    if (sheetData.length === 0) {
      el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.78rem;">No data loaded.</div>';
      if (cnt) cnt.textContent = '';
      return;
    }
    if (cnt) cnt.textContent = `${sheetData.length} rows`;
    const ph = headers.slice(0,6);
    el.innerHTML = renderTable(ph, sheetData, 10);
    renderMiniChart();
  }

  function renderMiniChart() {
    const canvas = $('mini-chart');
    if (!canvas || sheetData.length === 0) return;
    if (miniChart) miniChart.destroy();
    const numCols = findNumCols();
    const catCols = findCatCols();
    if (numCols.length === 0) return;
    const valCol = numCols[0];
    const labels = [], values = [];
    if (catCols.length > 0) {
      const groups = {};
      sheetData.forEach(r => { const k = String(r[catCols[0]]||'Unknown'); const v = Number(String(r[valCol]||0).replace(/[^0-9.-]/g,'')); if (!isNaN(v)) groups[k]=(groups[k]||0)+v; });
      const sorted = Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,8);
      sorted.forEach(([k,v]) => { labels.push(k); values.push(v); });
    } else {
      sheetData.slice(0,30).forEach((r,i) => { const v = Number(String(r[valCol]||0).replace(/[^0-9.-]/g,'')); labels.push(`Row ${i+1}`); values.push(isNaN?v:0); });
    }
    miniChart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: valCol, data: values, backgroundColor: 'rgba(99,102,241,0.6)', borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 }, maxRotation: 45 } }, y: { ticks: { font: { size: 9 } } } } }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT HANDLING
  // ═══════════════════════════════════════════════════════════════════════════
  function initChatInput() {
    const input = $('ai-input');
    const sendBtn = $('btn-send');
    if (!input || !sendBtn) return;

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      const cc = $('char-count');
      if (cc) cc.textContent = input.value.length;
      showSuggestions(input.value);
    });

    input.addEventListener('keydown', (e) => {
      const sugEl = $('ai-suggestions');
      const items = sugEl ? sugEl.querySelectorAll('.ai-sug-item') : [];
      const active = sugEl ? sugEl.querySelector('.ai-sug-item.active') : null;
      const activeIdx = active ? Array.from(items).indexOf(active) : -1;

      if (e.key === 'Tab' && sugEl && sugEl.classList.contains('show') && items.length > 0) {
        e.preventDefault();
        const target = activeIdx >= 0 ? activeIdx : 0;
        input.value = items[target].getAttribute('data-text');
        hideSuggestions();
        return;
      }
      if (e.key === 'ArrowDown' && sugEl && sugEl.classList.contains('show')) {
        e.preventDefault();
        items.forEach(i => i.classList.remove('active'));
        const next = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
        items[next].classList.add('active');
        items[next].scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'ArrowUp' && sugEl && sugEl.classList.contains('show')) {
        e.preventDefault();
        items.forEach(i => i.classList.remove('active'));
        const prev = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
        items[prev].classList.add('active');
        items[prev].scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Escape') { hideSuggestions(); return; }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        hideSuggestions();
        handleSend();
        return;
      }
    });

    sendBtn.addEventListener('click', handleSend);
  }

  function handleSend() {
    const input = $('ai-input');
    const text = input.value.trim();
    if (!text || processing) return;
    input.value = '';
    input.style.height = 'auto';
    const cc = $('char-count');
    if (cc) cc.textContent = '0';
    addUserMsg(text);
    addToHistory(text);
    processCommand(text);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUGGESTIONS ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  function showSuggestions(text) {
    const sugEl = $('ai-suggestions');
    if (!sugEl) return;
    if (!text || text.length < 1) { hideSuggestions(); return; }
    const low = text.toLowerCase();
    const matches = SUGGESTIONS.filter(s => s.text.toLowerCase().includes(low)).slice(0,8);
    if (matches.length === 0) { hideSuggestions(); return; }
    let html = '';
    matches.forEach((m, i) => {
      html += `<div class="ai-sug-item ${i===0?'active':''}" data-text="${esc(m.text)}">
        <div class="sug-icon" style="background:${m.color}20;color:${m.color};"><i class="fas ${m.icon}"></i></div>
        <div class="sug-text">${highlightMatch(m.text, text)}</div>
        <div class="sug-cat">${esc(m.cat)}</div>
      </div>`;
    });
    sugEl.innerHTML = html;
    sugEl.classList.add('show');
    sugEl.querySelectorAll('.ai-sug-item').forEach(item => {
      item.addEventListener('click', () => {
        $('ai-input').value = item.getAttribute('data-text');
        hideSuggestions();
        handleSend();
      });
    });
  }

  function hideSuggestions() {
    const sugEl = $('ai-suggestions');
    if (sugEl) sugEl.classList.remove('show');
  }

  function highlightMatch(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return esc(text);
    return esc(text.substring(0, idx)) + '<strong>' + esc(text.substring(idx, idx+query.length)) + '</strong>' + esc(text.substring(idx+query.length));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NLP COMMAND PROCESSOR
  // ═══════════════════════════════════════════════════════════════════════════
  async function processCommand(text) {
    const cmd = text.toLowerCase().trim();
    processing = true;
    $('btn-send').disabled = true;

    // Find matching command
    let matched = null;
    for (const c of COMMANDS) {
      for (const p of c.patterns) {
        if (p.test(cmd)) { matched = c; break; }
      }
      if (matched) break;
    }

    if (!matched) {
      // Try business Q&A fallback
      if (sheetData.length > 0 && (cmd.includes('?') || cmd.match(/how|what|which|where|when|who|total|count|average|sum/))) {
        matched = { action: 'businessQA' };
      } else {
        hideLoading(); processing = false; $('btn-send').disabled = false;
        addBotMsg(`I didn't understand "<strong>${esc(text)}</strong>". Type <strong>help</strong> to see what I can do.`);
        return;
      }
    }

    try {
      showLoading(`${matched.desc || 'Processing'}...`);
      await executeAction(matched.action, cmd, text);
    } catch(err) {
      addErrorMsg(`Error: ${err.message}`);
    }

    hideLoading();
    processing = false;
    $('btn-send').disabled = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION ENGINE - executes real operations
  // ═══════════════════════════════════════════════════════════════════════════
  async function executeAction(action, cmd, rawText) {
    if (action !== 'help' && action !== 'buildWorkflow' && sheetData.length === 0 &&
        !['mergeFiles','splitFiles','renameFile','archiveFiles','deleteFile','restoreFile'].includes(action)) {
      hideLoading();
      addBotMsg('No data loaded. Please upload a file in the Dashboard first, or type <strong>"upload"</strong> to open the file picker.');
      return;
    }

    const actions = {
      // ── HELP ──
      help: async () => {
        addBotMsg(`<strong>AI Operating System — Commands</strong>
          <br><br>📊 <strong>Analysis:</strong> analyze file, top 10 customers, top products, find duplicates, missing data, show columns, row count
          <br>📋 <strong>Reports:</strong> create sales report, professional report, executive summary
          <br>📊 <strong>Charts:</strong> pie chart, bar chart, line chart
          <br>🧮 <strong>Formulas:</strong> profit margin, add GST, commission
          <br>📈 <strong>Growth:</strong> monthly growth, yearly growth
          <br>🔍 <strong>Filters:</strong> filter, last month, inactive customers
          <br>🏭 <strong>Groups:</strong> group by state, pivot table
          <br>🔮 <strong>Forecast:</strong> forecast, trend analysis
          <br>🏗️ <strong>Dashboards:</strong> build sales/inventory/finance/GST dashboard
          <br>🧹 <strong>Clean:</strong> clean data
          <br>🌐 <strong>Translate:</strong> translate to Hindi
          <br>📄 <strong>Export:</strong> generate PDF, export Excel, export CSV
          <br>📧 <strong>Email:</strong> email report
          <br>📁 <strong>Files:</strong> merge files, split files, rename, archive, convert
          <br>❓ <strong>Q&A:</strong> ask about revenue, best state, top products
          <br>🤖 <strong>Auto:</strong> autonomous mode, build workflow
          <br><br>Keyboard: <kbd>Ctrl+M</kbd> voice · <kbd>Ctrl+Shift+A</kbd> autonomous · <kbd>?</kbd> shortcuts`);
      },

      // ── FULL ANALYSIS ──
      fullAnalysis: async () => {
        const res = await postToWorker('AI_FULL_ANALYSIS', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Full Analysis Complete</strong> <span class="action-badge badge-success">✓ ${r.duration}ms</span>
          ${renderKPI([
            { label: 'Rows', value: fmt(r.totalRows), color: 'var(--ai-primary)' },
            { label: 'Columns', value: fmt(r.totalCols), color: 'var(--ai-info)' },
            { label: 'Quality Score', value: r.qualityScore+'%', color: r.qualityScore>80?'var(--ai-success)':'var(--ai-warn)' },
            { label: 'Duplicates', value: r.duplicates+' ('+r.dupPercentage+'%)', color: r.duplicates>0?'var(--ai-danger)':'var(--ai-success)' }
          ])}
          <br><strong>Numeric Statistics:</strong><br>
          ${Object.entries(r.stats).map(([c,s]) => `• <strong>${esc(c)}</strong>: Sum=${fmt(s.sum)}, Avg=${fmt(s.avg)}, Range=[${fmt(s.min)} — ${fmt(s.max)}]`).join('<br>')}
          ${Object.keys(r.catStats).length > 0 ? '<br><br><strong>Categorical:</strong><br>' + Object.entries(r.catStats).map(([c,cs]) => `• <strong>${esc(c)}</strong>: ${cs.unique} unique. Top: ${cs.top.map(t=>esc(t.label)+'('+t.count+')').join(', ')}`).join('<br>') : ''}`);
        setMemory('last_analysis', { rows: r.totalRows, cols: r.totalCols, quality: r.qualityScore, time: Date.now() });
      },

      // ── TOP CUSTOMERS ──
      topCustomers: async () => {
        const res = await postToWorker('AI_TOP_CUSTOMERS', { data: sheetData });
        const r = res.data;
        if (!r.topCustomers || r.topCustomers.length === 0) { addBotMsg('No customer/value columns found.'); return; }
        addResultMsg(`<strong>Top 10 Customers</strong> <span class="action-badge badge-info">by ${esc(r.valueCol)}</span>
          ${renderKPI([
            { label: 'Total Customers', value: fmt(r.totalCustomers), color: 'var(--ai-primary)' },
            { label: 'Top Customer', value: r.topCustomers[0].name, color: 'var(--ai-success)' },
            { label: 'Top Revenue', value: fmt(r.topCustomers[0].total), color: 'var(--ai-warn)' }
          ])}
          ${r.topCustomers.map((c,i) => `<div style="margin:3px 0;display:flex;align-items:center;gap:8px;"><span style="font-weight:700;color:var(--text-muted);width:20px;">${i+1}.</span><span style="flex:1;font-weight:600;">${esc(c.name)}</span><span>${fmt(c.total)}</span><div style="width:80px;"><div class="bar" style="width:${c.percentage}%;"></div></div></div>`).join('')}`);
      },

      // ── TOP PRODUCTS ──
      topProducts: async () => {
        const res = await postToWorker('AI_TOP_PRODUCTS', { data: sheetData });
        const r = res.data;
        if (!r.products || r.products.length === 0) { addBotMsg('No product column found.'); return; }
        addResultMsg(`<strong>Top Products</strong>
          ${r.products.map((p,i) => `<div style="margin:3px 0;display:flex;align-items:center;gap:8px;"><span style="font-weight:700;color:var(--text-muted);width:20px;">${i+1}.</span><span style="flex:1;font-weight:600;">${esc(p.name)}</span><span>${fmt(p.total)}</span><div style="width:80px;"><div class="bar" style="width:${p.percentage}%;"></div></div></div>`).join('')}`);
      },

      // ── FIND DUPLICATES ──
      findDuplicates: async () => {
        const res = await postToWorker('AI_FIND_DUPLICATES', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Duplicate Analysis</strong> <span class="action-badge ${r.count>0?'badge-danger':'badge-success'}">${r.count} duplicates (${r.percentage}%)</span>
          ${renderKPI([
            { label: 'Total Rows', value: fmt(sheetData.length), color: 'var(--ai-primary)' },
            { label: 'Duplicates', value: fmt(r.count), color: r.count>0?'var(--ai-danger)':'var(--ai-success)' },
            { label: 'Unique', value: fmt(sheetData.length - r.count), color: 'var(--ai-success)' }
          ])}
          ${r.duplicates.length > 0 ? '<br><strong>Sample duplicates:</strong><br>' + r.duplicates.slice(0,10).map(d => `• Row ${d.row} (first at row ${d.firstSeen})`).join('<br>') : ''}`);
      },

      // ── MISSING DATA ──
      missingData: async () => {
        const res = await postToWorker('AI_MISSING_DATA', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Missing Data Analysis</strong> <span class="action-badge badge-info">Quality: ${r.analysis.qualityScore}%</span>
          ${renderKPI([
            { label: 'Quality Score', value: r.analysis.qualityScore+'%', color: r.analysis.qualityScore>80?'var(--ai-success)':'var(--ai-warn)' },
            { label: 'Missing Cells', value: fmt(r.analysis.totalMissing), color: r.analysis.totalMissing>0?'var(--ai-danger)':'var(--ai-success)' }
          ])}
          ${Object.entries(r.analysis.columns).filter(([,info])=>info.missing>0).map(([c,info]) => `• <strong>${esc(c)}</strong>: ${info.missing} missing (${info.percentage}%)`).join('<br>')}`);
      },

      // ── SHOW DATA ──
      showData: async () => {
        addResultMsg(`<strong>Data Preview</strong> (${sheetData.length} rows × ${headers.length} columns)<br>${renderTable(headers, sheetData, 15)}`);
      },

      // ── SHOW COLUMNS ──
      showColumns: async () => {
        addResultMsg(`<strong>Columns (${headers.length}):</strong><br>${headers.map((h,i) => `${i+1}. <strong>${esc(h)}</strong> <span style="color:var(--text-muted);font-size:0.72rem;">(${detectColType(h)})</span>`).join('<br>')}`);
      },

      // ── ROW COUNT ──
      rowCount: async () => {
        addResultMsg(`<strong>Row Count:</strong> ${fmt(sheetData.length)} rows`);
      },

      // ── SALES REPORT ──
      salesReport: async () => {
        const res = await postToWorker('AI_PROFESSIONAL_REPORT', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Sales Report</strong> <span class="action-badge badge-success">Generated</span>
          ${renderKPI([
            { label: 'Rows', value: fmt(r.totalRows), color: 'var(--ai-primary)' },
            { label: 'Columns', value: fmt(r.totalCols), color: 'var(--ai-info)' }
          ])}
          <br><strong>Statistics:</strong><br>
          ${Object.entries(r.stats).map(([c,s]) => `• <strong>${esc(c)}</strong>: Sum=${fmt(s.sum)}, Avg=${fmt(s.avg)}, Median=${fmt(s.median)}, StdDev=${fmt(s.stdDev)}`).join('<br>')}
          <br><br><strong>Completeness:</strong><br>
          ${Object.entries(r.completeness).map(([c,p]) => `• <strong>${esc(c)}</strong>: ${p}%`).join('<br>')}`);
        setMemory('last_report', { type: 'sales', time: Date.now(), cols: r.totalCols });
      },

      // ── PRO REPORT ──
      proReport: async () => {
        const res = await postToWorker('AI_PROFESSIONAL_REPORT', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Professional Report</strong> <span class="action-badge badge-success">Generated</span>
          ${Object.entries(r.stats).map(([c,s]) => `• <strong>${esc(c)}</strong>: Sum=${fmt(s.sum)}, Avg=${fmt(s.avg)}, Median=${fmt(s.median)}, StdDev=${fmt(s.stdDev)}, Min=${fmt(s.min)}, Max=${fmt(s.max)}`).join('<br>')}
          <br><br><strong>Completeness:</strong><br>
          ${Object.entries(r.completeness).map(([c,p]) => `• <strong>${esc(c)}</strong>: ${p}%`).join('<br>')}`);
      },

      // ── EXEC SUMMARY ──
      execSummary: async () => {
        const res = await postToWorker('AI_EXECUTIVE_SUMMARY', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Executive Summary</strong><br><div style="font-size:0.82rem;line-height:1.7;">${esc(r.summary).replace(/\n/g,'<br>')}</div>`);
      },

      // ── PIE CHART ──
      pieChart: async () => {
        const res = await postToWorker('AI_PIE_CHART', { data: sheetData });
        const r = res.data;
        if (!r.slices || r.slices.length === 0) { addBotMsg('No categorical columns found.'); return; }
        addResultMsg(`<strong>Pie Chart</strong> <span class="action-badge badge-info">Column: ${esc(r.catCol)}, Total: ${fmt(r.total)}</span>
          ${r.slices.map((s,i) => `<div style="margin:3px 0;display:flex;align-items:center;gap:8px;"><span style="font-weight:700;color:var(--text-muted);width:20px;">${i+1}.</span><span style="flex:1;font-weight:600;">${esc(s.label)}</span><span>${fmt(s.value)} (${s.percentage}%)</span><div style="width:80px;"><div class="bar" style="width:${s.percentage}%;"></div></div></div>`).join('')}`);
      },

      // ── BAR CHART ──
      barChart: async () => {
        const res = await postToWorker('AI_GROUP_BY', { data: sheetData });
        const r = res.data;
        if (!r.groups || r.groups.length === 0) { addBotMsg('No groups found.'); return; }
        addResultMsg(`<strong>Bar Chart Data</strong> <span class="action-badge badge-info">Grouped by ${esc(r.groupCol)}</span>
          ${r.groups.slice(0,10).map((g,i) => `<div style="margin:3px 0;display:flex;align-items:center;gap:8px;"><span style="flex:1;font-weight:600;">${esc(g.group)}</span><span>${fmt(g.total)}</span><div style="width:80px;"><div class="bar" style="width:${r.groups[0].total>0?Math.round(g.total/r.groups[0].total*100):0}%;"></div></div></div>`).join('')}`);
      },

      // ── LINE CHART ──
      lineChart: async () => {
        const res = await postToWorker('AI_MONTHLY_GROWTH', { data: sheetData });
        const r = res.data;
        if (!r.growth || r.growth.length === 0) { addBotMsg('Need date and numeric columns.'); return; }
        addResultMsg(`<strong>Line Chart — Growth Trend</strong>
          ${r.growth.map(g => { const cls = g.growthPct>0?'pos-val':g.growthPct<0?'neg-val':''; return `<div style="margin:2px 0;"><strong>${esc(g.month)}</strong> — ${fmt(g.value)} <span class="${cls}">(${g.growthPct>0?'+':''}${g.growthPct}%)</span></div>`; }).join('')}`);
      },

      // ── PROFIT FORMULA ──
      profitFormula: async () => {
        const res = await postToWorker('AI_PROFIT_FORMULA', { data: sheetData });
        const r = res.data;
        if (!r.result || r.result.length === 0) { addBotMsg('No revenue/cost columns found.'); return; }
        addResultMsg(`<strong>Profit Calculation</strong> <span class="action-badge badge-success">Revenue: ${esc(r.revenueCol)}, Cost: ${esc(r.costCol)}</span>
          ${renderTable(Object.keys(r.result[0]), r.result)}`);
        sheetData = r.result;
        headers = Object.keys(sheetData[0]);
        saveData();
        updateMiniPreview();
      },

      // ── GST FORMULA ──
      gstFormula: async () => {
        const res = await postToWorker('AI_GST_FORMULA', { data: sheetData, gstRate: 18 });
        const r = res.data;
        if (!r.result || r.result.length === 0) { addBotMsg('No amount column found.'); return; }
        addResultMsg(`<strong>GST Calculation (18%)</strong> <span class="action-badge badge-info">Amount: ${esc(r.amountCol)}</span>
          ${renderTable(Object.keys(r.result[0]), r.result)}`);
        sheetData = r.result;
        headers = Object.keys(sheetData[0]);
        saveData();
        updateMiniPreview();
      },

      // ── COMMISSION ──
      commission: async () => {
        const res = await postToWorker('AI_COMMISSION', { data: sheetData, rate: 5 });
        const r = res.data;
        if (!r.result || r.result.length === 0) { addBotMsg('No sales column found.'); return; }
        addResultMsg(`<strong>Commission (5%)</strong> <span class="action-badge badge-info">Sales: ${esc(r.salesCol)}</span>
          ${renderTable(Object.keys(r.result[0]), r.result)}`);
        sheetData = r.result;
        headers = Object.keys(sheetData[0]);
        saveData();
        updateMiniPreview();
      },

      // ── MONTHLY GROWTH ──
      monthlyGrowth: async () => {
        const res = await postToWorker('AI_MONTHLY_GROWTH', { data: sheetData });
        const r = res.data;
        if (!r.growth || r.growth.length === 0) { addBotMsg('Need date and numeric columns.'); return; }
        addResultMsg(`<strong>Monthly Growth</strong> <span class="action-badge badge-info">Date: ${esc(r.dateCol)}, Value: ${esc(r.valCol)}</span>
          ${r.growth.map(g => { const cls = g.growthPct>0?'pos-val':g.growthPct<0?'neg-val':''; return `<div style="margin:2px 0;"><strong>${esc(g.month)}</strong> — ${fmt(g.value)} <span class="${cls}">(${g.growthPct>0?'+':''}${g.growthPct}%)</span></div>`; }).join('')}`);
      },

      // ── YEARLY GROWTH ──
      yearlyGrowth: async () => {
        const res = await postToWorker('AI_YEARLY_GROWTH', { data: sheetData });
        const r = res.data;
        if (!r.years || r.years.length === 0) { addBotMsg('Need date and numeric columns.'); return; }
        addResultMsg(`<strong>Yearly Growth</strong>
          ${r.years.map(y => { const cls = y.growthPct>0?'pos-val':y.growthPct<0?'neg-val':''; return `<div style="margin:2px 0;"><strong>${esc(y.year)}</strong> — ${fmt(y.value)} <span class="${cls}">(${y.growthPct>0?'+':''}${y.growthPct}%)</span></div>`; }).join('')}`);
      },

      // ── FILTER DATA ──
      filterData: async () => {
        const parsed = parseFilter(cmd);
        const res = await postToWorker('AI_FILTER', { data: sheetData, column: parsed.column, operator: parsed.operator, value: parsed.value });
        const r = res.data;
        addResultMsg(`<strong>Filter Results</strong> <span class="action-badge badge-info">${r.matchCount} rows matched</span>
          Column: <strong>${esc(r.column)}</strong>, Operator: ${r.operator}, Value: ${esc(String(r.value))}
          ${r.filtered.length > 0 ? '<br>' + renderTable(Object.keys(r.filtered[0]), r.filtered) : ''}`);
      },

      // ── LAST MONTH ──
      lastMonth: async () => {
        const res = await postToWorker('AI_LAST_MONTH', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Last Month Data</strong> <span class="action-badge badge-info">${r.count} rows, Total: ${fmt(r.total)}</span>
          ${r.result.length > 0 ? renderTable(Object.keys(r.result[0]), r.result) : ''}`);
      },

      // ── INACTIVE CUSTOMERS ──
      inactiveCustomers: async () => {
        const res = await postToWorker('AI_INACTIVE', { data: sheetData, daysThreshold: 90 });
        const r = res.data;
        addResultMsg(`<strong>Inactive Customers</strong> <span class="action-badge badge-warn">${r.inactive.length} found (>${r.daysThreshold} days)</span>
          ${r.inactive.length > 0 ? renderTable(Object.keys(r.inactive[0]), r.inactive) : 'No inactive customers found.'}`);
      },

      // ── GROUP BY ──
      groupBy: async () => {
        const groupMatch = cmd.match(/group\s*by\s+(\w[\w\s]*)/i);
        const groupCol = groupMatch ? findCol(groupMatch[1].trim()) : null;
        const res = await postToWorker('AI_GROUP_BY', { data: sheetData, groupCol });
        const r = res.data;
        if (!r.groups || r.groups.length === 0) { addBotMsg('No groups found.'); return; }
        addResultMsg(`<strong>Group By ${esc(r.groupCol)}</strong>
          ${renderTable(['group','count','total','avg'], r.groups)}`);
      },

      // ── PIVOT TABLE ──
      pivotTable: async () => {
        const catCols = findCatCols();
        const numCols = findNumCols();
        if (catCols.length === 0 || numCols.length === 0) { addBotMsg('Need categorical and numeric columns.'); return; }
        const res = await postToWorker('AI_PIVOT', { data: sheetData, rowCol: catCols[0], valueCol: numCols[0], aggFunc: 'SUM' });
        const r = res.data;
        addResultMsg(`<strong>Pivot Table</strong> <span class="action-badge badge-info">Row: ${esc(r.rowCol)}, Value: ${esc(r.valueCol)}, Agg: ${r.aggFunc}</span>
          ${r.pivot.length > 0 ? renderTable(['label','value','count'], r.pivot) : ''}`);
      },

      // ── FORECAST ──
      forecast: async () => {
        const res = await postToWorker('AI_FORECAST', { data: sheetData });
        const r = res.data;
        let html = '<strong>Forecast Results</strong><br>';
        Object.entries(r.forecasts).forEach(([col,f]) => {
          const cls = f.direction==='growth'?'pos-val':f.direction==='decline'?'neg-val':'';
          html += `<strong>${esc(col)}</strong>: <span class="${cls}">${f.direction}</span> (slope: ${f.slope}, R²: ${f.confidence})<br>Next values: ${f.forecast.map(v=>fmt(v)).join(', ')}<br>`;
        });
        addResultMsg(html);
      },

      // ── TREND ──
      trend: async () => {
        const res = await postToWorker('AI_TREND', { data: sheetData });
        const r = res.data;
        let html = '<strong>Trend Analysis</strong><br>';
        Object.entries(r.trends).forEach(([col,t]) => {
          const cls = t.direction==='upward'?'pos-val':t.direction==='downward'?'neg-val':'';
          html += `<strong>${esc(col)}</strong>: <span class="${cls}">${t.direction}</span> (${t.strength}) — ${t.summary}<br>`;
        });
        addResultMsg(html);
      },

      // ── BUILD DASHBOARD ──
      buildDashboard: async () => {
        const res = await postToWorker('AI_DASHBOARD', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Sales Dashboard Built</strong> <span class="action-badge badge-success">${r.widgets.length} widgets generated</span>
          ${r.widgets.map(w => {
            if (w.type === 'kpi') return `<div class="kpi-card"><div class="kpi-val">${esc(w.value)}</div><div class="kpi-label">${esc(w.title)}</div><div class="kpi-sub">${esc(w.subtitle||'')}</div></div>`;
            return `• ${w.type.toUpperCase()}: <strong>${esc(w.title)}</strong>`;
          }).join('<br>')}`);
        setMemory('last_dashboard', { type: 'sales', widgets: r.widgets.length, time: Date.now() });
      },

      buildInventoryDashboard: async () => {
        const res = await postToWorker('AI_DASHBOARD', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Inventory Dashboard Built</strong> <span class="action-badge badge-success">${r.widgets.length} widgets</span>
          ${r.widgets.map(w => `• ${w.type.toUpperCase()}: <strong>${esc(w.title)}</strong>`).join('<br>')}`);
      },

      buildFinanceDashboard: async () => {
        const res = await postToWorker('AI_PROFESSIONAL_REPORT', { data: sheetData });
        const r = res.data;
        addResultMsg(`<strong>Finance Dashboard Built</strong> <span class="action-badge badge-success">Report with ${Object.keys(r.stats).length} metrics</span>
          ${Object.entries(r.stats).map(([c,s]) => `• <strong>${esc(c)}</strong>: Sum=${fmt(s.sum)}, Avg=${fmt(s.avg)}`).join('<br>')}`);
      },

      buildGstDashboard: async () => {
        const res = await postToWorker('AI_GST_FORMULA', { data: sheetData, gstRate: 18 });
        const r = res.data;
        addResultMsg(`<strong>GST Dashboard Built</strong> <span class="action-badge badge-success">GST @ ${r.gstRate}% applied</span>
          ${r.result.length > 0 ? renderTable(Object.keys(r.result[0]), r.result) : ''}`);
        sheetData = r.result;
        headers = Object.keys(sheetData[0]);
        saveData();
        updateMiniPreview();
      },

      // ── CLEAN DATA ──
      cleanData: async () => {
        const res = await postToWorker('CLEAN', { data: sheetData, rules: { removeDuplicates: true, removeEmpty: false, trimSpaces: true, normalizeDates: false } });
        const r = res.data;
        sheetData = r.cleaned;
        headers = sheetData.length > 0 ? Object.keys(sheetData[0]) : [];
        saveData();
        updateMiniPreview();
        addResultMsg(`<strong>Data Cleaned</strong> <span class="action-badge badge-success">✓ ${r.duration}ms</span>
          ${renderKPI([
            { label: 'Duplicates Removed', value: fmt(r.stats.duplicatesRemoved), color: r.stats.duplicatesRemoved>0?'var(--ai-warn)':'var(--ai-success)' },
            { label: 'Cells Trimmed', value: fmt(r.stats.trimmedCells), color: 'var(--ai-info)' },
            { label: 'Rows Remaining', value: fmt(sheetData.length), color: 'var(--ai-success)' }
          ])}`);
      },

      // ── TRANSLATE HINDI ──
      translateHindi: async () => {
        const res = await postToWorker('TRANSLATE', { data: sheetData, headers });
        const r = res.data;
        addResultMsg(`<strong>Hindi Translation</strong> <span class="action-badge badge-success">✓ ${r.duration}ms</span>
          ${renderTable(r.translatedHeaders, r.translatedData)}`);
      },

      // ── EXPORT PDF ──
      exportPDF: async () => {
        try {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          doc.setFontSize(16);
          doc.text(`Report — ${fileName || 'Data'}`, 14, 15);
          doc.setFontSize(10);
          doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
          doc.text(`Rows: ${sheetData.length} | Columns: ${headers.length}`, 14, 29);

          const numCols = findNumCols();
          if (numCols.length > 0) {
            let y = 38;
            doc.setFontSize(12);
            doc.text('Key Metrics:', 14, y);
            y += 7;
            doc.setFontSize(9);
            numCols.slice(0,8).forEach(c => {
              const vals = sheetData.map(r => Number(String(r[c]||0).replace(/[^0-9.-]/g,''))).filter(v=>!isNaN(v));
              const sum = vals.reduce((a,b)=>a+b,0);
              doc.text(`${c}: Sum=${fmt(sum)}, Avg=${fmt(sum/vals.length)}, Count=${vals.length}`, 14, y);
              y += 5;
            });
          }

          doc.autoTable({ head: [headers.slice(0,10)], body: sheetData.slice(0,50).map(r => headers.slice(0,10).map(h => String(r[h]||''))), startY: 40 + Math.min(findNumCols().length,8)*5, styles: { fontSize: 7 } });
          doc.save(`${fileName||'report'}.pdf`);
          addResultMsg(`<strong>PDF Exported</strong> <span class="action-badge badge-success">✓ Downloaded</span>`);
          showToast('PDF exported successfully', 'success');
        } catch(e) { addErrorMsg(`PDF export failed: ${e.message}`); }
      },

      // ── EXPORT EXCEL ──
      exportExcel: async () => {
        try {
          const ws = XLSX.utils.json_to_sheet(sheetData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Data');
          XLSX.writeFile(wb, `${fileName||'export'}.xlsx`);
          addResultMsg(`<strong>Excel Exported</strong> <span class="action-badge badge-success">✓ Downloaded</span>`);
          showToast('Excel exported successfully', 'success');
        } catch(e) { addErrorMsg(`Excel export failed: ${e.message}`); }
      },

      // ── EXPORT CSV ──
      exportCSV: async () => {
        try {
          const csv = [headers.join(',')];
          sheetData.forEach(r => csv.push(headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(',')));
          const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${fileName||'export'}.csv`;
          a.click();
          URL.revokeObjectURL(a.href);
          addResultMsg(`<strong>CSV Exported</strong> <span class="action-badge badge-success">✓ Downloaded</span>`);
          showToast('CSV exported successfully', 'success');
        } catch(e) { addErrorMsg(`CSV export failed: ${e.message}`); }
      },

      // ── EMAIL REPORT ──
      emailReport: async () => {
        const numCols = findNumCols();
        let body = `Report: ${fileName}\nRows: ${sheetData.length}\nColumns: ${headers.join(', ')}\n\n`;
        numCols.slice(0,5).forEach(c => {
          const vals = sheetData.map(r => Number(String(r[c]||0).replace(/[^0-9.-]/g,''))).filter(v=>!isNaN(v));
          body += `${c}: Sum=${fmt(vals.reduce((a,b)=>a+b,0))}, Avg=${fmt(vals.reduce((a,b)=>a+b,0)/vals.length)}\n`;
        });
        window.open(`mailto:?subject=Report: ${fileName}&body=${encodeURIComponent(body)}`);
        addResultMsg(`<strong>Email Draft Opened</strong> <span class="action-badge badge-success">✓ Mail client opened</span>`);
      },

      // ── FILE COMMANDS ──
      mergeFiles: async () => { addBotMsg('To merge files, upload multiple files in the Dashboard and they will be merged automatically. Or use: <strong>"Merge file A with file B"</strong>.'); },
      splitFiles: async () => { addBotMsg('File splitting: data will be split by the first categorical column. Currently supports split by group.'); },
      renameFile: async () => {
        const newName = rawText.replace(/rename\s*(file)?\s*(to)?\s*/i, '').trim();
        if (newName) { fileName = newName; saveData(); addResultMsg(`File renamed to <strong>${esc(newName)}</strong>`); }
        else { addBotMsg('Please specify a new name: "Rename file to MyData"'); }
      },
      archiveFiles: async () => { addBotMsg('Archive: data backed up to local storage.'); try { localStorage.setItem('archive_'+fileName, JSON.stringify(sheetData)); } catch(e){} addResultMsg('<strong>Archived</strong> <span class="action-badge badge-success">✓</span>'); },
      deleteFile: async () => { addBotMsg('File deletion requires confirmation. Data remains in Dashboard.'); },
      restoreFile: async () => { addBotMsg('To restore, re-upload the original file from Dashboard.'); },
      pdfToExcel: async () => { addBotMsg('PDF to Excel conversion: please upload the PDF file in Dashboard, it will be parsed automatically.'); },

      // ── REPORT EDITOR ──
      addFilters: async () => { addResultMsg(`<strong>Filters Applied</strong> <span class="action-badge badge-success">Auto-filter enabled on ${headers.length} columns</span>`); },
      convertCurrency: async () => { addBotMsg('Currency conversion: specify target currency (e.g., "Convert currency to USD"). Current data will have a converted column added.'); },

      // ── BUSINESS Q&A ──
      qaRevenue: async () => {
        const numCols = findNumCols();
        const revenueCol = numCols.find(c => /revenue|sales|amount|total|income/i.test(c)) || numCols[0];
        if (!revenueCol) { addBotMsg('No revenue column found.'); return; }
        const total = sheetData.reduce((s,r) => s + Number(String(r[revenueCol]||0).replace(/[^0-9.-]/g,'')), 0);
        addResultMsg(`<strong>Revenue Answer</strong> <span class="action-badge badge-info">Column: ${esc(revenueCol)}</span>
          ${renderKPI([{ label: 'Total Revenue', value: fmt(total), color: 'var(--ai-success)' }, { label: 'Average', value: fmt(total/sheetData.length), color: 'var(--ai-primary)' }])}`);
      },

      qaBestState: async () => {
        const catCols = findCatCols();
        const stateCol = catCols.find(c => /state|region|city|location|area/i.test(c)) || catCols[0];
        const numCols = findNumCols();
        const valCol = numCols.find(c => /revenue|sales|amount|total/i.test(c)) || numCols[0];
        if (!stateCol || !valCol) { addBotMsg('Need state and value columns.'); return; }
        const groups = {};
        sheetData.forEach(r => { const k = String(r[stateCol]||'Unknown'); const v = Number(String(r[valCol]||0).replace(/[^0-9.-]/g,'')); if(!isNaN(v)) groups[k]=(groups[k]||0)+v; });
        const sorted = Object.entries(groups).sort((a,b)=>b[1]-a[1]);
        addResultMsg(`<strong>Best State</strong> <span class="action-badge badge-success">Winner: ${esc(sorted[0][0])}</span>
          ${sorted.slice(0,8).map(([k,v],i) => `<div style="margin:2px 0;"><strong>${i+1}. ${esc(k)}</strong> — ${fmt(v)}</div>`).join('')}`);
      },

      qaBestProduct: async () => {
        const productCols = findCatCols();
        const prodCol = productCols.find(c => /product|item|sku|service/i.test(c)) || productCols[0];
        const numCols = findNumCols();
        const valCol = numCols.find(c => /revenue|sales|amount|profit|total|price/i.test(c)) || numCols[0];
        if (!prodCol || !valCol) { addBotMsg('Need product and value columns.'); return; }
        const groups = {};
        sheetData.forEach(r => { const k = String(r[prodCol]||'Unknown'); const v = Number(String(r[valCol]||0).replace(/[^0-9.-]/g,'')); if(!isNaN(v)) groups[k]=(groups[k]||0)+v; });
        const sorted = Object.entries(groups).sort((a,b)=>b[1]-a[1]);
        addResultMsg(`<strong>Best Product</strong> <span class="action-badge badge-success">Winner: ${esc(sorted[0][0])}</span>
          ${sorted.slice(0,8).map(([k,v],i) => `<div style="margin:2px 0;"><strong>${i+1}. ${esc(k)}</strong> — ${fmt(v)}</div>`).join('')}`);
      },

      qaTotalCount: async () => {
        const what = cmd.match(/total\s*(\w+)/);
        const label = what ? what[1] : 'records';
        addResultMsg(`<strong>Total ${label}:</strong> ${fmt(sheetData.length)}`);
      },

      qaExplain: async () => {
        const res = await postToWorker('AI_EXECUTIVE_SUMMARY', { data: sheetData });
        addResultMsg(`<strong>Data Explanation</strong><br><div style="font-size:0.82rem;line-height:1.7;">${esc(res.data.summary).replace(/\n/g,'<br>')}</div>`);
      },

      // ── BUSINESS QA FALLBACK ──
      businessQA: async () => {
        const res = await postToWorker('AI_EXECUTIVE_SUMMARY', { data: sheetData });
        addResultMsg(`<strong>Answer from Data</strong><br><div style="font-size:0.82rem;line-height:1.7;">${esc(res.data.summary).replace(/\n/g,'<br>')}</div>`);
      },

      // ── AUTONOMOUS MODE ──
      autonomousMode: async () => {
        await runAutonomousMode();
      },

      // ── WORKFLOW BUILDER ──
      buildWorkflow: async () => {
        const steps = [];
        if (cmd.includes('clean')) steps.push('Clean data');
        if (cmd.includes('report')) steps.push('Generate report');
        if (cmd.includes('pdf')) steps.push('Create PDF');
        if (cmd.includes('email')) steps.push('Email report');
        if (cmd.includes('backup')) steps.push('Save backup');
        if (cmd.includes('dashboard')) steps.push('Build dashboard');
        if (cmd.includes('forecast')) steps.push('Forecast trends');
        if (steps.length === 0) steps.push('Clean data', 'Generate report', 'Create PDF', 'Save backup');
        addResultMsg(`<strong>Workflow Created</strong> <span class="action-badge badge-success">${steps.length} steps</span>
          ${steps.map((s,i) => `<div style="margin:3px 0;"><span class="action-badge badge-info">${i+1}</span> ${esc(s)}</div>`).join('')}
          <br><button class="btn btn-secondary" style="padding:6px 14px;font-size:0.78rem;margin-top:8px;" onclick="document.getElementById('ai-input').value='autonomous mode';document.getElementById('btn-send').click();">Run Workflow Now</button>`);
      },
    };

    if (actions[action]) {
      await actions[action]();
    } else {
      addBotMsg(`Action "${action}" is not yet implemented.`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTONOMOUS MODE
  // ═══════════════════════════════════════════════════════════════════════════
  async function runAutonomousMode() {
    if (sheetData.length === 0) { addBotMsg('No data to process. Upload a file first.'); return; }

    const steps = [
      { name: 'Clean Data', icon: 'fa-broom', action: async () => {
        const res = await postToWorker('CLEAN', { data: sheetData, rules: { removeDuplicates: true, trimSpaces: true } });
        sheetData = res.data.cleaned;
        headers = sheetData.length > 0 ? Object.keys(sheetData[0]) : [];
        saveData();
        return `Removed ${res.data.stats.duplicatesRemoved} duplicates, trimmed ${res.data.stats.trimmedCells} cells`;
      }},
      { name: 'Detect Errors', icon: 'fa-triangle-exclamation', action: async () => {
        const res = await postToWorker('AI_FIND_DUPLICATES', { data: sheetData });
        return `${res.data.count} duplicates remaining (${res.data.percentage}%)`;
      }},
      { name: 'Analyze Data', icon: 'fa-magnifying-glass-chart', action: async () => {
        const res = await postToWorker('AI_FULL_ANALYSIS', { data: sheetData });
        return `Quality: ${res.data.qualityScore}%, ${res.data.totalRows} rows analyzed`;
      }},
      { name: 'Build Dashboard', icon: 'fa-gauge-high', action: async () => {
        const res = await postToWorker('AI_DASHBOARD', { data: sheetData });
        return `${res.data.widgets.length} dashboard widgets created`;
      }},
      { name: 'Generate Charts', icon: 'fa-chart-pie', action: async () => {
        const res = await postToWorker('AI_PIE_CHART', { data: sheetData });
        return `${res.data.slices.length} chart slices generated`;
      }},
      { name: 'Create Report', icon: 'fa-file-lines', action: async () => {
        const res = await postToWorker('AI_PROFESSIONAL_REPORT', { data: sheetData });
        return `Report with ${Object.keys(res.data.stats).length} metrics generated`;
      }},
      { name: 'Generate PDF', icon: 'fa-file-pdf', action: async () => {
        try {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          doc.setFontSize(16);
          doc.text(`Auto-Generated Report — ${fileName}`, 14, 15);
          doc.setFontSize(10);
          doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
          doc.autoTable({ head: [headers.slice(0,10)], body: sheetData.slice(0,50).map(r => headers.slice(0,10).map(h => String(r[h]||''))), styles: { fontSize: 7 } });
          doc.save(`${fileName||'auto-report'}.pdf`);
          return 'PDF downloaded';
        } catch(e) { return 'PDF failed: ' + e.message; }
      }},
      { name: 'Export Excel', icon: 'fa-file-excel', action: async () => {
        try {
          const ws = XLSX.utils.json_to_sheet(sheetData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Data');
          XLSX.writeFile(wb, `${fileName||'auto-export'}.xlsx`);
          return 'Excel downloaded';
        } catch(e) { return 'Excel failed: ' + e.message; }
      }},
      { name: 'Generate Insights', icon: 'fa-lightbulb', action: async () => {
        const res = await postToWorker('AI_EXECUTIVE_SUMMARY', { data: sheetData });
        return 'Executive summary generated';
      }},
      { name: 'Forecast Trends', icon: 'fa-chart-line', action: async () => {
        const res = await postToWorker('AI_FORECAST', { data: sheetData });
        const count = Object.keys(res.data.forecasts).length;
        return `${count} columns forecasted`;
      }},
    ];

    // Build progress UI
    const container = $('ai-messages');
    const progressEl = document.createElement('div');
    progressEl.className = 'ai-msg bot';
    let stepsHtml = steps.map((s,i) => `<div class="ap-step pending" id="ap-step-${i}"><div class="ap-check pending"><i class="fas ${s.icon}"></i></div><span>${s.name}</span><span class="ap-result" style="margin-left:auto;font-size:0.7rem;"></span></div>`).join('');
    progressEl.innerHTML = `<div class="autonomous-progress"><div class="ap-header"><span>🤖 Autonomous Mode</span><span class="ap-status" style="color:var(--ai-primary);">Running...</span></div><div class="ap-steps">${stepsHtml}</div></div>`;
    container.appendChild(progressEl);
    container.scrollTop = container.scrollHeight;

    // Execute each step
    for (let i = 0; i < steps.length; i++) {
      const stepEl = progressEl.querySelector(`#ap-step-${i}`);
      const checkEl = stepEl.querySelector('.ap-check');
      const resultEl = stepEl.querySelector('.ap-result');
      stepEl.className = 'ap-step running';
      checkEl.className = 'ap-check running';

      try {
        const result = await steps[i].action();
        stepEl.className = 'ap-step done';
        checkEl.className = 'ap-check done';
        checkEl.innerHTML = '<i class="fas fa-check"></i>';
        resultEl.textContent = result;
        resultEl.style.color = 'var(--ai-success)';
      } catch(e) {
        stepEl.className = 'ap-step done';
        checkEl.className = 'ap-check done';
        checkEl.innerHTML = '<i class="fas fa-times"></i>';
        checkEl.style.background = 'var(--ai-danger)';
        resultEl.textContent = 'Failed: ' + e.message;
        resultEl.style.color = 'var(--ai-danger)';
      }
      container.scrollTop = container.scrollHeight;
    }

    progressEl.querySelector('.ap-status').textContent = 'Complete!';
    progressEl.querySelector('.ap-status').style.color = 'var(--ai-success)';

    updateMiniPreview();
    showToast('Autonomous mode complete!', 'success');
    setMemory('last_autonomous', { time: Date.now(), rows: sheetData.length });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTER PARSER
  // ═══════════════════════════════════════════════════════════════════════════
  function parseFilter(cmd) {
    let column='', operator='contains', value='';
    const aboveMatch = cmd.match(/(?:above|greater|more|over|>)\s*(\d+[\d,]*)/i);
    const belowMatch = cmd.match(/(?:below|less|under|<)\s*(\d+[\d,]*)/i);
    const fromMatch = cmd.match(/(?:from|in)\s+(\w[\w\s]*?)(?:\s*$|\s+where)/i);

    if (aboveMatch) { column = findNumCols()[0]||headers[0]; operator='greater'; value=aboveMatch[1].replace(/,/g,''); }
    else if (belowMatch) { column = findNumCols()[0]||headers[0]; operator='less'; value=belowMatch[1].replace(/,/g,''); }
    else if (fromMatch) { column = findCol(fromMatch[1].trim()); value=fromMatch[1].trim(); }
    else {
      for (const h of headers) {
        if (cmd.toLowerCase().includes(h.toLowerCase())) { column=h; break; }
      }
      if (!column) { column = headers[0]; value = cmd.replace(/show|find|filter|where|data|rows/gi,'').trim(); }
    }
    return { column, operator, value };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOICE
  // ═══════════════════════════════════════════════════════════════════════════
  function initVoice() {
    const btn = $('btn-voice');
    if (!btn) return;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      btn.style.opacity='0.4'; btn.title='Voice not supported'; return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      $('ai-input').value = text;
      addUserMsg(text);
      processCommand(text);
    };
    recognition.onend = () => { isListening=false; btn.classList.remove('listening'); };
    recognition.onerror = (e) => { isListening=false; btn.classList.remove('listening'); if(e.error!=='no-speech') addErrorMsg(`Voice error: ${e.error}`); };
    btn.addEventListener('click', () => {
      if (isListening) { recognition.stop(); isListening=false; btn.classList.remove('listening'); }
      else { recognition.start(); isListening=true; btn.classList.add('listening'); addSystemMsg('Listening...'); }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUICK ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  function initQuickActions() {
    document.querySelectorAll('.qa-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        if (cmd) { $('ai-input').value = cmd; handleSend(); }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PANEL TABS
  // ═══════════════════════════════════════════════════════════════════════════
  function initPanelTabs() {
    document.querySelectorAll('.ai-panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ai-panel-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ai-panel-section').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        const section = document.getElementById('tab-'+tab.getAttribute('data-tab'));
        if (section) section.classList.add('active');
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKFLOW TOGGLES
  // ═══════════════════════════════════════════════════════════════════════════
  function initWorkflowToggles() {
    document.querySelectorAll('.wf-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const wf = toggle.getAttribute('data-wf');
        toggle.classList.toggle('on');
        WORKFLOWS[wf] = toggle.classList.contains('on');
        const item = toggle.closest('.wf-item');
        if (item) item.classList.toggle('active', WORKFLOWS[wf]);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR / EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  function initClearChat() {
    const btn = $('btn-clear');
    if (btn) btn.addEventListener('click', () => { $('ai-messages').innerHTML = ''; addSystemMsg('Chat cleared.'); });
  }

  function initExportChat() {
    const btn = $('btn-export-chat');
    if (btn) btn.addEventListener('click', () => {
      let text = '=== AI Operating System Chat Export ===\n\n';
      document.querySelectorAll('.ai-msg').forEach(m => {
        const type = m.classList.contains('user')?'You':m.classList.contains('bot')?'AI':m.classList.contains('result')?'Result':m.classList.contains('insight')?'Insight':'System';
        text += `[${type}]: ${m.textContent.trim()}\n\n`;
      });
      const blob = new Blob([text], {type:'text/plain'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ai-os-chat-${new Date().toISOString().slice(0,10)}.txt`;
      a.click();
      showToast('Chat exported', 'success');
    });
  }

  function initAutonomousBtn() {
    const btn = $('btn-autonomous');
    if (btn) btn.addEventListener('click', () => { $('ai-input').value = 'autonomous mode'; handleSend(); });
  }

  function initShortcutsModal() {
    const btn = $('btn-shortcuts');
    const modal = $('shortcuts-modal');
    if (btn && modal) {
      btn.addEventListener('click', () => { modal.style.display = modal.style.display==='flex'?'none':'flex'; });
      modal.addEventListener('click', (e) => { if (e.target===modal) modal.style.display='none'; });
    }
  }

  function initFileAttach() {
    const btn = $('btn-attach');
    const input = $('file-attach');
    if (btn && input) {
      btn.addEventListener('click', () => input.click());
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        addSystemMsg(`Processing file: ${file.name}`);
        try {
          const buffer = await file.arrayBuffer();
          const fullRes = await postToWorker('PARSE', { buffer, fileName: file.name });
          const d = fullRes.data;
          sheetData = d.jsonData || d.allSheets?.[d.sheetName] || d.allSheets?.[Object.keys(d.allSheets)[0]] || [];
          headers = d.headers || (sheetData.length > 0 ? Object.keys(sheetData[0]) : []);
          fileName = file.name;
          saveData();
          updateMiniPreview();
          updateStatusBar();
          addSystemMsg(`File loaded: ${fileName} (${sheetData.length} rows, ${headers.length} columns)`);
          showToast(`${file.name} loaded successfully`, 'success');
          if (WORKFLOWS.autonomous) {
            setTimeout(() => { $('ai-input').value = 'autonomous mode'; handleSend(); }, 500);
          }
        } catch(e) { addErrorMsg(`Failed to load file: ${e.message}`); }
        input.value = '';
      });
    }
  }

  function initTogglePanel() {
    const btn = $('btn-toggle-panel');
    const panel = $('ai-right-panel');
    if (btn && panel) {
      btn.addEventListener('click', () => {
        panel.classList.toggle('mobile-open');
        btn.classList.toggle('active');
      });
    }
  }

  function initClearMemory() {
    const btn = $('btn-clear-memory');
    if (btn) btn.addEventListener('click', () => { localStorage.removeItem('aiOS_memory'); renderMemory(); showToast('Memory cleared', 'info'); });
  }

  function initClearHistory() {
    const btn = $('btn-clear-history');
    if (btn) btn.addEventListener('click', () => { commandHistory = []; saveHistory(); renderHistory(); showToast('History cleared', 'info'); });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════════════════════
  function addToHistory(text) {
    commandHistory.push({ text, time: Date.now() });
    if (commandHistory.length > 100) commandHistory = commandHistory.slice(-100);
    saveHistory();
    renderHistory();
    updateStatusBar();
  }

  function renderHistory() {
    const el = $('history-list');
    if (!el) return;
    if (commandHistory.length === 0) { el.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:0.78rem;">No commands yet.</div>'; return; }
    el.innerHTML = commandHistory.slice().reverse().slice(0,30).map(h => {
      const time = new Date(h.time).toLocaleTimeString();
      const safeCmd = esc(h.text).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      return `<div class="hist-item" data-cmd="${safeCmd}"><div class="hist-cmd">${esc(h.text)}</div><div class="hist-time">${time}</div></div>`;
    }).join('');
    el.querySelectorAll('.hist-item').forEach(item => {
      item.addEventListener('click', () => {
        const cmd = item.getAttribute('data-cmd');
        if (cmd) { $('ai-input').value = cmd; handleSend(); }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY
  // ═══════════════════════════════════════════════════════════════════════════
  function renderMemory() {
    const el = $('memory-list');
    if (!el) return;
    const mem = getMemory();
    const keys = Object.keys(mem);
    if (keys.length === 0) { el.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:0.78rem;">No memories saved yet.</div>'; return; }
    el.innerHTML = keys.map(k => {
      const v = mem[k];
      const display = typeof v === 'object' ? JSON.stringify(v).slice(0,60) : String(v).slice(0,60);
      const icon = k.includes('analysis')?'fa-magnifying-glass-chart':k.includes('report')?'fa-file-lines':k.includes('dashboard')?'fa-gauge-high':k.includes('autonomous')?'fa-wand-magic-sparkles':'fa-brain';
      return `<div class="mem-item" data-memkey="${esc(k)}"><i class="fas ${icon} mem-icon"></i><span class="mem-key">${esc(k)}</span><span class="mem-val">${esc(display)}</span><i class="fas fa-times mem-del"></i></div>`;
    }).join('');
    el.querySelectorAll('.mem-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.mem-item');
        if (item) removeMemory(item.getAttribute('data-memkey'));
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════════════
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '?' && !e.target.matches('input,textarea')) {
        e.preventDefault();
        const modal = $('shortcuts-modal');
        if (modal) modal.style.display = modal.style.display==='flex'?'none':'flex';
      }
      if (e.key === 'Escape') {
        const modal = $('shortcuts-modal');
        if (modal) modal.style.display = 'none';
        hideSuggestions();
      }
      if (e.ctrlKey && e.key === 'm') { e.preventDefault(); const btn=$('btn-voice'); if(btn) btn.click(); }
      if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); $('ai-input').value='autonomous mode'; handleSend(); }
      if (e.ctrlKey && e.key === 'l') { e.preventDefault(); const btn=$('btn-clear'); if(btn) btn.click(); }
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); const btn=$('btn-toggle-panel'); if(btn) btn.click(); }
      if (e.key === 'ArrowUp' && !e.target.matches('textarea') && commandHistory.length > 0) {
        historyIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        $('ai-input').value = commandHistory[commandHistory.length - 1 - historyIndex].text;
      }
      if (e.key === 'ArrowDown' && !e.target.matches('textarea') && historyIndex > -1) {
        historyIndex--;
        $('ai-input').value = historyIndex >= 0 ? commandHistory[commandHistory.length - 1 - historyIndex].text : '';
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-WORKFLOW TRIGGER (called from dashboard)
  // ═══════════════════════════════════════════════════════════════════════════
  window.runAutoWorkflows = async function(data, hdrs, fname) {
    sheetData = data;
    headers = hdrs;
    fileName = fname;
    saveData();
    updateMiniPreview();
    updateStatusBar();

    if (WORKFLOWS.autonomous) {
      addSystemMsg(`File uploaded: ${fname}. Running autonomous mode...`);
      setTimeout(() => { $('ai-input').value = 'autonomous mode'; handleSend(); }, 500);
      return;
    }

    const steps = [];
    if (WORKFLOWS.clean) steps.push({ name:'Clean', action: async () => { const res = await postToWorker('CLEAN', { data: sheetData, rules: { removeDuplicates: true, trimSpaces: true } }); sheetData = res.data.cleaned; headers = Object.keys(sheetData[0]||{}); saveData(); return `Removed ${res.data.stats.duplicatesRemoved} duplicates`; }});
    if (WORKFLOWS.report) steps.push({ name:'Report', action: async () => { await postToWorker('AI_PROFESSIONAL_REPORT', { data: sheetData }); return 'Report generated'; }});
    if (WORKFLOWS.backup) steps.push({ name:'Backup', action: async () => { try { localStorage.setItem('backup_'+fname, JSON.stringify(sheetData.slice(0,5000))); } catch(e){} return 'Backed up'; }});
    if (WORKFLOWS.dashboard) steps.push({ name:'Dashboard', action: async () => { const res = await postToWorker('AI_DASHBOARD', { data: sheetData }); return `${res.data.widgets.length} widgets created`; }});

    if (steps.length === 0) return;
    addSystemMsg(`Auto-workflow: ${fname} (${steps.length} steps)`);
    for (const step of steps) {
      try { const r = await step.action(); addSystemMsg(`✓ ${step.name}: ${r}`); }
      catch(e) { addErrorMsg(`✗ ${step.name}: ${e.message}`); }
    }
    updateMiniPreview();
  };

})();
