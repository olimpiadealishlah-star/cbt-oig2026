document.addEventListener('DOMContentLoaded', () => {
    // Navigasi View
    const navLinks = document.querySelectorAll('.nav-link[data-view]');
    const views = document.querySelectorAll('.view-section');

    function switchView(viewId) {
        views.forEach(v => v.style.display = 'none');
        navLinks.forEach(l => l.classList.remove('active'));
        
        const targetView = document.getElementById(`view-${viewId}`);
        const targetLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
        
        if (targetView && targetLink) {
            targetView.style.display = 'block';
            targetLink.classList.add('active');
            window.location.hash = viewId;
            loadViewData(viewId);
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(link.dataset.view);
        });
    });

    // Inisialisasi View
    const initialView = window.location.hash ? window.location.hash.substring(1) : 'dashboard';
    switchView(initialView);

    // ==========================================
    // MODULE: DASHBOARD
    // ==========================================
    async function loadDashboard() {
        // Ambil rekap data. Bisa dengan query sederhana
        try {
            const { count: totalPeserta } = await supabaseClient.from('peserta').select('*', { count: 'exact', head: true });
            const { count: mengerjakan } = await supabaseClient.from('peserta').select('*', { count: 'exact', head: true }).eq('status', 'mengerjakan');
            const { count: selesai } = await supabaseClient.from('peserta').select('*', { count: 'exact', head: true }).eq('status', 'selesai');
            const { count: pelanggaran } = await supabaseClient.from('pelanggaran').select('*', { count: 'exact', head: true });

            document.getElementById('dash-total-peserta').textContent = totalPeserta || 0;
            document.getElementById('dash-mengerjakan').textContent = mengerjakan || 0;
            document.getElementById('dash-selesai').textContent = selesai || 0;
            document.getElementById('dash-pelanggaran').textContent = pelanggaran || 0;
        } catch (e) {
            console.error(e);
        }
    }
    document.getElementById('btn-refresh-dashboard').addEventListener('click', loadDashboard);

    // ==========================================
    // MODULE: PENGATURAN
    // ==========================================
    async function loadPengaturan() {
        const { data, error } = await supabaseClient.from('config').select('value').eq('key', 'app_config').single();
        if (data && data.value) {
            const config = data.value;
            document.getElementById('cfg_nama_event').value = config.nama_event || '';
            document.getElementById('cfg_batas_pelanggaran').value = config.batas_pelanggaran || 3;
            document.getElementById('cfg_acak_soal').checked = config.acak_soal ?? true;
            document.getElementById('cfg_acak_opsi').checked = config.acak_opsi ?? true;
            document.getElementById('cfg_scoreboard').checked = config.scoreboard_publik ?? true;
            
            if (config.durasi) {
                document.getElementById('cfg_dur_mat').value = config.durasi['Matematika'] || 120;
                document.getElementById('cfg_dur_pai').value = config.durasi['PAI'] || 90;
                document.getElementById('cfg_dur_ipa').value = config.durasi['IPA'] || 120;
                document.getElementById('cfg_dur_ing').value = config.durasi['Bahasa Inggris'] || 90;
            }
        }
    }

    document.getElementById('form-pengaturan').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Retrieve existing first to keep `skor` settings
        const { data: existing } = await supabaseClient.from('config').select('value').eq('key', 'app_config').single();
        const existingConfig = existing ? existing.value : {};

        const newConfig = {
            ...existingConfig,
            nama_event: document.getElementById('cfg_nama_event').value,
            batas_pelanggaran: parseInt(document.getElementById('cfg_batas_pelanggaran').value),
            acak_soal: document.getElementById('cfg_acak_soal').checked,
            acak_opsi: document.getElementById('cfg_acak_opsi').checked,
            scoreboard_publik: document.getElementById('cfg_scoreboard').checked,
            durasi: {
                'Matematika': parseInt(document.getElementById('cfg_dur_mat').value),
                'PAI': parseInt(document.getElementById('cfg_dur_pai').value),
                'IPA': parseInt(document.getElementById('cfg_dur_ipa').value),
                'Bahasa Inggris': parseInt(document.getElementById('cfg_dur_ing').value)
            }
        };

        const { error } = await supabaseClient.from('config').upsert({ key: 'app_config', value: newConfig });
        if (error) alert("Gagal menyimpan pengaturan: " + error.message);
        else alert("Pengaturan berhasil disimpan.");
    });

    // ==========================================
    // MODULE: PESERTA
    // ==========================================
    async function loadPeserta() {
        const cabang = document.getElementById('filter-cabang-peserta').value;
        let query = supabaseClient.from('peserta').select('id, nama, username, cabang, asal_sekolah, status').order('nama');
        if (cabang) query = query.eq('cabang', cabang);
        
        const { data, error } = await query;
        const tbody = document.querySelector('#table-peserta tbody');
        tbody.innerHTML = '';
        if (data) {
            data.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.nama}</td>
                    <td>${p.username}</td>
                    <td>${p.cabang}</td>
                    <td>${p.asal_sekolah}</td>
                    <td>${p.status}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="resetSesi('${p.id}')">Reset Sesi</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
    document.getElementById('btn-load-peserta').addEventListener('click', loadPeserta);

    window.resetSesi = async (id) => {
        if (confirm("Reset sesi akan menghapus token dan membolehkan peserta login ulang tanpa menghapus jawaban tersimpan. Lanjutkan?")) {
            await supabaseClient.from('peserta').update({ session_token: null, status: 'belum' }).eq('id', id);
            loadPeserta();
        }
    }

    // Import Peserta
    document.getElementById('file-import-peserta').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                // Convert all keys to lowercase to avoid case-sensitivity issues from CSV headers
                const json = rawJson.map(row => {
                    let lowerRow = {};
                    for (let key in row) {
                        lowerRow[key.toLowerCase().trim()] = row[key];
                    }
                    return lowerRow;
                });
                
                // Panggil RPC batch import
                // Chunk per 50 to avoid payload limits
                let successCount = 0;
                let errorMessages = [];
                for (let i = 0; i < json.length; i += 50) {
                    const chunk = json.slice(i, i + 50);
                    const { data: rpcData, error } = await supabaseClient.rpc('admin_import_peserta', { p_rows: chunk });
                    if (error) throw error;
                    if (rpcData.success && rpcData.results) {
                        const successItems = rpcData.results.filter(r => r.status === 'ok');
                        successCount += successItems.length;
                        const errs = rpcData.results.filter(r => r.status === 'error');
                        if (errs.length > 0) {
                            errorMessages.push(errs[0].message);
                            console.error(errs);
                        }
                    }
                }
                
                if (errorMessages.length > 0) {
                    alert(`Import berhasil: ${successCount} peserta dimasukkan.\nNamun ada gagal: ${errorMessages[0]}`);
                } else {
                    alert(`Import berhasil: ${successCount} peserta dimasukkan.`);
                }
                loadPeserta();
            } catch (err) {
                console.error(err);
                alert("Terjadi kesalahan import: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // ==========================================
    // MODULE: SOAL
    // ==========================================
    let currentSoalId = null;

    async function loadSoal() {
        const cabang = document.getElementById('filter-cabang-soal').value;
        const { data, error } = await supabaseClient
            .from('soal')
            .select('id, no, teks_soal, opsi_a, opsi_b, opsi_c, opsi_d, kunci_soal(kunci)')
            .eq('cabang', cabang)
            .order('no');
            
        const tbody = document.getElementById('tbody-soal');
        tbody.innerHTML = '';
        if (data) {
            data.forEach(s => {
                const kunci = s.kunci_soal ? s.kunci_soal.kunci : '?';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${s.no}</td>
                    <td class="latex-render">${s.teks_soal.substring(0, 50)}...</td>
                    <td class="latex-render">${s.opsi_a}</td>
                    <td class="latex-render">${s.opsi_b}</td>
                    <td class="latex-render">${s.opsi_c}</td>
                    <td class="latex-render">${s.opsi_d}</td>
                    <td><strong>${kunci}</strong></td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="editSoal('${s.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="hapusSoal('${s.id}')">Hapus</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            renderMathInElement(tbody, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}] });
        }
    }
    document.getElementById('btn-load-soal').addEventListener('click', loadSoal);

    // Import Soal
    document.getElementById('file-import-soal').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                let successCount = 0;
                for (let i = 0; i < json.length; i += 20) {
                    const chunk = json.slice(i, i + 20);
                    const { data: rpcData, error } = await supabaseClient.rpc('admin_import_soal', { p_rows: chunk });
                    if (error) throw error;
                    if (rpcData.success) successCount += chunk.length;
                }
                alert(`Import berhasil: ${successCount} soal dimasukkan.`);
                loadSoal();
            } catch (err) {
                console.error(err);
                alert("Kesalahan import: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // Form Soal
    const formSoalContainer = document.getElementById('form-soal-container');
    document.getElementById('btn-tambah-soal').addEventListener('click', () => {
        document.getElementById('form-soal').reset();
        document.getElementById('soal_id').value = '';
        currentSoalId = null;
        document.getElementById('input_cabang').value = document.getElementById('filter-cabang-soal').value;
        document.getElementById('preview_teks_soal').innerHTML = '';
        document.getElementById('preview_gambar_soal_container').style.display = 'none';
        formSoalContainer.style.display = 'block';
    });
    
    document.getElementById('btn-batal-soal').addEventListener('click', () => {
        formSoalContainer.style.display = 'none';
    });

    // Live preview LaTeX
    const inputTeksSoal = document.getElementById('input_teks_soal');
    const previewTeksSoal = document.getElementById('preview_teks_soal');
    inputTeksSoal.addEventListener('input', () => {
        previewTeksSoal.innerHTML = inputTeksSoal.value;
        renderMathInElement(previewTeksSoal, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false
        });
    });

    // Gambar Upload Handler
    const fileGambarSoal = document.getElementById('input_gambar_soal');
    fileGambarSoal.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { data, error } = await supabaseClient.storage.from('gambar-soal').upload(fileName, file);
        
        if (error) {
            alert('Upload gagal: ' + error.message);
        } else {
            const { data: publicUrlData } = supabaseClient.storage.from('gambar-soal').getPublicUrl(fileName);
            document.getElementById('url_gambar_soal').value = publicUrlData.publicUrl;
            document.getElementById('preview_gambar_soal_img').src = publicUrlData.publicUrl;
            document.getElementById('preview_gambar_soal_container').style.display = 'block';
        }
    });

    // Simpan Soal
    document.getElementById('form-soal').addEventListener('submit', async (e) => {
        e.preventDefault();
        const soalData = {
            cabang: document.getElementById('input_cabang').value,
            no: parseInt(document.getElementById('input_no').value),
            tipe: document.getElementById('input_tipe').value,
            teks_soal: document.getElementById('input_teks_soal').value,
            gambar_soal: document.getElementById('url_gambar_soal').value || null,
            opsi_a: document.getElementById('input_opsi_a').value,
            opsi_b: document.getElementById('input_opsi_b').value,
            opsi_c: document.getElementById('input_opsi_c').value,
            opsi_d: document.getElementById('input_opsi_d').value,
            opsi_e: document.getElementById('input_opsi_e').value || null,
            bobot: parseFloat(document.getElementById('input_bobot').value)
        };
        const kunciData = document.getElementById('input_kunci').value;

        if (currentSoalId) {
            const { error: errSoal } = await supabaseClient.from('soal').update(soalData).eq('id', currentSoalId);
            const { error: errKunci } = await supabaseClient.from('kunci_soal').update({ kunci: kunciData }).eq('soal_id', currentSoalId);
            if (errSoal || errKunci) alert("Gagal update soal");
            else alert("Soal diupdate");
        } else {
            // Because we don't have an RPC for insert single yet that handles both, we can just insert manually (Admin policy allows this)
            const { data, error: errSoal } = await supabaseClient.from('soal').insert(soalData).select().single();
            if (errSoal) {
                alert("Gagal simpan soal: " + errSoal.message);
                return;
            }
            const { error: errKunci } = await supabaseClient.from('kunci_soal').insert({ soal_id: data.id, kunci: kunciData });
            if (errKunci) alert("Gagal simpan kunci");
            else alert("Soal disimpan");
        }
        formSoalContainer.style.display = 'none';
        loadSoal();
    });

    window.editSoal = async (id) => {
        currentSoalId = id;
        const { data: s } = await supabaseClient.from('soal').select('*, kunci_soal(kunci)').eq('id', id).single();
        if (s) {
            document.getElementById('input_cabang').value = s.cabang;
            document.getElementById('input_no').value = s.no;
            document.getElementById('input_tipe').value = s.tipe;
            document.getElementById('input_teks_soal').value = s.teks_soal;
            
            // Trigger preview
            inputTeksSoal.dispatchEvent(new Event('input'));

            if (s.gambar_soal) {
                document.getElementById('url_gambar_soal').value = s.gambar_soal;
                document.getElementById('preview_gambar_soal_img').src = s.gambar_soal;
                document.getElementById('preview_gambar_soal_container').style.display = 'block';
            } else {
                document.getElementById('url_gambar_soal').value = '';
                document.getElementById('preview_gambar_soal_container').style.display = 'none';
            }

            document.getElementById('input_opsi_a').value = s.opsi_a;
            document.getElementById('input_opsi_b').value = s.opsi_b;
            document.getElementById('input_opsi_c').value = s.opsi_c;
            document.getElementById('input_opsi_d').value = s.opsi_d;
            document.getElementById('input_opsi_e').value = s.opsi_e || '';
            document.getElementById('input_bobot').value = s.bobot;
            document.getElementById('input_kunci').value = s.kunci_soal ? s.kunci_soal.kunci : 'A';
            
            formSoalContainer.style.display = 'block';
            window.scrollTo(0, formSoalContainer.offsetTop);
        }
    }

    window.hapusSoal = async (id) => {
        if(confirm("Yakin hapus soal ini?")) {
            await supabaseClient.from('soal').delete().eq('id', id);
            loadSoal();
        }
    }

    // ==========================================
    // MODULE: MONITORING LIVE
    // ==========================================
    async function loadMonitoring() {
        const cabang = document.getElementById('filter-cabang-monitoring').value;
        let query = supabaseClient.from('peserta').select('id, nama, cabang, status, sesi(waktu_mulai)');
        if (cabang) query = query.eq('cabang', cabang);
        query = query.in('status', ['mengerjakan', 'selesai', 'terkunci']);
        
        const { data, error } = await query;
        if(error) { console.error(error); return; }

        const tbody = document.getElementById('tbody-monitoring');
        tbody.innerHTML = '';
        data.forEach(p => {
            const tr = document.createElement('tr');
            let badge = 'bg-secondary';
            if(p.status === 'mengerjakan') badge = 'bg-warning';
            else if(p.status === 'selesai') badge = 'bg-success';
            else if(p.status === 'terkunci') badge = 'bg-danger';

            tr.innerHTML = `
                <td>${p.nama}</td>
                <td>${p.cabang}</td>
                <td><span style="padding: 2px 8px; border-radius: 4px; color: white;" class="${badge}">${p.status}</span></td>
                <td>-</td>
                <td>${p.sesi && p.sesi.length > 0 ? new Date(p.sesi[0].waktu_mulai).toLocaleTimeString() : '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    document.getElementById('filter-cabang-monitoring').addEventListener('change', loadMonitoring);
    document.getElementById('btn-refresh-monitoring').addEventListener('click', loadMonitoring);

    // ==========================================
    // MODULE: PELANGGARAN
    // ==========================================
    async function loadPelanggaran() {
        const cabang = document.getElementById('filter-cabang-pelanggaran').value;
        let query = supabaseClient.from('pelanggaran').select('*, peserta(nama, cabang)').order('created_at', { ascending: false }).limit(100);
        
        const { data, error } = await query;
        if(error) return;

        const tbody = document.getElementById('tbody-pelanggaran');
        tbody.innerHTML = '';
        data.forEach(p => {
            if (cabang && p.peserta.cabang !== cabang) return;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(p.created_at).toLocaleString('id-ID')}</td>
                <td>${p.peserta.nama}</td>
                <td>${p.peserta.cabang}</td>
                <td>${p.jenis_pelanggaran}</td>
                <td><span class="text-danger">${p.tindakan}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('btn-load-pelanggaran').addEventListener('click', loadPelanggaran);
    document.getElementById('btn-export-pelanggaran').addEventListener('click', () => {
        const table = document.getElementById('table-pelanggaran');
        const wb = XLSX.utils.table_to_book(table, {sheet: "Pelanggaran"});
        XLSX.writeFile(wb, `Log_Pelanggaran.xlsx`);
    });

    // ==========================================
    // MODULE: HASIL UJIAN
    // ==========================================
    async function loadHasil() {
        const cabang = document.getElementById('filter-cabang-hasil').value;
        const { data, error } = await supabaseClient.from('scoreboard_publik').select('*').eq('cabang', cabang);
        if (error) return;

        const tbody = document.getElementById('tbody-hasil');
        tbody.innerHTML = '';
        data.forEach((r, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>${r.nama}</td>
                <td>${r.sekolah}</td>
                <td>${r.benar} / ${r.salah} / ${r.kosong}</td>
                <td>${r.durasi_pengerjaan}</td>
                <td style="font-weight:bold; color:var(--primary)">${parseFloat(r.skor).toFixed(1)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('btn-load-hasil').addEventListener('click', loadHasil);
    document.getElementById('btn-export-hasil').addEventListener('click', () => {
        const table = document.getElementById('table-hasil');
        const wb = XLSX.utils.table_to_book(table, {sheet: "Hasil"});
        XLSX.writeFile(wb, `Hasil_Ujian_${document.getElementById('filter-cabang-hasil').value}.xlsx`);
    });

    // View loader map
    function loadViewData(viewId) {
        if (viewId === 'dashboard') loadDashboard();
        else if (viewId === 'peserta') loadPeserta();
        else if (viewId === 'soal') loadSoal();
        else if (viewId === 'pengaturan') loadPengaturan();
        else if (viewId === 'monitoring') loadMonitoring();
        else if (viewId === 'pelanggaran') loadPelanggaran();
        else if (viewId === 'hasil') loadHasil();
    }
});
