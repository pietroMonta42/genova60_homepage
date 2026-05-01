<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'

const isDarkMode = ref(document.documentElement.getAttribute('data-theme') === 'dark')
const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light')
}

const secretKey = ref(localStorage.getItem('genova60_secret') || '')
const isAuthenticated = ref(false)
const loginError = ref('')
const matches = ref([])
let pollingInterval = null

const login = async () => {
  if (secretKey.value.trim() === '') {
    loginError.value = 'Inserisci una chiave segreta'; return;
  }
  try {
    const res = await fetch('http://localhost:8787/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${secretKey.value}` }
    })
    if (res.ok) {
      isAuthenticated.value = true
      localStorage.setItem('genova60_secret', secretKey.value)
      await fetchMatches()
      // Auto-refresh every 10 seconds
      pollingInterval = setInterval(fetchMatches, 10000)
    } else {
      loginError.value = 'Password errata'
    }
  } catch (e) {
    loginError.value = 'Errore di connessione'
  }
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${secretKey.value}`
})

const fetchMatches = async () => {
  try {
    const res = await fetch('http://localhost:8787/api/matches')
    if (res.ok) {
        matches.value = await res.json()
    }
  } catch(e) {
    console.error("Error fetching matches", e)
  }
}

onMounted(() => {
    if (secretKey.value) login();
})

onUnmounted(() => {
    if(pollingInterval) clearInterval(pollingInterval)
})

const scheduledMatches = computed(() => matches.value.filter(m => m.status === 'scheduled'))
const inProgressMatches = computed(() => matches.value.filter(m => m.status === 'in_progress'))
const completedMatches = computed(() => matches.value.filter(m => m.status === 'completed'))

const formatTime = (isoString) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
}

const updateMatch = async (match, newStatus) => {
    try {
        const payload = {
            status: newStatus || match.status,
            score1: match.score1,
            score2: match.score2,
            team1_id: match.t1_id, // we need IDs to update points if completed
            team2_id: match.t2_id
        }
        
        const res = await fetch(`http://localhost:8787/api/matches/${match.id}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        })
        if (res.ok) {
            await fetchMatches()
        } else {
            alert('Errore durante l\'aggiornamento.')
        }
    } catch(e) {
        alert('Errore di connessione.')
    }
}

const setScore = async (match, score1, score2) => {
    match.score1 = score1;
    match.score2 = score2;
    await updateMatch(match);
}

const startMatch = async (match) => {
    if(!match.team1_name || match.team1_name.includes('° Girone') || match.team1_name.includes('Vincente')) {
        alert('Attenzione: Le squadre reali per questa partita non sono state ancora definite.');
        return;
    }
    await updateMatch(match, 'in_progress')
}

const endMatch = async (match) => {
    if (confirm(`Confermi il termine della partita sul risultato di ${match.score1} - ${match.score2}?`)) {
        await updateMatch(match, 'completed')
    }
}
</script>

