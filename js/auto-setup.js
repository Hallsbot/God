import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

export async function runAutoSetup() {
    try {
        const settingsRef = doc(db, "settings", "app");
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
            console.log("✅ Setup already exists.");
            return;
        }

        console.log("🚀 Running First-Time Setup...");

        // 1. Create Settings
        await setDoc(doc(db, "settings", "app"), {
            telegramLink: "https://t.me/raostarr",
            qrCodeUrl: "qr.jpg",
            setupCompleted: true
        });

        // 2. Create Admin Account in Auth & Firestore
        const adminEmail = "admin@raostar.shop";
        const adminPass = "raostar";

        try {
            const userCred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
            await setDoc(doc(db, "users", userCred.user.uid), {
                uid: userCred.user.uid,
                name: "RAOSTAR ADMIN",
                email: adminEmail,
                role: "admin",
                walletBalance: 0,
                createdAt: serverTimestamp()
            });
            console.log("👑 Admin Created Successfully!");
        } catch (authError) {
            console.warn("Admin might already exist in Auth:", authError.message);
        }

        // 3. Create Default Pages
        await setDoc(doc(db, "pages", "terms"), {
            title: "Terms & Conditions",
            content: "<h2>Rules</h2><p>Welcome to RAOSTAR. No refunds on glory packs.</p>",
            updatedAt: serverTimestamp()
        });
        await setDoc(doc(db, "pages", "privacy"), {
            title: "Privacy Policy",
            content: "<h2>Privacy</h2><p>Your data is safe with RAOSTAR SHOP.</p>",
            updatedAt: serverTimestamp()
        });

        alert("System Initialized! Use admin@raostar.shop / raostar to login.");

    } catch (error) {
        console.error("❌ Setup Error:", error);
    }
}