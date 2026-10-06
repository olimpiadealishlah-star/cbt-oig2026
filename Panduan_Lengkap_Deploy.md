# Panduan Lengkap Deploy & Penggunaan CBT Olimpiade Al Ishlah

Panduan ini disusun agar Anda dapat melakukan *deploy* sistem CBT secara gratis dari nol hingga aplikasi siap digunakan untuk olimpiade.

---

## TAHAP 1: Persiapan Database (Supabase)

Supabase adalah layanan *database* gratis yang akan kita jadikan tempat penyimpanan soal, nilai, dan data peserta.

1. Buka [https://supabase.com/](https://supabase.com/) dan buat akun (bisa menggunakan akun GitHub/Google).
2. Setelah masuk ke *Dashboard*, klik **New Project**.
   - **Name**: Isi dengan `CBT Al Ishlah`
   - **Database Password**: Buat password yang kuat (huruf, angka, simbol) dan catat password tersebut (jangan sampai lupa).
   "DapaLupaoig"
   - **Region**: Pilih **Singapore** agar akses dari Indonesia (Gorontalo) sangat cepat.
   - Klik **Create New Project** dan tunggu beberapa menit hingga *database* selesai disiapkan.

### A. Eksekusi Skrip Database Utama
3. Di panel sebelah kiri Supabase, cari dan klik menu **SQL Editor** (ikon terminal `>_`).
4. Klik **+ New Query**.
5. Buka file `supabase/migrations/001_init.sql` dari folder proyek Anda di komputer, lalu *copy* (salin) seluruh teksnya.
6. *Paste* (tempel) di kotak SQL Editor Supabase, lalu klik tombol **Run** (di kanan bawah). 
   - *Pastikan ada notifikasi "Success". Proses ini otomatis membuat semua tabel, hak akses, dan logika fungsi.*

### B. Membuat Akun Admin
7. Buka kembali file `supabase/migrations/002_create_admin.sql` dari folder proyek Anda, lalu *copy* isinya.
8. Kembali ke **SQL Editor** Supabase, hapus teks sebelumnya, *paste* teks baru ini, lalu klik **Run**.
   - *Langkah ini membuat akun panitia pusat dengan kredensial bawaan (Username: `admin` dan Password: `adminoig*`).*

### C. Menyiapkan Tempat Penyimpanan Gambar Soal
9. Di panel sebelah kiri, klik menu **Storage** (ikon kotak arsip).
10. Klik tombol **New Bucket**.
11. Beri nama bucket tepat: `gambar-soal`. 
12. **PENTING**: Centang kotak **Public bucket** (agar gambar soal bisa dilihat siswa tanpa terblokir), lalu klik **Save**.

### D. Mengambil Kunci API
13. Di panel sebelah kiri paling bawah, klik menu **Project Settings** (ikon roda gigi).
14. Pilih sub-menu **API**.
15. Di halaman ini, Anda akan melihat bagian **Project URL** dan **Project API Keys** (cari kotak berlabel `anon` `public`).
16. Biarkan tab browser ini terbuka, kita akan menyalinnya ke konfigurasi web sebentar lagi.

---

## TAHAP 2: Konfigurasi Frontend di Komputer

1. Buka folder proyek Anda, lalu buka file `js/config.js` menggunakan Notepad atau Text Editor (seperti VS Code).
2. Pada file tersebut, Anda akan menemukan konfigurasi ini:
   ```javascript
   const CONFIG = {
       SUPABASE_URL: 'ISI_URL_DISINI',
       SUPABASE_ANON_KEY: 'ISI_ANON_KEY_DISINI',
       // ...
   }
   ```
3. Kembali ke tab browser Supabase (Project Settings > API) Anda tadi:
   - Salin URL dan tempel menggantikan teks `ISI_URL_DISINI`.
   - Salin kunci *anon/public* dan tempel menggantikan teks `ISI_ANON_KEY_DISINI`.
4. **(Penting)** Untuk mencegah web dicolong dan dipasang di luar web sekolah, ubah baris `ALLOWED_PARENT_ORIGINS` menjadi alamat website sekolah Anda, misalnya:
   `ALLOWED_PARENT_ORIGINS: ['https://alishlah.sch.id'],` 
   *(Biarkan kosong `[]` jika belum ada website khusus).*
5. Simpan file `js/config.js`.

---

## TAHAP 3: Upload dan Hosting di GitHub Pages

Aplikasi kita tidak memerlukan sewa server (hanya HTML/JS/CSS statis), sehingga Github Pages adalah solusi hosting paling stabil dan gratis 100%.

1. Buka [https://github.com/](https://github.com/) dan buat/login ke akun Anda.
2. Buat repositori baru dengan klik tombol **New Repository** (+ di pojok kanan atas).
   - **Repository Name**: Ketik `cbt-alishlah-2026`
   - Visibilitas: Pilih **Public**.
   - Klik **Create Repository**.
3. **Upload** semua file dan folder proyek Anda ke repositori ini (Bisa lewat klik *Upload files* di web GitHub, atau *drag & drop*). Pastikan file `index.html` ada di posisi paling luar.
4. Setelah file berhasil di-*upload* dan tersimpan:
   - Klik tab **Settings** di dalam repositori GitHub Anda.
   - Di menu sebelah kiri agak ke bawah, klik **Pages**.
   - Pada bagian *Build and deployment* -> *Source*, pilih **Deploy from a branch**.
   - Pada bagian *Branch*, ubah dropdown `None` menjadi **main** (atau **master**), lalu biarkan sebelahnya `/ (root)`.
   - Klik **Save**.
5. Tunggu sekitar 1-3 menit. *Refresh* halaman, GitHub akan menampilkan pesan dan link website Anda (contoh: `https://[username].github.io/cbt-alishlah-2026/`).
6. Website CBT Olimpiade Anda kini **ONLINE** dan siap diakses dari mana saja!

---

## TAHAP 4: Operasional Admin (Input Data)

Sekarang sistem sudah online, mari masukkan data soal dan peserta.

1. Akses link hosting Github Pages Anda, dan tambahkan `/admin/login.html` di akhirnya.
2. Login menggunakan:
   - **Username**: `admin`
   - **Password**: `adminoig*`
3. Setelah masuk **Dashboard Admin**:
   - **Menu Pengaturan Ujian**: Sesuaikan durasi tiap mata pelajaran (Matematika, PAI, IPA, Bahasa Inggris).
   - **Menu Manajemen Peserta**: 
     - Klik **Unduh Template CSV**.
     - Buka file CSV di Excel, isi data peserta (jangan ubah baris pertama/header). 
     - Jika sudah, import CSV tersebut ke dalam aplikasi.
   - **Menu Manajemen Soal**:
     - Gunakan tombol **Unduh Template CSV** untuk mempercepat proses pembuatan soal via Excel.
     - Jika ada soal dengan *rumus rumit/akar*, gunakan mode input Manual yang mendukung *Live Preview LaTeX* (cukup apit rumus dengan simbol `$$`, contoh: `$$ x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} $$`).
     - *Catatan: Jika ada gambar soal, unggah manual via form "Tambah/Edit Manual".*

---

## TAHAP 5: Pelaksanaan Ujian (Simulasi Siswa)

1. Siswa mengakses URL Web Sekolah (dimana IFrame aplikasi ditanam).
2. Siswa masuk dengan `Username` dan `Password` dari data peserta.
3. Siswa akan berada di **Lobby Ujian**.
   - Sistem akan melakukan tes perangkat otomatis.
   - Siswa wajib menekan **Mulai Ujian Sekarang**. Layar akan terpaksa berubah menjadi *Fullscreen* penuh (layar penuh).
4. Siswa menjawab soal. Ada fitur loncat soal via *Grid* dan tanda **Ragu-Ragu**.
5. **Anti-Kecurangan Aktif**:
   - Jika siswa menekan logo *Windows*, membuka aplikasi lain, atau membagi layar (sehingga *fullscreen* tertutup), **Sistem mendeteksi**.
   - Peringatan layar merah besar akan muncul menutupi layar.
   - Jika pelanggaran berulang melampaui batas (default: 3 kali), sesi ujian akan **Terkunci Otomatis**, dan siswa dilempar kembali ke lobby.

---

## TAHAP 6: Monitoring Live & Ekspor Klasemen

1. Sebagai Panitia, Anda harus selalu *stand-by* membuka halaman **admin/index.html**.
2. **Menu Monitoring Live**: Membantu pengawas melihat status seluruh ruang ujian (Mengerjakan, Selesai, Terkunci).
3. **Menu Log Pelanggaran**: Memonitor secara spesifik siapa siswa yang mencoba mencontek (pindah tab), kapan waktunya, dan apa tindakannya.
4. **Halaman Khusus Proyektor**: Buka `scoreboard.html` di browser laptop proyektor utama.
   - Halaman ini dirancang estetik.
   - Ia akan me-refresh skor secara real-time dan **berputar menyorot** setiap cabang perlombaan tiap 5 detik secara otomatis tanpa perlu diklik manusia.
5. **Setelah Selesai (Rekapitulasi)**:
   - Kembali ke *Dashboard Admin* -> **Menu Hasil Ujian**.
   - Pilih Cabang, tampilkan, dan klik **Ekspor CSV**.
   - Data Excel nilai matang lengkap dengan durasi dan rincian Benar/Salah sudah siap diserahkan ke Kepala Sekolah/Yayasan.

---
🎉 **Selamat, aplikasi CBT Anda sudah siap digunakan!** 
*Jika ada yang rusak pada data, Anda bisa men-reset semua dengan cara menjalankan file `001_init.sql` ulang di Supabase.*
