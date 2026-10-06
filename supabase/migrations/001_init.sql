-- 001_init.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tables
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

CREATE TABLE admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE peserta_status AS ENUM ('belum', 'mengerjakan', 'selesai', 'terkunci');

CREATE TABLE peserta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabang TEXT NOT NULL,
    nama TEXT NOT NULL,
    asal_sekolah TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    status peserta_status DEFAULT 'belum',
    session_token TEXT,
    session_expires TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_peserta_cabang ON peserta(cabang);
CREATE INDEX idx_peserta_token ON peserta(session_token);

CREATE TYPE tipe_soal AS ENUM ('PG', 'PG_KOMPLEKS', 'ISIAN');

CREATE TABLE soal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabang TEXT NOT NULL,
    no INTEGER NOT NULL,
    tipe tipe_soal DEFAULT 'PG',
    teks_soal TEXT NOT NULL,
    gambar_soal TEXT,
    opsi_a TEXT,
    opsi_b TEXT,
    opsi_c TEXT,
    opsi_d TEXT,
    opsi_e TEXT,
    gambar_opsi_a TEXT,
    gambar_opsi_b TEXT,
    gambar_opsi_c TEXT,
    gambar_opsi_d TEXT,
    gambar_opsi_e TEXT,
    bobot NUMERIC DEFAULT 1,
    pembahasan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cabang, no)
);
CREATE INDEX idx_soal_cabang ON soal(cabang);

CREATE TABLE kunci_soal (
    soal_id UUID PRIMARY KEY REFERENCES soal(id) ON DELETE CASCADE,
    kunci TEXT NOT NULL
);

CREATE TYPE sesi_status AS ENUM ('aktif', 'selesai');

CREATE TABLE sesi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    peserta_id UUID REFERENCES peserta(id) ON DELETE CASCADE,
    cabang TEXT NOT NULL,
    waktu_mulai TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    waktu_selesai TIMESTAMPTZ NOT NULL,
    waktu_submit TIMESTAMPTZ,
    status sesi_status DEFAULT 'aktif',
    urutan_soal JSONB,
    urutan_opsi JSONB,
    jumlah_pelanggaran INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sesi_peserta ON sesi(peserta_id);

CREATE TABLE jawaban (
    sesi_id UUID REFERENCES sesi(id) ON DELETE CASCADE,
    soal_id UUID REFERENCES soal(id) ON DELETE CASCADE,
    jawaban TEXT,
    ragu BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (sesi_id, soal_id)
);

CREATE TABLE skor (
    peserta_id UUID PRIMARY KEY REFERENCES peserta(id) ON DELETE CASCADE,
    sesi_id UUID REFERENCES sesi(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    sekolah TEXT NOT NULL,
    cabang TEXT NOT NULL,
    benar INTEGER DEFAULT 0,
    salah INTEGER DEFAULT 0,
    kosong INTEGER DEFAULT 0,
    skor_akhir NUMERIC DEFAULT 0,
    durasi_detik INTEGER DEFAULT 0,
    waktu_submit TIMESTAMPTZ DEFAULT NOW(),
    jumlah_pelanggaran INTEGER DEFAULT 0
);
CREATE INDEX idx_skor_cabang_skor ON skor(cabang, skor_akhir DESC, durasi_detik ASC);

CREATE TABLE pelanggaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waktu TIMESTAMPTZ DEFAULT NOW(),
    peserta_id UUID REFERENCES peserta(id) ON DELETE CASCADE,
    sesi_id UUID REFERENCES sesi(id) ON DELETE CASCADE,
    jenis TEXT NOT NULL,
    detail TEXT,
    urutan_ke INTEGER NOT NULL,
    tindakan TEXT NOT NULL
);

CREATE TABLE log_admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waktu TIMESTAMPTZ DEFAULT NOW(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    aksi TEXT NOT NULL,
    detail JSONB
);

CREATE VIEW scoreboard_publik AS
SELECT nama, sekolah, cabang, skor_akhir as skor, durasi_detik as durasi, waktu_submit
FROM skor
ORDER BY cabang, skor_akhir DESC, durasi_detik ASC, waktu_submit ASC;

-- 2. RLS & Security

ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE kunci_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesi ENABLE ROW LEVEL SECURITY;
ALTER TABLE jawaban ENABLE ROW LEVEL SECURITY;
ALTER TABLE skor ENABLE ROW LEVEL SECURITY;
ALTER TABLE pelanggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_admin ENABLE ROW LEVEL SECURITY;