<template>
  <div class="app-wrapper">
    <nav class="navbar">
      <div class="container nav-container">
        <div class="brand">
          <router-link to="/torneo/admin" class="brand-text" style="text-decoration: none; color: inherit;">Calendario Operativo</router-link>
        </div>
        <div class="nav-links">
          <router-link to="/torneo/admin" class="nav-link">Torna al Setup</router-link>
          <router-link to="/torneo" class="nav-link">Sito Pubblico</router-link>
          <button @click="toggleTheme" class="theme-toggle" aria-label="Toggle Dark Mode">
            <svg v-if="!isDarkMode" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          </button>
        </div>
      </div>
    </nav>

    <main class="container section flex-center" v-if="!isAuthenticated">
      <div class="card login-card p-4">
        <h2 class="text-center mb-4" style="color: var(--accent-green);">Area Giuria</h2>
        <div class="form-group">
          <label for="secret">Chiave Segreta</label>
          <input type="password" id="secret" v-model="secretKey" @keyup.enter="login" class="form-control" placeholder="Inserisci la secret key" />
        </div>
        <p v-if="loginError" class="error-text">{{ loginError }}</p>
        <button @click="login" class="btn btn-primary w-100 mt-3">Accedi al Calendario</button>
      </div>
    </main>

    <main class="container-fluid" style="padding: 2rem;" v-else>
      <div class="board-layout">
        
        <!-- IN PROGRAMMA -->
        <div class="board-column column-scheduled">
          <div class="column-header">
            <h3>In Programma <span class="count-badge">{{ scheduledMatches.length }}</span></h3>
          </div>
          <div class="matches-list">
            <div v-for="m in scheduledMatches" :key="m.id" class="match-card card">
                <div class="match-meta">
                    <span>{{ formatTime(m.start_time) }}</span>
                    <strong>{{ m.court }}</strong>
                    <span class="badge">{{ m.phase }} {{ m.round }}</span>
                </div>
                <div class="match-teams">
                    <div class="team-name">{{ m.team1_name || m.placeholder_team1 }}</div>
                    <div class="vs">vs</div>
                    <div class="team-name">{{ m.team2_name || m.placeholder_team2 }}</div>
                </div>
                <button @click="startMatch(m)" class="btn btn-primary w-100 mt-3">Avvia Partita</button>
            </div>
            <div v-if="scheduledMatches.length === 0" class="empty-state">Nessuna partita in programma</div>
          </div>
        </div>

        <!-- IN CORSO -->
        <div class="board-column column-active">
          <div class="column-header">
            <h3>In Corso <span class="count-badge active-badge">{{ inProgressMatches.length }}</span></h3>
          </div>
          <div class="matches-list">
            <div v-for="m in inProgressMatches" :key="m.id" class="match-card card active-card">
                <div class="match-meta">
                    <span class="pulse-dot"></span> In corso su <strong>{{ m.court }}</strong>
                    <span class="badge">{{ m.phase }} {{ m.round }}</span>
                </div>
                <div class="match-scoreboard mt-3">
                    <div class="team-score-block">
                        <div class="team-name text-center">{{ m.team1_name }}</div>
                        <div class="score-controls mt-2">
                            <button class="score-btn minus" @click="setScore(m, Math.max(0, m.score1 - 1), m.score2)">-</button>
                            <input type="number" class="score-input" v-model.number="m.score1" @change="updateMatch(m)" />
                            <button class="score-btn plus" @click="setScore(m, m.score1 + 1, m.score2)">+</button>
                        </div>
                    </div>
                    
                    <div class="team-score-block">
                        <div class="team-name text-center">{{ m.team2_name }}</div>
                        <div class="score-controls mt-2">
                            <button class="score-btn minus" @click="setScore(m, m.score1, Math.max(0, m.score2 - 1))">-</button>
                            <input type="number" class="score-input" v-model.number="m.score2" @change="updateMatch(m)" />
                            <button class="score-btn plus" @click="setScore(m, m.score1, m.score2 + 1)">+</button>
                        </div>
                    </div>
                </div>
                <button @click="endMatch(m)" class="btn btn-danger w-100 mt-4">Termina Partita</button>
            </div>
            <div v-if="inProgressMatches.length === 0" class="empty-state">Nessuna partita in corso</div>
          </div>
        </div>

        <!-- COMPLETATE -->
        <div class="board-column column-completed">
          <div class="column-header">
            <h3>Completate <span class="count-badge">{{ completedMatches.length }}</span></h3>
          </div>
          <div class="matches-list">
            <div v-for="m in completedMatches" :key="m.id" class="match-card card completed-card">
                <div class="match-meta">
                    <span>{{ formatTime(m.start_time) }}</span>
                    <span>{{ m.court }}</span>
                    <span class="badge">{{ m.phase }} {{ m.round }}</span>
                </div>
                <div class="match-result mt-2">
                    <div class="result-team" :class="{ 'winner': m.score1 > m.score2 }">
                        <span>{{ m.team1_name }}</span>
                        <strong>{{ m.score1 }}</strong>
                    </div>
                    <div class="result-team mt-1" :class="{ 'winner': m.score2 > m.score1 }">
                        <span>{{ m.team2_name }}</span>
                        <strong>{{ m.score2 }}</strong>
                    </div>
                </div>
            </div>
            <div v-if="completedMatches.length === 0" class="empty-state">Nessuna partita completata</div>
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
.mt-4 { margin-top: 1.5rem; }
.text-center { text-align: center; }

