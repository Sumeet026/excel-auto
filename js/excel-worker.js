/* ==========================================================================
   EXCEL AUTO - ULTRA-FAST EXCEL WORKER ENGINE v4.0
   • Streaming reader with instant metadata + first 100 rows
   • Chunk processing for 500MB+ files with progress
   • Smart Data Engine: auto-detect column types
   • AI features: formula gen, cleaning, duplicates, missing data, forecasting
   • Multi-format parsing (XLSX, XLS, CSV, XML, JSON, TXT, PDF)
   • Background export with progress
   ========================================================================== */

'use strict';

importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

const CHUNK_SIZE = 5000;
const PREVIEW_ROWS = 100;

self.onmessage = function(e) {
  const { action, payload, id } = e.data;
  try {
    switch (action) {
      case 'PARSE_FAST':       handleParseFast(payload, id); break;
      case 'PARSE':            handleParse(payload, id); break;
      case 'PARSE_CHUNK':      handleParseChunk(payload, id); break;
      case 'CLEAN':            handleClean(payload, id); break;
      case 'FORMULA':          handleFormula(payload, id); break;
      case 'AI_ANALYZE':       handleAiAnalyze(payload, id); break;
      case 'AI_FORMULA':       handleAiFormula(payload, id); break;
      case 'AI_CLEAN':         handleAiClean(payload, id); break;
      case 'AI_DUPLICATES':    handleAiDuplicates(payload, id); break;
      case 'AI_MISSING':       handleAiMissing(payload, id); break;
      case 'AI_FORECAST':      handleAiForecast(payload, id); break;
      case 'AI_TREND':         handleAiTrend(payload, id); break;
      case 'AI_DASHBOARD':     handleAiDashboard(payload, id); break;
      case 'AI_REPORT':        handleAiReport(payload, id); break;
      case 'AI_TOP_CUSTOMERS': handleAiTopCustomers(payload, id); break;
      case 'AI_PIVOT':         handleAiPivot(payload, id); break;
      case 'TRANSLATE':        handleTranslate(payload, id); break;
      case 'AI_PIE_CHART':     handleAiPieChart(payload, id); break;
      case 'AI_PROFESSIONAL_REPORT': handleAiProfessionalReport(payload, id); break;
      case 'AI_EXECUTIVE_SUMMARY': handleAiExecutiveSummary(payload, id); break;
      case 'AI_PROFIT_FORMULA': handleAiProfitFormula(payload, id); break;
      case 'AI_GST_FORMULA':   handleAiGstFormula(payload, id); break;
      case 'AI_COMMISSION':    handleAiCommission(payload, id); break;
      case 'AI_MONTHLY_GROWTH': handleAiMonthlyGrowth(payload, id); break;
      case 'AI_FILTER':        handleAiFilter(payload, id); break;
      case 'AI_INACTIVE':      handleAiInactive(payload, id); break;
      case 'AI_LAST_MONTH':    handleAiLastMonth(payload, id); break;
      case 'AI_TOP_PRODUCTS':  handleAiTopProducts(payload, id); break;
      case 'AI_GROUP_BY':      handleAiGroupBy(payload, id); break;
      case 'AI_YEARLY_GROWTH': handleAiYearlyGrowth(payload, id); break;
      case 'AI_FULL_ANALYSIS': handleAiFullAnalysis(payload, id); break;
      case 'AI_FIND_DUPLICATES': handleAiFindDuplicates(payload, id); break;
      case 'AI_MISSING_DATA':  handleAiMissingData(payload, id); break;
      case 'EXPORT':           handleExport(payload, id); break;
      case 'CSV_STREAM':       handleCsvStream(payload, id); break;
      case 'DETECT_TYPES':     handleDetectTypes(payload, id); break;
      default:
        self.postMessage({ id, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    self.postMessage({ id, error: err.message, stack: err.stack });
  }
};

function progress(id, pct, msg) {
  self.postMessage({ id, type: 'progress', percent: pct, message: msg });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAST PARSE: Returns metadata + first 100 rows in <100ms
// ═══════════════════════════════════════════════════════════════════════════════
function handleParseFast({ buffer, fileName, textContent }, id) {
  const t0 = Date.now();
  let ext = fileName ? fileName.split('.').pop().toLowerCase() : 'xlsx';
  if (textContent) ext = 'pdf';

  progress(id, 10, 'Reading file structure...');

  let sheetNames = [];
  let totalRows = 0;
  let totalCols = 0;
  let previewData = [];
  let allData = [];
  let sheets = {};

  try {
    if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, {
        type: 'array', cellDates: true, cellText: false,
        cellFormula: false, dense: false, sheetStubs: false
      });
      sheetNames = wb.SheetNames;

      wb.SheetNames.forEach((name) => {
        const ws = wb.Sheets[name];
        if (!ws || !ws['!ref']) return;
        const range = XLSX.utils.decode_range(ws['!ref']);
        const rowCount = range.e.r - range.s.r + 1;
        const colCount = range.e.c - range.s.c + 1;
        totalRows += rowCount;
        if (colCount > totalCols) totalCols = colCount;

        const allRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'YYYY-MM-DD' });
        sheets[name] = allRows;
      });

      allData = sheets[sheetNames[0]] || [];
      previewData = allData.slice(0, PREVIEW_ROWS);
    }
    else if (ext === 'csv') {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      const lines = text.split('\n');
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        totalCols = headers.length;
        totalRows = lines.length - 1;
        for (let i = 1; i < Math.min(lines.length, PREVIEW_ROWS + 1); i++) {
          if (!lines[i].trim()) continue;
          const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row = {};
          headers.forEach((h, idx) => { row[h] = vals[idx] !== undefined ? vals[idx] : ''; });
          previewData.push(row);
        }
      }
      progress(id, 80, 'Detecting column types...');
      const csvHeaders = previewData.length > 0 ? Object.keys(previewData[0]) : [];
      const columnTypes = detectColumnTypes(previewData, csvHeaders);
      const parseTime = Date.now() - t0;

      self.postMessage({
        id, action: 'PARSE_FAST_COMPLETE',
        data: { previewData, sheetNames, totalRows, totalCols, headers: csvHeaders, columnTypes, parseTime, fileName, fileExtension: ext }
      });

      setTimeout(() => {
        allData = parseCsvFull(text);
        sheets['Sheet1'] = allData;
        const fullHeaders = allData.length > 0 ? Object.keys(allData[0]) : [];
        const fullColTypes = detectColumnTypes(allData, fullHeaders);
        self.postMessage({
          id, action: 'PARSE_FULL_COMPLETE',
          data: { jsonData: allData, allSheets: sheets, sheetName: 'Sheet1', sheetNames, totalRows: allData.length, totalCols: fullHeaders.length, headers: fullHeaders, columnTypes: fullColTypes, parseTime: Date.now() - t0 }
        });
      }, 0);
      return;
    }
    else if (ext === 'json') {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      const parsedObj = JSON.parse(text);
      allData = Array.isArray(parsedObj) ? parsedObj.map(flattenObject) : [flattenObject(parsedObj)];
      totalRows = allData.length;
      if (allData.length > 0) totalCols = Object.keys(allData[0]).length;
      previewData = allData.slice(0, PREVIEW_ROWS);
      sheets['Sheet1'] = allData;
    }
    else if (ext === 'xml') {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      allData = parseXmlToRows(text);
      totalRows = allData.length;
      if (allData.length > 0) totalCols = Object.keys(allData[0]).length;
      previewData = allData.slice(0, PREVIEW_ROWS);
      sheets['Sheet1'] = allData;
    }
    else if (ext === 'txt') {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      allData = extractEntitiesFromText(text);
      totalRows = allData.length;
      if (allData.length > 0) totalCols = Object.keys(allData[0]).length;
      previewData = allData.slice(0, PREVIEW_ROWS);
      sheets['Sheet1'] = allData;
    }
    else if (ext === 'pdf') {
      allData = extractEntitiesFromText(textContent || '');
      totalRows = allData.length;
      if (allData.length > 0) totalCols = Object.keys(allData[0]).length;
      previewData = allData.slice(0, PREVIEW_ROWS);
      sheets['Sheet1'] = allData;
    }

    const headers = allData.length > 0 ? Object.keys(allData[0]) : [];
    const parseTime = Date.now() - t0;

    progress(id, 80, 'Detecting column types...');
    const columnTypes = detectColumnTypes(allData, headers);

    progress(id, 100, `Fast parse complete: ${totalRows} rows in ${parseTime}ms`);

    self.postMessage({
      id,
      action: 'PARSE_FAST_COMPLETE',
      data: {
        previewData,
        sheetNames,
        totalRows,
        totalCols,
        headers,
        columnTypes,
        parseTime,
        fileName,
        fileExtension: ext
      }
    });

    // Also send full data separately so it doesn't block the fast response
    self.postMessage({
      id,
      action: 'PARSE_FULL_COMPLETE',
      data: {
        jsonData: allData,
        allSheets: sheets,
        sheetName: sheetNames[0] || 'Sheet1',
        sheetNames,
        totalRows,
        totalCols,
        headers,
        columnTypes,
        parseTime
      }
    });

  } catch (err) {
    self.postMessage({ id, error: `Fast parse failed: ${err.message}` });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANDARD PARSE: Full parse with chunk progress
// ═══════════════════════════════════════════════════════════════════════════════
function handleParse({ buffer, fileName, textContent, options = {} }, id) {
  const t0 = Date.now();
  let ext = fileName ? fileName.split('.').pop().toLowerCase() : 'xlsx';
  if (textContent) ext = 'pdf';

  progress(id, 5, 'Detecting file type...');

  let sheets = {};
  let firstSheet = 'Sheet1';
  let totalRows = 0;
  let totalCols = 0;
  let jsonData = [];
  let sheetNames = ['Sheet1'];

  try {
    if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, {
        type: 'array', cellDates: true, cellText: false,
        cellFormula: false, dense: false, ...options
      });

      sheetNames = wb.SheetNames;
      firstSheet = wb.SheetNames[0];

      wb.SheetNames.forEach((name, si) => {
        const ws = wb.Sheets[name];
        if (!ws) return;
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const rowCount = range.e.r - range.s.r + 1;
        const colCount = range.e.c - range.s.c + 1;
        totalRows += rowCount;
        if (colCount > totalCols) totalCols = colCount;

        const pct = 20 + Math.round((si / wb.SheetNames.length) * 60);
        progress(id, pct, `Parsing sheet: ${name} (${rowCount} rows)`);

        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'YYYY-MM-DD' });
        sheets[name] = rows;
      });
      jsonData = sheets[firstSheet] || [];
    }
    else if (ext === 'csv') {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      jsonData = parseCsvFull(text);
      sheets['Sheet1'] = jsonData;
      totalRows = jsonData.length;
      if (jsonData.length > 0) totalCols = Object.keys(jsonData[0]).length;
    }
    else if (ext === 'json') {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      const parsedObj = JSON.parse(text);
      jsonData = Array.isArray(parsedObj) ? parsedObj.map(flattenObject) : [flattenObject(parsedObj)];
      sheets['Sheet1'] = jsonData;
      totalRows = jsonData.length;
      if (jsonData.length > 0) totalCols = Object.keys(jsonData[0]).length;
    }
    else if (ext === 'xml') {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      jsonData = parseXmlToRows(text);
      sheets['Sheet1'] = jsonData;
      totalRows = jsonData.length;
      if (jsonData.length > 0) totalCols = Object.keys(jsonData[0]).length;
    }
    else if (ext === 'txt') {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(buffer);
      jsonData = extractEntitiesFromText(text);
      sheets['Sheet1'] = jsonData;
      totalRows = jsonData.length;
      if (jsonData.length > 0) totalCols = Object.keys(jsonData[0]).length;
    }
    else if (ext === 'pdf') {
      jsonData = extractEntitiesFromText(textContent || '');
      sheets['Sheet1'] = jsonData;
      totalRows = jsonData.length;
      if (jsonData.length > 0) totalCols = Object.keys(jsonData[0]).length;
    }

    if (jsonData.length > 0) {
      jsonData = runAutoSemanticMapping(jsonData);
      sheets[firstSheet] = jsonData;
    }

    const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
    progress(id, 85, 'Detecting column types...');
    const columnTypes = detectColumnTypes(jsonData, headers);

    progress(id, 90, 'Finalizing data structures...');
    const parseTime = Date.now() - t0;

    self.postMessage({
      id,
      action: 'PARSE_COMPLETE',
      data: { jsonData, allSheets: sheets, sheetName: firstSheet, sheetNames, totalRows, totalCols, headers, columnTypes, parseTime }
    });

    progress(id, 100, `Parsed ${totalRows} rows in ${parseTime}ms`);
  } catch (err) {
    self.postMessage({ id, error: `Parse failed: ${err.message}` });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART DATA ENGINE: Auto-detect column types
// ═══════════════════════════════════════════════════════════════════════════════
function detectColumnTypes(data, headers) {
  if (!data || data.length === 0 || !headers || headers.length === 0) return {};

  const sampleSize = Math.min(200, data.length);
  const sample = data.slice(0, sampleSize);
  const types = {};

  const patterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    phone: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/,
    url: /^(https?:\/\/|www\.)[^\s]+$/i,
    date: /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/ || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/,
    currency: /^[\$€£¥Rs\$]?\s*[\d,]+\.?\d{0,2}$/,
    number: /^-?[\d,]+\.?\d*$/,
    integer: /^-?\d+$/,
    boolean: /^(true|false|yes|no|0|1)$/i,
    name: /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/,
    address: /^\d+\s+\w+/
  };

  headers.forEach(h => {
    const values = sample.map(r => String(r[h] || '').trim()).filter(v => v !== '');
    if (values.length === 0) { types[h] = 'empty'; return; }

    const scores = {
      email: 0, phone: 0, url: 0, date: 0, currency: 0,
      number: 0, integer: 0, boolean: 0, name: 0, address: 0, text: 0
    };

    values.forEach(v => {
      if (patterns.email.test(v)) scores.email++;
      else if (patterns.phone.test(v)) scores.phone++;
      else if (patterns.url.test(v)) scores.url++;
      else if (patterns.boolean.test(v)) scores.boolean++;
      else if (patterns.currency.test(v)) scores.currency++;
      else if (patterns.integer.test(v)) scores.integer++;
      else if (patterns.number.test(v)) scores.number++;
      else if (patterns.date.test(v)) scores.date++;
      else if (patterns.name.test(v)) scores.name++;
      else if (patterns.address.test(v)) scores.address++;
      else scores.text++;
    });

    const threshold = values.length * 0.6;
    let bestType = 'text';
    let bestScore = 0;
    Object.entries(scores).forEach(([type, score]) => {
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestType = type;
      }
    });

    // Boost: check column name hints
    const lowerH = h.toLowerCase();
    if (bestType === 'text') {
      if (lowerH.includes('email') || lowerH.includes('e-mail')) bestType = 'email';
      else if (lowerH.includes('phone') || lowerH.includes('mobile') || lowerH.includes('tel')) bestType = 'phone';
      else if (lowerH.includes('date') || lowerH.includes('time') || lowerH.includes('created')) bestType = 'date';
      else if (lowerH.includes('price') || lowerH.includes('amount') || lowerH.includes('revenue') || lowerH.includes('cost') || lowerH.includes('total')) bestType = 'currency';
      else if (lowerH.includes('name') || lowerH.includes('customer') || lowerH.includes('user')) bestType = 'name';
      else if (lowerH.includes('address') || lowerH.includes('city') || lowerH.includes('street')) bestType = 'address';
      else if (lowerH.includes('url') || lowerH.includes('link') || lowerH.includes('website')) bestType = 'url';
      else if (lowerH.includes('id') || lowerH.includes('count') || lowerH.includes('qty') || lowerH.includes('quantity')) bestType = 'integer';
    }

    types[h] = bestType;
  });

  return types;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETECT TYPES (standalone action)
