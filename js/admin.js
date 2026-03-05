import { db, auth } from './firebase-config.js';
import { 
    collection, getDocs, query, where, doc, getDoc, updateDoc, increment, orderBy, runTransaction, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { showToast, formatCurrency, formatDate } from './utils.js';

// Admin Security Check & Routing
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Double check if admin
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
            window.location.href = '../home.html'; // Kick non-admins
        } else {
            initAdminPage();
        }
    } else {
        window.location.href = '../auth.html';
    }
});

// Detect which admin page is open
function initAdminPage() {
    const path = window.location.pathname;
    
    if (path.includes('admin-dashboard.html')) {
        loadDashboardStats();
    } else if (path.includes('admin-payments.html')) {
        loadPendingPayments();
    }
}

// ==========================================
// 📊 DASHBOARD STATS
// ==========================================
async function loadDashboardStats() {
    const totalUsersEl = document.getElementById('total-users');
    const revenueEl = document.getElementById('total-revenue');
    const pendingEl = document.getElementById('pending-requests');

    try {
        // 1. Get Total Users
        const usersSnap = await getDocs(collection(db, "users"));
        if(totalUsersEl) totalUsersEl.innerText = usersSnap.size;

        // 2. Get Pending Payments Count
        const pendingQ = query(collection(db, "transactions"), where("status", "==", "pending"), where("type", "==", "add_money"));
        const pendingSnap = await getDocs(pendingQ);
        if(pendingEl) pendingEl.innerText = pendingSnap.size;

        // 3. Calculate Total Revenue (Approved Purchases)
        const revenueQ = query(collection(db, "transactions"), where("status", "==", "approved"), where("type", "==", "purchase"));
        const revenueSnap = await getDocs(revenueQ);
        
        let totalRevenue = 0;
        revenueSnap.forEach(doc => {
            totalRevenue += (doc.data().amount || 0);
        });
        if(revenueEl) revenueEl.innerText = formatCurrency(totalRevenue);

    } catch (error) {
        console.error("Stats Error:", error);
    }
}

// ==========================================
// 💳 PAYMENT MANAGEMENT
// ==========================================
async function loadPendingPayments() {
    const container = document.getElementById('payments-list');
    if (!container) return;

    container.innerHTML = '<div class="loader"></div>';

    try {
        const q = query(
            collection(db, "transactions"), 
            where("type", "==", "add_money"), 
            where("status", "==", "pending"),
            orderBy("createdAt", "desc")
        );
        
        const snapshot = await getDocs(q);
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:#aaa;">No pending payment requests.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const t = doc.data();
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                    <div>
                        <h3>${t.userName}</h3>
                        <p style="color:#aaa; font-size:0.9rem;">Ref: ${doc.id.slice(0,8)}...</p>
                        <p style="margin-top:5px;">Amount: <b style="color:#10B981; font-size:1.2rem;">${formatCurrency(t.amount)}</b></p>
                        <p style="font-size:0.8rem; color:#aaa;">${formatDate(t.createdAt)}</p>
                    </div>
                    <div style="text-align:center;">
                        <a href="${t.proofUrl}" target="_blank">
                            <img src="${t.proofUrl}" alt="Proof" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:1px solid #444;">
                        </a>
                        <br><small>Click to View</small>
                    </div>
                </div>
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <button class="btn" style="background:#10B981; flex:1;" onclick="approvePayment('${doc.id}', '${t.userId}', ${t.amount})">Approve</button>
                    <button class="btn" style="background:#EF4444; flex:1;" onclick="rejectPayment('${doc.id}')">Reject</button>
                </div>
            `;
            container.appendChild(card);
        });

        // Expose functions to window so HTML buttons can access them
        window.approvePayment = approvePayment;
        window.rejectPayment = rejectPayment;

    } catch (error) {
        console.error("Payments Load Error:", error);
        container.innerHTML = '<p>Error loading payments.</p>';
    }
}

// ✅ Approve Payment Logic
async function approvePayment(txId, userId, amount) {
    if(!confirm(`Approve ₹${amount} for this user?`)) return;

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Get Transaction Ref
            const txRef = doc(db, "transactions", txId);
            const txDoc = await transaction.get(txRef);
            if (!txDoc.exists()) throw "Transaction missing";
            if (txDoc.data().status !== 'pending') throw "Transaction already processed";

            // 2. Get User Ref
            const userRef = doc(db, "users", userId);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User missing";

            // 3. Update Transaction Status
            transaction.update(txRef, { 
                status: 'approved',
                processedAt: serverTimestamp()
            });

            // 4. Add Money to Wallet
            const newBalance = (userDoc.data().walletBalance || 0) + Number(amount);
            transaction.update(userRef, { walletBalance: newBalance });
        });

        showToast("Payment Approved! Wallet Updated.", "success");
        loadPendingPayments(); // Refresh list

    } catch (error) {
        console.error(error);
        showToast("Error approving payment", "error");
    }
}

// ❌ Reject Payment Logic
async function rejectPayment(txId) {
    if(!confirm("Are you sure you want to REJECT this payment?")) return;

    try {
        const txRef = doc(db, "transactions", txId);
        await updateDoc(txRef, { 
            status: 'rejected',
            processedAt: serverTimestamp()
        });

        showToast("Payment Rejected.", "info");
        loadPendingPayments(); // Refresh list

    } catch (error) {
        console.error(error);
        showToast("Error rejecting payment", "error");
    }
}
