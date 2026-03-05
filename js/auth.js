import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './utils.js';

// --- Friendly Auth Error Messages ---
function getFriendlyError(code) {
    switch (code) {
        case 'auth/email-already-in-use': return "This email is already registered. Try logging in.";
        case 'auth/invalid-email': return "The email address is not valid.";
        case 'auth/weak-password': return "Password is too weak. Min 6 chars.";
        case 'auth/user-not-found': return "No account found with this email.";
        case 'auth/wrong-password': return "Incorrect password. Try again.";
        case 'auth/invalid-credential': return "Incorrect email or password.";
        case 'auth/too-many-requests': return "Too many attempts. Try later.";
        default: return "Authentication failed. Please check your data.";
    }
}

// --- Auth State Observer (Role-Based Redirect) ---
onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1);

    if (user) {
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const role = userSnap.data().role;
                if (page === 'auth.html' || page === 'index.html' || page === '') {
                    window.location.href = (role === 'admin') ? 'admin/admin-dashboard.html' : 'home.html';
                }
            } else {
                console.warn("User document not found for UID:", user.uid);
            }
        } catch (e) {
            console.error("Redirection Error:", e);
        }
    } else {
        const protectedPages = ['home.html', 'wallet.html', 'about.html', 'terms.html', 'privacy.html'];
        if (protectedPages.includes(page) || path.includes('/admin/')) {
            window.location.href = 'auth.html';
        }
    }
});

// --- Login Logic ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value;
        const btn = loginForm.querySelector('button');

        btn.innerText = "Checking Account...";
        btn.disabled = true;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            showToast("Welcome back!", "success");
        } catch (error) {
            console.error("Login Error:", error.code);
            showToast(getFriendlyError(error.code), "error");
            btn.innerText = "Login";
            btn.disabled = false;
        }
    });
}

// --- Registration Logic ---
const regForm = document.getElementById('register-form');
if (regForm) {
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value;
        const confirm = document.getElementById('reg-confirm-pass').value;
        const btn = regForm.querySelector('button');

        if (pass !== confirm) return showToast("Passwords do not match!", "error");
        if (pass.length < 6) return showToast("Password must be 6+ characters", "error");

        btn.innerText = "Creating Account...";
        btn.disabled = true;

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(cred.user, { displayName: name });

            await setDoc(doc(db, "users", cred.user.uid), {
                uid: cred.user.uid,
                name: name,
                email: email,
                role: "user", 
                walletBalance: 0,
                status: "active",
                createdAt: serverTimestamp()
            });

            showToast("Registered Successfully!", "success");
        } catch (error) {
            console.error("Reg Error:", error);
            showToast(getFriendlyError(error.code), "error");
            btn.innerText = "Create Account";
            btn.disabled = false;
        }
    });
}

// --- Logout Logic ---
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        if (confirm("Logout from RAOSTAR SHOP?")) {
            try {
                await signOut(auth);
                window.location.href = 'auth.html';
            } catch (e) {
                showToast("Logout failed!", "error");
            }
        }
    };
}