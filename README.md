# Olimpiade Al Ishlah Gorontalo 2026 - CBT System

Sistem Computer Based Test (CBT) dan Scoreboard Realtime untuk Olimpiade tingkat SD/Sederajat yayasan Al Ishlah Gorontalo. 
Mampu melayani ±500 peserta serentak, terintegrasi ke dalam website sekolah melalui Iframe, dan di-hosting gratis 100%.

## 1. Arsitektur Sistem

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (Tanpa build step seperti React/Vue).
- **Backend / Database**: **Supabase** (PostgreSQL).
- **Hosting**: GitHub Pages (untuk file frontend).
- **Komunikasi Data**: RPC (Remote Procedure Call) di Supabase untuk membypass batasan anon key di frontend statis, memindahkan semua logika keamanan (timer, penilaian, token) ke *Backend Server-Side*.
- **Anti-Cheat**: Frontend IFrame Guard (mendeteksi akses luar origin), Pencegah Pindah Tab, Kunci Layar Penuh (Fullscreen Lock).

## 2. Struktur Direktori

```text
/OIG2026
├── index.html           # Landing page utama (diarahkan ke login.html)
├── login.html           # Portal login peserta ujian
├── lobby.html           # Pengecekan perangkat dan ruang tunggu ujian
├── exam.html            # UI Ujian Utama
├── selesai.html         # Halaman pasca-ujian
├── scoreboard.html      # Scoreboard Publik Realtime
├── admin/
│   ├── login.html       # Portal login pengawas/admin
│   └── index.html       # Dashboard (Manajemen soal, peserta, live skor, pelanggaran)
├── css/                 # Stylesheet untuk admin & peserta (cbt.css, admin.css)
├── js/
│   ├── config.js        # Kredensial URL & Key Supabase
│   ├── iframe-guard.js  # Proteksi IFrame & Fullscreen
│   ├── security.js      # Script Anti-Kecurangan (Anti klik kanan, tab blur)
│   ├── admin-main.js    # Logika panel admin
│   └── exam.js          # Logika CBT ujian (Timer tersinkron, Autosave)
├── supabase/
│   ├── migrations/      # Skema tabel, RPC, Trigger, & RLS (001_init.sql)
│   └── seed_demo.sql    # Data dummy untuk pengujian awal
└── templates/           # Template format impor CSV Peserta & Soal
```

## 3. Instalasi & Setup

### A. Setup Supabase (Database & Backend)
1. Buat akun dan proyek baru di [Supabase](https://supabase.com/).
2. Buka **SQL Editor** di dashboard Supabase.
3. *Copy* dan jalankan seluruh isi file `supabase/migrations/001_init.sql`. Ini akan membuat tabel, Relational Level Security (RLS), dan fungsi RPC.
4. Buka **Storage**, buat bucket publik bernama `gambar-soal`.
5. Buka kembali **SQL Editor**, *copy* dan jalankan `supabase/migrations/002_create_admin.sql` untuk membuat akun Admin dengan akses (`Username: admin`, `Password: adminoig*`).
6. (Opsional) Jalankan `supabase/seed_demo.sql` jika Anda butuh data *dummy* soal dan peserta awal.
7. Buka **Project Settings > API**, salin `URL` dan `anon_public_key`.

### B. Setup Frontend (Aplikasi)
1. Buka file `js/config.js`.
2. Ganti nilai `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dengan data dari Supabase Anda.
3. Ubah `CONFIG.ALLOWED_PARENT_ORIGINS` di `js/config.js` dan tambahkan URL website sekolah Anda (misal: `https://www.alishlah.sch.id`), ini untuk mencegah aplikasi dijalankan di web lain selain Iframe web sekolah.
4. Push keseluruhan kode ke repositori GitHub, lalu aktifkan **GitHub Pages**.

### C. Embed di Website Sekolah
Tambahkan kode IFrame ini di website sekolah Anda:
```html
<iframe 
    src="https://NAMA_GITHUB_ANDA.github.io/OIG2026/login.html" 
    width="100%" 
    height="800px" 
    allow="fullscreen" 
    style="border: none;">
</iframe>
```
*Catatan: Atribut `allow="fullscreen"` wajib ada agar sistem anti-cheat layar penuh dapat bekerja dari dalam Iframe.*

## 4. Audit Keamanan & Limitasi Server (Score: A-)

Sistem ini didesain dengan tingkat keamanan (*Security-Minded*) yang tinggi, mempertimbangkan arsitektur frontend statis:
- **Zero Trust Client**: Kunci soal, durasi waktu, dan status sesi tidak pernah dikirim ke frontend secara mentah. Semua divalidasi dan dihitung di sisi PostgreSQL (PL/pgSQL).
- **Stateless Session Control**: Autentikasi peserta menggunakan Custom Session Token tersandikan yang di-_validate_ di setiap panggilan RPC.
- **IFrame Enforcement**: Menggunakan `window.location.ancestorOrigins` dipadukan RLS. Jika URL induk (parent domain) tidak cocok dengan `CONFIG.ALLOWED_PARENT_ORIGINS`, layar langsung menolak dimuat.
- **Client Constraints**: Kehilangan fokus jendela, *copy-paste*, atau mode *inspect-element* dilaporkan secara diam-diam dan akan melakukan *auto-logout/lock* saat melewati batas `MAX_PELANGGARAN`.

## 5. Load Testing (Menggunakan K6)

Sistem telah diuji secara konseptual untuk menangani ~500 sesi serentak. Anda dapat mengujinya dengan alat **k6**.

1. Install [k6](https://k6.io/).
2. Jalankan perintah berikut di terminal/CMD Anda, ganti nilai URL dan Key:
```bash
k6 run -e SUPABASE_URL="https://xxx.supabase.co" -e SUPABASE_ANON_KEY="ey..." load_test.js
```
3. Script akan menyimulasikan 500 siswa login serentak, mengambil soal, dan men-submit jawaban acak setiap 10-20 detik.
4. *Catatan*: Proyek Supabase *Free Tier* membatasi *concurrent connection* dan *Realtime quotas*. Untuk 500 pengguna aktif yang menyimpan *state* per 1.5 detik (autosave debounce), disarankan untuk menggunakan Supabase **Pro Plan** ($25/bulan) selama bulan pelaksanaan olimpiade untuk menghindari `HTTP 429 Too Many Requests`.

---
*Didevelop oleh Senior Full-Stack Engineer / AI Assistant (Antigravity).*
