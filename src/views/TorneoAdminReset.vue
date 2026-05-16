<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '../config.js'
import { saveAuth, getSavedAuth, clearAuth } from '../auth.js'
import { useTheme } from '../useTheme.js'

const router = useRouter()
const { isDarkMode, toggleTheme } = useTheme()

const secretKey = ref(getSavedAuth() || '')
const isAuthenticated = ref(false)
const loginError = ref('')

const showResetConfirm = ref(false)
const resetConfirmText = ref('')
const resetStatus = ref('')

const login = async () => {
  if (secretKey.value.trim() === '') {
    loginError.value = 'Inserisci una chiave segreta'; return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${secretKey.value}` }
    })
    if (res.ok) {
      isAuthenticated.value = true
      saveAuth(secretKey.value)
    } else {
      loginError.value = 'Password errata'
    }
  } catch (e) {
    loginError.value = 'Errore di connessione'
  }
}

const openResetConfirm = () => {
  showResetConfirm.value = true
  resetConfirmText.value = ''
  resetStatus.value = ''
}

const resetTournament = async () => {
  if (resetConfirmText.value !== 'RESET') {
    alert('Scrivi "RESET" nel campo per confermare.')
    return
  }
  resetStatus.value = 'Resettaggio in corso...'
  try {
    const res = await fetch(`${API_BASE}/api/reset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secretKey.value}` }
    })
    if (res.ok) {
      alert('✅ Torneo resettato con successo! Reindirizzamento al setup...')
      router.push('/torneo/admin')
    } else {
      const err = await res.json().catch(() => ({}))
      resetStatus.value = err.error || 'Errore durante il reset.'
    }
  } catch (e) {
    resetStatus.value = 'Errore di connessione.'
  }
}

onMounted(() => {
  if (secretKey.value) login()
})
</script>

<template>
  <div class="app-wrapper">
    <nav class="navbar">
      <div class="container nav-container">
        <div class="brand">
          <router-link to="/torneo/admin" class="brand-text" style="text-decoration: none; color: inherit;">Reset Torneo</router-link>
        </div>
        <div class="nav-links">
          <router-link to="/torneo/admin" class="nav-link">Admin Setup</router-link>
          <router-link to="/torneo/admin/calendario" class="nav-link">Calendario</router-link>
          <router-link to="/torneo" class="nav-link">Sito Pubblico</router-link>
          <button @click="toggleTheme" class="theme-toggle" aria-label="Toggle Dark Mode">
            <svg v-if="!isDarkMode" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          </button>
        </div>
      </div>
    </nav>

    <main class="container section flex-center">
      <div v-if="!isAuthenticated" class="card login-card p-4">
        <h2 class="text-center mb-4" style="color: var(--accent-green);">Reset Torneo</h2>
        <form @submit.prevent="login">
          <div class="form-group">
            <label for="secret">Chiave Segreta</label>
            <input type="password" id="secret" name="secret" v-model="secretKey" autocomplete="current-password" class="form-control" placeholder="Inserisci la secret key" />
          </div>
          <p v-if="loginError" class="error-text">{{ loginError }}</p>
          <button type="submit" class="btn btn-primary w-100 mt-3">Accedi</button>
        </form>
      </div>

      <div v-else class="reset-page mt-4">
        <div class="card p-4 reset-section">
          <h2 style="color: #e53e3e;">⚠️ Reset Completo del Torneo</h2>
          <p class="text-secondary mt-2">
            Questa operazione cancellerà <strong>tutti i dati</strong>: squadre, partite, risultati e classifiche.
            Il torneo tornerà allo stato iniziale (fase di configurazione). Questa azione è <strong>irreversibile</strong>.
          </p>

          <div v-if="!showResetConfirm">
            <button @click="openResetConfirm" class="btn btn-danger-outline mt-4">Procedi con il Reset</button>
            <router-link to="/torneo/admin" class="btn btn-secondary mt-3" style="display: inline-block; margin-left: 1rem;">Torna al Setup</router-link>
          </div>

          <div v-else class="reset-confirm-box mt-4">
            <p><strong>Conferma finale:</strong> Scrivi <code>RESET</code> nel campo sottostante e clicca su "Conferma Reset" per cancellare definitivamente tutti i dati del torneo.</p>
            <div style="display: flex; gap: 1rem; align-items: center;" class="mt-3">
              <input type="text" class="form-control" v-model="resetConfirmText" placeholder="Scrivi RESET" style="max-width: 200px;" @keyup.enter="resetTournament" />
              <button @click="resetTournament" class="btn btn-danger" :disabled="resetConfirmText !== 'RESET'">Conferma Reset</button>
              <button @click="showResetConfirm = false; resetConfirmText = ''" class="btn btn-secondary">Annulla</button>
            </div>
            <p v-if="resetStatus" class="mt-3" :style="{ color: resetStatus.includes('successo') || resetStatus.includes('Reindirizzamento') ? 'var(--accent-green)' : '#e53e3e' }">{{ resetStatus }}</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--nav-bg);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--card-border);
  padding: 0.5rem 0;
}
.nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand-text {
  font-size: 1.5rem;
  font-weight: bold;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.nav-link {
  font-weight: 700;
  color: var(--text-secondary);
  text-decoration: none;
  font-family: 'Fredoka', sans-serif;
}
.nav-link:hover {
  color: var(--accent-green);
}
.theme-toggle {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
}
.section {
  padding: 3rem 1.5rem;
  flex: 1;
}
.flex-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.login-card {
  width: 100%;
  max-width: 400px;
  margin-top: 5rem;
}
.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
}
.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--card-border);
  border-radius: 0.5rem;
  background: var(--bg-color);
  color: var(--text-primary);
  font-family: inherit;
}
.w-100 { width: 100%; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 1rem; }
.mt-4 { margin-top: 2rem; }
.mb-4 { margin-bottom: 1.5rem; }
.text-center { text-align: center; }
.text-secondary { color: var(--text-secondary); }
.error-text { color: #e53e3e; font-size: 0.9rem; margin-top: 0.5rem; }
.reset-page { width: 100%; max-width: 600px; }
.reset-section {
  border: 2px dashed #e53e3e;
  background: rgba(229, 62, 62, 0.03);
}
.btn-danger-outline {
  background: transparent;
  color: #e53e3e;
  border: 2px solid #e53e3e;
  padding: 0.8rem 1.8rem;
  border-radius: 9999px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-danger-outline:hover {
  background: #e53e3e;
  color: white;
}
.btn-danger {
  background-color: transparent;
  color: #e53e3e;
  border: 1px solid #e53e3e;
  cursor: pointer;
  padding: 0.8rem 1.8rem;
  border-radius: 9999px;
  font-weight: 700;
}
.btn-danger:hover {
  background-color: #e53e3e;
  color: white;
}
.btn-danger:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-secondary {
  background: var(--card-border);
  color: var(--text-primary);
  border: none;
  padding: 0.8rem 1.8rem;
  border-radius: 9999px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}
.reset-confirm-box {
  padding: 1rem;
  background: rgba(229, 62, 62, 0.08);
  border-radius: 1rem;
  border: 1px solid #e53e3e;
}
.reset-confirm-box code {
  background: var(--card-border);
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  font-weight: bold;
  color: #e53e3e;
}
</style>
