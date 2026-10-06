-- 002_create_admin.sql
-- Skrip untuk membuat akun Admin baru di tabel auth.users Supabase dan menyambungkannya ke tabel public.admins
-- Buka "SQL Editor" di Dashboard Supabase, lalu copy-paste dan jalankan skrip ini.

-- 1. Insert ke auth.users (Tabel bawaan Supabase Auth)
-- Gunakan pgcrypto untuk hash password
INSERT INTO auth.users (
    instance_id, 
    id, 
    aud, 
    role, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    recovery_sent_at, 
    last_sign_in_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at, 
    confirmation_token, 
    email_change, 
    email_change_token_new, 
    recovery_token
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@alishlah.sch.id', -- Ini email yang akan dibuat, frontend sudah dimodifikasi sehingga jika diketik "admin" akan diubah ke email ini.
    crypt('adminoig*', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
);

-- 2. Dapatkan UUID user yang baru dibuat, lalu insert ke tabel public.admins
INSERT INTO public.admins (user_id)
SELECT id FROM auth.users WHERE email = 'admin@alishlah.sch.id';

-- Selesai! Anda sekarang bisa login di admin/login.html dengan:
-- Username: admin
-- Password: adminoig*
