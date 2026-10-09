// js/exam.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = window.cbtAuth.getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    const btnStartFullscreen = document.getElementById('btn-start-fullscreen');
    if (btnStartFullscreen) {
        btnStartFullscreen.addEventListener('click', async () => {
            // Cek dukungan API Fullscreen (iPhone biasanya tidak mendukung ini sama sekali di documentElement)
            const isSupported = document.documentElement.requestFullscreen || 
                                document.documentElement.webkitRequestFullscreen || 
                                document.documentElement.msRequestFullscreen;

            if (isSupported) {
                const fsSuccess = await window.requestFullscreenSafe(document.documentElement);
                if (fsSuccess || window.self !== window.top) {
                    document.getElementById('start-overlay').style.display = 'none';
                } else {
                    // Jika API ada tapi eksekusi ditolak oleh browser
                    const lanjut = confirm("Browser gagal mengaktifkan layar penuh. Lanjutkan tanpa layar penuh?");
                    if (lanjut) document.getElementById('start-overlay').style.display = 'none';
                }
            } else {
                // Perangkat seperti iPhone/iOS Safari (Tidak ada API Fullscreen)
                document.getElementById('start-overlay').style.display = 'none';
            }
        });
    }

    let soalList = [];
    let jawabanMap = {}; // { soal_id: { jawaban: 'A', ragu: false } }
    let currentIndex = 0;
    let waktuSelesai = null;
    let timerInterval = null;
    let activeSaves = 0;
    let currentFontSize = 1.25; // default size in rem

    // Element Refs
    const elNo = document.getElementById('soal-aktif-no');
    const elTeks = document.getElementById('teks-soal');
    const elImg = document.getElementById('gambar-soal');
    const elOpsiContainer = document.getElementById('opsi-container');
    const gridContainer = document.getElementById('grid-container');
    const cbRagu = document.getElementById('cb-ragu');
    const statusSimpan = document.getElementById('status-simpan');
    const timerDisplay = document.getElementById('timer-display');
    const timerBox = document.getElementById('timer-box');

    // 1. Initial Load (Info + Soal)
    const { data: infoData } = await supabaseClient.rpc('peserta_info', { p_token: token });
    if (!infoData || !infoData.success) {
        window.cbtAuth.logout();
        return;
    }
    document.getElementById('peserta-nama').textContent = infoData.peserta.nama;
    document.getElementById('peserta-cabang').textContent = infoData.peserta.cabang;
    document.getElementById('watermark').textContent = infoData.peserta.nama + ' - ' + infoData.peserta.username;

    const { data: soalData } = await supabaseClient.rpc('ambil_soal', { p_token: token });
    if (!soalData || !soalData.success) {
        alert(soalData ? soalData.message : "Kesalahan server");
        window.location.href = 'lobby.html';
        return;
    }

    soalList = soalData.soal;
    jawabanMap = soalData.jawaban || {};
    waktuSelesai = new Date(soalData.waktu_selesai).getTime();

    // Pastikan jawabanMap ada semua key dan acak opsi
    const acakOpsi = infoData.config.acak_opsi !== false;
    
    soalList.forEach(s => {
        if (!jawabanMap[s.id]) jawabanMap[s.id] = { jawaban: null, ragu: false };
        
        let validKeys = ['a', 'b', 'c', 'd', 'e'].filter(k => s[`opsi_${k}`] || s[`gambar_opsi_${k}`]);
        if (validKeys.length === 0) validKeys = ['a', 'b', 'c', 'd', 'e'];
        
        if (acakOpsi) {
            let seed = 0;
            for (let i = 0; i < s.id.length; i++) seed += s.id.charCodeAt(i);
            
            let random = () => {
                let x = Math.sin(seed++) * 10000;
                return x - Math.floor(x);
            };
            
            for (let i = validKeys.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [validKeys[i], validKeys[j]] = [validKeys[j], validKeys[i]];
            }
        }
        s.opsiMap = validKeys;
    });

    renderGrid();
    loadSoal(0);
    startTimer();
    startHeartbeat();

    // 2. Render Grid
    function renderGrid() {
        gridContainer.innerHTML = '';
        soalList.forEach((s, idx) => {
            const btn = document.createElement('button');
            btn.className = 'btn-grid';
            btn.textContent = idx + 1;
            btn.onclick = () => loadSoal(idx);
            
            const jwbn = jawabanMap[s.id];
            if (jwbn.jawaban) btn.classList.add('dijawab');
            if (jwbn.ragu) btn.classList.add('ragu');
            if (idx === currentIndex) btn.classList.add('active');
            
            gridContainer.appendChild(btn);
        });
    }

    function updateGridStyle() {
        const btns = gridContainer.children;
        for (let i = 0; i < btns.length; i++) {
            const s = soalList[i];
            const jwbn = jawabanMap[s.id];
            btns[i].className = 'btn-grid';
            if (jwbn.jawaban) btns[i].classList.add('dijawab');
            if (jwbn.ragu) btns[i].classList.add('ragu');
            if (i === currentIndex) btns[i].classList.add('active');
        }
    }

    // 3. Render Soal
    function loadSoal(index) {
        if (index < 0 || index >= soalList.length) return;
        currentIndex = index;
        const soal = soalList[index];
        const jwbn = jawabanMap[soal.id];

        elNo.textContent = index + 1;
        elTeks.innerHTML = soal.teks_soal;
        elTeks.style.fontSize = currentFontSize + 'rem';
        
        if (soal.gambar_soal) {
            elImg.src = soal.gambar_soal;
            elImg.style.display = 'block';
        } else {
            elImg.style.display = 'none';
        }

        // Render Opsi A-E
        elOpsiContainer.innerHTML = '';
        const uiLabels = ['a', 'b', 'c', 'd', 'e'];
        const opsiKeys = soal.opsiMap || ['a', 'b', 'c', 'd', 'e'];
        
        opsiKeys.forEach((originalK, idx) => {
            if (idx >= uiLabels.length) return;
            const uiLabel = uiLabels[idx].toUpperCase();
            const originalKLabel = originalK.toUpperCase();
            const textVal = soal[`opsi_${originalK}`];
            const imgVal = soal[`gambar_opsi_${originalK}`];
            
            if (textVal || imgVal) {
                const optDiv = document.createElement('div');
                optDiv.className = 'opsi-item';
                if (jwbn.jawaban === originalKLabel) optDiv.classList.add('selected');
                
                let contentHtml = `<div class="opsi-text" style="font-size: ${currentFontSize - 0.15}rem;">${textVal || ''}</div>`;
                if (imgVal) contentHtml += `<img src="${imgVal}" class="opsi-img" onclick="event.stopPropagation(); window.openZoom(this.src);">`;

                optDiv.innerHTML = `<div class="opsi-label">${uiLabel}</div>${contentHtml}`;
                
                optDiv.onclick = () => selectJawaban(originalKLabel);
                elOpsiContainer.appendChild(optDiv);
            }
        });

        cbRagu.checked = jwbn.ragu || false;
        updateGridStyle();

        // Scroll to top of question area
        document.querySelector('.soal-area').scrollTop = 0;

        // Render KaTeX for current question area
        try {
            renderMathInElement(document.getElementById('soal-container'), {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ]
            });
        } catch(e) { console.error("KaTeX Error", e); }
    }

    function selectJawaban(huruf) {
        const soalId = soalList[currentIndex].id;
        if (jawabanMap[soalId].jawaban === huruf) {
            jawabanMap[soalId].jawaban = null; // Unselect if clicked again
        } else {
            jawabanMap[soalId].jawaban = huruf;
            if(!cbRagu.checked) jawabanMap[soalId].ragu = false;
        }
        
        loadSoal(currentIndex);
        scheduleSimpan();
    }

    cbRagu.addEventListener('change', () => {
        const soalId = soalList[currentIndex].id;
        jawabanMap[soalId].ragu = cbRagu.checked;
        updateGridStyle();
        scheduleSimpan();
    });

    document.getElementById('btn-prev').addEventListener('click', () => loadSoal(currentIndex - 1));
    document.getElementById('btn-next').addEventListener('click', () => {
        if(currentIndex < soalList.length - 1) loadSoal(currentIndex + 1);
    });

    // 4. Autosave (Tanpa Debounce agar data tidak hilang)
    async function scheduleSimpan(soalIdOverride = null) {
        statusSimpan.textContent = 'Menyimpan...';
        statusSimpan.style.color = 'var(--text-light)';
        
        const currentSoalId = soalIdOverride || soalList[currentIndex].id;
        const currentJ = Object.assign({}, jawabanMap[currentSoalId]);

        activeSaves++;

        const { error } = await supabaseClient.rpc('simpan_jawaban', {
            p_token: token,
            p_soal_id: currentSoalId,
            p_jawaban: currentJ.jawaban,
            p_ragu: currentJ.ragu
        });
        
        activeSaves--;
        if (activeSaves === 0) {
            if (!error) {
                statusSimpan.textContent = '✔Tersimpan';
                statusSimpan.style.color = 'var(--success)';
            } else {
                statusSimpan.textContent = '✖Gagal menyimpan! Cek koneksi.';
                statusSimpan.style.color = 'var(--danger)';
            }
        }
    }

    // 5. Timer
    function startTimer() {
        timerInterval = setInterval(() => {
            const now = new Date().getTime();
            let distance = waktuSelesai - now;

            if (distance < 0) {
                clearInterval(timerInterval);
                timerDisplay.textContent = "00:00:00";
                forceSubmitUjian();
                return;
            }

            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            timerDisplay.textContent = 
                (hours < 10 ? "0" + hours : hours) + ":" + 
                (minutes < 10 ? "0" + minutes : minutes) + ":" + 
                (seconds < 10 ? "0" + seconds : seconds);
            
            if (distance < 5 * 60 * 1000) { 
                timerBox.classList.add('warning');
            }
        }, 1000);
    }

    // 6. Heartbeat (30s)
    function startHeartbeat() {
        setInterval(async () => {
            const { data } = await supabaseClient.rpc('heartbeat', { p_token: token });
            if (data && data.waktu_habis) forceSubmitUjian();
            if (data && data.status === 'terkunci') {
                alert("Akun Anda telah dikunci oleh pengawas.");
                window.location.href = 'lobby.html';
            }
        }, 30000);
    }

    // 7. Submit
    const modalSubmit = document.getElementById('modal-submit');
    const msgSubmit = document.getElementById('msg-submit');
    
    document.getElementById('btn-submit-ujian').addEventListener('click', () => {
        let blmJawab = 0;
        let ragu = 0;
        soalList.forEach(s => {
            if (!jawabanMap[s.id].jawaban) blmJawab++;
            if (jawabanMap[s.id].ragu) ragu++;
        });

        let msg = "Apakah Anda yakin ingin menyelesaikan ujian?";
        if (blmJawab > 0) msg += `\n\nMasih ada ${blmJawab} soal yang belum dijawab.`;
        if (ragu > 0) msg += `\nAda ${ragu} soal yang masih ditandai Ragu-ragu.`;
        
        msgSubmit.innerText = msg;
        modalSubmit.classList.add('active');
    });

    document.getElementById('btn-batal-submit').addEventListener('click', () => {
        modalSubmit.classList.remove('active');
    });

    document.getElementById('btn-konfirm-submit').addEventListener('click', async () => {
        await submitProses();
    });

    let isSubmitting = false;
    async function forceSubmitUjian() {
        if(isSubmitting) return;
        alert("Waktu habis! Jawaban Anda akan disubmit otomatis.");
        await submitProses();
    }

    async function submitProses() {
        if(isSubmitting) return;
        isSubmitting = true;
        document.getElementById('btn-konfirm-submit').disabled = true;
        document.getElementById('btn-konfirm-submit').textContent = 'Menyimpan sisa jawaban...';
        
        // Tunggu hingga semua save asinkronus selesai
        while(activeSaves > 0) {
            await new Promise(r => setTimeout(r, 200));
        }

        document.getElementById('btn-konfirm-submit').textContent = 'Memproses...';
        
        const { error } = await supabaseClient.rpc('submit_ujian', { p_token: token });
        if (error) {
            alert("Terjadi kesalahan saat submit: " + error.message);
            document.getElementById('btn-konfirm-submit').disabled = false;
            isSubmitting = false;
        } else {
            window.cbtAuth.logout(); // hapus token local
            window.location.href = 'selesai.html';
        }
    }

    // 8. Pengaturan Ukuran Font
    const fontStep = 0.15;
    const maxFont = 2.0;
    const minFont = 0.8;

    document.getElementById('btn-font-inc').addEventListener('click', () => {
        if (currentFontSize < maxFont) {
            currentFontSize += fontStep;
            document.getElementById('teks-soal').style.fontSize = currentFontSize + 'rem';
            document.querySelectorAll('.opsi-text').forEach(el => el.style.fontSize = (currentFontSize - 0.15) + 'rem');
        }
    });

    document.getElementById('btn-font-dec').addEventListener('click', () => {
        if (currentFontSize > minFont) {
            currentFontSize -= fontStep;
            document.getElementById('teks-soal').style.fontSize = currentFontSize + 'rem';
            document.querySelectorAll('.opsi-text').forEach(el => el.style.fontSize = (currentFontSize - 0.15) + 'rem');
        }
    });

    // 9. Modal Zoom Gambar
    const modalZoom = document.getElementById('modal-zoom');
    const zoomedImg = document.getElementById('zoomed-img');
    const closeZoomBtn = document.getElementById('close-zoom');

    window.openZoom = function(src) {
        if (!src) return;
        zoomedImg.src = src;
        modalZoom.classList.add('active');
    };

    closeZoomBtn.addEventListener('click', () => {
        modalZoom.classList.remove('active');
    });
    modalZoom.addEventListener('click', (e) => {
        if (e.target === modalZoom) {
            modalZoom.classList.remove('active');
        }
    });

    elImg.addEventListener('click', () => window.openZoom(elImg.src));
});
