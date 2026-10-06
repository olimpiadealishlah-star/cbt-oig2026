// js/iframe-guard.js

(function() {
    // 1. Cek Soft Domain Restriction
    function checkOrigin() {
        if (window.self !== window.top) {
            // Kita berada di dalam iframe
            let allowed = false;
            
            // Cek menggunakan ancestorOrigins jika didukung (Chrome/Edge)
            if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
                const parentOrigin = window.location.ancestorOrigins[0];
                allowed = CONFIG.ALLOWED_PARENT_ORIGINS.some(origin => parentOrigin.startsWith(origin));
            } 
            // Fallback menggunakan document.referrer
            else if (document.referrer) {
                try {
                    const refUrl = new URL(document.referrer);
                    allowed = CONFIG.ALLOWED_PARENT_ORIGINS.some(origin => refUrl.origin === origin);
                } catch(e) {}
            } else {
                // Tidak bisa mendeteksi asal (Safari/Privacy settings)
                // Kita asumsikan true tapi sarankan tab penuh
                allowed = true; 
            }

            if (!allowed && !CONFIG.DEBUG) {
                document.body.innerHTML = `
                    <div style="padding: 2rem; text-align: center; font-family: sans-serif;">
                        <h2>Akses Ditolak</h2>
                        <p>Akses ujian hanya diperbolehkan melalui website resmi sekolah.</p>
                        <a href="${window.location.href}" target="_blank" style="padding: 10px 20px; background: #0F5A3E; color: white; text-decoration: none; border-radius: 5px;">Buka di Tab Baru (Jika Anda merasa ini salah)</a>
                    </div>
                `;
                throw new Error("Akses iframe dari origin tidak diizinkan.");
            }
        }
    }

    // 2. Fungsi Fullscreen untuk iFrame
    window.requestFullscreenSafe = async function(element) {
        try {
            if (element.requestFullscreen) {
                await element.requestFullscreen();
                return true;
            } else if (element.webkitRequestFullscreen) { /* Safari */
                await element.webkitRequestFullscreen();
                return true;
            } else if (element.msRequestFullscreen) { /* IE11 */
                await element.msRequestFullscreen();
                return true;
            }
        } catch (e) {
            console.warn("Fullscreen ditolak oleh browser/iframe:", e);
        }
        return false;
    }

    document.addEventListener('DOMContentLoaded', checkOrigin);
})();
