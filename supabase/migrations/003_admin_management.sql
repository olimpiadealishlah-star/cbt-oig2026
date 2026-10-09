-- 003_admin_management.sql
-- Skrip ini menambahkan fungsi untuk membuat admin baru dari panel admin frontend.
-- Jalankan skrip ini di SQL Editor Supabase.

CREATE OR REPLACE FUNCTION admin_tambah_admin(p_username TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
    v_uid UUID;
    v_email TEXT;
BEGIN
    IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'message', 'Unauthorized'); END IF;
    
    -- Format email fiktif agar bisa masuk ke auth.users
    v_email := p_username || '@alishlah.sch.id';
    v_uid := gen_random_uuid();
    
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email, 
        crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
    );
    
    INSERT INTO public.admins (user_id) VALUES (v_uid);
    
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
