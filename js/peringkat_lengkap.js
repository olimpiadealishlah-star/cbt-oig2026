document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('tbody-ranking');
    const filterMapel = document.getElementById('filter-mapel');
    const filterSekolah = document.getElementById('filter-sekolah');
    const statPeserta = document.getElementById('stat-peserta');
    
    let allData = [];
    let uniqueSchools = new Set();

    // 1. Fetch Config Event Name (Optional)
    try {
        const { data: cfg } = await supabaseClient.from('config').select('value').eq('key', 'app_config').single();
        if (cfg && cfg.value && cfg.value.nama_event) {
            document.getElementById('event-name').textContent = cfg.value.nama_event;
        }
    } catch (e) { console.warn("Gagal load config", e); }

    // 2. Fetch Data from Supabase
    async function fetchData() {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Mengambil data...</td></tr>';
        
        // Ambil semua data, order by cabang, lalu skor descending, lalu durasi ascending
        const { data, error } = await supabaseClient
            .from('skor')
            .select('nama, sekolah, cabang, skor_akhir, durasi_detik, benar')
            .order('cabang', { ascending: true })
            .order('skor_akhir', { ascending: false })
            .order('durasi_detik', { ascending: true });

        if (error) {
            console.error("Gagal mengambil data:", error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Gagal memuat data.</td></tr>';
            return;
        }

        // Proses rank per mapel
        let currentCabang = '';
        let currentRank = 1;
        
        allData = data.map(row => {
            if (row.cabang !== currentCabang) {
                currentCabang = row.cabang;
                currentRank = 1;
            }
            row.rank = currentRank++;
            uniqueSchools.add(row.sekolah);
            return row;
        });

        populateSchoolFilter();
        renderTable();
    }

    // 3. Populate Filter Sekolah
    function populateSchoolFilter() {
        const schools = Array.from(uniqueSchools).sort();
        schools.forEach(school => {
            const opt = document.createElement('option');
            opt.value = school;
            opt.textContent = school;
            filterSekolah.appendChild(opt);
        });
    }

    // 4. Render Table
    function renderTable() {
        const selectedMapel = filterMapel.value;
        const selectedSekolah = filterSekolah.value;

        const welcomeSection = document.getElementById('welcome-section');
        const tableContainer = document.getElementById('table-container');

        if (!selectedMapel || selectedMapel === '') {
            welcomeSection.style.display = 'block';
            tableContainer.style.display = 'none';
            return;
        } else {
            welcomeSection.style.display = 'none';
            tableContainer.style.display = 'block';
        }

        // Filter data
        const filteredData = allData.filter(row => {
            const matchMapel = row.cabang === selectedMapel;
            const matchSekolah = selectedSekolah === 'Semua' || row.sekolah === selectedSekolah;
            return matchMapel && matchSekolah;
        });

        statPeserta.textContent = filteredData.length;
        tbody.innerHTML = '';

        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Tidak ada data yang sesuai filter.</td></tr>';
            return;
        }

        filteredData.forEach(r => {
            const tr = document.createElement('tr');
            
            // Tentukan style khusus untuk top 3
            if (r.rank === 1) tr.classList.add('top-1');
            else if (r.rank === 2) tr.classList.add('top-2');
            else if (r.rank === 3) tr.classList.add('top-3');

            tr.innerHTML = `
                <td style="text-align: center;">
                    <div class="rank-badge">${r.rank}</div>
                </td>
                <td style="font-weight: 600;">${r.nama}</td>
                <td>${r.sekolah}</td>
                <td><span style="background: rgba(15, 90, 62, 0.1); color: var(--primary); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">${r.cabang}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 5. Event Listeners
    filterMapel.addEventListener('change', renderTable);
    filterSekolah.addEventListener('change', renderTable);

    // Initial fetch
    await fetchData();

    // 6. Realtime Updates (Optional tapi bagus untuk live dashboard)
    const channel = supabaseClient.channel('public:skor_dashboard');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'skor' }, payload => {
        // Karena ada perhitungan rank ulang, kita fetch ulang saja jika ada perubahan skor
        fetchData();
    }).subscribe();
});
