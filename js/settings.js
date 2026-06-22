/* ==========================================================================
   EXCEL AUTO - SYSTEM PREFERENCES CONTROLLER (settings.js)
   ========================================================================== */

let currentSelectedTheme = 'dark';

document.addEventListener('DOMContentLoaded', () => {
  initSettingsLoader();
  initThemeSelectorCards();
  initFbConfigHandlers();
});

/**
 * Load User Settings from Firestore
 */
function initSettingsLoader() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const doc = await db.collection('settings').doc(user.uid).get();
        if (doc.exists) {
          const settings = doc?.data();
          
          // Populate Form Values
          document.getElementById('settings-language').value = settings.language || 'en';
          document.getElementById('settings-notif-upload').checked = settings.notifyUpload !== false;
          document.getElementById('settings-notif-clean').checked = settings.notifyClean !== false;
          document.getElementById('settings-notif-export').checked = settings.notifyExport !== false;
          
          currentSelectedTheme = settings.theme || 'dark';
          updateThemeCardUI(currentSelectedTheme);
        }
      } catch (err) {
        console.warn("Failed to load cloud settings, running on local defaults.", err);
      }
    }
  });

  // Save Settings button handler
  const saveBtn = document.getElementById('btn-save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      const spinner = document.getElementById('settings-spinner');
      
      const language = document.getElementById('settings-language').value;
      const notifyUpload = document.getElementById('settings-notif-upload').checked;
      const notifyClean = document.getElementById('settings-notif-clean').checked;
      const notifyExport = document.getElementById('settings-notif-export').checked;
      
      saveBtn.disabled = true;
      spinner.style.display = 'inline-block';
      
      try {
        const timestamp = new Date().toISOString();
        const settingsData = {
          theme: currentSelectedTheme,
          language: language,
          notifyUpload: notifyUpload,
          notifyClean: notifyClean,
          notifyExport: notifyExport,
          updatedAt: timestamp
        };
        
        await db.collection('settings').doc(user.uid).set(settingsData, { merge: true });
        
        showToast("System settings saved successfully.", "success");
        await logUserActivity("Updated account settings");
        
      } catch (err) {
        console.error(err);
        showToast(err.message, "error");
      } finally {
        saveBtn.disabled = false;
        spinner.style.display = 'none';
      }
    });
  }
}

/**
 * Handle Theme selection cards
 */
function initThemeSelectorCards() {
  const darkCard = document.getElementById('theme-btn-dark');
  const lightCard = document.getElementById('theme-btn-light');
  
  if (!darkCard || !lightCard) return;
  
  darkCard.addEventListener('click', () => {
    currentSelectedTheme = 'dark';
    updateThemeCardUI('dark');
    
    // Preview instantly
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('excel_auto_theme', 'dark');
    
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.innerHTML = '<i class="fas fa-sun"></i>';
    
    // Fire event for charts to redraw
    window.dispatchEvent(new Event('themeChanged'));
  });
  
  lightCard.addEventListener('click', () => {
    currentSelectedTheme = 'light';
    updateThemeCardUI('light');
    
    // Preview instantly
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('excel_auto_theme', 'light');
    
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.innerHTML = '<i class="fas fa-moon"></i>';
    
    // Fire event for charts to redraw
    window.dispatchEvent(new Event('themeChanged'));
  });
}

function updateThemeCardUI(theme) {
  const darkCard = document.getElementById('theme-btn-dark');
  const lightCard = document.getElementById('theme-btn-light');
  if (!darkCard || !lightCard) return;
  
  if (theme === 'dark') {
    darkCard.classList.add('active');
    lightCard.classList.remove('active');
  } else {
    lightCard.classList.add('active');
    darkCard.classList.remove('active');
  }
}

/**
 * Handle custom Local Storage Firebase configurations
 */
function initFbConfigHandlers() {
  const textarea = document.getElementById('settings-fb-config');
  const saveBtn = document.getElementById('btn-save-fb-config');
  const resetBtn = document.getElementById('btn-reset-fb-config');
  
  if (!textarea || !saveBtn) return;
  
  // Load current saved configuration (if exists)
  const savedStr = localStorage.getItem('excel_auto_firebase_config');
  if (savedStr) {
    try {
      const parsedObj = JSON.parse(savedStr);
      textarea.value = JSON.stringify(parsedObj, null, 2);
    } catch(e) {
      textarea.value = savedStr;
    }
  }
  
  // Save custom credentials
  saveBtn.addEventListener('click', () => {
    const configStr = textarea.value.trim();
    if (!configStr) {
      showToast("Firebase Config details cannot be empty.", "warning");
      return;
    }
    
    try {
      // Validate JSON syntax
      const parsed = JSON.parse(configStr);
      
      if (!parsed.apiKey || !parsed.projectId) {
        throw new Error("Missing critical keys: apiKey and projectId required.");
      }

      // Validate API key format
      if (!parsed.apiKey.startsWith('AIzaSy')) {
        throw new Error("Invalid API key format. Firebase Web API keys must start with 'AIzaSy'. Get yours from Firebase Console → Project Settings → General → Web API Key.");
      }
      if (parsed.apiKey.length < 30) {
        throw new Error("API key appears truncated. Firebase Web API keys are ~39 characters long.");
      }
      
      // Validate authDomain matches projectId
      if (parsed.authDomain && !parsed.authDomain.includes(parsed.projectId)) {
        console.warn('[Settings] authDomain does not contain projectId. Expected:', parsed.projectId + '.firebaseapp.com');
      }
      
      // Validate storageBucket matches projectId
      if (parsed.storageBucket && !parsed.storageBucket.includes(parsed.projectId)) {
        console.warn('[Settings] storageBucket does not contain projectId. Expected:', parsed.projectId + '.appspot.com');
      }
      
      localStorage.setItem('excel_auto_firebase_config', JSON.stringify(parsed));
      console.log('[Settings] Firebase config saved:', { projectId: parsed.projectId, apiKeyPrefix: parsed.apiKey.substring(0, 8) + '...' });
      showToast("Linked database settings! Reloading workspace to apply...", "success");
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      showToast(`Invalid configuration: ${err.message}`, "error");
    }
  });
  
  // Reset credentials
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm("Reset Firebase config back to sandboxed demo?")) {
        localStorage.removeItem('excel_auto_firebase_config');
        textarea.value = '';
        showToast("Disconnected credentials! Reloading...", "warning");
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    });
  }
}
