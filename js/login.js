/* ==========================================================================
   EXCEL AUTO - LOGIN CONTROLLER (login.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Login] Page loaded');
  console.log('[Login] Firebase mode:', window.isFirebaseMocked ? 'SANDBOX (mock)' : 'LIVE');
  console.log('[Login] auth object:', typeof window.auth);
  if (window.auth) {
    console.log('[Login] currentUser:', window.auth.currentUser ? window.auth.currentUser.email : 'null');
  }
  initLoginForm();
  initGoogleLogin();
  initForgotPasswordModal();
  initResendVerification();
});

/**
 * Handle Account Login Form Submission
 */
function initLoginForm() {
  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('auth-alert');
  const alertMsg = document.getElementById('auth-alert-message');
  const spinner = document.getElementById('login-spinner');
  const submitBtn = document.getElementById('btn-login-submit');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Hide previous warnings
    if (alertBox) alertBox.style.display = 'none';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Toggle loader
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';

    try {
      // Hide resend box on new attempt
      const resendBox = document.getElementById('resend-verify-box');
      const resendSuccess = document.getElementById('resend-success');
      if (resendBox) resendBox.style.display = 'none';
      if (resendSuccess) resendSuccess.style.display = 'none';

      // Sign in using Firebase Auth
      console.log('[Login] Attempting email sign-in for:', email);
      const loginResult = await auth.signInWithEmailAndPassword(email, password);
      
      // Log activity (non-blocking)
      logUserActivity("Logged in: " + email).catch(() => {});

      // Redirect immediately to dashboard
      window.location.replace('dashboard.html');

    } catch (err) {
      console.error("[Login] Login failed with details:", err);
      console.error("[Login] Error code:", err.code);
      console.error("[Login] Error message:", err.message);

      // Auto-recover from invalid API key: clear config and reload in sandbox mode
      if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' ||
          err.message.includes('api-key-not-valid')) {
        console.warn("[Login] Invalid API key detected — clearing config and reloading in Sandbox Mode...");
        localStorage.removeItem('excel_auto_firebase_config');
        alertMsg.textContent = "Firebase API key is invalid. Switching to Sandbox Mode — reloading...";
        alertBox.className = "status-pill warning";
        alertBox.style.display = 'flex';
        setTimeout(() => { window.location.reload(); }, 1500);
        return;
      }

      // Show EXACT error message in UI
      if (alertMsg) alertMsg.textContent = err.message || "Failed to sign in. Please verify your credentials.";
      if (alertBox) alertBox.style.display = 'flex';
      
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
    }
  });
}

/**
 * Handle Google SSO Logins
 */
function initGoogleLogin() {
  const googleBtn = document.getElementById('btn-google-login');
  const alertBox = document.getElementById('auth-alert');
  const alertMsg = document.getElementById('auth-alert-message');

  if (!googleBtn) return;

  googleBtn.addEventListener('click', async () => {
    alertBox.style.display = 'none';
    
    try {
      let provider;
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth.GoogleAuthProvider) {
        provider = new firebase.auth.GoogleAuthProvider();
      }
      const credential = await auth.signInWithPopup(provider);
      const user = credential.user;

      // Ensure profile doc exists (for new SSO signups logging in directly)
      await createUserProfileDoc(user);

      // Log activity
      await logUserActivity("Logged in via Google SSO: " + user.email);

      // Redirect immediately to studio
      window.location.href = 'dashboard.html';

    } catch (err) {
      console.error("[Login] Google Single Sign-on failed:", err);
      console.error("[Login] Error code:", err.code);
      console.error("[Login] Error message:", err.message);

      if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' ||
          err.message.includes('api-key-not-valid')) {
        console.warn("[Login] Invalid API key — switching to Sandbox Mode...");
        localStorage.removeItem('excel_auto_firebase_config');
        alertMsg.textContent = "Firebase API key is invalid. Switching to Sandbox Mode — reloading...";
        alertBox.className = "status-pill warning";
        alertBox.style.display = 'flex';
        setTimeout(() => { window.location.reload(); }, 1500);
        return;
      }

      // Show EXACT error message in UI
      alertMsg.textContent = err.message || "Google single sign-on failed. Please try again.";
      alertBox.style.display = 'flex';
    }
  });
}

/**
 * Handle Forgot Password Overlay & Form Submissions
 */
function initForgotPasswordModal() {
  const trigger = document.getElementById('forgot-password-trigger');
  const modal = document.getElementById('forgot-password-modal');
  const closeBtn = document.getElementById('forgot-modal-close');
  const cancelBtn = document.getElementById('forgot-cancel-btn');
  const submitBtn = document.getElementById('forgot-submit-btn');
  const spinner = document.getElementById('reset-spinner');
  
  const resetEmailInput = document.getElementById('reset-email');
  const alertBox = document.getElementById('reset-alert');
  const alertMsg = document.getElementById('reset-alert-message');

  if (!trigger || !modal) return;

  // Open modal
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.add('active');
    if (alertBox) alertBox.style.display = 'none';
    if (resetEmailInput) resetEmailInput.value = '';
  });

  // Close helper
  const closeModal = () => {
    modal.classList.remove('active');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Submit password reset
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const email = resetEmailInput.value.trim();
      if (!email) {
        if (alertBox) alertBox.className = "status-pill danger";
        if (alertMsg) alertMsg.textContent = "Please enter your email address.";
        if (alertBox) alertBox.style.display = 'flex';
        return;
      }

      submitBtn.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';
      if (alertBox) alertBox.style.display = 'none';

    try {
      await auth.sendPasswordResetEmail(email);
      
      if (alertBox) alertBox.className = "status-pill success";
      if (alertMsg) alertMsg.textContent = "Recovery instructions sent. Check your inbox!";
      if (alertBox) alertBox.style.display = 'flex';
      
      setTimeout(closeModal, 3000);
      
    } catch (err) {
      console.error("[Login] Password reset failed:", err);
      console.error("[Login] Error code:", err.code);
      console.error("[Login] Error message:", err.message);
      // Show EXACT error message in UI
      if (alertBox) alertBox.className = "status-pill danger";
      if (alertMsg) alertMsg.textContent = err.message || "Failed to send recovery email. Verify the address is correct.";
      if (alertBox) alertBox.style.display = 'flex';
    } finally {
      submitBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
    }
  });
  }
}

/**
 * Handle Resend Verification Email Button
 */
function initResendVerification() {
  const resendBtn = document.getElementById('resend-verify-btn');
  const spinner = document.getElementById('resend-spinner');
  const successMsg = document.getElementById('resend-success');
  if (!resendBtn) return;

  resendBtn.addEventListener('click', async () => {
    const resendBox = document.getElementById('resend-verify-box');
    const email = resendBox ? resendBox.dataset.userEmail : null;
    if (!email) return;

    resendBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (successMsg) successMsg.style.display = 'none';

    try {
      // First sign in briefly to get the user object, then send verification
      const password = document.getElementById('login-password').value;
      const cred = await auth.signInWithEmailAndPassword(email, password);
      const user = cred.user;
      if (user && typeof user.sendEmailVerification === 'function') {
        await user.sendEmailVerification();
      }
      await auth.signOut();

      if (successMsg) successMsg.style.display = 'block';
      showToast('Verification email resent! Check your inbox.', 'success');
    } catch (err) {
      console.error('[Login] Resend verification failed:', err);
      showToast(err.message || 'Failed to resend verification email.', 'error');
    } finally {
      resendBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
    }
  });
}
