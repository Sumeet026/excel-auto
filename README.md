<<<<<<< HEAD
# ExcelAuto - Enterprise Excel Automation Platform

ExcelAuto is a high-performance, responsive enterprise spreadsheet automation and report generation platform built purely using **HTML5, CSS3, Vanilla ES6 JavaScript, and Firebase Cloud Services**.

No heavy frameworks (React, Angular, Vue) or UI components libraries (Bootstrap, Tailwind) are used, ensuring extremely lightweight loading speeds and custom styled premium glassmorphism visuals.

---

## 📂 File and Folder Structure

```
excel-auto/
│
├── index.html                  # Brand Landing Page & CTA Navigation
├── login.html                  # User Authentication Sign-In Screen
├── signup.html                 # User Registration & Verification Screen
├── dashboard.html              # Main Studio Console Workspace
├── reports.html                # PDF/Excel/CSV Report Compiler
├── analytics.html              # Interactive KPI Performance Charts
├── profile.html                # Account Display details & Photo Uploads
├── settings.html               # UI Theme toggles & Database configuration
├── admin.html                  # Administration Governance Panel
│
├── css/
│   ├── styles.css              # Glassmorphic UI colors, layout grids, alerts
│   ├── auth.css                # Authentication structures & ambient back-glows
│   └── dashboard.css           # Workspace managers, previews, mapping rows
│
├── js/
│   ├── firebase-config.js      # Credentials loader & Local sandbox mock suite
│   ├── common.js               # Route guards, toasts, notifications drawers
│   ├── auth.js                 # Authentication handlers & Firestore registration
│   ├── dashboard.js            # SheetJS parsers, cleaning filters, formulas solver
│   ├── reports.js              # Combiners, statistics calculator, PDF compilations
│   ├── analytics.js            # ChartJS canvas adapters & timeline range updates
│   ├── profile.js              # Account profile updates & storage avatar uploaders
│   └── settings.js             # SaaS settings writers & credentials linking
│
├── firestore.rules             # Rules for Firestore Collections
├── storage.rules               # Sizing & MIME restrictions for Cloud Storage
└── database-rules.json         # Paths permission rules for Realtime DB
```

---

## ⚙️ Configuration & Deployment Instructions

By default, the application initiates in a **local sandboxed state** saving user metrics, files, and records mock-ups to your browser's local storage. This guarantees the console workspace is **100% interactive and functional out-of-the-box** without any complex configurations.

To bind the workspace to your actual live Firebase backend instance:

### 1. Create a Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and specify a name (e.g. `ExcelAuto-Production`).
3. Enable **Google Analytics** (Optional).

### 2. Register Web Application
1. Click the **Web (</>)** icon on your project overview screen.
2. Register the app nickname and click register.
3. Copy the configuration JSON object `firebaseConfig` which includes the `apiKey`, `authDomain`, etc.

### 3. Connect to Application
1. Launch `index.html` in your browser.
2. Go to `signup.html` to create a test user, then navigate to the **Settings** panel from the sidebar.
3. Scroll to **Link Live Firebase Instance**, paste the copied Firebase configuration JSON, and click **Link Firebase Database**.
4. The workspace will automatically refresh and connect to your live databases!
*Alternatively, you can edit `/js/firebase-config.js` and modify `defaultFirebaseConfig` directly.*

### 4. Enable Authentication Providers
In the Firebase console:
1. Navigate to **Authentication** > **Sign-in method**.
2. Enable **Email/Password** sign-in (turn on Email Verification).
3. Enable **Google** sign-in.

### 5. Setup Databases & Upload Security Rules
1. Create a **Firestore Database** in production mode. Update rules in Firebase Console using the code from `firestore.rules`.
2. Create a **Realtime Database**. Update rules using the structure in `database-rules.json`.
3. Create a **Storage Bucket**. Update rules using the constraints in `storage.rules`.

### 6. Hosting Deployments
To deploy the application to Firebase Hosting:
1. Run `npm install -g firebase-tools` in your terminal to install the Firebase CLI.
2. Execute `firebase login` to authenticate your console.
3. Run `firebase init` inside this directory:
   - Select **Hosting: Configure files for Firebase Hosting**.
   - Set the public directory to `.` (since our files are in the root directory).
   - Configure as a single-page app: **No**.
4. Deploy by running: `firebase deploy`.

---

## 🛡️ Administrative Governance
To access the **Admin Panel**:
1. Log in with the email `admin@excelauto.com`. This automatically triggers the administration path-guards to assign you the `admin` role and injects the panel into your sidebar.
2. Alternatively, you can toggle `localStorage.setItem('is_admin_YOUR_UID', 'true')` in your browser console.

---

## 📝 Libraries Used (CDNs)
* [SheetJS (xlsx.full.min.js)](https://github.com/sheetjs/sheetjs) - Client-side Excel parsing & conversion.
* [jsPDF & AutoTable](https://github.com/parallax/jsPDF) - Client-side PDF layout generation.
* [Chart.js](https://www.chartjs.org/) - Interactive reports data graphing.
* [FontAwesome](https://fontawesome.com/) - Modern vector SaaS iconography.
=======
# excel-auto
>>>>>>> 74f693190c2f857ea5926910473220176a57c042