-- Helper to check admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies (can do anything if they are in admins table)
CREATE POLICY "Admins full access config" ON config FOR ALL USING (is_admin());
CREATE POLICY "Admins full access admins" ON admins FOR ALL USING (is_admin());
CREATE POLICY "Admins full access peserta" ON peserta FOR ALL USING (is_admin());
CREATE POLICY "Admins full access soal" ON soal FOR ALL USING (is_admin());
CREATE POLICY "Admins full access kunci_soal" ON kunci_soal FOR ALL USING (is_admin());
CREATE POLICY "Admins full access sesi" ON sesi FOR ALL USING (is_admin());
CREATE POLICY "Admins full access jawaban" ON jawaban FOR ALL USING (is_admin());
CREATE POLICY "Admins full access skor" ON skor FOR ALL USING (is_admin());
CREATE POLICY "Admins full access pelanggaran" ON pelanggaran FOR ALL USING (is_admin());
CREATE POLICY "Admins full access log_admin" ON log_admin FOR ALL USING (is_admin());

-- Public (anon) policies
CREATE POLICY "Anon read config" ON config FOR SELECT USING (true);
CREATE POLICY "Anon read skor for scoreboard" ON skor FOR SELECT USING (
    COALESCE((SELECT (value->>'scoreboard_publik')::boolean FROM config WHERE key = 'app_config'), false) = true
);

