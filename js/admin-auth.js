document.addEventListener('DOMContentLoaded', async () => {
    // Cek sesi
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    // Redirect logic
    if (session) {
        if (window.location.pathname.endsWith('login.html')) {
            window.location.href = 'index.html';
        }
    } else {
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    }

    // Login Form Handler
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-login');
            const msg = document.getElementById('login-message');
            btn.disabled = true;
            btn.textContent = 'Memuat...';
            msg.textContent = '';

            let email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email.includes('@')) {
                email = email + '@alishlah.sch.id';
            }

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            
            if (error) {
                msg.textContent = error.message;
                btn.disabled = false;
                btn.textContent = 'Masuk';
            } else {
                // Cek apakah user ada di tabel admins
                const { data: adminCheck, error: errCheck } = await supabaseClient
                    .from('admins')
                    .select('user_id')
                    .eq('user_id', data.user.id)
                    .single();
                
                if (errCheck || !adminCheck) {
                    msg.textContent = "Akun Anda tidak memiliki akses Admin.";
                    await supabaseClient.auth.signOut();
                    btn.disabled = false;
                    btn.textContent = 'Masuk';
                } else {
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // Logout Handler
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        });
    }
});
