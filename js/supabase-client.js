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
