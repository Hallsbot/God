import { db, auth } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, doc, getDoc, onSnapshot, serverTimestamp, runTransaction 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { showToast, formatCurrency, formatDate, uploadImageToImgBB, randomBetween } from './utils.js';
import { runAutoSetup } from './auto-setup.js';

// 1. Initialize System
runAutoSetup();

// Current Page Detection
const path = window.location.pathname;
const page = path.substring(path.lastIndexOf('/') + 1);

let currentUser = null;
let pendingPurchaseData = null; // Store product info while modal is open

// ==========================================
// 🔐 AUTH OBSERVER & PAGE ROUTING
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("Logged in as:", user.email);
        
        // Load specific page data
        if (page === 'home.html' || page === '' || page === 'index.html') {
            await loadHome();
        }
        if (page === 'wallet.html') {
            await loadWallet();
        }
        if (page === 'about.html') {
            await loadProfile();
        }
        
        initTelegramPopup();
    } else {
        const protectedPages = ['home.html', 'wallet.html', 'about.html'];
        if (protectedPages.includes(page)) {
            window.location.href = 'auth.html';
        }
    }
});

// ==========================================
// 🏠 HOME PAGE (SHOP & BANNERS)
// ==========================================
async function loadHome() {
    loadBanners();
    loadProducts();
    initPurchaseModalEvents();
}

async function loadBanners() {
    const bannerWrapper = document.getElementById('banner-wrapper');
    if (!bannerWrapper) return;

    // Fast Load: Show Permanent Banner Immediately
    bannerWrapper.innerHTML = `
        <div class="swiper-slide active" id="perm-slide">
            <a href="https://idmarket.unaux.com/?i=1" target="_blank">
                <img src="permanent-banner.jpg" class="banner-img" alt="Offer" onerror="this.src='https://placehold.co/1200x400?text=Welcome+to+Raostar'">
            </a>
        </div>
    `;

    try {
        const q = query(collection(db, "banners"), where("enabled", "==", true));
        const snapshot = await getDocs(q);
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.imageUrl !== 'permanent-banner.jpg') {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.innerHTML = `<a href="${data.link || '#'}" target="_blank">
                    <img src="${data.imageUrl}" class="banner-img">
                </a>`;
                bannerWrapper.appendChild(slide);
            }
        });

        if (snapshot.size > 0) startBannerSlider();
    } catch (e) {
        console.warn("Banners load failed, default showing.");
    }
}

function startBannerSlider() {
    const slides = document.querySelectorAll('.swiper-slide');
    if (slides.length <= 1) return;
    let current = 0;
    setInterval(() => {
        slides[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
    }, 5000);
}

async function loadProducts() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="loader"></div>';

    try {
        const q = query(collection(db, "plans"), where("enabled", "==", true));
        const snapshot = await getDocs(q);
        grid.innerHTML = '';

        if (snapshot.empty) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#94a3b8;">No glory packs available right now.</div>';
            return;
        }

        // Sort in JS to avoid Index Requirement
        const plans = snapshot.docs.map(d => ({id: d.id, ...d.data()}))
                      .sort((a, b) => a.price - b.price);

        plans.forEach((p) => {
            const card = document.createElement('div');
            card.className = 'card product-card';
            card.innerHTML = `
                ${p.isHot ? '<span class="badge-hot">HOT</span>' : ''}
                <h3>${p.title}</h3>
                <div class="glory-text">${p.glory}</div>
                <div class="features">
                    ${p.features ? p.features.map(f => `<span>✓ ${f}</span>`).join('') : ''}
                </div>
                <div class="price-row">
                    <span class="price">${formatCurrency(p.price)}</span>
                    <button class="btn btn-primary buy-btn" data-id="${p.id}" data-price="${p.price}" data-title="${p.title}">BUY</button>
                </div>
            `;
            grid.appendChild(card);
        });

        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.onclick = (e) => handleBuyButtonClick(e.currentTarget.dataset);
        });

    } catch (error) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center;">Failed to connect to shop database.</div>';
    }
}

