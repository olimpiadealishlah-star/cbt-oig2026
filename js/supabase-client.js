// Menggunakan UMD dari CDN Supabase (@supabase/supabase-js)
const { createClient } = supabase;

if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY || CONFIG.SUPABASE_URL.includes('xyzcompany')) {
    console.warn("PERINGATAN: Supabase URL atau Anon Key belum disetel dengan benar di js/config.js");
}

const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true
    }
});

// INTERCEPTOR DEMO ACCOUNT
const originalRpc = supabaseClient.rpc.bind(supabaseClient);
supabaseClient.rpc = async function(fnName, args) {
    // 1. Intercept Login
    if (fnName === 'peserta_login' && args && args.p_username === 'demo' && args.p_password === 'demo') {
        const demoToken = 'DEMO_TOKEN_' + Math.random().toString(36).substr(2, 9);
        const demoState = { status: 'lobby', waktu_mulai: null, jawaban: {} };
        sessionStorage.setItem(demoToken, JSON.stringify(demoState));
        return { data: { success: true, token: demoToken }, error: null };
    }

    // 2. Intercept Other RPCs for Demo
    const isDemo = args && args.p_token && args.p_token.startsWith('DEMO_TOKEN_');
    if (isDemo) {
        const demoToken = args.p_token;
        const state = JSON.parse(sessionStorage.getItem(demoToken) || '{}');
        
        await new Promise(r => setTimeout(r, 200)); // mock network delay

        switch(fnName) {
            case 'peserta_info':
                return {
                    data: {
                        success: true,
                        peserta: {
                            nama: 'Akun Demo',
                            username: 'demo',
                            cabang: 'SMA',
                            asal_sekolah: 'Sekolah Demo Al Ishlah',
                            status: state.status || 'lobby'
                        },
                        config: { durasi: { 'SMA': 120 } }
                    }, error: null
                };
            case 'mulai_ujian':
                state.status = 'mengerjakan';
                state.waktu_mulai = Date.now();
                sessionStorage.setItem(demoToken, JSON.stringify(state));
                return { data: { success: true, message: 'Ujian dimulai' }, error: null };
            case 'ambil_soal':
                const dummySoal = [];
                for(let i=1; i<=10; i++) {
                    dummySoal.push({
                        id: 'demo_soal_' + i,
                        teks_soal: `Ini adalah contoh soal demo nomor ${i}. Manakah pilihan yang paling tepat?`,
                        gambar_soal: null,
                        opsi_a: `Pilihan A untuk soal ${i}`,
                        opsi_b: `Pilihan B untuk soal ${i}`,
                        opsi_c: `Pilihan C untuk soal ${i}`,
                        opsi_d: `Pilihan D untuk soal ${i}`,
                        opsi_e: `Pilihan E untuk soal ${i}`,
                        gambar_opsi_a: null, gambar_opsi_b: null, gambar_opsi_c: null, gambar_opsi_d: null, gambar_opsi_e: null,
                    });
                }
                const startTime = state.waktu_mulai || Date.now();
                const waktuSelesai = new Date(startTime + 120 * 60 * 1000).toISOString();
                return {
                    data: {
                        success: true,
                        soal: dummySoal,
                        jawaban: state.jawaban || {},
                        waktu_selesai: waktuSelesai
                    }, error: null
                };
            case 'simpan_jawaban':
                if (!state.jawaban) state.jawaban = {};
                state.jawaban[args.p_soal_id] = { jawaban: args.p_jawaban, ragu: args.p_ragu };
                sessionStorage.setItem(demoToken, JSON.stringify(state));
                return { data: { success: true }, error: null };
            case 'heartbeat':
                return { data: { status: state.status, waktu_habis: false }, error: null };
            case 'submit_ujian':
                state.status = 'selesai';
                sessionStorage.setItem(demoToken, JSON.stringify(state));
                return { data: { success: true }, error: null };
        }
        return { data: { success: false, message: 'RPC tidak didukung di mode demo' }, error: null };
    }

    return originalRpc(fnName, args);
};
