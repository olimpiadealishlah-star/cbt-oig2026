document.addEventListener('DOMContentLoaded', async () => {
    const boards = document.getElementById('boards');
    const cabangList = ['Matematika', 'PAI', 'IPA', 'Bahasa Inggris'];

    // 1. Build UI Skeleton
    cabangList.forEach(c => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.id = `card-${c.replace(/\s+/g, '-')}`;
        
        card.innerHTML = `
            <div class="subject-header">
                <h2>${c}</h2>
            </div>
            <div class="ranking-list" id="list-${c.replace(/\s+/g, '-')}">
                <div class="rank-item" style="justify-content: center; color: var(--text-muted);">
                    Memuat data peringkat...
                </div>
            </div>
        `;
        boards.appendChild(card);
    });

    // 2. Fetch Config
    try {
        const { data: cfg } = await supabaseClient.from('config').select('value').eq('key', 'app_config').single();
        if (cfg && cfg.value) {
            if (cfg.value.nama_event) {
                document.getElementById('event-name').textContent = cfg.value.nama_event;
            }
            // You can optionally add a config to hide the top 10 announcement if needed
            if (cfg.value.pengumuman_publik === false) {
                document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh;"><h2 style="color: var(--text-muted);">Pengumuman Peringkat belum dirilis.</h2></div>';
                return;
            }
        }
    } catch (e) {
        console.warn("Gagal load config", e);
    }

    // 3. Fetch Scores and Process Ranking
    async function fetchRankings() {
        // Fetch scores, order by skor_akhir descending, then durasi_detik ascending to resolve ties
        const { data, error } = await supabaseClient
            .from('skor')
            .select('nama, sekolah, cabang, skor_akhir, durasi_detik, benar')
            .order('skor_akhir', { ascending: false })
            .order('durasi_detik', { ascending: true });
            
        if (error) {
            console.error("Gagal mengambil data peringkat:", error);
            boards.innerHTML = '<div style="text-align:center; width:100%; color:#ef4444;">Gagal memuat data. Silakan muat ulang halaman.</div>';
            return;
        }

        // Group data by cabang
        const grouped = {};
        cabangList.forEach(c => grouped[c] = []);
        data.forEach(row => {
            if (grouped[row.cabang]) grouped[row.cabang].push(row);
        });

        // Render top 10 per cabang
        cabangList.forEach(c => {
            const listContainer = document.getElementById(`list-${c.replace(/\s+/g, '-')}`);
            if (!listContainer) return;
            
            listContainer.innerHTML = '';
            
            const rows = grouped[c];
            const top10 = rows.slice(0, 10);
            
            if (top10.length === 0) {
                listContainer.innerHTML = `
                    <div class="rank-item" style="justify-content: center; color: var(--text-muted);">
                        Belum ada data skor.
                    </div>
                `;
                return;
            }

            top10.forEach((r, idx) => {
                const rankClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
                const rankLabel = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1);

                const item = document.createElement('div');
                item.className = `rank-item ${rankClass}`;
                item.style.animationDelay = `${idx * 0.1}s`;
                item.style.animation = `fadeIn 0.5s ease-out backwards`;
                item.style.cursor = 'pointer';
                item.title = "Klik untuk melihat detail";

                const minutes = Math.floor(r.durasi_detik / 60);
                const seconds = r.durasi_detik % 60;
                const timeStr = `${minutes}m ${seconds}s`;
                const points = (r.benar || 0) * 3;

                item.innerHTML = `
                    <div class="rank-number">${rankLabel}</div>
                    <div class="student-info">
                        <div class="student-name">${r.nama}</div>
                        <div class="student-school">${r.sekolah}</div>
                        <div class="student-details" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(0,0,0,0.1); font-size: 0.95rem; color: var(--text-main);">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>Jawaban Benar</span>
                                <strong>${r.benar || 0} Soal</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>Durasi Pengerjaan</span>
                                <strong>${timeStr}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; background: rgba(15, 90, 62, 0.05); padding: 4px 8px; border-radius: 4px; margin-top: 6px;">
                                <span style="color: var(--primary); font-weight: 600;">Total Poin</span>
                                <strong style="color: var(--primary); font-size: 1.1rem;">${points}</strong>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add click event for accordion toggle
                item.addEventListener('click', () => {
                    const details = item.querySelector('.student-details');
                    if (details.style.display === 'none') {
                        details.style.display = 'block';
                        item.style.background = '#FFFFFF';
                        item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                    } else {
                        details.style.display = 'none';
                        item.style.background = '';
                        item.style.boxShadow = '';
                    }
                });

                listContainer.appendChild(item);
            });
        });
    }

    await fetchRankings();

    // 4. Realtime Updates (Optional: Jika sedang berlangsung lomba tapi ingin auto update pengumumannya)
    const channel = supabaseClient.channel('public:skor_pengumuman');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'skor' }, payload => {
        fetchRankings();
    }).subscribe();

});
