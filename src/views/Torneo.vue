<script setup>
import { ref, onMounted, computed } from 'vue'

const isDarkMode = ref(document.documentElement.getAttribute('data-theme') === 'dark')

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light')
}

const teams = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch('http://localhost:8787/api/teams')
    if (res.ok) teams.value = await res.json()
  } catch (e) {
    console.error('Error fetching data', e)
  } finally {
    loading.value = false
  }
})

// Raggruppa le squadre per girone
const groupedTeams = computed(() => {
  const groups = {}
  // Le squadre senza girone le ignoriamo o le mettiamo in un gruppo "Non Assegnato"
  teams.value.forEach(team => {
    const group = team.group_name || 'Non Assegnate'
    if (!groups[group]) groups[group] = []
    groups[group].push(team)
  })
  
  // Ordina le chiavi (es. A, B, C)
  const sortedKeys = Object.keys(groups).sort()
  const result = {}
  sortedKeys.forEach(k => result[k] = groups[k])
  
  return result
})
</script>

<template>
  <div class="app-wrapper torneo-bg">
    <!-- Simple Navigation for Torneo -->
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
        <h1 style="font-size: 3rem; color: var(--accent-green);">Classifiche Gironi</h1>
        <p>Segui l'andamento del torneo di pallavolo in tempo reale.</p>
      </div>

      <div v-if="loading" class="text-center p-4">Caricamento classifiche...</div>
      <div v-else-if="teams.length === 0" class="text-center p-4 card mt-4">Nessuna squadra trovata nel torneo.</div>
      
      <div v-else class="groups-grid mt-4">
        <div v-for="(groupTeams, groupName) in groupedTeams" :key="groupName" class="card p-4">
          <h2 class="mb-3" style="color: var(--accent-green);">Girone {{ groupName }}</h2>
          <div class="table-responsive">
            <table class="ranking-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Squadra</th>
                  <th>Punti</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(team, index) in groupTeams" :key="team.id">
                  <td>{{ index + 1 }}°</td>
                  <td style="font-weight: bold;">{{ team.name }}</td>
                  <td style="color: var(--accent-green); font-weight: bold;">{{ team.points }}</td>
                </tr>
              </tbody>
            </table>
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
.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}
.ranking-table {
  width: 100%;
  border-collapse: collapse;
}
.ranking-table th, .ranking-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid var(--card-border);
}
.ranking-table th {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
}
.ranking-table tr:last-child td {
  border-bottom: none;
}
.table-responsive {
  overflow-x: auto;
}
</style>
