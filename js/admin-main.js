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
                document.getElementById('cfg_dur_mat').value = config.durasi['Matematika'] || 60;
                document.getElementById('cfg_dur_pai').value = config.durasi['PAI'] || 60;
                document.getElementById('cfg_dur_ipa').value = config.durasi['IPA'] || 60;
                document.getElementById('cfg_dur_ing').value = config.durasi['Bahasa Inggris'] || 60;
            }
            if (config.skor) {
                document.getElementById('cfg_skor_benar').value = config.skor.benar !== undefined ? config.skor.benar : 3;
                document.getElementById('cfg_skor_salah').value = config.skor.salah !== undefined ? config.skor.salah : 0;
                document.getElementById('cfg_skor_kosong').value = config.skor.kosong !== undefined ? config.skor.kosong : 0;
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
            },
            skor: {
                benar: parseInt(document.getElementById('cfg_skor_benar').value),
                salah: parseInt(document.getElementById('cfg_skor_salah').value),
                kosong: parseInt(document.getElementById('cfg_skor_kosong').value)
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
                    <td class="text-center"><input type="checkbox" class="cb-peserta" value="${p.id}"></td>
                    <td>${p.nama}</td>
                    <td>${p.username}</td>
                    <td>${p.cabang}</td>
                    <td>${p.asal_sekolah}</td>
                    <td>${p.status}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="resetSesi('${p.id}')" style="margin-right: 5px;">Reset Sesi</button>
                        <button class="btn btn-sm" style="background-color: #e74c3c; color: white;" onclick="hapusPeserta('${p.id}', '${p.nama}')">Hapus</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
    document.getElementById('btn-load-peserta').addEventListener('click', loadPeserta);

    // Fitur Bulk Delete Peserta
    document.getElementById('cb-all-peserta').addEventListener('change', (e) => {
        const cbs = document.querySelectorAll('.cb-peserta');
        cbs.forEach(cb => cb.checked = e.target.checked);
        toggleBtnBulkDeletePeserta();
    });

    document.querySelector('#table-peserta tbody').addEventListener('change', (e) => {
        if(e.target.classList.contains('cb-peserta')) toggleBtnBulkDeletePeserta();
    });

    function toggleBtnBulkDeletePeserta() {
        const checked = document.querySelectorAll('.cb-peserta:checked').length;
        document.getElementById('btn-hapus-terpilih-peserta').style.display = checked > 0 ? 'inline-block' : 'none';
    }

    document.getElementById('btn-hapus-terpilih-peserta').addEventListener('click', async () => {
        const checked = document.querySelectorAll('.cb-peserta:checked');
        if (checked.length === 0) return;
        if (confirm(`Yakin ingin menghapus ${checked.length} peserta terpilih beserta seluruh datanya?`)) {
            const ids = Array.from(checked).map(cb => cb.value);
            const { error } = await supabaseClient.from('peserta').delete().in('id', ids);
            if (error) alert("Gagal menghapus: " + error.message);
            else {
                alert(`${checked.length} peserta dihapus.`);
                document.getElementById('cb-all-peserta').checked = false;
                toggleBtnBulkDeletePeserta();
                loadPeserta();
            }
        }
    });

    window.resetSesi = async (id) => {
        if (confirm("Reset sesi akan menghapus token dan membolehkan peserta login ulang tanpa menghapus jawaban tersimpan. Lanjutkan?")) {
            await supabaseClient.from('peserta').update({ session_token: null, status: 'belum' }).eq('id', id);
            loadPeserta();
        }
    }

    window.hapusPeserta = async (id, nama) => {
        if (confirm(`Apakah Anda yakin ingin menghapus peserta ${nama}? Seluruh skor dan jawaban mereka juga akan terhapus!`)) {
            const { error } = await supabaseClient.from('peserta').delete().eq('id', id);
            if (error) alert("Gagal menghapus peserta: " + error.message);
            else {
                alert("Peserta berhasil dihapus.");
                loadPeserta();
            }
        }
    }

    // Export Excel
    document.getElementById('btn-export-peserta').addEventListener('click', () => {
        const table = document.getElementById('table-peserta');
        const wb = XLSX.utils.table_to_book(table, { sheet: "Peserta" });
        XLSX.writeFile(wb, "Daftar_Peserta_CBT.xlsx");
    });

    // Tambah Manual
    const modalPeserta = document.getElementById('modal-tambah-peserta');
    document.getElementById('btn-tambah-peserta').addEventListener('click', () => {
        modalPeserta.style.display = 'flex';
    });
    document.getElementById('close-modal-peserta').addEventListener('click', () => {
        modalPeserta.style.display = 'none';
    });
    
    document.getElementById('form-tambah-peserta').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-simpan-peserta');
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
        
        const row = {
            nama: document.getElementById('tambah-peserta-nama').value,
            username: document.getElementById('tambah-peserta-username').value,
            password: document.getElementById('tambah-peserta-password').value,
            cabang: document.getElementById('tambah-peserta-cabang').value,
            asal_sekolah: document.getElementById('tambah-peserta-sekolah').value
        };

        const { data, error } = await supabaseClient.rpc('admin_import_peserta', { p_rows: [row] });
        
        btn.disabled = false;
        btn.textContent = 'Simpan Peserta';
        
        if (error) {
            alert("Gagal menambahkan: " + error.message);
        } else if (data && data.success && data.results) {
            const errs = data.results.filter(r => r.status === 'error');
            if (errs.length > 0) {
                alert("Gagal menambahkan: " + errs[0].message);
            } else {
                alert("Peserta berhasil ditambahkan!");
                modalPeserta.style.display = 'none';
                document.getElementById('form-tambah-peserta').reset();
                loadPeserta();
            }
        }
    });

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
                    <td class="text-center"><input type="checkbox" class="cb-soal" value="${s.id}"></td>
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

    // Fitur Bulk Delete Soal
    document.getElementById('cb-all-soal').addEventListener('change', (e) => {
        const cbs = document.querySelectorAll('.cb-soal');
        cbs.forEach(cb => cb.checked = e.target.checked);
        toggleBtnBulkDeleteSoal();
    });

    document.querySelector('#table-soal tbody').addEventListener('change', (e) => {
        if(e.target.classList.contains('cb-soal')) toggleBtnBulkDeleteSoal();
    });

    function toggleBtnBulkDeleteSoal() {
        const checked = document.querySelectorAll('.cb-soal:checked').length;
        document.getElementById('btn-hapus-terpilih-soal').style.display = checked > 0 ? 'inline-block' : 'none';
    }

    document.getElementById('btn-hapus-terpilih-soal').addEventListener('click', async () => {
        const checked = document.querySelectorAll('.cb-soal:checked');
        if (checked.length === 0) return;
        if (confirm(`Yakin ingin menghapus ${checked.length} soal terpilih?`)) {
            const ids = Array.from(checked).map(cb => cb.value);
            const { error } = await supabaseClient.from('soal').delete().in('id', ids);
            if (error) alert("Gagal menghapus: " + error.message);
            else {
                alert(`${checked.length} soal dihapus.`);
                document.getElementById('cb-all-soal').checked = false;
                toggleBtnBulkDeleteSoal();
                loadSoal();
            }
        }
    });

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
        let query = supabaseClient.from('pelanggaran').select('*, peserta(nama, cabang)').order('waktu', { ascending: false }).limit(100);
        
        const { data, error } = await query;
        if(error) return;

        const tbody = document.getElementById('tbody-pelanggaran');
        tbody.innerHTML = '';
        data.forEach(p => {
            if (cabang && p.peserta.cabang !== cabang) return;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(p.waktu).toLocaleString('id-ID')}</td>
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
    // MODULE: HASIL TES & ANALISIS BUTIR SOAL
    // ==========================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    let currentDetailData = {
        peserta: null,
        cabang: '',
        items: [],
        skorConfig: { benar: 3, salah: 0, kosong: 0 }
    };
    let currentDetailFilter = 'all';

    async function loadHasil() {
        const cabang = document.getElementById('filter-cabang-hasil').value;
        const tbody = document.getElementById('tbody-hasil');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 20px;">Memuat data hasil ujian...</td></tr>';

        const { data, error } = await supabaseClient
            .from('skor')
            .select('*')
            .eq('cabang', cabang)
            .order('skor_akhir', { ascending: false })
            .order('durasi_detik', { ascending: true });

        if (error) {
            console.error("Gagal load hasil:", error);
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger" style="padding: 20px;">Gagal memuat data: ${error.message}</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 20px; color: var(--text-light);">Belum ada peserta yang menyelesaikan ujian pada cabang ini.</td></tr>';
            return;
        }

        data.forEach((r, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><strong>${escapeHtml(r.nama)}</strong></td>
                <td>${escapeHtml(r.sekolah)}</td>
                <td>${r.benar} / ${r.salah} / ${r.kosong}</td>
                <td>${r.durasi_detik}</td>
                <td style="font-weight:bold; color:var(--primary)">${parseFloat(r.skor_akhir).toFixed(1)}</td>
                <td style="text-align: center;">
                    <button type="button" class="btn btn-sm btn-primary btn-lihat-detail"
                        data-peserta-id="${r.peserta_id}"
                        data-sesi-id="${r.sesi_id || ''}"
                        data-nama="${escapeHtml(r.nama)}"
                        data-sekolah="${escapeHtml(r.sekolah)}"
                        data-cabang="${escapeHtml(r.cabang)}"
                        data-skor="${r.skor_akhir}">
                        Detail Jawaban
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('btn-load-hasil').addEventListener('click', loadHasil);
    document.getElementById('filter-cabang-hasil').addEventListener('change', loadHasil);

    // Event delegation tombol "Detail Jawaban"
    document.getElementById('tbody-hasil').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-lihat-detail');
        if (!btn) return;
        const { pesertaId, sesiId, nama, sekolah, cabang, skor } = btn.dataset;
        bukaDetailJawaban(pesertaId, sesiId, nama, sekolah, cabang, skor);
    });

    // Modal Detail Jawaban Logic
    const modalDetailJawaban = document.getElementById('modal-detail-jawaban');
    const closeBtnDetailJawaban = document.getElementById('close-modal-detail-jawaban');
    const tutupBtnDetailJawaban = document.getElementById('btn-tutup-detail-jawaban');

    if (closeBtnDetailJawaban) {
        closeBtnDetailJawaban.addEventListener('click', () => {
            modalDetailJawaban.style.display = 'none';
        });
    }
    if (tutupBtnDetailJawaban) {
        tutupBtnDetailJawaban.addEventListener('click', () => {
            modalDetailJawaban.style.display = 'none';
        });
    }

    async function bukaDetailJawaban(pesertaId, sesiId, nama, sekolah, cabang, skorAkhir) {
        modalDetailJawaban.style.display = 'flex';
        
        document.getElementById('detail-siswa-nama').textContent = nama;
        document.getElementById('detail-siswa-info').textContent = `${sekolah} • Cabang ${cabang}`;
        document.getElementById('detail-stat-benar').textContent = '...';
        document.getElementById('detail-stat-salah').textContent = '...';
        document.getElementById('detail-stat-kosong').textContent = '...';
        document.getElementById('detail-stat-skor').textContent = parseFloat(skorAkhir || 0).toFixed(1);

        const tbodyDetail = document.getElementById('tbody-detail-jawaban');
        tbodyDetail.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 30px;">Mengambil data jawaban siswa...</td></tr>';

        // 1. Dapatkan sesiId jika belum ada
        if (!sesiId) {
            const { data: sesiData } = await supabaseClient
                .from('sesi')
                .select('id')
                .eq('peserta_id', pesertaId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (sesiData) sesiId = sesiData.id;
        }

        // 2. Dapatkan config skor cabang
        let skorConfig = { benar: 3, salah: 0, kosong: 0 };
        try {
            const { data: cfgRow } = await supabaseClient.from('config').select('value').eq('key', 'app_config').single();
            if (cfgRow && cfgRow.value && cfgRow.value.skor) {
                if (cfgRow.value.skor[cabang]) skorConfig = cfgRow.value.skor[cabang];
                else if (typeof cfgRow.value.skor.benar === 'number') skorConfig = cfgRow.value.skor;
            }
        } catch (err) {
            console.warn("Gagal membaca config skor:", err);
        }

        // 3. Ambil seluruh butir soal cabang tersebut
        const { data: soalList, error: errSoal } = await supabaseClient
            .from('soal')
            .select('id, no, teks_soal, bobot, kunci_soal(kunci)')
            .eq('cabang', cabang)
            .order('no', { ascending: true });

        if (errSoal || !soalList) {
            tbodyDetail.innerHTML = `<tr><td colspan="6" class="text-center text-danger" style="padding: 20px;">Gagal memuat soal: ${errSoal ? errSoal.message : 'Soal tidak ditemukan'}</td></tr>`;
            return;
        }

        // 4. Ambil jawaban siswa untuk sesi ini
        let jawabanMap = {};
        if (sesiId) {
            const { data: jwbList } = await supabaseClient
                .from('jawaban')
                .select('soal_id, jawaban, ragu')
                .eq('sesi_id', sesiId);
            if (jwbList) {
                jwbList.forEach(j => {
                    jawabanMap[j.soal_id] = j;
                });
            }
        }

        // 5. Analisis per butir soal
        let countBenar = 0;
        let countSalah = 0;
        let countKosong = 0;
        let totalPoinKalkulasi = 0;
        const items = [];

        soalList.forEach(s => {
            const jwbObj = jawabanMap[s.id] || null;
            const jwbRaw = jwbObj && jwbObj.jawaban ? jwbObj.jawaban.trim() : null;
            const kunciRaw = s.kunci_soal && s.kunci_soal.kunci ? s.kunci_soal.kunci.trim() : '-';
            const bobot = s.bobot !== null && s.bobot !== undefined ? parseFloat(s.bobot) : 1;

            let status = 'kosong';
            let poin = 0;

            if (!jwbRaw) {
                status = 'kosong';
                poin = (skorConfig.kosong !== undefined ? skorConfig.kosong : 0) * bobot;
                countKosong++;
            } else if (jwbRaw.toUpperCase() === kunciRaw.toUpperCase()) {
                status = 'benar';
                poin = (skorConfig.benar !== undefined ? skorConfig.benar : 3) * bobot;
                countBenar++;
            } else {
                status = 'salah';
                poin = (skorConfig.salah !== undefined ? skorConfig.salah : 0) * bobot;
                countSalah++;
            }
            totalPoinKalkulasi += poin;

            items.push({
                soalId: s.id,
                no: s.no,
                teks: s.teks_soal || '',
                jawabanSiswa: jwbRaw ? jwbRaw.toUpperCase() : '-',
                kunci: kunciRaw.toUpperCase(),
                status: status,
                poin: poin,
                ragu: jwbObj ? !!jwbObj.ragu : false
            });
        });

        currentDetailData = {
            peserta: { id: pesertaId, sesiId, nama, sekolah, cabang, skorAkhir: skorAkhir || totalPoinKalkulasi },
            cabang,
            items,
            skorConfig
        };

        document.getElementById('detail-stat-benar').textContent = countBenar;
        document.getElementById('detail-stat-salah').textContent = countSalah;
        document.getElementById('detail-stat-kosong').textContent = countKosong;
        document.getElementById('detail-stat-skor').textContent = parseFloat(skorAkhir !== undefined && skorAkhir !== '' ? skorAkhir : totalPoinKalkulasi).toFixed(1);

        document.getElementById('count-all').textContent = items.length;
        document.getElementById('count-benar').textContent = countBenar;
        document.getElementById('count-salah').textContent = countSalah;
        document.getElementById('count-kosong').textContent = countKosong;

        // Reset filter ke 'all'
        currentDetailFilter = 'all';
        document.querySelectorAll('.btn-filter-detail').forEach(b => {
            b.classList.toggle('active-filter', b.dataset.filter === 'all');
        });

        renderDetailTable('all');
    }

    function renderDetailTable(filter) {
        currentDetailFilter = filter;
        const tbodyDetail = document.getElementById('tbody-detail-jawaban');
        tbodyDetail.innerHTML = '';

        const filtered = currentDetailData.items.filter(item => {
            if (filter === 'all') return true;
            return item.status === filter;
        });

        if (filtered.length === 0) {
            tbodyDetail.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 25px; color: var(--text-light);">Tidak ada butir soal dengan status "${filter}".</td></tr>`;
            return;
        }

        filtered.forEach(item => {
            const tr = document.createElement('tr');
            
            let statusBadge = '';
            let jawabanDisplay = '';

            if (item.status === 'benar') {
                statusBadge = '<span class="badge badge-benar">Benar</span>';
                jawabanDisplay = `<strong class="text-success" style="font-size: 1.1rem;">${escapeHtml(item.jawabanSiswa)}</strong>`;
            } else if (item.status === 'salah') {
                statusBadge = '<span class="badge badge-salah">Salah</span>';
                jawabanDisplay = `<strong class="text-danger" style="font-size: 1.1rem;">${escapeHtml(item.jawabanSiswa)}</strong>`;
            } else {
                statusBadge = '<span class="badge badge-kosong">Kosong</span>';
                jawabanDisplay = '<span style="color: #95a5a6; font-style: italic;">(Tidak dijawab)</span>';
            }

            if (item.ragu) {
                jawabanDisplay += ' <span class="badge bg-warning" style="font-size: 0.7rem; padding: 1px 5px; vertical-align: middle;">Ragu</span>';
            }

            // Cuplikan teks soal
            let teksSnippet = escapeHtml(item.teks);
            if (teksSnippet.length > 140) {
                teksSnippet = teksSnippet.substring(0, 140) + '...';
            }

            tr.innerHTML = `
                <td style="text-align: center; font-weight: 600;">${item.no}</td>
                <td class="latex-render" style="font-size: 0.95rem;">${teksSnippet}</td>
                <td style="text-align: center;">${jawabanDisplay}</td>
                <td style="text-align: center; font-weight: bold; color: var(--primary); font-size: 1.1rem;">${escapeHtml(item.kunci)}</td>
                <td style="text-align: center;">${statusBadge}</td>
                <td style="text-align: center; font-weight: 600;">${item.poin >= 0 ? '+' : ''}${item.poin}</td>
            `;
            tbodyDetail.appendChild(tr);
        });

        if (window.renderMathInElement) {
            renderMathInElement(tbodyDetail, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ]
            });
        }
    }

    // Filter Buttons Listener
    const filterDetailContainer = document.getElementById('filter-detail-status');
    if (filterDetailContainer) {
        filterDetailContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-filter-detail');
            if (!btn) return;
            document.querySelectorAll('.btn-filter-detail').forEach(b => b.classList.remove('active-filter'));
            btn.classList.add('active-filter');
            renderDetailTable(btn.dataset.filter);
        });
    }

    // Export Excel Rincian Siswa Tunggal
    document.getElementById('btn-export-detail-siswa').addEventListener('click', () => {
        if (!currentDetailData.peserta || currentDetailData.items.length === 0) {
            alert("Data rincian siswa belum dimuat.");
            return;
        }

        const p = currentDetailData.peserta;
        const b = document.getElementById('detail-stat-benar').textContent;
        const s = document.getElementById('detail-stat-salah').textContent;
        const k = document.getElementById('detail-stat-kosong').textContent;

        const rows = [
            ["RINCIAN HASIL PENGERJAAN BUTIR SOAL"],
            ["Event", "Milad Yayasan Al Ishlah 2026 - CBT"],
            ["Nama Siswa", p.nama],
            ["Asal Sekolah", p.sekolah],
            ["Cabang Lomba", p.cabang],
            ["Rekap Hasil", `Benar: ${b} | Salah: ${s} | Kosong: ${k}`],
            ["Skor Akhir", parseFloat(p.skorAkhir).toFixed(1)],
            [],
            ["No", "Teks Soal", "Jawaban Siswa", "Kunci Jawaban", "Status", "Poin"]
        ];

        currentDetailData.items.forEach(item => {
            rows.push([
                item.no,
                item.teks,
                item.jawabanSiswa,
                item.kunci,
                item.status.toUpperCase(),
                item.poin
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Rincian Jawaban");
        const safeName = p.nama.replace(/[^a-zA-Z0-9_-]/g, '_');
        XLSX.writeFile(wb, `Rincian_Jawaban_${safeName}_${p.cabang}.xlsx`);
    });

    // Ekspor Rekap Hasil Ringkas
    document.getElementById('btn-export-hasil').addEventListener('click', () => {
        const table = document.getElementById('table-hasil');
        const cabang = document.getElementById('filter-cabang-hasil').value;
        const wb = XLSX.utils.table_to_book(table, { sheet: "Rekap Hasil" });
        XLSX.writeFile(wb, `Rekap_Hasil_Ujian_${cabang}.xlsx`);
    });

    // Ekspor Analisis Butir Soal (Matriks Excel Komprehensif)
    document.getElementById('btn-export-matriks-hasil').addEventListener('click', async () => {
        const btn = document.getElementById('btn-export-matriks-hasil');
        const cabang = document.getElementById('filter-cabang-hasil').value;
        const originalText = btn.textContent;

        try {
            btn.disabled = true;
            btn.textContent = "Mengunduh Data...";

            // 1. Ambil seluruh skor cabang terpilih
            const { data: listSkor, error: errSkor } = await supabaseClient
                .from('skor')
                .select('*')
                .eq('cabang', cabang)
                .order('skor_akhir', { ascending: false })
                .order('durasi_detik', { ascending: true });

            if (errSkor || !listSkor || listSkor.length === 0) {
                alert("Tidak ada data hasil ujian yang dapat diekspor untuk cabang ini.");
                return;
            }

            // 2. Ambil seluruh soal untuk cabang ini
            const { data: listSoal, error: errSoal } = await supabaseClient
                .from('soal')
                .select('id, no, bobot, kunci_soal(kunci)')
                .eq('cabang', cabang)
                .order('no', { ascending: true });

            if (errSoal || !listSoal || listSoal.length === 0) {
                alert("Data butir soal untuk cabang ini tidak ditemukan.");
                return;
            }

            // 3. Ambil seluruh sesi_id peserta
            const sesiIds = listSkor.map(s => s.sesi_id).filter(Boolean);
            
            // 4. Ambil jawaban seluruh siswa
            let allJawaban = [];
            const chunkSize = 200;
            for (let i = 0; i < sesiIds.length; i += chunkSize) {
                const chunk = sesiIds.slice(i, i + chunkSize);
                const { data: jwbChunk, error: errJwb } = await supabaseClient
                    .from('jawaban')
                    .select('sesi_id, soal_id, jawaban')
                    .in('sesi_id', chunk)
                    .range(0, 9999);
                if (jwbChunk) allJawaban = allJawaban.concat(jwbChunk);
            }

            // Buat map: sesiId -> { soalId: jawaban }
            const jawabanBySesi = {};
            allJawaban.forEach(j => {
                if (!jawabanBySesi[j.sesi_id]) jawabanBySesi[j.sesi_id] = {};
                jawabanBySesi[j.sesi_id][j.soal_id] = j.jawaban ? j.jawaban.trim().toUpperCase() : '';
            });

            // Siapkan Worksheets
            const wb = XLSX.utils.book_new();

            // SHEET 1: Matriks Jawaban Siswa (Huruf A/B/C/D/E)
            const headersS1 = ['Peringkat', 'Nama Siswa', 'Asal Sekolah'];
            listSoal.forEach(s => headersS1.push(`No ${s.no}`));
            headersS1.push('Benar', 'Salah', 'Kosong', 'Skor Akhir', 'Durasi (dtk)');

            const rowsS1 = [headersS1];

            // Baris Kunci
            const rowKunciS1 = ['KUNCI JAWABAN', '-', '-'];
            listSoal.forEach(s => {
                rowKunciS1.push(s.kunci_soal && s.kunci_soal.kunci ? s.kunci_soal.kunci.toUpperCase() : '-');
            });
            rowKunciS1.push('-', '-', '-', '-', '-');
            rowsS1.push(rowKunciS1);

            // Statistik per butir soal untuk Sheet 3
            const statSoal = {};
            listSoal.forEach(s => {
                statSoal[s.id] = {
                    no: s.no,
                    kunci: s.kunci_soal && s.kunci_soal.kunci ? s.kunci_soal.kunci.toUpperCase() : '-',
                    benar: 0,
                    salah: 0,
                    kosong: 0
                };
            });

            // SHEET 2: Matriks B/S (1 = Benar, 0 = Kosong/Salah)
            const headersS2 = ['Peringkat', 'Nama Siswa', 'Asal Sekolah'];
            listSoal.forEach(s => headersS2.push(`No ${s.no}`));
            headersS2.push('Total Benar', 'Total Salah', 'Total Kosong', 'Skor Akhir');
            const rowsS2 = [headersS2];

            // Isi Data Setiap Siswa
            listSkor.forEach((peserta, idx) => {
                const jwbPesertaMap = jawabanBySesi[peserta.sesi_id] || {};

                const rowSiswaS1 = [idx + 1, peserta.nama, peserta.sekolah];
                const rowSiswaS2 = [idx + 1, peserta.nama, peserta.sekolah];

                listSoal.forEach(s => {
                    const jwb = jwbPesertaMap[s.id] || '';
                    const kunci = s.kunci_soal && s.kunci_soal.kunci ? s.kunci_soal.kunci.toUpperCase() : '';

                    rowSiswaS1.push(jwb || '-');

                    if (!jwb) {
                        rowSiswaS2.push(0);
                        statSoal[s.id].kosong++;
                    } else if (jwb === kunci) {
                        rowSiswaS2.push(1);
                        statSoal[s.id].benar++;
                    } else {
                        rowSiswaS2.push(0);
                        statSoal[s.id].salah++;
                    }
                });

                rowSiswaS1.push(peserta.benar, peserta.salah, peserta.kosong, parseFloat(peserta.skor_akhir), peserta.durasi_detik);
                rowSiswaS2.push(peserta.benar, peserta.salah, peserta.kosong, parseFloat(peserta.skor_akhir));

                rowsS1.push(rowSiswaS1);
                rowsS2.push(rowSiswaS2);
            });

            // SHEET 3: Analisis Tingkat Kesukaran Butir Soal
            const headersS3 = [
                'No Soal',
                'Kunci Jawaban',
                'Jumlah Menjawab Benar',
                'Jumlah Menjawab Salah',
                'Jumlah Kosong',
                'Total Peserta',
                'Tingkat Kemudahan (% Benar)',
                'Kategori Tingkat Kesukaran'
            ];
            const rowsS3 = [headersS3];

            const totalPesertaCount = listSkor.length;
            listSoal.forEach(s => {
                const st = statSoal[s.id];
                const pctBenar = totalPesertaCount > 0 ? (st.benar / totalPesertaCount) * 100 : 0;
                let kategori = 'Sedang';
                if (pctBenar >= 70) kategori = 'Mudah';
                else if (pctBenar < 30) kategori = 'Sukar';

                rowsS3.push([
                    st.no,
                    st.kunci,
                    st.benar,
                    st.salah,
                    st.kosong,
                    totalPesertaCount,
                    parseFloat(pctBenar.toFixed(1)) + '%',
                    kategori
                ]);
            });

            // Append sheets
            const ws1 = XLSX.utils.aoa_to_sheet(rowsS1);
            const ws2 = XLSX.utils.aoa_to_sheet(rowsS2);
            const ws3 = XLSX.utils.aoa_to_sheet(rowsS3);

            XLSX.utils.book_append_sheet(wb, ws1, "Matriks Jawaban Siswa");
            XLSX.utils.book_append_sheet(wb, ws2, "Matriks Skor B-S");
            XLSX.utils.book_append_sheet(wb, ws3, "Analisis Butir Soal");

            XLSX.writeFile(wb, `Analisis_Butir_Soal_${cabang}_Milad2026.xlsx`);
        } catch (err) {
            console.error("Gagal ekspor matriks:", err);
            alert("Terjadi kesalahan saat mengekspor matriks: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
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

    // ==========================================
    // MODULE: MANAJEMEN ADMIN
    // ==========================================
    const formAdmin = document.getElementById('form-tambah-admin');
    if(formAdmin) {
        formAdmin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-admin');
            const user = document.getElementById('admin_new_user').value.trim();
            const pass = document.getElementById('admin_new_pass').value;

            btn.disabled = true; btn.textContent = "Menyimpan...";
            const { data, error } = await supabaseClient.rpc('admin_tambah_admin', {
                p_username: user,
                p_password: pass
            });
            btn.disabled = false; btn.textContent = "Tambahkan Admin";
            
            if (error) {
                alert("Gagal menambahkan admin: " + error.message + "\n\nPastikan Anda telah menjalankan skrip migrasi 003_admin_management.sql di Supabase SQL Editor.");
            } else if (!data.success) {
                alert("Gagal: " + data.message);
            } else {
                alert("Admin berhasil ditambahkan!\nUsername: " + user + "\nPassword: " + pass);
                formAdmin.reset();
            }
        });
    }
});
