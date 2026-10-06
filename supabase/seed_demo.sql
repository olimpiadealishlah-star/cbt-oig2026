-- seed_demo.sql

-- Default configuration
INSERT INTO config (key, value) VALUES (
    'app_config', 
    '{
        "nama_event": "Olimpiade Al Ishlah Gorontalo 2026",
        "durasi": {
            "Matematika": 120,
            "PAI": 90,
            "IPA": 120,
            "Bahasa Inggris": 90
        },
        "skor": {
            "Matematika": {"benar": 4, "salah": -1, "kosong": 0},
            "PAI": {"benar": 4, "salah": -1, "kosong": 0},
            "IPA": {"benar": 4, "salah": -1, "kosong": 0},
            "Bahasa Inggris": {"benar": 4, "salah": -1, "kosong": 0}
        },
        "batas_pelanggaran": 3,
        "acak_soal": true,
        "acak_opsi": true,
        "scoreboard_publik": true
    }'::jsonb
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Dummy Peserta (Password is 'password123')
INSERT INTO peserta (cabang, nama, asal_sekolah, username, password_hash) VALUES
('Matematika', 'Budi Santoso', 'SDN 1 Gorontalo', 'mat_budi', crypt('password123', gen_salt('bf'))),
('PAI', 'Siti Aminah', 'MIN 1 Gorontalo', 'pai_siti', crypt('password123', gen_salt('bf'))),
('IPA', 'Andi Ilham', 'SDN 2 Gorontalo', 'ipa_andi', crypt('password123', gen_salt('bf'))),
('Bahasa Inggris', 'Dewi Lestari', 'SDN 3 Gorontalo', 'ing_dewi', crypt('password123', gen_salt('bf')));

-- Dummy Soal Matematika
WITH s1 AS (
    INSERT INTO soal (cabang, no, tipe, teks_soal, opsi_a, opsi_b, opsi_c, opsi_d) 
    VALUES ('Matematika', 1, 'PG', 'Berapakah hasil dari $2 + 2$?', '3', '4', '5', '6') 
    RETURNING id
) INSERT INTO kunci_soal (soal_id, kunci) SELECT id, 'B' FROM s1;

WITH s2 AS (
    INSERT INTO soal (cabang, no, tipe, teks_soal, opsi_a, opsi_b, opsi_c, opsi_d) 
    VALUES ('Matematika', 2, 'PG', 'Nilai dari $\int_0^1 x^2 dx$ adalah...', '1/3', '1/2', '1', '0') 
    RETURNING id
) INSERT INTO kunci_soal (soal_id, kunci) SELECT id, 'A' FROM s2;

-- Dummy Soal PAI
WITH s3 AS (
    INSERT INTO soal (cabang, no, tipe, teks_soal, opsi_a, opsi_b, opsi_c, opsi_d) 
    VALUES ('PAI', 1, 'PG', 'Rukun iman yang ke-3 adalah iman kepada...', 'Malaikat', 'Kitab', 'Rasul', 'Hari Kiamat') 
    RETURNING id
) INSERT INTO kunci_soal (soal_id, kunci) SELECT id, 'B' FROM s3;

-- Dummy Soal IPA
WITH s4 AS (
    INSERT INTO soal (cabang, no, tipe, teks_soal, opsi_a, opsi_b, opsi_c, opsi_d) 
    VALUES ('IPA', 1, 'PG', 'Planet terdekat dari matahari adalah...', 'Venus', 'Mars', 'Bumi', 'Merkurius') 
    RETURNING id
) INSERT INTO kunci_soal (soal_id, kunci) SELECT id, 'D' FROM s4;

-- Dummy Soal Bahasa Inggris
WITH s5 AS (
    INSERT INTO soal (cabang, no, tipe, teks_soal, opsi_a, opsi_b, opsi_c, opsi_d) 
    VALUES ('Bahasa Inggris', 1, 'PG', 'What is the synonym of "Happy"?', 'Sad', 'Angry', 'Glad', 'Tired') 
    RETURNING id
) INSERT INTO kunci_soal (soal_id, kunci) SELECT id, 'C' FROM s5;
