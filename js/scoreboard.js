document.addEventListener('DOMContentLoaded', async () => {
    const boards = document.getElementById('boards');
    const cabangList = ['Matematika', 'PAI', 'IPA', 'Bahasa Inggris'];
    let rotateIndex = 0;

    // Build UI
    cabangList.forEach(c => {
        const card = document.createElement('div');
        card.className = 'cabang-card';
        card.id = `card-${c.replace(/\s+/g, '-')}`;
        card.innerHTML = `
            <div class="cabang-header">${c}</div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">Rank</th>
                            <th>Nama Peserta</th>
                            <th>Asal Sekolah</th>
                            <th style="text-align:center;">Waktu</th>
                            <th style="text-align:right;">Skor</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-${c.replace(/\s+/g, '-')}">
                        <tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
        boards.appendChild(card);
    });

    // Auto rotate focus (untuk mode layar proyektor)
    setInterval(() => {
        document.querySelectorAll('.cabang-card').forEach(c => c.classList.remove('active-focus'));
        const currentCard = document.getElementById(`card-${cabangList[rotateIndex].replace(/\s+/g, '-')}`);
        if(currentCard) currentCard.classList.add('active-focus');
        rotateIndex = (rotateIndex + 1) % cabangList.length;
    }, 5000);

    // Fetch config
    const { data: cfg } = await supabaseClient.from('config').select('value').eq('key', 'app_config').single();
    if (cfg && cfg.value) {
        document.getElementById('event-name').textContent = cfg.value.nama_event || 'Olimpiade Al Ishlah';
        if (cfg.value.scoreboard_publik === false) {
            document.body.innerHTML = '<h2 style="text-align:center; margin-top:20vh; color: #2C3E50;">Scoreboard ditutup sementara.</h2>';
            return;
        }
    }

    async function fetchScores() {
        const { data, error } = await supabaseClient.from('scoreboard_publik').select('*');
        if (error) {
            console.error("Gagal mengambil data skor:", error);
            return;
        }
        
        document.getElementById('last-update').textContent = 'Terakhir diperbarui: ' + new Date().toLocaleTimeString();

        // Group by cabang
        const grouped = {};
        cabangList.forEach(c => grouped[c] = []);
        data.forEach(row => {
            if (grouped[row.cabang]) grouped[row.cabang].push(row);
        });

        cabangList.forEach(c => {
            const tbody = document.getElementById(`tbody-${c.replace(/\s+/g, '-')}`);
            if (!tbody) return;
            
            tbody.innerHTML = '';
            const rows = grouped[c];
            // Ambil top 10
            const topRows = rows.slice(0, 10);
            
            if (topRows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999;">Belum ada skor</td></tr>';
                return;
            }

            topRows.forEach((r, idx) => {
                const tr = document.createElement('tr');
                const minutes = Math.floor(r.durasi / 60);
                const seconds = r.durasi % 60;
                const timeStr = `${minutes}m ${seconds}s`;
                
                tr.innerHTML = `
                    <td style="font-weight: bold; font-size: 1.1rem; text-align: center;">
                        ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </td>
                    <td style="font-weight:600; font-size: 1.1rem;">${r.nama}</td>
                    <td style="color: var(--text-light);">${r.sekolah}</td>
                    <td style="text-align:center; color: var(--text-light); font-variant-numeric: tabular-nums;">${timeStr}</td>
                    <td style="text-align:right;" class="score-val">${parseFloat(r.skor).toFixed(1)}</td>
                `;
                tbody.appendChild(tr);
            });
        });
    }

    await fetchScores();

    // Supabase Realtime
    const channel = supabaseClient.channel('public:skor');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'skor' }, payload => {
        fetchScores();
    }).subscribe((status) => {
        const connEl = document.getElementById('conn-status');
        if (status === 'SUBSCRIBED') {
            connEl.textContent = '🟢 Realtime Aktif';
            connEl.style.color = '#fff';
        } else {
            connEl.textContent = '🔴 Koneksi Terputus (Fallback: Polling)';
            connEl.style.color = '#F1C40F';
        }
    });

    // Fallback polling jika realtime putus (misal karena limit concurrent connection paket gratis)
    setInterval(async () => {
        if (channel.state !== 'joined') {
            await fetchScores();
        }
    }, 10000);
});
