/* ==========================================================================
   EXCEL AUTO - SHARED AUTH HELPERS (auth.js)
   ========================================================================== */

console.log("Auth Helper Script Loaded");

/**
 * Creates or updates user profile in Firestore
 */
async function createUserProfileDoc(user, additionalData = {}) {
  if (!user) return;

  const userRef = db.collection('users').doc(user.uid);
  let snapshot;
  
  try {
    snapshot = await userRef.get();
  } catch (error) {
    console.warn("Could not retrieve user document (running in sandbox/offline mode?):", error);
    // Proceed to set document anyway
  }

  if (!snapshot || !snapshot.exists) {
    const { email, displayName, photoURL } = user;
    const createdAt = new Date().toISOString();
    try {
      await userRef.set({
        id: user.uid,
        name: displayName || email.split('@')[0],
        email: email,
        photoURL: photoURL || null,
        role: 'user', // Default role
        status: 'active',
        createdAt: createdAt,
        updatedAt: createdAt,
        ...additionalData
      });
      console.log("User profile document created successfully in Firestore.");
    } catch (error) {
      console.error("Error creating user profile document in Firestore: ", error);
      throw error;
    }
  }
}
