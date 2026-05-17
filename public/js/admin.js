// public/js/admin.js - Global admin real-time features
let storeOpen = true;

async function toggleStoreStatus() {
    const btn = event.target.closest('.status-btn');
    if (!btn) return;
    
    event.preventDefault();
    
    const wasOpen = btn.classList.contains('btn-open');
    btn.textContent = '⏳ UPDATING...';
    btn.style.opacity = '0.7';
    
    try {
        const response = await fetch('/admin/toggle-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        storeOpen = data.storeOpen;
        
        if (data.storeOpen) {
            btn.className = 'status-btn btn-open';
            btn.textContent = '● OPEN';
        } else {
            btn.className = 'status-btn btn-closed';
            btn.textContent = '○ CLOSED';
        }
        
        // Update ALL status buttons on page
        document.querySelectorAll('.status-btn').forEach(b => {
            if (data.storeOpen) {
                b.className = 'status-btn btn-open';
                b.textContent = '● OPEN';
            } else {
                b.className = 'status-btn btn-closed';
                b.textContent = '○ CLOSED';
            }
        });
        
        console.log('✅ Store status:', data.storeOpen ? 'OPEN' : 'CLOSED');
        
    } catch (error) {
        console.error('Status update failed:', error);
        // Revert
        if (wasOpen) {
            btn.className = 'status-btn btn-open';
            btn.textContent = '● OPEN';
        } else {
            btn.className = 'status-btn btn-closed';
            btn.textContent = '○ CLOSED';
        }
    }
    
    btn.style.opacity = '1';
}

// Listen for clicks on ALL status buttons
document.addEventListener('click', function(e) {
    if (e.target.matches('.status-btn') || e.target.closest('.status-btn')) {
        toggleStoreStatus();
    }
});