/* Board Layout */
.board-layout {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    height: calc(100vh - 120px);
}
@media (max-width: 1024px) {
    .board-layout {
        grid-template-columns: 1fr;
        height: auto;
    }
}
.board-column {
    display: flex;
    flex-direction: column;
    background: rgba(0,0,0,0.02);
    border-radius: 1rem;
    padding: 1rem;
    max-height: 100%;
}
[data-theme="dark"] .board-column {
    background: rgba(255,255,255,0.02);
}
.column-active {
    background: rgba(14, 203, 129, 0.05);
    border: 2px solid var(--accent-green);
}
.column-header {
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--card-border);
}
.column-header h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.3rem;
}
.count-badge {
    background: var(--card-border);
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.9rem;
}
.count-badge.active-badge {
    background: var(--accent-green);
    color: white;
}
.matches-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    flex: 1;
    padding-right: 0.5rem;
}
.empty-state {
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
    padding: 2rem 0;
}

/* Match Cards */
.match-card {
    padding: 1rem;
}
.active-card {
    border-color: var(--accent-green);
    box-shadow: 0 4px 12px rgba(14, 203, 129, 0.1);
}
.completed-card {
    opacity: 0.8;
}
.match-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}
.badge {
    background: var(--card-border);
    padding: 0.2rem 0.4rem;
    border-radius: 0.2rem;
    font-size: 0.7rem;
    font-weight: bold;
}
.match-teams {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1.1rem;
    font-weight: 600;
}
.vs {
    font-size: 0.8rem;
    color: var(--text-secondary);
    padding: 0 0.5rem;
}

/* Scoreboard */
.match-scoreboard {
    display: flex;
    gap: 1rem;
}
.team-score-block {
    flex: 1;
    background: rgba(0,0,0,0.03);
    padding: 1rem;
    border-radius: 0.5rem;
}
[data-theme="dark"] .team-score-block { background: rgba(255,255,255,0.03); }

.score-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}
.score-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--card-border);
    color: var(--text-primary);
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
}
.score-btn.plus { background: var(--accent-green); color: white; }
.score-btn:hover { filter: brightness(1.1); }
.score-input {
    width: 60px;
    text-align: center;
    font-size: 1.5rem;
    font-weight: bold;
    border: 1px solid var(--card-border);
    border-radius: 0.5rem;
    background: var(--bg-color);
    color: var(--text-primary);
    padding: 0.2rem;
}

/* Completed Result */
.match-result {
    display: flex;
    flex-direction: column;
}
.result-team {
    display: flex;
    justify-content: space-between;
    padding: 0.4rem 0.8rem;
    background: rgba(0,0,0,0.02);
    border-radius: 0.3rem;
}
[data-theme="dark"] .result-team { background: rgba(255,255,255,0.02); }
.result-team.winner {
    font-weight: bold;
    color: var(--accent-green);
    background: rgba(14, 203, 129, 0.1);
}

/* Utils */
.pulse-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    background-color: #e53e3e;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
}
@keyframes pulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(229, 62, 62, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }
}
.btn-danger {
  background-color: transparent;
  color: #e53e3e;
  border: 1px solid #e53e3e;
  cursor: pointer;
}
.btn-danger:hover {
  background-color: #e53e3e;
  color: white;
}
</style>
