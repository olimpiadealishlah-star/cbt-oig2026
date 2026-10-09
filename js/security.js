// js/security.js
// Modul anti-kecurangan berjalan di exam.html

(function() {
    let violationTimeout = null;
    let isReporting = false;

    // Debounce laporan pelanggaran
    async function reportViolation(jenis, detail) {
        if (isReporting) return;
        
        const token = window.cbtAuth ? window.cbtAuth.getToken() : null;
        if (!token) return;

        isReporting = true;
        try {
            const { data, error } = await supabaseClient.rpc('catat_pelanggaran', {
                p_token: token,
                p_jenis: jenis,
                p_detail: detail
            });
            
            if (data && data.success) {
                if (data.tindakan === 'kunci_akun') {
                    alert("Akun Anda telah dikunci karena terlalu banyak pelanggaran. Ujian akan diakhiri.");
                    // Memaksa submit jika perlu, atau sekadar logout
                    // Untuk saat ini logout karena server sudah mengunci
                    window.location.href = 'lobby.html'; 
                } else {
                    showWarningOverlay(`PELANGGARAN TERCATAT!\nAnda terdeteksi: ${detail}.\nIni adalah peringatan ke-${data.urutan_ke}.`);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            // Beri jeda 5 detik agar tidak spam pelanggaran
            setTimeout(() => { isReporting = false; }, 5000);
        }
    }

    function showWarningOverlay(msg) {
        let overlay = document.getElementById('violation-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'violation-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(231, 76, 60, 0.95); color: white;
                display: flex; align-items: center; justify-content: center; text-align: center;
                z-index: 999999; flex-direction: column; padding: 2rem;
            `;
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
            <h1 style="font-size: 3rem; margin-bottom: 1rem;">⚠️ PERINGATAN ⚠️</h1>
            <h2 style="font-size: 1.5rem; max-width: 800px; white-space: pre-line;">${msg}</h2>
            <p style="margin-top: 2rem;">Kembali fokus ke ujian. Layar ini akan hilang dalam 5 detik.</p>
        `;
        overlay.style.display = 'flex';
        
        // Coba kembali ke fullscreen
        window.requestFullscreenSafe(document.documentElement);

        setTimeout(() => {
            overlay.style.display = 'none';
        }, 5000);
    }

    // 1. Deteksi Fullscreen
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            reportViolation('KELUAR_FULLSCREEN', 'Keluar dari mode layar penuh');
        }
    });

    // 2. Deteksi Blur / Pindah Tab
    window.addEventListener('blur', () => {
        // Blur kadang terjadi pada input iframe, kita beri timeout sedikit
        violationTimeout = setTimeout(() => {
            reportViolation('PINDAH_TAB', 'Pindah tab atau meminimalkan jendela');
        }, 1000);
    });

    window.addEventListener('focus', () => {
        if (violationTimeout) clearTimeout(violationTimeout);
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            reportViolation('PINDAH_TAB', 'Tab ujian disembunyikan');
        }
    });

    // 3. Blokir Klik Kanan, Copy, Paste, Shortcut
    document.addEventListener('contextmenu', e => e.preventDefault());
    
    document.addEventListener('copy', e => {
        e.preventDefault();
        reportViolation('COPY_PASTE', 'Mencoba menyalin soal');
    });

    document.addEventListener('paste', e => e.preventDefault());
    document.addEventListener('cut', e => e.preventDefault());

    document.addEventListener('keydown', e => {
        // Blokir F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+P, Ctrl+S
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
            (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'P' || e.key === 'p' || e.key === 'S' || e.key === 's'))) {
            e.preventDefault();
            reportViolation('INSPECT_SHORTCUT', 'Mencoba membuka inspect element atau shortcut terlarang');
        }

        // Blokir PrintScreen
        if (e.key === 'PrintScreen') {
            navigator.clipboard.writeText('');
            e.preventDefault();
            reportViolation('SCREENSHOT', 'Mencoba mengambil tangkapan layar');
        }

        // Blokir Windows+Shift+S (Snipping Tool)
        if (e.shiftKey && e.metaKey && (e.key === 'S' || e.key === 's')) {
            e.preventDefault();
            reportViolation('SCREENSHOT', 'Mencoba mengambil tangkapan layar (Snipping Tool)');
        }
    });

    document.addEventListener('keyup', e => {
        if (e.key === 'PrintScreen') {
            navigator.clipboard.writeText('');
            reportViolation('SCREENSHOT', 'Mencoba mengambil tangkapan layar');
        }
    });

    // Mencegah drag gambar
    document.addEventListener('dragstart', e => {
        if(e.target.tagName.toLowerCase() === 'img') e.preventDefault();
    });

})();
