// js/exam.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = window.cbtAuth.getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    let soalList = [];
    let jawabanMap = {}; // { soal_id: { jawaban: 'A', ragu: false } }
    let currentIndex = 0;
    let waktuSelesai = null;
    let timerInterval = null;
    let saveTimeout = null;

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

    // Pastikan jawabanMap ada semua key
    soalList.forEach(s => {
        if (!jawabanMap[s.id]) jawabanMap[s.id] = { jawaban: null, ragu: false };
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
        
        if (soal.gambar_soal) {
            elImg.src = soal.gambar_soal;
            elImg.style.display = 'block';
        } else {
            elImg.style.display = 'none';
        }

        // Render Opsi A-E
        elOpsiContainer.innerHTML = '';
        const opsiKeys = ['a', 'b', 'c', 'd', 'e'];
        opsiKeys.forEach(k => {
            const keyLabel = k.toUpperCase();
            const textVal = soal[`opsi_${k}`];
            const imgVal = soal[`gambar_opsi_${k}`];
            
            if (textVal || imgVal) {
                const optDiv = document.createElement('div');
                optDiv.className = 'opsi-item';
                if (jwbn.jawaban === keyLabel) optDiv.classList.add('selected');
                
                let contentHtml = `<div class="opsi-text">${textVal || ''}</div>`;
                if (imgVal) contentHtml += `<img src="${imgVal}" class="opsi-img">`;

                optDiv.innerHTML = `<div class="opsi-label">${keyLabel}</div>${contentHtml}`;
                
                optDiv.onclick = () => selectJawaban(keyLabel);
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

    // 4. Autosave (Debounce)
    function scheduleSimpan() {
        statusSimpan.textContent = 'Menyimpan...';
        statusSimpan.style.color = 'var(--text-light)';
        if (saveTimeout) clearTimeout(saveTimeout);
        
        const currentSoalId = soalList[currentIndex].id;
        const currentJ = jawabanMap[currentSoalId];

        // Exponential backoff logic omitted for brevity, basic debounce used
        saveTimeout = setTimeout(async () => {
            const { error } = await supabaseClient.rpc('simpan_jawaban', {
                p_token: token,
                p_soal_id: currentSoalId,
                p_jawaban: currentJ.jawaban,
                p_ragu: currentJ.ragu
            });
            if (!error) {
                statusSimpan.textContent = '✔Tersimpan';
                statusSimpan.style.color = 'var(--success)';
            } else {
                statusSimpan.textContent = '✖Gagal menyimpan! Cek koneksi.';
                statusSimpan.style.color = 'var(--danger)';
            }
        }, 1500); // 1.5s debounce
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
});
