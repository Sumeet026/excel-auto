/* ==========================================================================
   EXCEL AUTO - REPORT TEMPLATES ENGINE v1.0 (report-templates.js)
   • 8 prebuilt enterprise report templates
   • Realistic sample data generation
   • One-click Excel/PDF/CSV export
   • Template preview with live data
   ========================================================================== */

'use strict';

const ReportTemplates = (() => {

  // ─── UTILITY: Random helpers ──────────────────────────────────────────────
  const _rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const _randFloat = (min, max, dec = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
  const _pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const _uuid = () => 'TXN-' + Date.now().toString(36).toUpperCase() + _rand(100, 999);
  const _date = (daysAgo = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // ─── TEMPLATE DEFINITIONS ─────────────────────────────────────────────────
  const TEMPLATES = {

    // ─── 1. SALES REPORT ──────────────────────────────────────────────────
    sales: {
      name: 'Sales Report',
      icon: 'fa-chart-line',
      color: '#10b981',
      description: 'Track revenue, deals, and sales team performance with product-wise breakdowns.',
      columns: ['Date', 'Invoice ID', 'Customer', 'Product', 'Quantity', 'Unit Price', 'Total', 'Tax', 'Net Revenue', 'Salesperson', 'Region', 'Status'],
      generate() {
        const products = ['Enterprise License', 'Pro Subscription', 'Starter Pack', 'API Access', 'Data Storage Add-on', 'Priority Support'];
        const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
        const salespeople = ['Ravi Kumar', 'Sarah Johnson', 'Mike Chen', 'Priya Patel', 'Emma Wilson'];
        const statuses = ['Completed', 'Pending', 'Invoiced', 'Cancelled'];
        const customers = ['Tata Consultancy', 'Infosys Ltd', 'Wipro Digital', 'HCL Technologies', 'Tech Mahindra', 'Reliance Jio', 'Flipkart', 'Zomato', 'Swiggy', 'BYJU\'S'];
        return Array.from({ length: 50 }, (_, i) => {
          const qty = _rand(1, 50);
          const price = _randFloat(500, 15000);
          const total = qty * price;
          const tax = _randFloat(total * 0.05, total * 0.18);
          return {
            'Date': _date(_rand(0, 90)),
            'Invoice ID': `INV-${2026}${String(i + 1).padStart(4, '0')}`,
            'Customer': _pick(customers),
            'Product': _pick(products),
            'Quantity': qty,
            'Unit Price': price,
            'Total': parseFloat(total.toFixed(2)),
            'Tax': parseFloat(tax.toFixed(2)),
            'Net Revenue': parseFloat((total - tax).toFixed(2)),
            'Salesperson': _pick(salespeople),
            'Region': _pick(regions),
            'Status': _pick(statuses)
          };
        });
      }
    },

    // ─── 2. INVENTORY REPORT ──────────────────────────────────────────────
    inventory: {
      name: 'Inventory Report',
      icon: 'fa-boxes-stacked',
      color: '#06b6d4',
      description: 'Monitor stock levels, reorder points, warehouse locations, and supplier details.',
      columns: ['SKU', 'Product Name', 'Category', 'Warehouse', 'Quantity In Stock', 'Reorder Level', 'Unit Cost', 'Total Value', 'Supplier', 'Last Restocked', 'Status'],
      generate() {
        const categories = ['Electronics', 'Office Supplies', 'Furniture', 'Software Licenses', 'Networking', 'Storage'];
        const warehouses = ['Mumbai Hub', 'Delhi Center', 'Bangalore DC', 'Chennai Warehouse', 'Hyderabad Store'];
        const suppliers = ['Dell Technologies', 'HP Enterprise', 'Cisco Systems', 'Samsung India', 'Lenovo India', 'Western Digital'];
        const products = [
          ['DELL-LAP-001', 'Dell Latitude 5540'], ['HP-PRN-002', 'HP LaserJet Pro'], ['CIS-SW-003', 'Cisco Catalyst Switch'],
          ['SAM-MON-004', 'Samsung 27" Monitor'], ['LEN-TAB-005', 'Lenovo Tab M10'], ['WD-EXT-006', 'WD Elements 2TB'],
          ['LOG-KB-007', 'Logitech MX Keys'], ['APL-AIR-008', 'Apple AirPods Pro'], ['MS-ARC-009', 'Microsoft Arc Mouse'],
          ['BOS-SPK-010', 'Bose SoundLink'], ['EPH-CAM-011', 'Logitech Webcam C920'], ['SAN-USB-012', 'SanDisk 128GB USB']
        ];
        return Array.from({ length: 40 }, (_, i) => {
          const [sku, name] = _pick(products);
          const qty = _rand(0, 500);
          const cost = _randFloat(50, 8000);
          const reorder = _rand(10, 50);
          return {
            'SKU': sku,
            'Product Name': name,
            'Category': _pick(categories),
            'Warehouse': _pick(warehouses),
            'Quantity In Stock': qty,
            'Reorder Level': reorder,
            'Unit Cost': cost,
            'Total Value': parseFloat((qty * cost).toFixed(2)),
            'Supplier': _pick(suppliers),
            'Last Restocked': _date(_rand(1, 60)),
            'Status': qty <= reorder ? 'LOW STOCK' : qty > reorder * 5 ? 'Overstocked' : 'Normal'
          };
        });
      }
    },

    // ─── 3. FINANCE REPORT ────────────────────────────────────────────────
    finance: {
      name: 'Finance Report',
      icon: 'fa-indian-rupee-sign',
      color: '#8b5cf6',
      description: 'Track income, expenses, profit margins, and departmental budgets.',
      columns: ['Date', 'Category', 'Description', 'Department', 'Income', 'Expense', 'Net', 'Payment Method', 'Approved By', 'Reference'],
      generate() {
        const categories = ['Salary', 'Marketing', 'Operations', 'Infrastructure', 'Travel', 'Utilities', 'Consulting', 'Software', 'Legal', 'R&D'];
        const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
        const methods = ['Bank Transfer', 'UPI', 'Credit Card', 'Cash', 'Cheque', 'NEFT'];
        const approvers = ['CFO Rajesh', 'VP Ananya', 'Director Suresh', 'Manager Kavita', 'Head Amit'];
        return Array.from({ length: 60 }, (_, i) => {
          const isIncome = Math.random() > 0.45;
          const amount = _randFloat(1000, 500000);
          return {
            'Date': _date(_rand(0, 180)),
            'Category': _pick(categories),
            'Description': `${_pick(['Payment', 'Invoice', 'Bill', 'Receipt', 'Reimbursement'])} - ${_pick(['Q1', 'Q2', 'Q3', 'Q4'])} ${_rand(2024, 2026)}`,
            'Department': _pick(departments),
            'Income': isIncome ? amount : 0,
            'Expense': isIncome ? 0 : amount,
            'Net': isIncome ? amount : -amount,
            'Payment Method': _pick(methods),
            'Approved By': _pick(approvers),
            'Reference': _uuid()
          };
        });
      }
    },

    // ─── 4. GST REPORT ────────────────────────────────────────────────────
    gst: {
      name: 'GST Report',
      icon: 'fa-receipt',
      color: '#f59e0b',
      description: 'Generate GST-compliant reports with CGST, SGST, IGST breakdowns and HSN codes.',
      columns: ['Invoice Date', 'GSTIN', 'Invoice No', 'Customer', 'HSN Code', 'Taxable Amount', 'CGST Rate', 'CGST Amount', 'SGST Rate', 'SGST Amount', 'IGST Rate', 'IGST Amount', 'Total Tax', 'Invoice Value'],
      generate() {
        const gstins = ['27AAACN1234F1Z5', '29BBBDP5678G1Z3', '06CCCDR9012H1Z1', '24DDDAS3456J1Z9', '07EEEET7890K1Z7'];
        const hsnCodes = ['998314', '998319', '8471', '8443', '8528', '9403', '9504', '8504'];
        const customers = ['M/s Tata Steel Ltd', 'M/s Bajaj Auto', 'M/s Maruti Suzuki', 'M/s ITC Limited', 'M/s Hindustan Unilever'];
        return Array.from({ length: 45 }, (_, i) => {
          const taxable = _randFloat(5000, 200000);
          const cgstRate = _pick([2.5, 5, 9, 12]);
          const sgstRate = cgstRate;
          const isInterState = Math.random() > 0.7;
          const cgst = isInterState ? 0 : parseFloat((taxable * cgstRate / 100).toFixed(2));
          const sgst = isInterState ? 0 : parseFloat((taxable * sgstRate / 100).toFixed(2));
          const igst = isInterState ? parseFloat((taxable * (cgstRate + sgstRate) / 100).toFixed(2)) : 0;
          const totalTax = parseFloat((cgst + sgst + igst).toFixed(2));
          return {
            'Invoice Date': _date(_rand(0, 90)),
            'GSTIN': _pick(gstins),
            'Invoice No': `GST-${2026}${String(i + 1).padStart(4, '0')}`,
            'Customer': _pick(customers),
            'HSN Code': _pick(hsnCodes),
            'Taxable Amount': taxable,
            'CGST Rate': cgstRate + '%',
            'CGST Amount': cgst,
            'SGST Rate': sgstRate + '%',
            'SGST Amount': sgst,
            'IGST Rate': isInterState ? (cgstRate + sgstRate) + '%' : '0%',
            'IGST Amount': igst,
            'Total Tax': totalTax,
            'Invoice Value': parseFloat((taxable + totalTax).toFixed(2))
          };
        });
      }
    },

    // ─── 5. ATTENDANCE REPORT ─────────────────────────────────────────────
    attendance: {
      name: 'Attendance Report',
      icon: 'fa-calendar-check',
      color: '#ec4899',
      description: 'Track employee attendance, leaves, overtime, and work-from-home days.',
      columns: ['Employee ID', 'Employee Name', 'Department', 'Date', 'Check In', 'Check Out', 'Hours Worked', 'Overtime (Hrs)', 'Status', 'Leave Type', 'Remarks'],
      generate() {
        const names = ['Aarav Mehta', 'Vivaan Sharma', 'Aditya Joshi', 'Arjun Reddy', 'Sai Krishna', 'Riya Patel', 'Ananya Singh', 'Diya Gupta', 'Priya Nair', 'Kavya Iyer', 'Rohan Das', 'Neha Kapoor', 'Amit Verma', 'Sneha Rao', 'Vikram Bhat'];
        const departments = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Support'];
        const statuses = ['Present', 'Present', 'Present', 'Present', 'Absent', 'Half Day', 'Work From Home', 'On Leave'];
        const leaveTypes = ['None', 'None', 'None', 'None', 'Casual Leave', 'Sick Leave', 'Earned Leave', 'Comp Off'];
        return Array.from({ length: 75 }, (_, i) => {
          const status = _pick(statuses);
          const hours = status === 'Present' ? _randFloat(7.5, 10) : status === 'Half Day' ? _randFloat(3, 5) : 0;
          const overtime = status === 'Present' && Math.random() > 0.7 ? _randFloat(0.5, 3) : 0;
          const checkIn = status === 'Present' || status === 'Half Day' ? `${_rand(8, 10)}:${String(_rand(0, 59)).padStart(2, '0')}` : '-';
          const checkOut = status === 'Present' || status === 'Half Day' ? `${_rand(17, 20)}:${String(_rand(0, 59)).padStart(2, '0')}` : '-';
          return {
            'Employee ID': `EMP-${String(_rand(1001, 1050)).padStart(4, '0')}`,
            'Employee Name': _pick(names),
            'Department': _pick(departments),
            'Date': _date(_rand(0, 30)),
            'Check In': checkIn,
            'Check Out': checkOut,
            'Hours Worked': hours,
            'Overtime (Hrs)': overtime,
            'Status': status,
            'Leave Type': status === 'On Leave' ? _pick(['Casual Leave', 'Sick Leave', 'Earned Leave', 'Comp Off']) : 'None',
            'Remarks': status === 'Absent' ? _pick(['Unplanned absence', 'No communication', 'Personal emergency']) : status === 'Work From Home' ? 'Approved WFH' : ''
          };
        });
      }
    },

    // ─── 6. PAYROLL REPORT ────────────────────────────────────────────────
    payroll: {
      name: 'Payroll Report',
      icon: 'fa-money-bill-wave',
      color: '#22c55e',
      description: 'Process salary slips with earnings, deductions, PF, ESI, and net pay calculations.',
      columns: ['Employee ID', 'Employee Name', 'Department', 'Designation', 'Basic Salary', 'HRA', 'Conveyance', 'Medical Allowance', 'Gross Earnings', 'PF', 'ESI', 'Professional Tax', 'Total Deductions', 'Net Pay'],
      generate() {
        const names = ['Rajesh Kumar', 'Anita Desai', 'Suresh Menon', 'Kavita Joshi', 'Amitabh Saxena', 'Pooja Chatterjee', 'Sanjay Mishra', 'Deepa Iyer', 'Manoj Tiwari', 'Lakshmi Raman', 'Vikash Gupta', 'Nisha Agarwal', 'Rahul Bose', 'Meera Prasad', 'Arvind Sharma'];
        const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'];
        const designations = ['Senior Engineer', 'Manager', 'Lead', 'Analyst', 'Director', 'VP', 'Intern', 'Associate'];
        return Array.from({ length: 30 }, (_, i) => {
          const basic = _randFloat(25000, 150000);
          const hra = _randFloat(basic * 0.3, basic * 0.5);
          const conv = _randFloat(1000, 3000);
          const med = _randFloat(1000, 5000);
          const gross = parseFloat((basic + hra + conv + med).toFixed(2));
          const pf = parseFloat((basic * 0.12).toFixed(2));
          const esi = gross <= 21000 ? parseFloat((gross * 0.0075).toFixed(2)) : 0;
          const pt = 200;
          const totalDed = parseFloat((pf + esi + pt).toFixed(2));
          return {
            'Employee ID': `EMP-${String(1001 + i).padStart(4, '0')}`,
            'Employee Name': _pick(names),
            'Department': _pick(departments),
            'Designation': _pick(designations),
            'Basic Salary': basic,
            'HRA': parseFloat(hra.toFixed(2)),
            'Conveyance': conv,
            'Medical Allowance': med,
            'Gross Earnings': gross,
            'PF': pf,
            'ESI': esi,
            'Professional Tax': pt,
            'Total Deductions': totalDed,
            'Net Pay': parseFloat((gross - totalDed).toFixed(2))
          };
        });
      }
    },

    // ─── 7. INVOICE REPORT ────────────────────────────────────────────────
    invoice: {
      name: 'Invoice Report',
      icon: 'fa-file-invoice',
      color: '#3b82f6',
      description: 'Track all invoices with payment status, due dates, and outstanding amounts.',
      columns: ['Invoice No', 'Invoice Date', 'Due Date', 'Client', 'Description', 'Amount', 'Tax (18%)', 'Total', 'Paid Amount', 'Outstanding', 'Payment Status'],
      generate() {
        const clients = ['Reliance Industries', 'Tata Group', 'Infosys BPO', 'Wipro Cloud', 'HCL Tech', 'Adani Enterprises', 'Bajaj Finserv', 'L&T Infotech', 'Mindtree', 'Mphasis'];
        const descriptions = ['Annual Software License', 'Cloud Infrastructure Q1', 'Consulting Services March', 'Data Analytics Platform', 'API Gateway Setup', 'Security Audit Q2', 'Mobile App Development', 'ERP Module Customization', 'Staff Augmentation', 'Maintenance Contract'];
        const statuses = ['Paid', 'Paid', 'Paid', 'Pending', 'Overdue', 'Partial'];
        return Array.from({ length: 35 }, (_, i) => {
          const amount = _randFloat(10000, 500000);
          const tax = parseFloat((amount * 0.18).toFixed(2));
          const total = parseFloat((amount + tax).toFixed(2));
          const status = _pick(statuses);
          const paid = status === 'Paid' ? total : status === 'Partial' ? _randFloat(total * 0.3, total * 0.8) : 0;
          return {
            'Invoice No': `INV-2026-${String(i + 1).padStart(4, '0')}`,
            'Invoice Date': _date(_rand(0, 120)),
            'Due Date': _date(-_rand(5, 60)),
            'Client': _pick(clients),
            'Description': _pick(descriptions),
            'Amount': amount,
            'Tax (18%)': tax,
            'Total': total,
            'Paid Amount': parseFloat(paid.toFixed(2)),
            'Outstanding': parseFloat((total - paid).toFixed(2)),
            'Payment Status': status
          };
        });
      }
    },

    // ─── 8. CUSTOMER ANALYSIS ─────────────────────────────────────────────
    customer: {
      name: 'Customer Analysis',
      icon: 'fa-users',
      color: '#14b8a6',
      description: 'Analyze customer segments, lifetime value, acquisition channels, and retention metrics.',
      columns: ['Customer ID', 'Customer Name', 'Email', 'Phone', 'Segment', 'Acquisition Date', 'Total Orders', 'Total Spent', 'Avg Order Value', 'Last Order Date', 'Lifetime Value', 'Churn Risk'],
      generate() {
        const names = ['Rajesh Industries', 'Priya Enterprises', 'Amit Trading Co', 'Sneha Exports', 'Vikram Imports', 'Deepa Solutions', 'Sanjay Traders', 'Kavita Corp', 'Rohan Global', 'Neha Ventures', 'Arun Impex', 'Meera Enterprises', 'Vikash Traders', 'Lakshmi Industries', 'Manoj Exports'];
        const segments = ['Enterprise', 'Mid-Market', 'SMB', 'Startup', 'Individual'];
        const channels = ['Organic', 'Paid Ads', 'Referral', 'Partner', 'Cold Outreach', 'Webinar'];
        const risks = ['Low', 'Low', 'Low', 'Medium', 'Medium', 'High'];
        const domains = ['tech', 'corp', 'global', 'solutions', 'trading', 'enterprises'];
        return Array.from({ length: 40 }, (_, i) => {
          const orders = _rand(1, 100);
          const spent = _randFloat(5000, 2000000);
          const segment = _pick(segments);
          return {
            'Customer ID': `CUST-${String(10001 + i).padStart(5, '0')}`,
            'Customer Name': _pick(names),
            'Email': `contact@${_pick(domains)}${_rand(1, 99)}.com`,
            'Phone': `+91-${_rand(70000, 99999)}-${_rand(10000, 99999)}`,
            'Segment': segment,
            'Acquisition Date': _date(_rand(30, 730)),
            'Total Orders': orders,
            'Total Spent': spent,
            'Avg Order Value': parseFloat((spent / orders).toFixed(2)),
            'Last Order Date': _date(_rand(0, 90)),
            'Lifetime Value': segment === 'Enterprise' ? _randFloat(500000, 5000000) : segment === 'Mid-Market' ? _randFloat(100000, 500000) : _randFloat(10000, 100000),
            'Churn Risk': _pick(risks)
          };
        });
      }
    }
  };

  // ─── PUBLIC API ────────────────────────────────────────────────────────────
  return {

    /**
     * Get all template metadata (no data)
     */
    getAll() {
      return Object.entries(TEMPLATES).map(([key, tpl]) => ({
        id: key,
        name: tpl.name,
        icon: tpl.icon,
        color: tpl.color,
        description: tpl.description,
        columnCount: tpl.columns.length
      }));
    },

    /**
     * Get a single template definition
     */
    get(templateId) {
      return TEMPLATES[templateId] || null;
    },

    /**
     * Generate sample data for a template
     */
    generateData(templateId) {
      const tpl = TEMPLATES[templateId];
      if (!tpl) throw new Error(`Template "${templateId}" not found`);
      return tpl.generate();
    },

    /**
     * Export generated data to Excel workbook (returns XLSX buffer)
     */
    exportToExcel(templateId, data) {
      const tpl = TEMPLATES[templateId];
      if (!tpl) throw new Error(`Template "${templateId}" not found`);

      const ws = XLSX.utils.json_to_sheet(data);

      // Column widths
      const colWidths = tpl.columns.map(col => ({ wch: Math.max(col.length + 4, 14) }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tpl.name);
      return wb;
    },

    /**
     * Export generated data to CSV string
     */
    exportToCSV(templateId, data) {
      const tpl = TEMPLATES[templateId];
      if (!tpl) throw new Error(`Template "${templateId}" not found`);

      const lines = [tpl.columns.join(',')];
      data.forEach(row => {
        const values = tpl.columns.map(col => {
          const val = row[col] !== undefined ? row[col] : '';
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        });
        lines.push(values.join(','));
      });
      return lines.join('\n');
    },

    /**
     * Export generated data to PDF (uses jsPDF + autoTable)
     */
    exportToPDF(templateId, data, title) {
      const tpl = TEMPLATES[templateId];
      if (!tpl) throw new Error(`Template "${templateId}" not found`);
      if (typeof window.jspdf === 'undefined') throw new Error('jsPDF not loaded');

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: tpl.columns.length > 8 ? 'landscape' : 'portrait' });

      // Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(99, 102, 241);
      doc.text(title || tpl.name, 14, 20);

      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleString()} | ExcelAuto Templates`, 14, 27);
      doc.line(14, 30, doc.internal.pageSize.getWidth() - 14, 30);

      // Summary
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Records: ${data.length}`, 14, 37);

      // Table
      const limitedCols = tpl.columns.slice(0, 10);
      const head = [limitedCols];
      const body = data.map(row =>
        limitedCols.map(col => {
          const v = row[col];
          return v !== undefined && v !== null ? String(v) : '';
        })
      );

      doc.autoTable({
        startY: 42,
        head,
        body,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241], fontSize: 7 },
        styles: { fontSize: 7, overflow: 'ellipsize' },
        margin: { top: 42 }
      });

      return doc;
    },

    /**
     * Download helper — triggers browser download
     */
    download(templateId, data, format = 'xlsx') {
      const tpl = TEMPLATES[templateId];
      if (!tpl) throw new Error(`Template "${templateId}" not found`);

      const baseName = tpl.name.replace(/\s+/g, '_');

      switch (format) {
        case 'xlsx': {
          const wb = this.exportToExcel(templateId, data);
          XLSX.writeFile(wb, `${baseName}_template.xlsx`);
          break;
        }
        case 'csv': {
          const csv = this.exportToCSV(templateId, data);
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${baseName}_template.csv`;
          a.click();
          URL.revokeObjectURL(url);
          break;
        }
        case 'pdf': {
          const doc = this.exportToPDF(templateId, data, tpl.name);
          doc.save(`${baseName}_template.pdf`);
          break;
        }
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      showToast(`Downloaded ${tpl.name} as ${format.toUpperCase()}`, 'success');
      logUserActivity(`Exported template: ${tpl.name} as ${format.toUpperCase()}`);
    }
  };
})();

// ─── TEMPLATE UI CONTROLLER ────────────────────────────────────────────────
let activeTemplateId = null;
let activeTemplateData = [];

document.addEventListener('DOMContentLoaded', () => {
  initTemplateGrid();
});

function initTemplateGrid() {
  const grid = document.getElementById('templates-grid');
  if (!grid) return;

  const templates = ReportTemplates.getAll();

  grid.innerHTML = templates.map(tpl => `
    <div class="card template-card" data-template-id="${tpl.id}" style="cursor: pointer; transition: all 0.2s; border: 1px solid var(--card-border);">
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
        <div style="width: 44px; height: 44px; border-radius: 10px; background: ${tpl.color}15; display: flex; align-items: center; justify-content: center;">
          <i class="fas ${tpl.icon}" style="color: ${tpl.color}; font-size: 1.2rem;"></i>
        </div>
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0; color: var(--text-primary);">${tpl.name}</h4>
          <span style="font-size: 0.7rem; color: var(--text-muted);">${tpl.columnCount} columns</span>
        </div>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">${tpl.description}</p>
      <div style="margin-top: 14px; display: flex; gap: 8px;">
        <button class="btn btn-primary btn-template-use" data-id="${tpl.id}" style="flex: 1; padding: 8px; font-size: 0.8rem;">
          <i class="fas fa-play"></i> Generate
        </button>
        <button class="btn btn-secondary btn-template-preview" data-id="${tpl.id}" style="padding: 8px 12px; font-size: 0.8rem;" title="Preview sample data">
          <i class="fas fa-eye"></i>
        </button>
      </div>
    </div>
  `).join('');

  // Hover effects
  grid.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.borderColor = 'var(--primary)';
      card.style.transform = 'translateY(-2px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = 'var(--card-border)';
      card.style.transform = 'none';
    });
  });

  // Generate buttons
  grid.querySelectorAll('.btn-template-use').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      generateTemplate(btn.dataset.id);
    });
  });

  // Preview buttons
  grid.querySelectorAll('.btn-template-preview').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      previewTemplate(btn.dataset.id);
    });
  });
}

function generateTemplate(templateId) {
  const tpl = ReportTemplates.get(templateId);
  if (!tpl) return;

  activeTemplateId = templateId;
  activeTemplateData = ReportTemplates.generateData(templateId);

  // Show export panel
  const exportPanel = document.getElementById('template-export-panel');
  const previewBox = document.getElementById('template-preview-container');
  const previewInfo = document.getElementById('template-preview-info');

  if (exportPanel) exportPanel.style.display = 'block';
  if (previewInfo) previewInfo.textContent = `${tpl.name} — ${activeTemplateData.length} rows generated`;

  renderTemplatePreview(tpl, activeTemplateData);
  showToast(`${tpl.name}: ${activeTemplateData.length} rows generated`, 'success');
}

function previewTemplate(templateId) {
  const tpl = ReportTemplates.get(templateId);
  if (!tpl) return;

  // Generate just 5 rows for preview
  const previewData = tpl.generate().slice(0, 5);
  renderTemplatePreview(tpl, previewData);

  const previewInfo = document.getElementById('template-preview-info');
  if (previewInfo) previewInfo.textContent = `${tpl.name} — Preview (5 rows)`;

  const exportPanel = document.getElementById('template-export-panel');
  if (exportPanel) exportPanel.style.display = 'block';
}

function renderTemplatePreview(tpl, data) {
  const container = document.getElementById('template-preview-container');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No data to preview</div>';
    return;
  }

  const cols = tpl.columns.slice(0, 8);
  let html = `
    <div style="max-height: 400px; overflow: auto; border: 1px solid var(--card-border); border-radius: var(--border-radius-sm);">
      <table class="custom-table" style="font-size: 0.8rem;">
        <thead><tr>${cols.map(c => `<th style="white-space: nowrap;">${c}</th>`).join('')}</tr></thead>
        <tbody>
  `;

  data.forEach(row => {
    html += '<tr>';
    cols.forEach(col => {
      let val = row[col] !== undefined ? row[col] : '';
      if (typeof val === 'number') val = val.toLocaleString();
      html += `<td style="white-space: nowrap;">${val}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  if (tpl.columns.length > 8) {
    html += `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 6px; text-align: center;">Showing ${cols.length} of ${tpl.columns.length} columns. Export to see all.</div>`;
  }
  container.innerHTML = html;
}

// ─── EXPORT BUTTON HANDLERS ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const btnExcel = document.getElementById('btn-template-export-xlsx');
  const btnCSV = document.getElementById('btn-template-export-csv');
  const btnPDF = document.getElementById('btn-template-export-pdf');

  if (btnExcel) {
    btnExcel.addEventListener('click', () => {
      if (!activeTemplateId || activeTemplateData.length === 0) {
        showToast('Generate a template first.', 'warning');
        return;
      }
      ReportTemplates.download(activeTemplateId, activeTemplateData, 'xlsx');
    });
  }

  if (btnCSV) {
    btnCSV.addEventListener('click', () => {
      if (!activeTemplateId || activeTemplateData.length === 0) {
        showToast('Generate a template first.', 'warning');
        return;
      }
      ReportTemplates.download(activeTemplateId, activeTemplateData, 'csv');
    });
  }

  if (btnPDF) {
    btnPDF.addEventListener('click', () => {
      if (!activeTemplateId || activeTemplateData.length === 0) {
        showToast('Generate a template first.', 'warning');
        return;
      }
      ReportTemplates.download(activeTemplateId, activeTemplateData, 'pdf');
    });
  }
});
