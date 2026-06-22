/* ==========================================================================
   EXCEL AUTO - ANALYTICS CHART BUILDERS (analytics.js)
   ========================================================================== */

let charts = {};
let currentRange = '30d';

document.addEventListener('DOMContentLoaded', () => {
  initChartDefaults();
  renderAllCharts();
  initRangeToggles();
  initThemeChangeListener();
});

/**
 * Configure ChartJS styles to match glassmorphism aesthetics
 */
function initChartDefaults() {
  Chart.defaults.font.family = "'Outfit', sans-serif";
  Chart.defaults.color = getThemeColor('--text-secondary');
  Chart.defaults.scale.grid.color = getThemeColor('--card-border');
}

function getThemeColor(variable) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

/**
 * Draw all charts inside canvas wrappers
 */
function renderAllCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  
  // Destruct existing charts if refreshing
  Object.keys(charts).forEach(key => charts[key].destroy());
  
  // 1. Revenue area chart (Gradient Fill)
  const revCtx = document.getElementById('chart-revenue').getContext('2d');
  const revGrad = revCtx.createLinearGradient(0, 0, 0, 300);
  revGrad.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
  revGrad.addColorStop(1, 'rgba(99, 102, 241, 0.01)');
  
  charts.revenue = new Chart(revCtx, {
    type: 'line',
    data: {
      labels: getLabels('revenue'),
      datasets: [{
        label: 'Platform Revenue ($)',
        data: getData('revenue'),
        borderColor: '#6366f1',
        borderWidth: 3,
        backgroundColor: revGrad,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#a855f7',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } }
      }
    }
  });

  // 2. Sales bar chart
  const salesCtx = document.getElementById('chart-sales').getContext('2d');
  charts.sales = new Chart(salesCtx, {
    type: 'bar',
    data: {
      labels: getLabels('sales'),
      datasets: [
        {
          label: 'Target Volume',
          data: getData('sales-target'),
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.06)',
          borderRadius: 6
        },
        {
          label: 'Completed Sales',
          data: getData('sales-actual'),
          backgroundColor: '#10b981',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12 } }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } }
      }
    }
  });

  // 3. File Processing lines
  const fileCtx = document.getElementById('chart-files').getContext('2d');
  charts.files = new Chart(fileCtx, {
    type: 'line',
    data: {
      labels: getLabels('files'),
      datasets: [{
        label: 'Files Processed',
        data: getData('files'),
        borderColor: '#06b6d4',
        borderWidth: 2,
        tension: 0.1,
        fill: false,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } }
      }
    }
  });

  // 4. Distribution doughnut chart
  const userCtx = document.getElementById('chart-users').getContext('2d');
  charts.users = new Chart(userCtx, {
    type: 'doughnut',
    data: {
      labels: ['Data Cleans', 'Sheet Merges', 'Calculations', 'Exports'],
      datasets: [{
        data: getData('distribution'),
        backgroundColor: ['#6366f1', '#a855f7', '#06b6d4', '#10b981'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12 } }
      }
    }
  });
}

/**
 * Handle timeline selectors redrawing datasets
 */
function initRangeToggles() {
  const pills = document.querySelectorAll('.timeline-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      
      currentRange = pill.dataset.range;
      showToast(`Recalculated analytics for ${pill.textContent}`, "info");
      
      renderAllCharts();
    });
  });
}

/**
 * Redraw gridlines on active Theme swapper events
 */
function initThemeChangeListener() {
  window.addEventListener('themeChanged', () => {
    // Timeout to let DOM variable swap finalize
    setTimeout(() => {
      Chart.defaults.color = getThemeColor('--text-secondary');
      Chart.defaults.scale.grid.color = getThemeColor('--card-border');
      renderAllCharts();
    }, 100);
  });
}

/**
 * Mock data loaders matching timeline bounds
 */
function getLabels(chartType) {
  if (currentRange === '7d') {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }
  if (currentRange === '30d') {
    return ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
  }
  // 12 Months
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}

function getData(type) {
  const datasetPools = {
    'revenue': {
      '7d': [120, 190, 300, 250, 400, 380, 520],
      '30d': [1820, 2400, 2100, 3200],
      '12m': [15000, 18000, 24000, 22000, 28000, 31000, 35000, 33000, 42000, 48000, 45000, 56000]
    },
    'sales-target': {
      '7d': [200, 200, 200, 200, 200, 200, 200],
      '30d': [1000, 1000, 1000, 1000],
      '12m': [12000, 12000, 12000, 12000, 15000, 15000, 15000, 15000, 18000, 18000, 18000, 18000]
    },
    'sales-actual': {
      '7d': [150, 230, 180, 210, 290, 260, 320],
      '30d': [920, 1240, 1080, 1400],
      '12m': [10500, 13400, 11800, 14200, 16900, 15400, 18100, 17200, 21200, 19800, 23200, 25400]
    },
    'files': {
      '7d': [14, 25, 18, 30, 42, 12, 19],
      '30d': [84, 120, 102, 154],
      '12m': [890, 1020, 940, 1150, 1280, 1420, 1210, 1350, 1680, 1820, 1740, 2150]
    },
    'distribution': {
      '7d': [45, 25, 20, 10],
      '30d': [245, 154, 110, 65],
      '12m': [2450, 1420, 1180, 720]
    }
  };
  
  return datasetPools[type] ? datasetPools[type][currentRange] : [];
}
