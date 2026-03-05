// Import Firebase functions from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your RAOSTAR SHOP Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAfEtaPbLb92LEHoP2pV8g6b_wR2b0iwnc",
    authDomain: "raostar-ec800.firebaseapp.com",
    projectId: "raostar-ec800",
    storageBucket: "raostar-ec800.firebasestorage.app",
    messagingSenderId: "837135687190",
    appId: "1:837135687190:web:54b11a97b519000b271f37"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const auth = getAuth(app);
const db = getFirestore(app);

// Export for use in other files
export { auth, db };

console.log("🔥 Firebase Initialized Successfully");