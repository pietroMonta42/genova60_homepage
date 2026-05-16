<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { TournamentBracket } from 'vue3-tournament'
import 'vue3-tournament/style.css'
import { API_BASE } from '../config.js'
import { useTheme } from '../useTheme.js'

const { isDarkMode, toggleTheme } = useTheme()

const matches = ref([])
const loading = ref(true)
const bracketKey = ref(0)

const activeTab = ref('gironi')

const fetchMatches = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/matches`)
    if (res.ok) {
      matches.value = await res.json()
      bracketKey.value++
    }
  } catch (e) {
    console.error('Error fetching data', e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchMatches)

// Filtra i match dei gironi
const groupMatches = computed(() => matches.value.filter(m => m.phase === 'groups'))

// Prepara i rounds per il componente vue3-tournament
const bracketRounds = computed(() => {
  const roundOrder = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F']

  const formatMatch = (m) => {
    let winner = null
    if (m.status === 'completed') {
      winner = m.score1 > m.score2 ? '1' : (m.score2 > m.score1 ? '2' : null)
    }
    
    return {
      id: m.id,
      winner: winner,
      team1: { 
        id: '1', 
        name: m.team1_name || m.placeholder_team1 || 'TBD', 
        score: m.status === 'completed' ? m.score1 : undefined 
      },
      team2: { 
        id: '2', 
        name: m.team2_name || m.placeholder_team2 || 'TBD', 
        score: m.status === 'completed' ? m.score2 : undefined 
      }
    }
  }

  const knockoutMatches = matches.value.filter(
    m => m.phase === 'knockout' || m.phase === 'final'
  )

  const groups = {}
  for (const m of knockoutMatches) {
    const r = m.round
    if (!groups[r]) groups[r] = []
    groups[r].push(m)
  }

  const rounds = []
  for (const roundName of roundOrder) {
    if (groups[roundName] && groups[roundName].length > 0) {
      rounds.push({ matchs: groups[roundName].map(formatMatch) })
    }
  }

  return rounds
})

const hasGroups = computed(() => groupMatches.value.length > 0)

const onTabChange = (tab) => {
  activeTab.value = tab
  if (tab === 'tabellone') fetchMatches()
}

// Auto-switch to tabellone if no group phase exists
const switchToTabelloneIfNoGroups = () => {
  if (activeTab.value === 'gironi' && !hasGroups.value && bracketRounds.value.length > 0) {
    activeTab.value = 'tabellone'
  }
}

watch(groupMatches, switchToTabelloneIfNoGroups)
watch(bracketRounds, switchToTabelloneIfNoGroups)
</script>

<template>
  <div class="app-wrapper torneo-bg">
    <nav class="navbar">
      <div class="container nav-container">
        <div class="brand">
          <router-link to="/torneo" class="brand-text" style="text-decoration: none; color: inherit;">Torneo Volley</router-link>
        </div>
        
        <div class="nav-links">
          <router-link to="/torneo" class="nav-link">Classifica</router-link>
          <router-link to="/torneo/partite" class="nav-link">Calendario e Tabellone</router-link>
          <router-link to="/" class="nav-link">Home Gruppo</router-link>
          <button @click="toggleTheme" class="theme-toggle" aria-label="Toggle Dark Mode">
            <svg v-if="!isDarkMode" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          </button>
        </div>
      </div>
    </nav>

    <main class="container section">
      <div class="section-header">
        <h1 style="font-size: 3rem; color: var(--accent-green);">Calendario e Tabellone</h1>
        <p v-if="hasGroups">Scopri i prossimi incontri, le fasi a gironi e il tabellone a eliminazione diretta.</p>
        <p v-else>Scopri il tabellone a eliminazione diretta.</p>
      </div>

      <div class="tabs-container mb-4">
        <button v-if="hasGroups" class="tab-btn" :class="{ active: activeTab === 'gironi' }" @click="onTabChange('gironi')">Fase a Gironi</button>
        <button class="tab-btn" :class="{ active: activeTab === 'tabellone' }" @click="onTabChange('tabellone')">Tabellone Finale</button>
      </div>

      <div v-if="activeTab === 'gironi' && hasGroups" class="card p-4">
        <div class="matches-list">
          <div v-if="loading" class="text-center p-4">Caricamento partite...</div>
          <div v-else-if="groupMatches.length === 0" class="text-center p-4">Nessuna partita a gironi in programma.</div>
          <div v-else class="grid-2">
            <div v-for="match in groupMatches" :key="match.id" class="match-card">
              <div class="match-header">
                <span>Girone {{ match.group1 }}</span>
                <span>{{ new Date(match.start_time).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }} | {{ match.court }}</span>
              </div>
              <div class="match-teams">
                <div class="team">
                  <span class="team-name">{{ match.team1_name }}</span>
                  <span class="team-score" :class="{ 'winner': match.score1 > match.score2 }">{{ match.score1 }}</span>
                </div>
                <div class="team">
                  <span class="team-name">{{ match.team2_name }}</span>
                  <span class="team-score" :class="{ 'winner': match.score2 > match.score1 }">{{ match.score2 }}</span>
                </div>
              </div>
              <div class="match-status" :class="match.status">{{ match.status === 'completed' ? 'Terminata' : 'In Programma' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'tabellone'" class="card p-4 overflow-auto">
        <h2 class="text-center mb-4">Fasi Finali</h2>
        <div v-if="loading" class="text-center p-4">Caricamento tabellone...</div>
        <div v-else-if="bracketRounds.length === 0" class="text-center p-4">Il tabellone finale non è ancora stato generato.</div>
        <div v-else class="bracket-wrapper">
          <TournamentBracket :rounds="bracketRounds" :key="bracketKey" />
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
.nav-link.router-link-exact-active {
  color: var(--accent-green);
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
.section-header {
  text-align: center;
  margin-bottom: 2rem;
}
.text-center {
  text-align: center;
}
.mb-4 {
  margin-bottom: 1.5rem;
}

/* Tabs */
.tabs-container {
  display: flex;
  justify-content: center;
  gap: 1rem;
}
.tab-btn {
  background: var(--bg-color);
  border: 2px solid var(--card-border);
  color: var(--text-primary);
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn:hover {
  border-color: var(--accent-green);
}
.tab-btn.active {
  background: var(--accent-green);
  border-color: var(--accent-green);
  color: white;
}

/* Match Cards */
.matches-list .grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}
@media (max-width: 768px) {
  .matches-list .grid-2 {
    grid-template-columns: 1fr;
  }
}

.match-card {
  border: 1px solid var(--card-border);
  border-radius: 1rem;
  padding: 1rem;
  background: rgba(0,0,0,0.02);
}
[data-theme="dark"] .match-card {
  background: rgba(255,255,255,0.02);
}

.match-header {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
  display: flex;
  justify-content: space-between;
}

.match-teams {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.team {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.team-score {
  background: var(--card-border);
  padding: 0.2rem 0.6rem;
  border-radius: 0.5rem;
  min-width: 2rem;
  text-align: center;
}

.team-score.winner {
  background: var(--accent-green);
  color: white;
}

.match-status {
  margin-top: 1rem;
  font-size: 0.8rem;
  text-align: right;
  font-weight: 700;
}
.match-status.completed {
  color: var(--accent-green);
}
.match-status.scheduled {
  color: var(--accent-grey);
}

/* Bracket */
.overflow-auto {
  overflow: auto;
}
.bracket-wrapper {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}
</style>
