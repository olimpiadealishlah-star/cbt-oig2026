import http from 'k6/http';
import { check, sleep } from 'k6';

// Konfigurasi K6
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up ke 50 peserta dalam 30s
    { duration: '1m', target: 500 },  // Ramp up ke 500 peserta dalam 1 menit
    { duration: '3m', target: 500 },  // Bertahan di 500 peserta selama 3 menit
    { duration: '30s', target: 0 },   // Ramp down
  ],
};

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

export default function () {
  // Simulasi 1: Login
  const loginPayload = JSON.stringify({
    p_username: `user_${__VU}`, // Virtual User ID dari k6 (1-500)
    p_password: 'rahasia123'
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
  };

  // Panggil RPC login
  const loginRes = http.post(`${SUPABASE_URL}/rest/v1/rpc/peserta_login`, loginPayload, params);
  
  check(loginRes, {
    'login success': (r) => r.status === 200,
  });

  let token = null;
  try {
    const resBody = JSON.parse(loginRes.body);
    if(resBody && resBody.token) {
        token = resBody.token;
    }
  } catch(e) {}

  if (!token) return; // Hentikan iterasi VU jika gagal login

  sleep(Math.random() * 2 + 1); // Jeda sebelum mulai ujian 1-3 detik

  // Simulasi 2: Mulai Ujian
  const mulaiPayload = JSON.stringify({ p_token: token });
  const mulaiRes = http.post(`${SUPABASE_URL}/rest/v1/rpc/mulai_ujian`, mulaiPayload, params);
  
  check(mulaiRes, {
    'mulai ujian success': (r) => r.status === 200,
  });

  sleep(Math.random() * 5 + 5); // Baca soal 5-10 detik

  // Simulasi 3: Simpan Jawaban (dummy)
  const simpanPayload = JSON.stringify({
    p_token: token,
    p_soal_id: `00000000-0000-0000-0000-000000000000`, // UUID dummy, karena fetch UUID asli sulit di k6 tanpa parsing kompleks
    p_jawaban: 'A',
    p_ragu: false
  });
  
  const simpanRes = http.post(`${SUPABASE_URL}/rest/v1/rpc/simpan_jawaban`, simpanPayload, params);
  check(simpanRes, {
    'simpan jawaban success (atau handled by RPC)': (r) => r.status === 200,
  });
  
  sleep(Math.random() * 10 + 10);
}