// 🛒 Buy Button Action
async function handleBuyButtonClick(data) {
    const price = parseInt(data.price);
    
    try {
        // Step 1: Check balance
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        const currentBalance = userSnap.data().walletBalance || 0;

        if (currentBalance < price) {
            return showToast(`Insufficient Balance! You need ${formatCurrency(price)}.`, "error");
        }

        // Step 2: Prepare the Modal
        pendingPurchaseData = data;
        document.getElementById('modal-plan-name').innerText = "Buy " + data.title;
        
        // Load servers from global settings
        const dropdown = document.getElementById('user-server');
        dropdown.innerHTML = '<option value="" disabled selected>-- Select Server --</option>';
        
        const settingsSnap = await getDoc(doc(db, "settings", "app"));
        if (settingsSnap.exists() && settingsSnap.data().availableServers) {
            settingsSnap.data().availableServers.forEach(srv => {
                dropdown.innerHTML += `<option value="${srv}">${srv}</option>`;
            });
        } else {
            dropdown.innerHTML += `<option value="India">India</option>`;
        }

        // Show Modal
        document.getElementById('purchase-modal').style.display = 'flex';

    } catch (e) { showToast("Error preparing order.", "error"); }
}

function initPurchaseModalEvents() {
    const modal = document.getElementById('purchase-modal');
    const closeBtn = document.getElementById('close-purchase-modal');
    const form = document.getElementById('purchase-details-form');

    if (!modal) return;

    closeBtn.onclick = () => { modal.style.display = 'none'; };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const server = document.getElementById('user-server').value;
        const guildId = document.getElementById('user-guild-id').value;
        const confirmBtn = document.getElementById('confirm-purchase-btn');

        confirmBtn.innerText = "Processing...";
        confirmBtn.disabled = true;

        try {
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, "users", currentUser.uid);
                const userDoc = await transaction.get(userRef);
                const balance = userDoc.data().walletBalance || 0;

                if (balance < pendingPurchaseData.price) throw "Insufficient funds!";

                // Deduct Balance
                transaction.update(userRef, { 
                    walletBalance: balance - parseInt(pendingPurchaseData.price),
                    updatedAt: serverTimestamp() 
                });

                // Record Purchase
                const txRef = doc(collection(db, "transactions"));
                transaction.set(txRef, {
                    userId: currentUser.uid,
                    userName: userDoc.data().name,
                    userEmail: userDoc.data().email,
                    type: 'purchase',
                    amount: parseInt(pendingPurchaseData.price),
                    planTitle: pendingPurchaseData.title,
                    serverId: server,
                    guildId: guildId,
                    status: 'pending', // Waiting for Admin to deliver
                    createdAt: serverTimestamp()
                });
            });

            showToast("Order Placed Successfully! 🚀", "success");
            modal.style.display = 'none';
            form.reset();
        } catch (err) {
            showToast("Transaction Error: " + err, "error");
        } finally {
            confirmBtn.innerText = "Confirm & Buy";
            confirmBtn.disabled = false;
        }
    };
}

