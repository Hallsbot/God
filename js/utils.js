// UTILITY FUNCTIONS FOR RAOSTAR SHOP

// 1. Toast Notification (Pop-up alerts)
export function showToast(message, type = 'info') {
    // Check if a toast already exists to prevent stacking too many
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification`;
    toast.innerText = message;

    // Inline styles to ensure it works even if CSS fails partly
    toast.style.position = 'fixed';
    toast.style.bottom = '80px'; // Just above bottom nav
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '50px';
    toast.style.color = '#fff';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 4px 10px rgba(0,0,0,0.4)';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s ease';
    toast.style.minWidth = '200px';
    toast.style.textAlign = 'center';

    // Colors based on type
    if (type === 'success') toast.style.backgroundColor = '#10B981'; // Green
    else if (type === 'error') toast.style.backgroundColor = '#EF4444'; // Red
    else toast.style.backgroundColor = '#3B82F6'; // Blue

    document.body.appendChild(toast);

    // Show animation
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
    });

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 2. Format Currency to INR (e.g., ₹99)
export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// 3. Format Date from Firebase Timestamp
export function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    // Handle Firebase Timestamp or JS Date object
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleString('en-IN', {
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
    });
}

// 4. Upload Image to ImgBB API
export async function uploadImageToImgBB(file) {
    const apiKey = "a97182a927fb5cbaa7eb1a8a0c39033d"; // Your ImgBB API Key
    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            return data.data.url; // Return the hosted image URL
        } else {
            throw new Error(data.error ? data.error.message : "Image upload failed");
        }
    } catch (error) {
        console.error("ImgBB Error:", error);
        throw error;
    }
}

// 5. Random Number Generator (For Telegram Popup timing)
export function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}