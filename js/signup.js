/* ==========================================================================
   EXCEL AUTO - SIGN UP CONTROLLER (signup.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Signup] Page loaded');
  console.log('[Signup] Firebase mode:', window.isFirebaseMocked ? 'SANDBOX (mock)' : 'LIVE');
  console.log('[Signup] auth object:', typeof window.auth);
  if (window.auth) {
    console.log('[Signup] currentUser:', window.auth.currentUser ? window.auth.currentUser.email : 'null');
  }
  initSignupForm();
  initGoogleSignup();
});

/**
 * Handle Account Registration Form Submission
 */
function initSignupForm() {
  const form = document.getElementById('signup-form');
  const alertBox = document.getElementById('auth-alert');
  const alertMsg = document.getElementById('auth-alert-message');
  const spinner = document.getElementById('signup-spinner');
  const submitBtn = document.getElementById('btn-signup-submit');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Hide any previous warnings
    alertBox.style.display = 'none';

    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const terms = document.getElementById('terms-agree').checked;

    // Check basic parameters
    if (password.length < 6) {
      alertMsg.textContent = "Password must be at least 6 characters long.";
      alertBox.style.display = 'flex';
      return;
    }

    if (password !== confirmPassword) {
      alertMsg.textContent = "Passwords do not match.";
      alertBox.style.display = 'flex';
      return;
    }

    if (!terms) {
      alertMsg.textContent = "You must agree to the Terms of Service & Privacy Policy.";
      alertBox.style.display = 'flex';
      return;
    }

    // Toggle loader
    submitBtn.disabled = true;
    spinner.style.display = 'inline-block';

    try {
      // 1. Create account
      console.log('[Signup] Attempting to create user:', email);
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      const user = credential.user;

      // 2. Set profile display name
      if (user && typeof user.updateProfile === 'function') {
        await user.updateProfile({ displayName: name });
      }

      // 3. Create document record in Firestore collection
      await createUserProfileDoc(user, { name: name });

      // 4. Send verification email (non-blocking, ignore errors if mock mode)
      try {
        if (typeof user.sendEmailVerification === 'function') {
          await user.sendEmailVerification();
        }
      } catch (evErr) {
        console.warn("Could not dispatch verification email:", evErr);
      }

      // 5. Shift display wrapper to verification step page
      document.getElementById('sent-email-placeholder').textContent = email;
      document.getElementById('signup-form-step').style.display = 'none';
      document.getElementById('signup-verification-step').style.display = 'block';
      // Reset UI state
      submitBtn.disabled = false;
      spinner.style.display = 'none';

      // Log activity
      await logUserActivity("Registered user account: " + email);

    } catch (err) {
      console.error("[Signup] Sign up failed with details:", err);
      console.error("[Signup] Error code:", err.code);
      console.error("[Signup] Error message:", err.message);

      // Auto-recover from invalid API key
      if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' ||
          err.message.includes('api-key-not-valid')) {
        console.warn("[Signup] Invalid API key — switching to Sandbox Mode...");
        localStorage.removeItem('excel_auto_firebase_config');
        alertMsg.textContent = "Firebase API key is invalid. Switching to Sandbox Mode — reloading...";
        alertBox.className = "status-pill warning";
        alertBox.style.display = 'flex';
        setTimeout(() => { window.location.reload(); }, 1500);
        submitBtn.disabled = false;
        spinner.style.display = 'none';
        return;
      }

      // Show EXACT error message in UI
      alertMsg.textContent = err.message || "Failed to create account. Please try again.";
      alertBox.style.display = 'flex';
      
      submitBtn.disabled = false;
      spinner.style.display = 'none';
    }
  });
}

/**
 * Handle Google SSO Sign up
 */
function initGoogleSignup() {
  const googleBtn = document.getElementById('btn-google-signup');
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

      // Create document record in Firestore collection
      await createUserProfileDoc(user);

      // Log activity
      await logUserActivity("Signed up via Google SSO: " + user.email);

      // Redirect immediately to studio
      window.location.href = 'dashboard.html';

    } catch (err) {
      console.error("[Signup] Google Single Sign-on signup failed:", err);
      console.error("[Signup] Error code:", err.code);
      console.error("[Signup] Error message:", err.message);

      if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' ||
          err.message.includes('api-key-not-valid')) {
        console.warn("[Signup] Invalid API key — switching to Sandbox Mode...");
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