// ==========================================
// 💰 WALLET & ADD MONEY (FIXED & TESTED)
// ==========================================
async function loadWallet() {
    const balanceEl = document.getElementById('wallet-balance');
    const historyBox = document.getElementById('transaction-history');
    const addMoneyBtn = document.getElementById('add-money-btn');
    const modal = document.getElementById('add-money-modal');
    const closeModal = document.getElementById('close-modal');
    const submitBtn = document.getElementById('submit-add-money');

    if (!balanceEl) return;

    // Real-time Balance
    onSnapshot(doc(db, "users", currentUser.uid), (d) => {
        if (d.exists()) balanceEl.innerText = formatCurrency(d.data().walletBalance || 0);
    });

    // History (Real-time + JS Sort)
    const q = query(collection(db, "transactions"), where("userId", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        historyBox.innerHTML = '';
        if (snapshot.empty) {
            historyBox.innerHTML = '<div style="text-align:center; padding:30px; color:gray;">No transactions yet.</div>';
            return;
        }

        const txs = snapshot.docs.map(d => d.data())
                    .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        txs.forEach(t => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            const isAdd = t.type === 'add_money';
            let statusColor = t.status === 'approved' ? '#10b981' : (t.status === 'rejected' ? '#ef4444' : '#f59e0b');
            
            item.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:700;">${isAdd ? 'Wallet Recharge' : t.planTitle}</div>
                    <small style="color:#64748b;">${formatDate(t.createdAt)}</small><br>
                    <span style="color:${statusColor}; font-size:0.65rem; font-weight:bold; text-transform:uppercase;">${t.status}</span>
                </div>
                <div style="font-weight:900; color:${isAdd ? '#10B981':'#EF4444'}">
                    ${isAdd ? '+':'-'}${formatCurrency(t.amount)}
                </div>
            `;
            historyBox.appendChild(item);
        });
    });

    // Add Money Modal Logic
    addMoneyBtn.onclick = async () => {
        modal.style.display = 'flex';
        const qrImg = document.getElementById('qr-display');
        try {
            const s = await getDoc(doc(db, "settings", "app"));
            if (s.exists()) qrImg.src = s.data().qrCodeUrl || 'qr.jpg';
        } catch (e) { qrImg.src = 'qr.jpg'; }
    };

    closeModal.onclick = () => { modal.style.display = 'none'; };

    // 🔥 THE FIX: SUBMIT ADD MONEY REQUEST
    submitBtn.onclick = async () => {
        const amtInput = document.getElementById('amount-input');
        const fileInput = document.getElementById('payment-proof');
        const amount = parseInt(amtInput.value);
        const file = fileInput.files[0];

        if (!amount || amount < 1) return showToast("Please enter a valid amount.", "error");
        if (!file) return showToast("Please upload payment screenshot.", "error");

        submitBtn.innerText = "Uploading...";
        submitBtn.disabled = true;

        try {
            // 1. Get current user data for the request
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);
            const userName = userSnap.data().name || "Customer";

            // 2. Upload to ImgBB
            const proofUrl = await uploadImageToImgBB(file);

            // 3. Save Transaction to Firestore
            await addDoc(collection(db, "transactions"), {
                userId: currentUser.uid,
                userName: userName,
                type: 'add_money',
                amount: amount,
                proofUrl: proofUrl,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            showToast("Request sent! Approval takes 5-30 mins.", "success");
            modal.style.display = 'none';
            amtInput.value = '';
            fileInput.value = '';
        } catch (err) {
            console.error("Add Money Error:", err);
            showToast("Failed to send request. Try again.", "error");
        } finally {
            submitBtn.innerText = "Submit Request";
            submitBtn.disabled = false;
        }
    };
}

// ==========================================
// 👤 PROFILE & UTILS
// ==========================================
async function loadProfile() {
    const pName = document.getElementById('profile-name');
    const pEmail = document.getElementById('profile-email');
    const pJoin = document.getElementById('join-date');
    if (!pName) return;

    pName.innerText = currentUser.displayName || "Raostar User";
    pEmail.innerText = currentUser.email;

    const snap = await getDoc(doc(db, "users", currentUser.uid));
    if (snap.exists()) pJoin.innerText = "Joined: " + formatDate(snap.data().createdAt);
}

function initTelegramPopup() {
    if (sessionStorage.getItem('tg_popup')) return;
    setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'modal-overlay';
        p.style.display = 'flex';
        p.innerHTML = `
            <div class="modal-content">
                <div style="width:70px; margin:0 auto 15px; fill:#3B82F6;">
                    <svg viewBox="0 0 640 640"><path d="M320 72C183 72 72 183 72 320C72 457 183 568 320 568C457 568 568 457 568 320C568 183 457 72 320 72zM435 240.7C431.3 279.9 415.1 375.1 406.9 419C403.4 437.6 396.6 443.8 390 444.4C375.6 445.7 364.7 434.9 350.7 425.7C328.9 411.4 316.5 402.5 295.4 388.5C270.9 372.4 286.8 363.5 300.7 349C304.4 345.2 367.8 287.5 369 282.3C369.2 281.6 369.3 279.2 367.8 277.9C366.3 276.6 364.2 277.1 362.7 277.4C360.5 277.9 325.6 300.9 258.1 346.5C248.2 353.3 239.2 356.6 231.2 356.4C222.3 356.2 205.3 351.4 192.6 347.3C177.1 342.3 164.7 339.6 165.8 331C166.4 326.5 172.5 322 184.2 317.3C256.5 285.8 304.7 265 328.8 255C397.7 226.4 412 221.4 421.3 221.2C423.4 221.2 427.9 221.7 430.9 224.1C432.9 225.8 434.1 228.2 434.4 230.8C434.9 234 435 237.3 434.8 240.6z"/></svg>
                </div>
                <h3>Join Official Telegram</h3>
                <p style="margin-bottom:15px; font-size:0.85rem; color:#94a3b8;">Get the latest updates and exclusive glory offers!</p>
                <a href="https://t.me/raostarrr" target="_blank" class="btn btn-blue" style="margin-bottom:10px;">Join Channel</a>
                <button id="close-tg" class="btn" style="background:transparent; color:gray; font-size:0.75rem;">Already Joined</button>
            </div>
        `;
        document.body.appendChild(p);
        document.getElementById('close-tg').onclick = () => {
            p.remove();
            sessionStorage.setItem('tg_popup', 'true');
        };
    }, 25000);
}