-- 3. Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('gambar-soal', 'gambar-soal', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Public read gambar-soal" ON storage.objects FOR SELECT USING (bucket_id = 'gambar-soal');
CREATE POLICY "Admin write gambar-soal" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gambar-soal' AND is_admin());
CREATE POLICY "Admin update gambar-soal" ON storage.objects FOR UPDATE USING (bucket_id = 'gambar-soal' AND is_admin());
CREATE POLICY "Admin delete gambar-soal" ON storage.objects FOR DELETE USING (bucket_id = 'gambar-soal' AND is_admin());

-- 4. RPC Functions (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION peserta_login(p_username TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
    v_peserta RECORD;
    v_token TEXT;
BEGIN
    SELECT * INTO v_peserta FROM peserta WHERE username = p_username;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Username atau password salah.');
    END IF;
    
    IF v_peserta.status = 'terkunci' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Akun terkunci. Hubungi pengawas.');
    END IF;

    IF v_peserta.password_hash = crypt(p_password, v_peserta.password_hash) THEN
        v_token := encode(gen_random_bytes(32), 'hex');
        
        UPDATE peserta 
        SET session_token = v_token, 
            session_expires = NOW() + INTERVAL '12 hours', 
            last_seen = NOW()
        WHERE id = v_peserta.id;
        
        RETURN jsonb_build_object('success', true, 'token', v_token, 'cabang', v_peserta.cabang, 'nama', v_peserta.nama);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Username atau password salah.');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION peserta_info(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_peserta RECORD;
    v_config JSONB;
BEGIN
    SELECT * INTO v_peserta FROM peserta WHERE session_token = p_token AND session_expires > NOW();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Token tidak valid atau kedaluwarsa.');
    END IF;
    
    SELECT value INTO v_config FROM config WHERE key = 'app_config';
    
    RETURN jsonb_build_object(
        'success', true,
        'peserta', jsonb_build_object(
            'id', v_peserta.id,
            'nama', v_peserta.nama,
            'cabang', v_peserta.cabang,
            'status', v_peserta.status,
            'asal_sekolah', v_peserta.asal_sekolah
        ),
        'config', v_config
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION mulai_ujian(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_peserta RECORD;
    v_config JSONB;
    v_durasi_menit INTEGER;
    v_soal_ids JSONB;
    v_sesi_id UUID;
    v_waktu_selesai TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_peserta FROM peserta WHERE session_token = p_token AND session_expires > NOW();
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Token invalid'); END IF;

    IF v_peserta.status = 'terkunci' THEN RETURN jsonb_build_object('success', false, 'message', 'Akun terkunci'); END IF;
    IF v_peserta.status = 'selesai' THEN RETURN jsonb_build_object('success', false, 'message', 'Anda sudah menyelesaikan ujian'); END IF;

    SELECT value INTO v_config FROM config WHERE key = 'app_config';
    v_durasi_menit := COALESCE((v_config->'durasi'->>v_peserta.cabang)::INTEGER, 120);

    IF v_peserta.status = 'belum' THEN
        SELECT jsonb_agg(id) INTO v_soal_ids FROM (
            SELECT id FROM soal WHERE cabang = v_peserta.cabang 
            ORDER BY (CASE WHEN COALESCE((v_config->>'acak_soal')::boolean, true) THEN random() ELSE no::float END)
        ) s;
        
        v_waktu_selesai := NOW() + (v_durasi_menit || ' minutes')::interval;

        INSERT INTO sesi (peserta_id, cabang, waktu_selesai, urutan_soal)
        VALUES (v_peserta.id, v_peserta.cabang, v_waktu_selesai, v_soal_ids)
        RETURNING id INTO v_sesi_id;

        UPDATE peserta SET status = 'mengerjakan' WHERE id = v_peserta.id;

        RETURN jsonb_build_object('success', true, 'sesi_id', v_sesi_id, 'waktu_selesai', v_waktu_selesai);
    ELSIF v_peserta.status = 'mengerjakan' THEN
        SELECT id, waktu_selesai INTO v_sesi_id, v_waktu_selesai FROM sesi WHERE peserta_id = v_peserta.id AND status = 'aktif';
        RETURN jsonb_build_object('success', true, 'sesi_id', v_sesi_id, 'waktu_selesai', v_waktu_selesai, 'message', 'Melanjutkan sesi');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION ambil_soal(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_peserta RECORD;
    v_sesi RECORD;
    v_soal JSONB;
    v_jawaban JSONB;
BEGIN
    SELECT * INTO v_peserta FROM peserta WHERE session_token = p_token AND session_expires > NOW();
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Token invalid'); END IF;

    SELECT * INTO v_sesi FROM sesi WHERE peserta_id = v_peserta.id AND status = 'aktif';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Tidak ada sesi aktif'); END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'no', s.no,
            'tipe', s.tipe,
            'teks_soal', s.teks_soal,
            'gambar_soal', s.gambar_soal,
            'opsi_a', s.opsi_a, 'opsi_b', s.opsi_b, 'opsi_c', s.opsi_c, 'opsi_d', s.opsi_d, 'opsi_e', s.opsi_e,
            'gambar_opsi_a', s.gambar_opsi_a, 'gambar_opsi_b', s.gambar_opsi_b, 'gambar_opsi_c', s.gambar_opsi_c, 'gambar_opsi_d', s.gambar_opsi_d, 'gambar_opsi_e', s.gambar_opsi_e
        )
    ), '[]'::jsonb) INTO v_soal
    FROM jsonb_array_elements_text(v_sesi.urutan_soal) WITH ORDINALITY t(soal_id, ord)
    JOIN soal s ON s.id::text = t.soal_id;

    SELECT jsonb_object_agg(j.soal_id, jsonb_build_object('jawaban', j.jawaban, 'ragu', j.ragu)) INTO v_jawaban
    FROM jawaban j
    WHERE j.sesi_id = v_sesi.id;

    RETURN jsonb_build_object(
        'success', true, 
        'soal', v_soal, 
        'jawaban', COALESCE(v_jawaban, '{}'::jsonb),
        'waktu_selesai', v_sesi.waktu_selesai,
        'waktu_sekarang', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION simpan_jawaban(p_token TEXT, p_soal_id UUID, p_jawaban TEXT, p_ragu BOOLEAN)
RETURNS JSONB AS $$
DECLARE
    v_peserta RECORD;
    v_sesi RECORD;
BEGIN
    SELECT * INTO v_peserta FROM peserta WHERE session_token = p_token AND session_expires > NOW();
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Token invalid'); END IF;

    SELECT * INTO v_sesi FROM sesi WHERE peserta_id = v_peserta.id AND status = 'aktif';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Sesi tidak aktif'); END IF;

    IF NOW() > v_sesi.waktu_selesai THEN
        RETURN jsonb_build_object('success', false, 'message', 'Waktu habis');
    END IF;

    INSERT INTO jawaban (sesi_id, soal_id, jawaban, ragu, updated_at)
    VALUES (v_sesi.id, p_soal_id, p_jawaban, p_ragu, NOW())
    ON CONFLICT (sesi_id, soal_id) DO UPDATE 
    SET jawaban = EXCLUDED.jawaban, ragu = EXCLUDED.ragu, updated_at = NOW();

    UPDATE peserta SET last_seen = NOW() WHERE id = v_peserta.id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION heartbeat(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_peserta RECORD;
    v_sesi RECORD;
BEGIN
    SELECT * INTO v_peserta FROM peserta WHERE session_token = p_token AND session_expires > NOW();
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Token invalid'); END IF;
    
    UPDATE peserta SET last_seen = NOW() WHERE id = v_peserta.id;

    SELECT * INTO v_sesi FROM sesi WHERE peserta_id = v_peserta.id AND status = 'aktif';
    IF FOUND AND NOW() > v_sesi.waktu_selesai THEN
        RETURN jsonb_build_object('success', true, 'status', v_peserta.status, 'waktu_habis', true, 'waktu_sekarang', NOW());
    END IF;

    RETURN jsonb_build_object('success', true, 'status', v_peserta.status, 'waktu_sekarang', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION catat_pelanggaran(p_token TEXT, p_jenis TEXT, p_detail TEXT)
RETURNS JSONB AS $$
DECLARE
    v_peserta RECORD;
    v_sesi RECORD;
    v_config JSONB;
    v_batas INTEGER;
    v_urutan INTEGER;
    v_tindakan TEXT;
BEGIN
    SELECT * INTO v_peserta FROM peserta WHERE session_token = p_token AND session_expires > NOW();
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Token invalid'); END IF;
    
    SELECT * INTO v_sesi FROM sesi WHERE peserta_id = v_peserta.id AND status = 'aktif';
    
    SELECT value INTO v_config FROM config WHERE key = 'app_config';
    v_batas := COALESCE((v_config->>'batas_pelanggaran')::INTEGER, 3);
    
    IF FOUND THEN
        UPDATE sesi SET jumlah_pelanggaran = jumlah_pelanggaran + 1 WHERE id = v_sesi.id RETURNING jumlah_pelanggaran INTO v_urutan;
    ELSE
        v_urutan := 1;
    END IF;

    IF v_urutan >= v_batas THEN
        v_tindakan := 'kunci_akun';
        UPDATE peserta SET status = 'terkunci' WHERE id = v_peserta.id;
    ELSE
        v_tindakan := 'peringatan';
    END IF;

    INSERT INTO pelanggaran (peserta_id, sesi_id, jenis, detail, urutan_ke, tindakan)
    VALUES (v_peserta.id, v_sesi.id, p_jenis, p_detail, v_urutan, v_tindakan);

    RETURN jsonb_build_object('success', true, 'tindakan', v_tindakan, 'urutan_ke', v_urutan);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION submit_ujian(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_peserta RECORD;
    v_sesi RECORD;
    v_config JSONB;
    v_skor_config JSONB;
    v_j RECORD;
    v_kunci RECORD;
    v_benar INTEGER := 0;
    v_salah INTEGER := 0;
    v_kosong INTEGER := 0;
    v_skor_akhir NUMERIC := 0;
    v_durasi INTEGER;
BEGIN
    SELECT * INTO v_peserta FROM peserta WHERE session_token = p_token;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Token invalid'); END IF;

    SELECT * INTO v_sesi FROM sesi WHERE peserta_id = v_peserta.id AND status = 'aktif';
    IF NOT FOUND THEN 
        IF v_peserta.status = 'selesai' THEN
            RETURN jsonb_build_object('success', true, 'message', 'Ujian sudah disubmit sebelumnya');
        END IF;
        RETURN jsonb_build_object('success', false, 'message', 'Sesi tidak aktif'); 
    END IF;

    SELECT value INTO v_config FROM config WHERE key = 'app_config';
    v_skor_config := v_config->'skor'->(v_peserta.cabang);
    IF v_skor_config IS NULL THEN
        v_skor_config := '{"benar": 4, "salah": -1, "kosong": 0}'::jsonb;
    END IF;

    FOR v_kunci IN SELECT ks.soal_id, ks.kunci, s.bobot FROM kunci_soal ks JOIN soal s ON s.id = ks.soal_id WHERE s.cabang = v_peserta.cabang LOOP
        SELECT jawaban INTO v_j FROM jawaban WHERE sesi_id = v_sesi.id AND soal_id = v_kunci.soal_id;
        
        IF NOT FOUND OR v_j.jawaban IS NULL OR v_j.jawaban = '' THEN
            v_kosong := v_kosong + 1;
            v_skor_akhir := v_skor_akhir + ((v_skor_config->>'kosong')::NUMERIC * v_kunci.bobot);
        ELSIF v_j.jawaban = v_kunci.kunci THEN
            v_benar := v_benar + 1;
            v_skor_akhir := v_skor_akhir + ((v_skor_config->>'benar')::NUMERIC * v_kunci.bobot);
        ELSE
            v_salah := v_salah + 1;
            v_skor_akhir := v_skor_akhir + ((v_skor_config->>'salah')::NUMERIC * v_kunci.bobot);
        END IF;
    END LOOP;

    UPDATE sesi SET status = 'selesai', waktu_submit = NOW() WHERE id = v_sesi.id;
    UPDATE peserta SET status = 'selesai', session_token = NULL WHERE id = v_peserta.id;

    v_durasi := EXTRACT(EPOCH FROM (NOW() - v_sesi.waktu_mulai))::INTEGER;
    
    INSERT INTO skor (peserta_id, sesi_id, nama, sekolah, cabang, benar, salah, kosong, skor_akhir, durasi_detik, jumlah_pelanggaran)
    VALUES (v_peserta.id, v_sesi.id, v_peserta.nama, v_peserta.asal_sekolah, v_peserta.cabang, v_benar, v_salah, v_kosong, v_skor_akhir, v_durasi, v_sesi.jumlah_pelanggaran)
    ON CONFLICT (peserta_id) DO UPDATE SET
        sesi_id = EXCLUDED.sesi_id, benar = EXCLUDED.benar, salah = EXCLUDED.salah, kosong = EXCLUDED.kosong,
        skor_akhir = EXCLUDED.skor_akhir, durasi_detik = EXCLUDED.durasi_detik, waktu_submit = NOW(), jumlah_pelanggaran = EXCLUDED.jumlah_pelanggaran;

    RETURN jsonb_build_object('success', true, 'skor_akhir', v_skor_akhir);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin specific RPCs

CREATE OR REPLACE FUNCTION admin_import_peserta(p_rows JSONB)
RETURNS JSONB AS $$
DECLARE
    row JSONB;
    v_res JSONB := '[]'::jsonb;
    v_hash TEXT;
BEGIN
    IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'message', 'Unauthorized'); END IF;

    FOR row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
        BEGIN
            v_hash := crypt(row->>'password', gen_salt('bf', 8));
            INSERT INTO peserta (cabang, nama, asal_sekolah, username, password_hash)
            VALUES (row->>'cabang', row->>'nama', row->>'asal_sekolah', row->>'username', v_hash);
            
            v_res := v_res || jsonb_build_object('username', row->>'username', 'status', 'ok');
        EXCEPTION WHEN OTHERS THEN
            v_res := v_res || jsonb_build_object('username', row->>'username', 'status', 'error', 'message', SQLERRM);
        END;
    END LOOP;
    
    INSERT INTO log_admin (admin_id, aksi, detail) VALUES (auth.uid(), 'import_peserta', jsonb_build_object('count', jsonb_array_length(p_rows)));
    RETURN jsonb_build_object('success', true, 'results', v_res);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_import_soal(p_rows JSONB)
RETURNS JSONB AS $$
DECLARE
    row JSONB;
    v_res JSONB := '[]'::jsonb;
    v_soal_id UUID;
BEGIN
    IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'message', 'Unauthorized'); END IF;

    FOR row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
        BEGIN
            INSERT INTO soal (cabang, no, tipe, teks_soal, gambar_soal, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, gambar_opsi_a, gambar_opsi_b, gambar_opsi_c, gambar_opsi_d, gambar_opsi_e, bobot, pembahasan)
            VALUES (
                row->>'cabang', (row->>'no')::INTEGER, COALESCE((row->>'tipe')::tipe_soal, 'PG'), row->>'teks_soal', row->>'gambar_soal',
                row->>'opsi_a', row->>'opsi_b', row->>'opsi_c', row->>'opsi_d', row->>'opsi_e',
                row->>'gambar_opsi_a', row->>'gambar_opsi_b', row->>'gambar_opsi_c', row->>'gambar_opsi_d', row->>'gambar_opsi_e',
                COALESCE((row->>'bobot')::NUMERIC, 1), row->>'pembahasan'
            ) RETURNING id INTO v_soal_id;

            INSERT INTO kunci_soal (soal_id, kunci) VALUES (v_soal_id, row->>'kunci');
            
            v_res := v_res || jsonb_build_object('cabang', row->>'cabang', 'no', row->>'no', 'status', 'ok');
        EXCEPTION WHEN OTHERS THEN
            v_res := v_res || jsonb_build_object('cabang', row->>'cabang', 'no', row->>'no', 'status', 'error', 'message', SQLERRM);
        END;
    END LOOP;
    
    INSERT INTO log_admin (admin_id, aksi, detail) VALUES (auth.uid(), 'import_soal', jsonb_build_object('count', jsonb_array_length(p_rows)));
    RETURN jsonb_build_object('success', true, 'results', v_res);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
