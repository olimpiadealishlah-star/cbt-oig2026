// js/auth.js

// Memori fallback jika sessionStorage diblokir
let memoryStorage = {};

const storage = {
    set: function(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.warn("sessionStorage tidak tersedia, menggunakan memory fallback.");
            memoryStorage[key] = value;
        }
    },
    get: function(key) {
        try {
            return sessionStorage.getItem(key) || memoryStorage[key] || null;
        } catch (e) {
            return memoryStorage[key] || null;
        }
    },
    remove: function(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (e) {}
        delete memoryStorage[key];
    },
    clear: function() {
        try {
            sessionStorage.clear();
        } catch(e) {}
        memoryStorage = {};
    }
};

window.cbtAuth = {
    TOKEN_KEY: 'cbt_session_token',

    getToken: function() {
        return storage.get(this.TOKEN_KEY);
    },

    setToken: function(token) {
        storage.set(this.TOKEN_KEY, token);
    },

    logout: function() {
        storage.remove(this.TOKEN_KEY);
        window.location.href = 'login.html';
    },

    login: async function(username, password) {
        const { data, error } = await supabaseClient.rpc('peserta_login', { p_username: username, p_password: password });
        
        if (error) {
            console.error("Login Error RPC:", error);
            return { success: false, message: "Terjadi kesalahan pada server." };
        }

        if (data && data.success) {
            this.setToken(data.token);
            return data;
        } else {
            return data; // {success: false, message: ...}
        }
    },

    checkLobbyAccess: async function() {
        const token = this.getToken();
        if (!token) {
            window.location.href = 'login.html';
            return null;
        }

        const { data, error } = await supabaseClient.rpc('peserta_info', { p_token: token });
        
        if (error || !data.success) {
            this.logout();
            return null;
        }
        
        return data; // {success: true, peserta: {...}, config: {...}}
    }
};
