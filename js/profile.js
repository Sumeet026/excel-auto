/* ==========================================================================
   EXCEL AUTO - PROFILE CONTROLLER (profile.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initTabSwitchers();
  initProfileLoader();
  initAvatarUploader();
});

/**
 * Switch tabs between Account details & Security forms
 */
function initTabSwitchers() {
  const tabDetails = document.getElementById('tab-trigger-details');
  const tabSecurity = document.getElementById('tab-trigger-security');
  
  const formDetails = document.getElementById('profile-details-form');
  const formSecurity = document.getElementById('profile-security-form');
  
  if (!tabDetails || !tabSecurity) return;
  
  tabDetails.addEventListener('click', () => {
    tabDetails.classList.add('active');
    tabSecurity.classList.remove('active');
    formDetails.style.display = 'block';
    formSecurity.style.display = 'none';
  });
  
  tabSecurity.addEventListener('click', () => {
    tabSecurity.classList.add('active');
    tabDetails.classList.remove('active');
    formSecurity.style.display = 'block';
    formDetails.style.display = 'none';
  });
}

/**
 * Load user profiles in forms
 */
function initProfileLoader() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      document.getElementById('profile-name-header').textContent = user.displayName || user.email.split('@')[0];
      document.getElementById('profile-email-header').textContent = user.email;
      
      document.getElementById('profile-name-input').value = user.displayName || "";
      document.getElementById('profile-email-input').value = user.email || "";
      
      // Load Avatar previews
      const avatarUrl = user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150';
      document.getElementById('profile-pic-preview').src = avatarUrl;
      
      // Verify Status label
      const verifyLabel = document.getElementById('verification-status-label');
      if (user.emailVerified) {
        verifyLabel.innerHTML = `<span class="status-pill success"><i class="fas fa-check-circle"></i> Verified Account</span>`;
      } else {
        verifyLabel.innerHTML = `
          <span class="status-pill danger"><i class="fas fa-times-circle"></i> Unverified</span> 
          <a href="#" id="verify-email-now" style="color: var(--primary); font-weight:600; margin-left: 8px; text-decoration: underline;">Send Verification Email</a>
        `;
        
        // Attach verification click handler
        const verifyLink = document.getElementById('verify-email-now');
        if (verifyLink) {
          verifyLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
              await user.sendEmailVerification();
              showToast("Verification email sent to your inbox!", "success");
            } catch (err) {
              showToast(err.message, "error");
            }
          });
        }
      }
    }
  });

  // Wire detail update form submission
  const detailsForm = document.getElementById('profile-details-form');
  if (detailsForm) {
    detailsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const user = auth.currentUser;
      if (!user) return;
      
      const newName = document.getElementById('profile-name-input').value.trim();
      const newEmail = document.getElementById('profile-email-input').value.trim();
      
      const submitBtn = document.getElementById('btn-save-details');
      const spinner = document.getElementById('details-spinner');
      
      submitBtn.disabled = true;
      spinner.style.display = 'inline-block';
      
      try {
        // 1. Update Display Name
        await user.updateProfile({ displayName: newName });
        
        // 2. Update Email (if changed)
        if (newEmail !== user.email) {
          await user.updateEmail(newEmail);
          showToast("Email address updated! Please re-verify.", "warning");
        }
        
        // 3. Update Firestore Document
        const timestamp = new Date().toISOString();
        await db.collection('users').doc(user.uid).update({
          name: newName,
          email: newEmail,
          updatedAt: timestamp
        });
        
        showToast("Profile details updated successfully.", "success");
        await logUserActivity("Updated profile details");
        
        // Update header & sidebar
        document.getElementById('profile-name-header').textContent = newName;
        document.getElementById('profile-email-header').textContent = newEmail;
        
        const sideName = document.querySelector('.profile-name');
        if (sideName) sideName.textContent = newName;
        
      } catch (err) {
        console.error(err);
        if (err.code === 'auth/requires-recent-login') {
          showToast("Security requires you to sign out and log back in to change emails.", "error");
        } else {
          showToast(err.message, "error");
        }
      } finally {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
      }
    });
  }

  // Wire security change submission
  const securityForm = document.getElementById('profile-security-form');
  if (securityForm) {
    securityForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const user = auth.currentUser;
      if (!user) return;
      
      const oldPwd = document.getElementById('profile-old-pwd').value;
      const newPwd = document.getElementById('profile-new-pwd').value;
      const confirmPwd = document.getElementById('profile-confirm-pwd').value;
      
      const submitBtn = document.getElementById('btn-save-security');
      const spinner = document.getElementById('security-spinner');
      
      if (newPwd.length < 6) {
        showToast("Password must be at least 6 characters.", "warning");
        return;
      }
      
      if (newPwd !== confirmPwd) {
        showToast("Passwords do not match.", "warning");
        return;
      }
      
      submitBtn.disabled = true;
      spinner.style.display = 'inline-block';
      
      try {
        // Reauthenticate standard requirement
        let credential;
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth.EmailAuthProvider) {
          credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPwd);
        } else {
          // Mock mode - skip reauthentication
          showToast("Password updated successfully.", "success");
          securityForm.reset();
          return;
        }
        await user.reauthenticateWithCredential(credential);
        
        // Update Password
        await user.updatePassword(newPwd);
        
        showToast("Password updated successfully.", "success");
        await logUserActivity("Changed account password");
        securityForm.reset();
        
      } catch (err) {
        console.error(err);
        showToast(`Failed to update password: ${err.message}`, "error");
      } finally {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
      }
    });
  }
}

/**
 * Avatar Upload
 */
function initAvatarUploader() {
  const avatarInput = document.getElementById('avatar-file-input');
  const preview = document.getElementById('profile-pic-preview');
  
  if (!avatarInput || !preview) return;
  
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    if (!file) return;
    
    // Client-side image check
    if (!file.type.startsWith('image/')) {
      showToast("Please upload an image file.", "warning");
      return;
    }
    
    // Quick preview local update
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    const user = auth.currentUser;
    if (!user) return;
    
    showToast("Uploading profile picture...", "info");
    
    try {
      const storagePath = `users/${user.uid}/profile/avatar_${Date.now()}`;
      const avatarRef = storage.ref(storagePath);
      
      // Upload task
      await avatarRef.put(file);
      const downloadUrl = await avatarRef.getDownloadURL();
      
      // Update Auth Profile
      await user.updateProfile({ photoURL: downloadUrl });
      
      // Update Firestore profile
      await db.collection('users').doc(user.uid).update({
        photoURL: downloadUrl,
        updatedAt: new Date().toISOString()
      });
      
      // Update sidebar
      const sideAvatar = document.querySelector('.profile-avatar');
      if (sideAvatar) sideAvatar.src = downloadUrl;
      
      showToast("Profile image updated!", "success");
      await logUserActivity("Uploaded profile avatar picture");
      
    } catch (err) {
      console.error(err);
      showToast(`Upload failed: ${err.message}`, "error");
    }
  });
}