// ═══════════════════════════════════════════════════════════════════════════════
function handleDetectTypes({ data, headers }, id) {
  const types = detectColumnTypes(data, headers);
  self.postMessage({ id, action: 'DETECT_TYPES_COMPLETE', data: { columnTypes: types } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV FULL PARSER
// ═══════════════════════════════════════════════════════════════════════════════
function parseCsvFull(text) {
  const lines = text.split('\n');
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    const vals = matches.map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] !== undefined ? vals[idx] : ''; });
    rows.push(row);
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSE CHUNK (streaming large files)
// ═══════════════════════════════════════════════════════════════════════════════
function handleParseChunk({ buffer, sheetName, startRow, chunkSize = CHUNK_SIZE }, id) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellText: false });
  const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
  if (!ws) { self.postMessage({ id, error: 'Sheet not found' }); return; }

  const allRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'YYYY-MM-DD' });
  const chunk = allRows.slice(startRow, startRow + chunkSize);

  self.postMessage({
    id, action: 'PARSE_CHUNK_COMPLETE',
    data: { chunk, startRow, totalRows: allRows.length, hasMore: startRow + chunkSize < allRows.length }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV STREAMING
// ═══════════════════════════════════════════════════════════════════════════════
function handleCsvStream({ text, chunkIndex = 0 }, id) {
  const t0 = Date.now();
  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1 + chunkIndex * CHUNK_SIZE; i < Math.min(lines.length, (chunkIndex + 1) * CHUNK_SIZE + 1); i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] !== undefined ? vals[idx] : ''; });
    rows.push(row);
  }

  self.postMessage({
    id, action: 'CSV_CHUNK_COMPLETE',
    data: { rows, headers, chunkIndex, totalLines: lines.length - 1, hasMore: (chunkIndex + 1) * CHUNK_SIZE < lines.length - 1, duration: Date.now() - t0 }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEAN (multi-rule, chunk-based, with progress)
// ═══════════════════════════════════════════════════════════════════════════════
function handleClean({ data, rules }, id) {
  const t0 = Date.now();
  const total = data.length;
  let cleaned = data;
  let stats = { duplicatesRemoved: 0, emptyRowsRemoved: 0, emptyColsRemoved: 0, trimmedCells: 0, datesFixed: 0, charsStripped: 0 };

  progress(id, 5, 'Analyzing dataset...');

  if (rules.removeDuplicates) {
    const seen = new Map();
    cleaned = cleaned.filter(row => {
      const hash = stableHash(row);
      if (seen.has(hash)) return false;
      seen.set(hash, true);
      return true;
    });
    stats.duplicatesRemoved = total - cleaned.length;
    progress(id, 25, `Removed ${stats.duplicatesRemoved} duplicates`);
  }

  if (rules.removeEmpty) {
    const before = cleaned.length;
    cleaned = cleaned.filter(row => Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== ''));
    stats.emptyRowsRemoved = before - cleaned.length;
    progress(id, 40, `Removed ${stats.emptyRowsRemoved} empty rows`);
  }

  if (rules.removeEmptyCols && cleaned.length > 0) {
    const headers = Object.keys(cleaned[0]);
    const emptyCols = headers.filter(h => cleaned.every(row => row[h] === null || row[h] === undefined || String(row[h]).trim() === ''));
    if (emptyCols.length > 0) {
      cleaned = cleaned.map(row => { const nr = { ...row }; emptyCols.forEach(c => delete nr[c]); return nr; });
      stats.emptyColsRemoved = emptyCols.length;
    }
    progress(id, 55, `Removed ${stats.emptyColsRemoved} empty columns`);
  }

  if (rules.trimSpaces || rules.stripSpecial) {
    cleaned = processInChunks(cleaned, CHUNK_SIZE, (chunk) => {
      return chunk.map(row => {
        const nr = {};
        Object.keys(row).forEach(k => {
          let v = row[k];
          if (typeof v === 'string') {
            if (rules.trimSpaces) { const before = v; v = v.trim(); if (before !== v) stats.trimmedCells++; }
            if (rules.stripSpecial && !k.toLowerCase().includes('email') && !k.toLowerCase().includes('url')) {
              v = v.replace(/[^\w\s\-\.\,\@\:\/\(\)\#\+\=\!\?]/gi, '');
              stats.charsStripped++;
            }
          }
          nr[k] = v;
        });
        return nr;
      });
    });
    progress(id, 70, `Trimmed ${stats.trimmedCells} cells`);
  }

  if (rules.normalizeDates) {
    cleaned = cleaned.map(row => {
      const nr = { ...row };
      Object.keys(nr).forEach(k => {
        const v = nr[k];
        if (v instanceof Date) { nr[k] = v.toISOString().split('T')[0]; stats.datesFixed++; }
        else if (typeof v === 'string' && v.length >= 6 && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(v)) {
          const d = new Date(v);
          if (!isNaN(d.getTime())) { nr[k] = d.toISOString().split('T')[0]; stats.datesFixed++; }
        }
      });
      return nr;
    });
    progress(id, 90, `Fixed ${stats.datesFixed} dates`);
  }

  const duration = Date.now() - t0;
  self.postMessage({ id, action: 'CLEAN_COMPLETE', data: { cleaned, stats, duration } });
  progress(id, 100, `Cleaned ${total} rows in ${duration}ms`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULA (vectorized)
// ═══════════════════════════════════════════════════════════════════════════════
function handleFormula({ data, formula, targetColumn, operation }, id) {
  const t0 = Date.now();
  const total = data.length;

  const result = processInChunks(data, CHUNK_SIZE, (chunk) => {
    return chunk.map((row) => {
      const nr = { ...row };
      try {
        switch (operation) {
          case 'SUM': case 'EVAL': {
            let expr = formula;
            Object.keys(row).sort((a, b) => b.length - a.length).forEach(h => {
              expr = expr.replace(new RegExp(`\\b${escapeRegex(h)}\\b`, 'g'), Number(row[h]) || 0);
            });
            nr[targetColumn] = Function('"use strict"; return (' + expr + ')')();
            break;
          }
          case 'AVERAGE': {
            const cols = formula.split(',').map(c => c.trim());
            const nums = cols.map(c => Number(row[c]) || 0).filter(n => !isNaN(n));
            nr[targetColumn] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
            break;
          }
          case 'IF': {
            let evalStr = formula;
            Object.keys(row).sort((a, b) => b.length - a.length).forEach(h => {
              const v = typeof row[h] === 'string' ? `"${row[h].replace(/"/g, '\\"')}"` : (Number(row[h]) || 0);
              evalStr = evalStr.replace(new RegExp(`\\b${escapeRegex(h)}\\b`, 'g'), v);
            });
            nr[targetColumn] = Function('"use strict"; return (' + evalStr + ')')();
            break;
          }
          case 'CONCAT': {
            nr[targetColumn] = formula.split('+').map(p => { p = p.trim(); return p.startsWith('"') ? p.replace(/^['"]|['"]$/g, '') : String(row[p] !== undefined ? row[p] : ''); }).join('');
            break;
          }
          case 'COUNTIF': {
            let c = 0;
            data.forEach(r => { if (String(r[formula] || '').trim() === String(row[formula] || '').trim()) c++; });
            nr[targetColumn] = c;
            break;
          }
          case 'XLOOKUP': {
            const parts = formula.split(',').map(p => p.trim());
            const match = data.find(r => String(r[parts[1]] || '') === String(row[parts[0]] || ''));
            nr[targetColumn] = match ? match[parts[2]] : 'N/A';
            break;
          }
          default: nr[targetColumn] = formula;
        }
      } catch (e) { nr[targetColumn] = `#ERR: ${e.message}`; }
      return nr;
    });
  });

  const duration = Date.now() - t0;
  self.postMessage({ id, action: 'FORMULA_COMPLETE', data: { result, duration, totalRows: total } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Top 10 Customers
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiTopCustomers({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) {
    self.postMessage({ id, action: 'AI_TOP_CUSTOMERS_COMPLETE', data: { topCustomers: [], duration: 0 } });
    return;
  }

  const headers = Object.keys(data[0]);
  const nameCol = headers.find(h => /customer|client|buyer|name|company|vendor/i.test(h)) || headers[0];
  const numCols = headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  const valueCol = numCols.find(h => /revenue|amount|total|spent|sales|price|cost|value|paid/i.test(h)) || numCols[0] || null;

  if (!valueCol) {
    self.postMessage({ id, action: 'AI_TOP_CUSTOMERS_COMPLETE', data: { topCustomers: [], nameCol, valueCol: null, duration: Date.now() - t0 } });
    return;
  }

  const aggregated = {};
  data.forEach(row => {
    const name = String(row[nameCol] || 'Unknown').trim();
    if (!name) return;
    const val = Number(String(row[valueCol] || 0).replace(/[^0-9.-]/g, ''));
    if (!isNaN(val)) {
      aggregated[name] = (aggregated[name] || 0) + val;
    }
  });

  const sorted = Object.entries(aggregated)
    .map(([name, total]) => ({ name, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const maxVal = sorted.length > 0 ? sorted[0].total : 1;

  self.postMessage({
    id, action: 'AI_TOP_CUSTOMERS_COMPLETE',
    data: {
      topCustomers: sorted.map(c => ({ ...c, percentage: parseFloat(((c.total / maxVal) * 100).toFixed(1)) })),
      nameCol, valueCol,
      totalCustomers: Object.keys(aggregated).length,
      duration: Date.now() - t0
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Pivot Table
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiPivot({ data, rowCol, valueCol, aggFunc = 'SUM' }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0 || !rowCol || !valueCol) {
    self.postMessage({ id, action: 'AI_PIVOT_COMPLETE', data: { pivot: [], duration: 0 } });
    return;
  }

  const groups = {};
  data.forEach(row => {
    const key = String(row[rowCol] || 'Unknown').trim();
    const val = Number(String(row[valueCol] || 0).replace(/[^0-9.-]/g, ''));
    if (!isNaN(val)) {
      if (!groups[key]) groups[key] = [];
      groups[key].push(val);
    }
  });

  const pivot = Object.entries(groups).map(([key, vals]) => {
    let aggVal;
    switch (aggFunc) {
      case 'AVG': case 'AVERAGE': aggVal = vals.reduce((a, b) => a + b, 0) / vals.length; break;
      case 'COUNT': aggVal = vals.length; break;
      case 'MIN': aggVal = Math.min(...vals); break;
      case 'MAX': aggVal = Math.max(...vals); break;
      default: aggVal = vals.reduce((a, b) => a + b, 0);
    }
    return { label: key, value: parseFloat(aggVal.toFixed(2)), count: vals.length };
  }).sort((a, b) => b.value - a.value);

  self.postMessage({
    id, action: 'AI_PIVOT_COMPLETE',
    data: { pivot, rowCol, valueCol, aggFunc, duration: Date.now() - t0 }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATE: Hindi dictionary-based translation
// ═══════════════════════════════════════════════════════════════════════════════
function handleTranslate({ data, headers, targetLang = 'hi' }, id) {
  const t0 = Date.now();

  const hindiDict = {
    'Date': 'तिथि', 'Invoice ID': 'चालान आईडी', 'Customer': 'ग्राहक', 'Product': 'उत्पाद',
    'Quantity': 'मात्रा', 'Unit Price': 'इकाई मूल्य', 'Total': 'कुल', 'Tax': 'कर',
    'Net Revenue': 'शुद्ध राजस्व', 'Salesperson': 'बिक्रेता', 'Region': 'क्षेत्र', 'Status': 'स्थिति',
    'Name': 'नाम', 'Email': 'ईमेल', 'Phone': 'फ़ोन', 'Address': 'पता',
    'Amount': 'राशि', 'Price': 'मूल्य', 'Cost': 'लागत', 'Revenue': 'राजस्व',
    'Sales': 'बिक्री', 'Profit': 'लाभ', 'Loss': 'हानि', 'Expense': 'व्यय',
    'Income': 'आय', 'Salary': 'वेतन', 'Department': 'विभाग', 'Employee': 'कर्मचारी',
    'Company': 'कंपनी', 'Order': 'ऑर्डर', 'Payment': 'भुगतान', 'Discount': 'छूट',
    'Weight': 'वज़न', 'Size': 'आकार', 'Category': 'श्रेणी', 'Description': 'विवरण',
    'Reference': 'संदर्भ', 'Approved By': 'अनुमोदित', 'Notes': 'नोट्स',
    'CGST Rate': 'CGST दर', 'CGST Amount': 'CGST राशि',
    'SGST Rate': 'SGST दर', 'SGST Amount': 'SGST राशि',
    'IGST Rate': 'IGST दर', 'IGST Amount': 'IGST राशि',
    'Total Tax': 'कुल कर', 'Invoice Value': 'चालान मूल्य',
    'Taxable Amount': 'कर योग्य राशि', 'HSN Code': 'HSN कोड', 'GSTIN': 'जीएसटीआईएन',
    'Invoice No': 'चालान संख्या', 'Invoice Date': 'चालान तिथि',
    'Completed': 'पूर्ण', 'Pending': 'लंबित', 'Cancelled': 'रद्द', 'Invoiced': 'चालानित',
    'Paid': 'भुगतानित', 'Overdue': 'अतिदेय', 'Partial': 'आंशिक',
    'Low Stock': 'कम स्टॉक', 'Normal': 'सामान्य', 'Overstocked': 'अधिक स्टॉक',
    'Present': 'उपस्थित', 'Absent': 'अनुपस्थित', 'Work From Home': 'घर से कार्य',
    'On Leave': 'अवकाश पर', 'Half Day': 'आधा दिन',
    'Growth': 'वृद्धि', 'Decline': 'गिरावट', 'Stable': 'स्थिर',
    'Enterprise': 'उद्यम', 'Mid-Market': 'मध्य बाज़ार', 'SMB': 'लघु व्यवसाय',
    'Startup': 'स्टार्टअप', 'Individual': 'व्यक्तिगत',
    'Low': 'कम', 'Medium': 'मध्यम', 'High': 'उच्च',
    'North America': 'उत्तरी अमेरिका', 'Europe': 'यूरोप', 'Asia Pacific': 'एशिया पैसिफिक',
    'Latin America': 'लैटिन अमेरिका', 'Middle East': 'मध्य पूर्व'
  };

  const translatedHeaders = headers.map(h => hindiDict[h] || h);
  const translatedData = data.map(row => {
    const newRow = {};
    headers.forEach((h, i) => {
      const val = row[h];
      newRow[translatedHeaders[i]] = hindiDict[val] || val;
    });
    return newRow;
  });

  self.postMessage({
    id, action: 'TRANSLATE_COMPLETE',
    data: { translatedData, translatedHeaders, duration: Date.now() - t0 }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: PIE CHART DATA
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiPieChart({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_PIE_CHART_COMPLETE', data: { slices: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const catCol = headers.find(h => /category|product|status|region|state|segment|type|department/i.test(h)) || headers[0];
  const numCols = headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  const valCol = numCols.find(h => /revenue|amount|total|sales|price|cost|spent|value/i.test(h)) || numCols[0] || null;

  const groups = {};
  data.forEach(row => {
    const key = String(row[catCol] || 'Unknown').trim();
    const val = valCol ? Number(String(row[valCol] || 0).replace(/[^0-9.-]/g, '')) : 1;
    if (!isNaN(val)) groups[key] = (groups[key] || 0) + val;
  });

  const slices = Object.entries(groups).map(([label, value]) => ({ label, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value).slice(0, 10);
  const total = slices.reduce((s, e) => s + e.value, 0);
  slices.forEach(s => s.percentage = parseFloat(((s.value / total) * 100).toFixed(1)));

  self.postMessage({ id, action: 'AI_PIE_CHART_COMPLETE', data: { slices, catCol, valCol, total: parseFloat(total.toFixed(2)), duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: PROFESSIONAL REPORT
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiProfessionalReport({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_PROFESSIONAL_REPORT_COMPLETE', data: { report: {}, duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const numHeaders = headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  const catHeaders = headers.filter(h => !numHeaders.includes(h));

  const stats = {};
  numHeaders.forEach(h => {
    const vals = data.map(r => Number(String(r[h] || 0).replace(/[^0-9.-]/g, ''))).filter(v => !isNaN(v));
    if (vals.length === 0) return;
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    const sorted = [...vals].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
    const variance = vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length;
    stats[h] = { sum: parseFloat(sum.toFixed(2)), avg: parseFloat(avg.toFixed(2)), min: sorted[0], max: sorted[sorted.length - 1], median: parseFloat(median.toFixed(2)), stdDev: parseFloat(Math.sqrt(variance).toFixed(2)), count: vals.length };
  });

  const catStats = {};
  catHeaders.forEach(h => {
    const freq = {};
    data.forEach(r => { const v = String(r[h] || 'Unknown').trim(); freq[v] = (freq[v] || 0) + 1; });
    catStats[h] = { unique: Object.keys(freq).length, top: Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ label: k, count: v })) };
  });

  const completeness = {};
  headers.forEach(h => {
    const empty = data.filter(r => r[h] === null || r[h] === undefined || String(r[h]).trim() === '').length;
    completeness[h] = parseFloat((((data.length - empty) / data.length) * 100).toFixed(1));
  });

  self.postMessage({ id, action: 'AI_PROFESSIONAL_REPORT_COMPLETE', data: { stats, catStats, completeness, totalRows: data.length, totalCols: headers.length, numHeaders, catHeaders, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: EXECUTIVE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiExecutiveSummary({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_EXECUTIVE_SUMMARY_COMPLETE', data: { summary: '', duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const numCols = headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  const catCols = headers.filter(h => !numCols.includes(h));

  let summary = `EXECUTIVE SUMMARY\n${'='.repeat(50)}\n\n`;
  summary += `Dataset Overview: ${data.length} records across ${headers.length} fields.\n`;
  summary += `Numeric columns: ${numCols.join(', ') || 'None detected'}\n`;
  summary += `Categorical columns: ${catCols.join(', ') || 'None detected'}\n\n`;

  numCols.forEach(h => {
    const vals = data.map(r => Number(String(r[h] || 0).replace(/[^0-9.-]/g, ''))).filter(v => !isNaN(v));
    if (vals.length === 0) return;
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    const sorted = [...vals].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(vals.length * 0.25)];
    const q3 = sorted[Math.floor(vals.length * 0.75)];
    const iqr = q3 - q1;
    const outliers = vals.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);
    summary += `${h}: Total=${sum.toFixed(2)}, Avg=${avg.toFixed(2)}, Range=[${sorted[0]} to ${sorted[sorted.length - 1]}]`;
    if (outliers.length > 0) summary += `, ${outliers.length} outliers detected`;
    summary += '\n';
  });

  catCols.forEach(h => {
    const freq = {};
    data.forEach(r => { const v = String(r[h] || '').trim(); if (v) freq[v] = (freq[v] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length > 0) summary += `${h}: Top values — ${top.map(([k, v]) => `${k}(${v})`).join(', ')}\n`;
  });

  const totalMissing = headers.reduce((s, h) => s + data.filter(r => r[h] === null || r[h] === undefined || String(r[h]).trim() === '').length, 0);
  const totalCells = data.length * headers.length;
  summary += `\nData Quality: ${(((totalCells - totalMissing) / totalCells) * 100).toFixed(1)}% complete (${totalMissing} missing cells)\n`;

  self.postMessage({ id, action: 'AI_EXECUTIVE_SUMMARY_COMPLETE', data: { summary, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: PROFIT FORMULA
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiProfitFormula({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_PROFIT_FORMULA_COMPLETE', data: { result: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const revenueCol = headers.find(h => /revenue|sales|amount|total|income|turnover/i.test(h));
  const costCol = headers.find(h => /cost|expense|cogs|spending/i.test(h));

  const result = data.map(row => {
    const nr = { ...row };
    const rev = Number(String(row[revenueCol] || 0).replace(/[^0-9.-]/g, ''));
    const cost = Number(String(row[costCol] || 0).replace(/[^0-9.-]/g, ''));
    const profit = (!isNaN(rev) && !isNaN(cost)) ? parseFloat((rev - cost).toFixed(2)) : 0;
    const margin = (rev !== 0 && !isNaN(rev)) ? parseFloat(((profit / rev) * 100).toFixed(2)) : 0;
    nr['Profit'] = profit;
    nr['Profit Margin %'] = margin;
    return nr;
  });

  self.postMessage({ id, action: 'AI_PROFIT_FORMULA_COMPLETE', data: { result, revenueCol, costCol, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: GST FORMULA
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiGstFormula({ data, gstRate = 18 }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_GST_FORMULA_COMPLETE', data: { result: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const amountCol = headers.find(h => /amount|total|price|revenue|taxable|value/i.test(h));

  const result = data.map(row => {
    const nr = { ...row };
    const amt = Number(String(row[amountCol] || 0).replace(/[^0-9.-]/g, ''));
    if (!isNaN(amt)) {
      const cgst = parseFloat((amt * gstRate / 200).toFixed(2));
      const sgst = parseFloat((amt * gstRate / 200).toFixed(2));
      const igst = parseFloat((amt * gstRate / 100).toFixed(2));
      nr['CGST'] = cgst;
      nr['SGST'] = sgst;
      nr['IGST'] = igst;
      nr['Total GST'] = parseFloat((cgst + sgst).toFixed(2));
      nr['Invoice Value'] = parseFloat((amt + cgst + sgst).toFixed(2));
    }
    return nr;
  });

  self.postMessage({ id, action: 'AI_GST_FORMULA_COMPLETE', data: { result, amountCol, gstRate, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: COMMISSION CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiCommission({ data, rate = 5 }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_COMMISSION_COMPLETE', data: { result: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const salesCol = headers.find(h => /sales|revenue|amount|total|target/i.test(h));

  const result = data.map(row => {
    const nr = { ...row };
    const sales = Number(String(row[salesCol] || 0).replace(/[^0-9.-]/g, ''));
    if (!isNaN(sales)) {
      nr['Commission'] = parseFloat((sales * rate / 100).toFixed(2));
      nr['Net Payout'] = parseFloat((sales + (sales * rate / 100)).toFixed(2));
    }
    return nr;
  });

  self.postMessage({ id, action: 'AI_COMMISSION_COMPLETE', data: { result, salesCol, rate, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: MONTHLY GROWTH
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiMonthlyGrowth({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_MONTHLY_GROWTH_COMPLETE', data: { growth: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const dateCol = headers.find(h => /date|time|month|created/i.test(h));
  const valCol = headers.find(h => /revenue|sales|amount|total|income/i.test(h)) || headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))))[0];

  if (!dateCol || !valCol) { self.postMessage({ id, action: 'AI_MONTHLY_GROWTH_COMPLETE', data: { growth: [], error: 'Need date and numeric columns' }, duration: Date.now() - t0 }); return; }

  const monthly = {};
  data.forEach(row => {
    const d = String(row[dateCol] || '');
    const month = d.substring(0, 7) || 'Unknown';
    const val = Number(String(row[valCol] || 0).replace(/[^0-9.-]/g, ''));
    if (!isNaN(val)) monthly[month] = (monthly[month] || 0) + val;
  });

  const sorted = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]));
  const growth = sorted.map(([month, value], i) => {
    const prev = i > 0 ? sorted[i - 1][1] : value;
    const growthPct = prev !== 0 ? parseFloat((((value - prev) / Math.abs(prev)) * 100).toFixed(2)) : 0;
    return { month, value: parseFloat(value.toFixed(2)), growthPct };
  });

  self.postMessage({ id, action: 'AI_MONTHLY_GROWTH_COMPLETE', data: { growth, dateCol, valCol, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: FILTER DATA
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiFilter({ data, column, operator, value }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_FILTER_COMPLETE', data: { filtered: [], duration: 0 } }); return; }

  const filtered = data.filter(row => {
    const cellVal = String(row[column] || '').toLowerCase();
    const target = String(value).toLowerCase();
    const numCell = Number(String(row[column] || 0).replace(/[^0-9.-]/g, ''));
    const numTarget = Number(value);

    switch (operator) {
      case 'equals': case '=': case '==': return cellVal === target;
      case 'contains': return cellVal.includes(target);
      case 'greater': case '>': return !isNaN(numCell) && !isNaN(numTarget) && numCell > numTarget;
      case 'less': case '<': return !isNaN(numCell) && !isNaN(numTarget) && numCell < numTarget;
      case 'gte': case '>=': return !isNaN(numCell) && !isNaN(numTarget) && numCell >= numTarget;
      case 'lte': case '<=': return !isNaN(numCell) && !isNaN(numTarget) && numCell <= numTarget;
      case 'notequals': case '!=': return cellVal !== target;
      case 'startswith': return cellVal.startsWith(target);
      case 'endswith': return cellVal.endsWith(target);
      default: return cellVal.includes(target);
    }
  });

  self.postMessage({ id, action: 'AI_FILTER_COMPLETE', data: { filtered, column, operator, value, matchCount: filtered.length, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: INACTIVE CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiInactive({ data, daysThreshold = 90 }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_INACTIVE_COMPLETE', data: { inactive: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const nameCol = headers.find(h => /customer|client|name|company|buyer/i.test(h)) || headers[0];
  const dateCol = headers.find(h => /date|last.*order|last.*purchase|updated|activity/i.test(h));

  const now = new Date();
  const inactive = [];

  if (dateCol) {
    data.forEach(row => {
      const d = new Date(row[dateCol]);
      if (!isNaN(d.getTime())) {
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        if (diffDays > daysThreshold) inactive.push({ ...row, _inactiveDays: diffDays });
      }
    });
  } else {
    const freq = {};
    data.forEach(row => { const n = String(row[nameCol] || '').trim(); if (n) freq[n] = (freq[n] || 0) + 1; });
    const avgFreq = Object.values(freq).reduce((a, b) => a + b, 0) / Object.keys(freq).length;
    Object.entries(freq).filter(([, v]) => v < avgFreq * 0.3).forEach(([name]) => {
      const row = data.find(r => String(r[nameCol]) === name);
      if (row) inactive.push(row);
    });
  }

  self.postMessage({ id, action: 'AI_INACTIVE_COMPLETE', data: { inactive: inactive.slice(0, 50), nameCol, dateCol, daysThreshold, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: LAST MONTH SALES
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiLastMonth({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_LAST_MONTH_COMPLETE', data: { result: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const dateCol = headers.find(h => /date|time|created|order.*date/i.test(h));
  const valCol = headers.find(h => /revenue|sales|amount|total|price/i.test(h));

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let result = data;
  if (dateCol) {
    result = data.filter(row => {
      const d = new Date(row[dateCol]);
      return !isNaN(d.getTime()) && d >= lastMonth && d < thisMonth;
    });
  }

  const total = valCol ? result.reduce((s, r) => s + Number(String(r[valCol] || 0).replace(/[^0-9.-]/g, '')), 0) : 0;

  self.postMessage({ id, action: 'AI_LAST_MONTH_COMPLETE', data: { result, total: parseFloat(total.toFixed(2)), count: result.length, dateCol, valCol, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: TOP PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiTopProducts({ data, limit = 10 }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_TOP_PRODUCTS_COMPLETE', data: { products: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const productCol = headers.find(h => /product|item|sku|service|plan/i.test(h)) || headers[0];
  const valCol = headers.find(h => /revenue|sales|amount|total|price|quantity|qty/i.test(h));

  const aggregated = {};
  data.forEach(row => {
    const name = String(row[productCol] || 'Unknown').trim();
    const val = valCol ? Number(String(row[valCol] || 0).replace(/[^0-9.-]/g, '')) : 1;
    if (!isNaN(val)) aggregated[name] = (aggregated[name] || 0) + val;
  });

  const products = Object.entries(aggregated).map(([name, total]) => ({ name, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total).slice(0, limit);
  const maxVal = products.length > 0 ? products[0].total : 1;
  products.forEach(p => p.percentage = parseFloat(((p.total / maxVal) * 100).toFixed(1)));

  self.postMessage({ id, action: 'AI_TOP_PRODUCTS_COMPLETE', data: { products, productCol, valCol, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: GROUP BY
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiGroupBy({ data, groupCol, valCol }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_GROUP_BY_COMPLETE', data: { groups: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const autoGroupCol = groupCol || headers.find(h => /state|region|city|category|segment|status|department/i.test(h)) || headers[0];
  const autoValCol = valCol || headers.find(h => /revenue|sales|amount|total|price|cost|spent/i.test(h));

  const groups = {};
  data.forEach(row => {
    const key = String(row[autoGroupCol] || 'Unknown').trim();
    if (!groups[key]) groups[key] = { count: 0, values: [] };
    groups[key].count++;
    if (autoValCol) {
      const v = Number(String(row[autoValCol] || 0).replace(/[^0-9.-]/g, ''));
      if (!isNaN(v)) groups[key].values.push(v);
    }
  });

  const result = Object.entries(groups).map(([key, g]) => ({
    group: key, count: g.count,
    total: g.values.length > 0 ? parseFloat(g.values.reduce((a, b) => a + b, 0).toFixed(2)) : 0,
    avg: g.values.length > 0 ? parseFloat((g.values.reduce((a, b) => a + b, 0) / g.values.length).toFixed(2)) : 0
  })).sort((a, b) => b.total - a.total);

  self.postMessage({ id, action: 'AI_GROUP_BY_COMPLETE', data: { groups: result, groupCol: autoGroupCol, valCol: autoValCol, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: YEARLY GROWTH
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiYearlyGrowth({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_YEARLY_GROWTH_COMPLETE', data: { years: [], duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const dateCol = headers.find(h => /date|year|time|created/i.test(h));
  const valCol = headers.find(h => /revenue|sales|amount|total|income/i.test(h)) || headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))))[0];

  const yearly = {};
  data.forEach(row => {
    let year = 'Unknown';
    if (dateCol) {
      const d = String(row[dateCol]);
      const ym = d.match(/\d{4}/);
      if (ym) year = ym[0];
    }
    const val = valCol ? Number(String(row[valCol] || 0).replace(/[^0-9.-]/g, '')) : 1;
    if (!isNaN(val)) yearly[year] = (yearly[year] || 0) + val;
  });

  const sorted = Object.entries(yearly).sort((a, b) => a[0].localeCompare(b[0]));
  const years = sorted.map(([year, value], i) => {
    const prev = i > 0 ? sorted[i - 1][1] : value;
    const growthPct = prev !== 0 ? parseFloat((((value - prev) / Math.abs(prev)) * 100).toFixed(2)) : 0;
    return { year, value: parseFloat(value.toFixed(2)), growthPct };
  });

  self.postMessage({ id, action: 'AI_YEARLY_GROWTH_COMPLETE', data: { years, dateCol, valCol, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: FIND DUPLICATES
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiFindDuplicates({ data, columns }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_FIND_DUPLICATES_COMPLETE', data: { duplicates: [], duration: 0 } }); return; }
  const checkCols = columns || Object.keys(data[0]);
  const seen = new Map();
  const duplicates = [];

  data.forEach((row, idx) => {
    const key = checkCols.map(h => String(row[h] || '').toLowerCase().trim()).join('|||');
    if (seen.has(key)) duplicates.push({ row: idx + 1, firstSeen: seen.get(key), data: row });
    else seen.set(key, idx + 1);
  });

  self.postMessage({ id, action: 'AI_FIND_DUPLICATES_COMPLETE', data: { duplicates: duplicates.slice(0, 100), count: duplicates.length, percentage: parseFloat(((duplicates.length / data.length) * 100).toFixed(1)), duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: MISSING DATA
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiMissingData({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_MISSING_DATA_COMPLETE', data: { analysis: {}, duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const analysis = { columns: {}, totalMissing: 0, totalCells: data.length * headers.length, affectedRows: new Set() };

  headers.forEach(h => {
    const missingRows = [];
    data.forEach((row, idx) => {
      if (row[h] === null || row[h] === undefined || String(row[h]).trim() === '') {
        missingRows.push(idx + 1);
        analysis.affectedRows.add(idx + 1);
      }
    });
    analysis.columns[h] = { missing: missingRows.length, percentage: parseFloat(((missingRows.length / data.length) * 100).toFixed(1)), sampleRows: missingRows.slice(0, 5) };
    analysis.totalMissing += missingRows.length;
  });

  analysis.affectedRows = analysis.affectedRows.size;
  analysis.qualityScore = parseFloat((((analysis.totalCells - analysis.totalMissing) / analysis.totalCells) * 100).toFixed(1));

  self.postMessage({ id, action: 'AI_MISSING_DATA_COMPLETE', data: { analysis, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI: FULL FILE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiFullAnalysis({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) { self.postMessage({ id, action: 'AI_FULL_ANALYSIS_COMPLETE', data: { report: {}, duration: 0 } }); return; }
  const headers = Object.keys(data[0]);
  const numHeaders = headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  const catHeaders = headers.filter(h => !numHeaders.includes(h));

  const stats = {};
  numHeaders.forEach(h => {
    const vals = data.map(r => Number(String(r[h] || 0).replace(/[^0-9.-]/g, ''))).filter(v => !isNaN(v));
    if (vals.length === 0) return;
    const sum = vals.reduce((a, b) => a + b, 0);
    stats[h] = { sum: parseFloat(sum.toFixed(2)), avg: parseFloat((sum / vals.length).toFixed(2)), min: Math.min(...vals), max: Math.max(...vals), count: vals.length };
  });

  const missing = {};
  headers.forEach(h => {
    const m = data.filter(r => r[h] === null || r[h] === undefined || String(r[h]).trim() === '').length;
    missing[h] = { count: m, pct: parseFloat(((m / data.length) * 100).toFixed(1)) };
  });

  const seen = new Set();
  let dupCount = 0;
  data.forEach(row => {
    const key = headers.map(h => String(row[h] || '')).join('|||');
    if (seen.has(key)) dupCount++; else seen.add(key);
  });

  const catStats = {};
  catHeaders.forEach(h => {
    const freq = {};
    data.forEach(r => { const v = String(r[h] || '').trim(); freq[v] = (freq[v] || 0) + 1; });
    catStats[h] = { unique: Object.keys(freq).length, top: Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ label: k, count: v })) };
  });

  self.postMessage({ id, action: 'AI_FULL_ANALYSIS_COMPLETE', data: { stats, missing, catStats, duplicates: dupCount, dupPercentage: parseFloat(((dupCount / data.length) * 100).toFixed(1)), totalRows: data.length, totalCols: headers.length, numHeaders, catHeaders, qualityScore: parseFloat((((data.length * headers.length - headers.reduce((s, h) => s + data.filter(r => r[h] === null || r[h] === undefined || String(r[h]).trim() === '').length, 0)) / (data.length * headers.length)) * 100).toFixed(1)), duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
function handleExport({ data, format = 'xlsx', sheetName = 'Sheet1' }, id) {
  const t0 = Date.now();
  progress(id, 10, 'Building workbook...');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  progress(id, 60, 'Writing buffer...');
  const buffer = XLSX.write(wb, { bookType: format, type: 'array' });
  progress(id, 100, 'Export ready');
  self.postMessage({ id, action: 'EXPORT_COMPLETE', data: { buffer, duration: Date.now() - t0, rowCount: data.length } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI ANALYZE (Descriptive Stats + Forecasting + Pivots)
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiAnalyze({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) {
    self.postMessage({ id, action: 'AI_ANALYZE_COMPLETE', data: { summary: { rowCount: 0 }, duration: 0 } });
    return;
  }

  progress(id, 5, 'Profiling dataset...');
  const headers = Object.keys(data[0]);
  const summary = { rowCount: data.length, columnCount: headers.length, anomalies: [], predictions: {}, suggestions: [], insights: [], columnStats: {}, pivotCharts: {}, dataQuality: {} };
  const numCols = {};
  const catCols = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const xssRegex = /<script|javascript:|onload|onerror/gi;

  headers.forEach(h => { summary.columnStats[h] = { min: Infinity, max: -Infinity, sum: 0, count: 0, nullCount: 0, unique: new Set() }; });

  progress(id, 20, 'Analyzing columns...');
  data.forEach((row, rIdx) => {
    headers.forEach(h => {
      const raw = row[h];
      const str = String(raw ?? '').trim();
      const stats = summary.columnStats[h];

      if (str === '' || raw === null || raw === undefined) {
        stats.nullCount++;
        if (summary.anomalies.length < 20) summary.anomalies.push({ row: rIdx + 1, column: h, type: 'Missing Value', severity: 'low', message: 'Empty or null cell detected.' });
        return;
      }
      stats.unique.add(str);
      if (xssRegex.test(str)) summary.anomalies.push({ row: rIdx + 1, column: h, type: 'Security Threat', severity: 'critical', message: 'Possible script injection detected.' });
      if (h.toLowerCase().includes('email') && !emailRegex.test(str)) summary.anomalies.push({ row: rIdx + 1, column: h, type: 'Format Error', severity: 'medium', message: `"${str}" is not a valid email.` });

      const num = Number(str.replace(/[^0-9.-]/g, ""));
      if (!isNaN(num) && str !== '') {
        if (!numCols[h]) numCols[h] = [];
        numCols[h].push({ val: num, idx: rIdx });
        stats.sum += num;
        stats.count++;
        stats.min = Math.min(stats.min, num);
        stats.max = Math.max(stats.max, num);
      } else {
        if (!catCols[h]) catCols[h] = {};
        catCols[h][str] = (catCols[h][str] || 0) + 1;
      }
    });
  });

  progress(id, 60, 'Running statistical models...');

  Object.keys(numCols).forEach(h => {
    const list = numCols[h];
    if (list.length < 3) return;
    const vals = list.map(n => n.val);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sqDiffs = vals.map(v => (v - mean) ** 2);
    const stdDev = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / vals.length);

    if (stdDev > 0) {
      list.forEach(item => {
        const z = (item.val - mean) / stdDev;
        if (Math.abs(z) > 2.5 && summary.anomalies.length < 40)
          summary.anomalies.push({ row: item.idx + 1, column: h, type: 'Outlier', severity: Math.abs(z) > 3.5 ? 'high' : 'medium', message: `Value ${item.val.toLocaleString()} (Z=${z.toFixed(2)}) is a statistical outlier.` });
      });
    }

    summary.columnStats[h].mean = parseFloat(mean.toFixed(2));
    summary.columnStats[h].stdDev = parseFloat(stdDev.toFixed(2));

    const series = vals.slice(-Math.min(50, vals.length));
    if (series.length >= 4) {
      const n = series.length;
      let sx = 0, sy = 0, sxy = 0, sxx = 0;
      for (let i = 0; i < n; i++) { sx += i; sy += series[i]; sxy += i * series[i]; sxx += i * i; }
      const denom = n * sxx - sx * sx;
      if (denom !== 0) {
        const slope = (n * sxy - sx * sy) / denom;
        const intercept = (sy - slope * sx) / n;
        summary.predictions[h] = { forecast: [slope * n + intercept, slope * (n + 1) + intercept, slope * (n + 2) + intercept].map(v => parseFloat(v.toFixed(2))), direction: slope > 0.001 ? 'growth' : slope < -0.001 ? 'decline' : 'stable', slope: parseFloat(slope.toFixed(4)) };
      }
    }
  });

  progress(id, 80, 'Generating pivot aggregations...');

  const mainNumCol = Object.keys(numCols).find(h => h.toLowerCase().includes('price') || h.toLowerCase().includes('revenue') || h.toLowerCase().includes('sales') || h.toLowerCase().includes('cost')) || Object.keys(numCols)[0] || null;
  const pivotCatCol = Object.keys(catCols).find(h => h.toLowerCase().includes('category') || h.toLowerCase().includes('product') || h.toLowerCase().includes('status') || h.toLowerCase().includes('role') || h.toLowerCase().includes('city')) || Object.keys(catCols)[0] || null;

  if (mainNumCol && pivotCatCol) {
    const pivot = {};
    data.forEach(row => {
      const cat = String(row[pivotCatCol] || 'Unknown');
      const val = Number(String(row[mainNumCol] || 0).replace(/[^0-9.-]/g, ""));
      if (!pivot[cat]) pivot[cat] = 0;
      if (!isNaN(val)) pivot[cat] += val;
    });
    summary.pivotCharts = { label: pivotCatCol, valueCol: mainNumCol, labels: Object.keys(pivot), values: Object.values(pivot).map(v => parseFloat(v.toFixed(2))) };
  }

  progress(id, 90, 'Formulating insights...');

  // Data quality score
  let totalCells = data.length * headers.length;
  let emptyCells = headers.reduce((sum, h) => sum + summary.columnStats[h].nullCount, 0);
  summary.dataQuality = {
    score: Math.round(((totalCells - emptyCells) / totalCells) * 100),
    totalCells, emptyCells, completeness: ((totalCells - emptyCells) / totalCells * 100).toFixed(1)
  };

  const nullHeavyCols = headers.filter(h => summary.columnStats[h].nullCount > data.length * 0.1);
  if (nullHeavyCols.length > 0) summary.suggestions.push(`${nullHeavyCols.length} column(s) have >10% missing data: ${nullHeavyCols.slice(0, 3).join(', ')}`);

  const outliersCount = summary.anomalies.filter(a => a.type === 'Outlier').length;
  if (outliersCount > 0) summary.suggestions.push(`${outliersCount} statistical outliers detected. Consider reviewing with Z-score filter.`);

  const growthCols = Object.entries(summary.predictions).filter(([, v]) => v.direction === 'growth').map(([k]) => k);
  const declineCols = Object.entries(summary.predictions).filter(([, v]) => v.direction === 'decline').map(([k]) => k);
  if (growthCols.length > 0) summary.insights.push(`Positive trend detected in: ${growthCols.slice(0, 3).join(', ')}`);
  if (declineCols.length > 0) summary.insights.push(`Declining trend detected in: ${declineCols.slice(0, 3).join(', ')}`);
  summary.insights.push(`Dataset profiled: ${summary.rowCount.toLocaleString()} rows x ${summary.columnCount} columns in ${Date.now() - t0}ms`);

  headers.forEach(h => delete summary.columnStats[h].unique);
  self.postMessage({ id, action: 'AI_ANALYZE_COMPLETE', data: { summary, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Formula Generator
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiFormula({ data, request }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) {
    self.postMessage({ id, action: 'AI_FORMULA_COMPLETE', data: { formulas: [], duration: 0 } });
    return;
  }

  const headers = Object.keys(data[0]);
  const numHeaders = headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  const formulas = [];

  // Generate SUM formulas for numeric columns
  numHeaders.forEach(h => {
    formulas.push({ name: `Total ${h}`, formula: h, operation: 'SUM', description: `Sum of all values in ${h}`, confidence: 0.95 });
  });

  // Generate AVERAGE formulas
  if (numHeaders.length >= 2) {
    formulas.push({ name: 'Weighted Average', formula: numHeaders.slice(0, 2).join(','), operation: 'AVERAGE', description: `Average of ${numHeaders.slice(0, 2).join(' and ')}`, confidence: 0.9 });
  }

  // Generate CONCAT formulas for name-like columns
  const nameCols = headers.filter(h => h.toLowerCase().includes('first') || h.toLowerCase().includes('last') || h.toLowerCase().includes('name'));
  if (nameCols.length >= 2) {
    formulas.push({ name: 'Full Name', formula: `${nameCols[0]} + " " + ${nameCols[1]}`, operation: 'CONCAT', description: `Combine ${nameCols[0]} and ${nameCols[1]}`, confidence: 0.85 });
  }

  // Generate IF formulas for status columns
  const statusCols = headers.filter(h => h.toLowerCase().includes('status') || h.toLowerCase().includes('state'));
  if (statusCols.length > 0 && numHeaders.length > 0) {
    formulas.push({ name: 'Status Flag', formula: `${numHeaders[0]} > 0 ? "Active" : "Inactive"`, operation: 'IF', description: `Flag based on ${numHeaders[0]}`, confidence: 0.8 });
  }

  self.postMessage({ id, action: 'AI_FORMULA_COMPLETE', data: { formulas, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Data Cleaning Suggestions
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiClean({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) {
    self.postMessage({ id, action: 'AI_CLEAN_COMPLETE', data: { suggestions: [], duration: 0 } });
    return;
  }

  const headers = Object.keys(data[0]);
  const suggestions = [];

  headers.forEach(h => {
    const values = data.map(r => String(r[h] || '').trim());
    const nonEmpty = values.filter(v => v !== '');
    const emptyCount = values.length - nonEmpty.length;

    // Check for inconsistent casing
    const lowerVals = nonEmpty.map(v => v.toLowerCase());
    const uniqueLower = new Set(lowerVals);
    if (uniqueLower.size < nonEmpty.length * 0.8 && nonEmpty.length > 10) {
      suggestions.push({ column: h, type: 'Inconsistent Casing', severity: 'medium', action: 'TRIM_AND_NORMALIZE', description: `Column "${h}" has inconsistent casing. Consider normalizing to Title Case.` });
    }

    // Check for leading/trailing spaces
    const hasSpaces = nonEmpty.some(v => v !== v.trim());
    if (hasSpaces) suggestions.push({ column: h, type: 'Whitespace Issues', severity: 'low', action: 'TRIM_SPACES', description: `Column "${h}" has leading/trailing whitespace in some cells.` });

    // Check for empty columns
    if (emptyCount > data.length * 0.5) suggestions.push({ column: h, type: 'High Null Rate', severity: 'high', action: 'REMOVE_COLUMN', description: `Column "${h}" is ${((emptyCount / data.length) * 100).toFixed(0)}% empty. Consider removing.` });

    // Check for duplicate values in ID-like columns
    if (h.toLowerCase().includes('id') || h.toLowerCase().includes('email')) {
      const uniqueVals = new Set(nonEmpty);
      if (uniqueVals.size < nonEmpty.length) {
        const dupCount = nonEmpty.length - uniqueVals.size;
        suggestions.push({ column: h, type: 'Duplicate Values', severity: 'high', action: 'REMOVE_DUPLICATES', description: `Column "${h}" has ${dupCount} duplicate values.` });
      }
    }
  });

  self.postMessage({ id, action: 'AI_CLEAN_COMPLETE', data: { suggestions, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Duplicate Detection
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiDuplicates({ data, columns }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) {
    self.postMessage({ id, action: 'AI_DUPLICATES_COMPLETE', data: { duplicates: [], summary: {}, duration: 0 } });
    return;
  }

  const checkCols = columns || Object.keys(data[0]);
  const seen = new Map();
  const duplicates = [];

  data.forEach((row, idx) => {
    const key = checkCols.map(h => String(row[h] || '')).join('|||');
    if (seen.has(key)) {
      duplicates.push({ row: idx + 1, originalRow: seen.get(key), columns: checkCols, values: checkCols.map(h => row[h]) });
    } else {
      seen.set(key, idx + 1);
    }
  });

  const summary = {
    totalRows: data.length,
    duplicateGroups: duplicates.length,
    duplicatePercentage: ((duplicates.length / data.length) * 100).toFixed(1),
    affectedColumns: checkCols,
    recommendation: duplicates.length > 0 ? `${duplicates.length} duplicate rows found. Consider removing duplicates to improve data quality.` : 'No duplicates found.'
  };

  self.postMessage({ id, action: 'AI_DUPLICATES_COMPLETE', data: { duplicates: duplicates.slice(0, 100), summary, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Missing Data Detection
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiMissing({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) {
    self.postMessage({ id, action: 'AI_MISSING_COMPLETE', data: { analysis: {}, duration: 0 } });
    return;
  }

  const headers = Object.keys(data[0]);
  const analysis = { columns: {}, totalMissing: 0, affectedRows: new Set(), recommendations: [] };

  headers.forEach(h => {
    const missingRows = [];
    data.forEach((row, idx) => {
      const val = row[h];
      if (val === null || val === undefined || String(val).trim() === '') {
        missingRows.push(idx + 1);
        analysis.affectedRows.add(idx + 1);
      }
    });

    analysis.columns[h] = {
      missingCount: missingRows.length,
      missingPercentage: ((missingRows.length / data.length) * 100).toFixed(1),
      sampleRows: missingRows.slice(0, 10),
      severity: missingRows.length === 0 ? 'none' : missingRows.length / data.length > 0.3 ? 'critical' : missingRows.length / data.length > 0.1 ? 'high' : 'medium'
    };

    analysis.totalMissing += missingRows.length;

    if (missingRows.length > 0) {
      const colType = data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))) ? 'numeric' : 'categorical';
      if (colType === 'numeric') {
        const mean = data.filter(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))).reduce((sum, r) => sum + Number(String(r[h] || 0).replace(/[^0-9.-]/g, '')), 0) / (data.length - missingRows.length);
        analysis.recommendations.push({ column: h, action: 'IMPUTE_MEAN', value: mean.toFixed(2), description: `Impute missing values with mean (${mean.toFixed(2)})` });
      } else {
        analysis.recommendations.push({ column: h, action: 'IMPUTE_MODE', description: 'Impute missing values with most frequent value' });
      }
    }
  });

  analysis.affectedRows = analysis.affectedRows.size;
  analysis.overallScore = Math.round(((data.length * headers.length - analysis.totalMissing) / (data.length * headers.length)) * 100);

  self.postMessage({ id, action: 'AI_MISSING_COMPLETE', data: { analysis, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Forecasting
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiForecast({ data, column, periods = 5 }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) {
    self.postMessage({ id, action: 'AI_FORECAST_COMPLETE', data: { forecasts: {}, duration: 0 } });
    return;
  }

  const headers = Object.keys(data[0]);
  const targetCols = column ? [column] : headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  const forecasts = {};

  targetCols.forEach(h => {
    const values = data.map(r => Number(String(r[h] || '').replace(/[^0-9.-]/g, ''))).filter(v => !isNaN(v));
    if (values.length < 4) return;

    const n = values.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += values[i]; sxy += i * values[i]; sxx += i * i; }
    const denom = n * sxx - sx * sx;
    if (denom === 0) return;

    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    const mean = sy / n;
    const residuals = values.map((v, i) => v - (slope * i + intercept));
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
    const rmse = Math.sqrt(mse);

    const forecastValues = [];
    for (let i = 0; i < periods; i++) {
      forecastValues.push(parseFloat((slope * (n + i) + intercept).toFixed(2)));
    }

    const r2 = 1 - (residuals.reduce((sum, r) => sum + r * r, 0) / values.reduce((sum, v) => sum + (v - mean) ** 2, 0));

    forecasts[h] = {
      forecast: forecastValues,
      slope: parseFloat(slope.toFixed(4)),
      intercept: parseFloat(intercept.toFixed(4)),
      direction: slope > 0.001 ? 'growth' : slope < -0.001 ? 'decline' : 'stable',
      confidence: parseFloat(Math.max(0, r2).toFixed(3)),
      rmse: parseFloat(rmse.toFixed(2)),
      summary: `Trend: ${slope > 0.001 ? 'Growing' : slope < -0.001 ? 'Declining' : 'Stable'} (slope: ${slope.toFixed(4)}, R²: ${r2.toFixed(3)})`
    };
  });

  self.postMessage({ id, action: 'AI_FORECAST_COMPLETE', data: { forecasts, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Trend Analysis
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiTrend({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length < 10) {
    self.postMessage({ id, action: 'AI_TREND_COMPLETE', data: { trends: {}, duration: 0 } });
    return;
  }

  const headers = Object.keys(data[0]);
  const numHeaders = headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  const trends = {};

  numHeaders.forEach(h => {
    const values = data.map(r => Number(String(r[h] || '').replace(/[^0-9.-]/g, ''))).filter(v => !isNaN(v));
    if (values.length < 10) return;

    const third = Math.floor(values.length / 3);
    const early = values.slice(0, third);
    const mid = values.slice(third, third * 2);
    const late = values.slice(third * 2);

    const avgEarly = early.reduce((a, b) => a + b, 0) / early.length;
    const avgMid = mid.reduce((a, b) => a + b, 0) / mid.length;
    const avgLate = late.reduce((a, b) => a + b, 0) / late.length;

    const momentum = (avgLate - avgEarly) / (avgEarly || 1);
    const acceleration = ((avgLate - avgMid) - (avgMid - avgEarly)) / (avgMid || 1);

    let trendDirection, trendStrength;
    if (Math.abs(momentum) < 0.05) { trendDirection = 'stable'; trendStrength = 'weak'; }
    else if (momentum > 0) { trendDirection = 'upward'; trendStrength = Math.abs(momentum) > 0.2 ? 'strong' : 'moderate'; }
    else { trendDirection = 'downward'; trendStrength = Math.abs(momentum) > 0.2 ? 'strong' : 'moderate'; }

    trends[h] = {
      direction: trendDirection, strength: trendStrength,
      momentum: parseFloat(momentum.toFixed(3)),
      acceleration: parseFloat(acceleration.toFixed(3)),
      earlyAvg: parseFloat(avgEarly.toFixed(2)),
      midAvg: parseFloat(avgMid.toFixed(2)),
      lateAvg: parseFloat(avgLate.toFixed(2)),
      summary: `${trendDirection.charAt(0).toUpperCase() + trendDirection.slice(1)} trend (${trendStrength} momentum: ${(momentum * 100).toFixed(1)}%)`
    };
  });

  self.postMessage({ id, action: 'AI_TREND_COMPLETE', data: { trends, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Dashboard Builder
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiDashboard({ data }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) {
    self.postMessage({ id, action: 'AI_DASHBOARD_COMPLETE', data: { widgets: [], duration: 0 } });
    return;
  }

  const headers = Object.keys(data[0]);
  const widgets = [];

  // KPI Cards
  const numHeaders = headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  numHeaders.slice(0, 6).forEach(h => {
    const values = data.map(r => Number(String(r[h] || '').replace(/[^0-9.-]/g, ''))).filter(v => !isNaN(v));
    if (values.length === 0) return;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    widgets.push({ type: 'kpi', title: `Total ${h}`, value: sum.toFixed(2), subtitle: `Avg: ${avg.toFixed(2)} | Range: ${min.toFixed(0)}-${max.toFixed(0)}`, icon: 'fa-calculator', color: 'primary' });
    widgets.push({ type: 'kpi', title: `Average ${h}`, value: avg.toFixed(2), subtitle: `${values.length} records`, icon: 'fa-chart-line', color: 'success' });
  });

  // Bar Chart for categorical columns
  const catHeaders = headers.filter(h => !numHeaders.includes(h));
  if (catHeaders.length > 0) {
    const h = catHeaders[0];
    const counts = {};
    data.forEach(r => { const v = String(r[h] || 'Unknown'); counts[v] = (counts[v] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    widgets.push({ type: 'bar', title: `Distribution of ${h}`, labels: sorted.map(([k]) => k), values: sorted.map(([, v]) => v), color: '#6366f1' });
  }

  // Pie Chart for status-like columns
  const statusHeaders = headers.filter(h => h.toLowerCase().includes('status') || h.toLowerCase().includes('type') || h.toLowerCase().includes('category'));
  if (statusHeaders.length > 0) {
    const h = statusHeaders[0];
    const counts = {};
    data.forEach(r => { const v = String(r[h] || 'Unknown'); counts[v] = (counts[v] || 0) + 1; });
    widgets.push({ type: 'pie', title: `${h} Breakdown`, labels: Object.keys(counts), values: Object.values(counts) });
  }

  // Trend Chart for first numeric column
  if (numHeaders.length > 0) {
    const h = numHeaders[0];
    const values = data.map(r => Number(String(r[h] || '').replace(/[^0-9.-]/g, ''))).filter(v => !isNaN(v));
    const sampleRate = Math.max(1, Math.floor(values.length / 50));
    const sampled = values.filter((_, i) => i % sampleRate === 0);
    widgets.push({ type: 'line', title: `${h} Trend`, labels: sampled.map((_, i) => `Row ${i * sampleRate + 1}`), values: sampled, color: '#10b981' });
  }

  // Table Widget
  widgets.push({ type: 'table', title: 'Data Preview', headers: headers.slice(0, 8), rows: data.slice(0, 10).map(r => headers.slice(0, 8).map(h => String(r[h] || ''))) });

  self.postMessage({ id, action: 'AI_DASHBOARD_COMPLETE', data: { widgets, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI FEATURES: Report Writer
// ═══════════════════════════════════════════════════════════════════════════════
function handleAiReport({ data, title }, id) {
  const t0 = Date.now();
  if (!data || data.length === 0) {
    self.postMessage({ id, action: 'AI_REPORT_COMPLETE', data: { report: {}, duration: 0 } });
    return;
  }

  const headers = Object.keys(data[0]);
  const numHeaders = headers.filter(h => data.some(r => !isNaN(Number(String(r[h] || '').replace(/[^0-9.-]/g, '')))));
  const catHeaders = headers.filter(h => !numHeaders.includes(h));

  // Executive Summary
  const executiveSummary = {
    title: title || 'Data Analysis Report',
    date: new Date().toISOString().split('T')[0],
    totalRecords: data.length,
    totalColumns: headers.length,
    dataQuality: 0,
    keyFindings: []
  };

  // Data Quality
  let emptyCells = 0;
  headers.forEach(h => { data.forEach(r => { if (r[h] === null || r[h] === undefined || String(r[h]).trim() === '') emptyCells++; }); });
  executiveSummary.dataQuality = Math.round(((data.length * headers.length - emptyCells) / (data.length * headers.length)) * 100);

  // Key Findings
  numHeaders.slice(0, 3).forEach(h => {
    const values = data.map(r => Number(String(r[h] || '').replace(/[^0-9.-]/g, ''))).filter(v => !isNaN(v));
    if (values.length === 0) return;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    executiveSummary.keyFindings.push(`Total ${h}: ${sum.toLocaleString(undefined, { maximumFractionDigits: 2 })} (Average: ${avg.toLocaleString(undefined, { maximumFractionDigits: 2 })})`);
  });

  catHeaders.slice(0, 2).forEach(h => {
    const counts = {};
    data.forEach(r => { const v = String(r[h] || 'Unknown'); counts[v] = (counts[v] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top) executiveSummary.keyFindings.push(`Most common ${h}: "${top[0]}" (${top[1]} occurrences, ${((top[1] / data.length) * 100).toFixed(1)}%)`);
  });

  // Statistics Table
  const statistics = {};
  numHeaders.forEach(h => {
    const values = data.map(r => Number(String(r[h] || '').replace(/[^0-9.-]/g, ''))).filter(v => !isNaN(v));
    if (values.length === 0) return;
    const sorted = [...values].sort((a, b) => a - b);
    statistics[h] = {
      count: values.length, sum: values.reduce((a, b) => a + b, 0),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      min: sorted[0], max: sorted[sorted.length - 1],
      median: sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)]
    };
  });

  self.postMessage({ id, action: 'AI_REPORT_COMPLETE', data: { report: { executiveSummary, statistics }, duration: Date.now() - t0 } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function processInChunks(arr, size, fn) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(...fn(arr.slice(i, i + size)));
  return result;
}

function stableHash(obj) { return JSON.stringify(Object.keys(obj).sort().map(k => [k, obj[k]])); }
function escapeRegex(str) { return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); }

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const propName = prefix ? `${prefix}_${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]))
        Object.assign(result, flattenObject(obj[key], propName));
      else result[propName] = obj[key];
    }
  }
  return result;
}

function parseXmlToRows(xmlText) {
  const rows = [];
  const tags = {};
  const tagRegex = /<([^>]+)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = tagRegex.exec(xmlText)) !== null) {
    const tagName = match[1];
    const content = match[2].trim();
    if (content.startsWith('<')) { if (!tags[tagName]) tags[tagName] = []; tags[tagName].push(content); }
  }
  let rowTagName = null, maxCount = 0;
  Object.keys(tags).forEach(t => { if (tags[t].length > maxCount) { maxCount = tags[t].length; rowTagName = t; } });
  if (rowTagName && maxCount > 0) {
    tags[rowTagName].forEach(rowXml => {
      const row = {};
      const childRegex = /<([^>]+)>([^<>]*?)<\/\1>/g;
      let childMatch;
      while ((childMatch = childRegex.exec(rowXml)) !== null) row[childMatch[1]] = childMatch[2].trim();
      if (Object.keys(row).length > 0) rows.push(row);
    });
  }
  if (rows.length === 0) {
    const row = {};
    const flatRegex = /<([^>]+)>([^<>]*?)<\/\1>/g;
    let flatMatch;
    while ((flatMatch = flatRegex.exec(xmlText)) !== null) row[flatMatch[1]] = flatMatch[2].trim();
    if (Object.keys(row).length > 0) rows.push(row);
  }
  return rows;
}

function extractEntitiesFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows = [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const dateRegex = /\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})|(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/g;
  const priceRegex = /(?:\$|£|€|¥|Rs\.?)\s*\d+(?:,\d{3})*(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\b\s*(?:USD|EUR|GBP|INR|JPY)/gi;
  const invoiceRegex = /\b(?:INV|INVOICE|TXN|TRXN)[-\s]?#?\s*[a-zA-Z0-9-]+\b/gi;
  let currentRecord = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNewRecordStart = line.toLowerCase().includes('invoice') || line.toLowerCase().includes('transaction') || line.toLowerCase().includes('order #') || /^\d{5,}\s*$/.test(line);
    if (isNewRecordStart && Object.keys(currentRecord).length > 0) { rows.push(currentRecord); currentRecord = {}; }

    const emails = line.match(emailRegex);
    const phones = line.match(phoneRegex);
    const dates = line.match(dateRegex);
    const prices = line.match(priceRegex);
    const invoices = line.match(invoiceRegex);

    if (emails) currentRecord['Email Address'] = emails[0];
    if (phones) currentRecord['Phone Number'] = phones[0];
    if (dates) currentRecord['Date'] = dates[0];
    if (prices) currentRecord['Amount / Price'] = prices[0];
    if (invoices) currentRecord['Invoice / Txn ID'] = invoices[0];
    if (emails && !currentRecord['Customer Name']) { const emailName = emails[0].split('@')[0].replace(/[._-]/g, ' '); currentRecord['Customer Name'] = emailName.replace(/\b\w/g, c => c.toUpperCase()); }

    const addressMatch = line.match(/\d+\s+[a-zA-Z\s]+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive)\b[-\s,a-zA-Z0-9]*/gi);
    if (addressMatch) currentRecord['Address'] = addressMatch[0].trim();

    const productMatch = line.match(/(?:Product|Item|Desc|Description|Service)\s*[:\-]?\s*([a-zA-Z0-9\s]+)/i);
    if (productMatch) currentRecord['Product / Item'] = productMatch[1].trim();

    if (Object.keys(currentRecord).length >= 4) { rows.push(currentRecord); currentRecord = {}; }
  }
  if (Object.keys(currentRecord).length > 0) rows.push(currentRecord);

  if (rows.length === 0) {
    lines.forEach(line => {
      const parts = line.split(/\t|\||;/);
      if (parts.length > 1) { const row = {}; parts.forEach((p, idx) => { row[`Column_${idx + 1}`] = p.trim(); }); rows.push(row); }
      else rows.push({ 'Raw Content': line });
    });
  }
  return rows;
}

function runAutoSemanticMapping(data) {
  const headers = Object.keys(data[0]);
  const newHeaders = {};
  headers.forEach(h => {
    const values = data.slice(0, 10).map(r => String(r[h] || ''));
    let matchedField = h;
    if (values.some(v => v.includes('@') && v.includes('.'))) matchedField = 'Email Address';
    else if (values.some(v => /^\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(v))) matchedField = 'Phone Number';
    else if (values.some(v => /^\d{4}[-/.]\d{2}[-/.]\d{2}/.test(v) || /^\d{2}[-/.]\d{2}[-/.]\d{2,4}/.test(v))) matchedField = 'Date';
    else if (values.some(v => v.startsWith('$') || v.includes('USD') || v.startsWith('\u20ac') || v.startsWith('\u00a3'))) matchedField = 'Price';
    else if (h.toLowerCase().includes('name') || h.toLowerCase().includes('user') || h.toLowerCase().includes('customer')) matchedField = 'Customer Name';
    else if (h.toLowerCase().includes('inv') || h.toLowerCase().includes('txn') || h.toLowerCase().includes('bill')) matchedField = 'Invoice / Txn ID';
    else if (h.toLowerCase().includes('prod') || h.toLowerCase().includes('item') || h.toLowerCase().includes('good')) matchedField = 'Product / Item';
    newHeaders[h] = matchedField;
  });
  return data.map(row => { const newRow = {}; Object.keys(row).forEach(k => { newRow[newHeaders[k]] = row[k]; }); return newRow; });
}
