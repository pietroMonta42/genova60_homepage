<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isDarkMode = ref(document.documentElement.getAttribute('data-theme') === 'dark')

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light')
}

const secretKey = ref('')
const isAuthenticated = ref(false)
const loginError = ref('')

const teams = ref([])
const settings = ref({
  format: 'gironi',
  has_return_matches: 'false',
  status: 'settings_setup',
  courts_count: '2',
  match_duration_minutes: '40',
  break_between_matches_minutes: '5',
  start_date_time: ''
})

const newTeam = ref({ name: '' })
const createTeamStatus = ref('')

const updateSettingsStatus = ref('')

const previewMatches = ref([])
const showPreview = ref(false)
const generateMatchesStatus = ref('')
const previewType = ref('') // 'groups' or 'knockout'

// Groups Setup State
const availableGroups = ref(['A', 'B'])
const newGroupName = ref('')
const groupsSetupStatus = ref('')

// Knockout Setup State
const knockoutConfig = ref({
  qualified_per_group: 2
})

const fetchData = async () => {
  try {
    const [teamsRes, settingsRes] = await Promise.all([
      fetch('http://localhost:8787/api/teams'),
      fetch('http://localhost:8787/api/settings')
    ])
    if (teamsRes.ok) teams.value = await teamsRes.json()
    if (settingsRes.ok) {
      const serverSettings = await settingsRes.json()
      settings.value = { ...settings.value, ...serverSettings }
      
      if (!settings.value.status) settings.value.status = 'settings_setup';
      
      if (settings.value.status === 'groups_setup') {
         const existingGroups = new Set(teams.value.map(t => t.group_name).filter(g => g))
         if (existingGroups.size > 0) {
           availableGroups.value = Array.from(existingGroups).sort()
         }
      }
    }
  } catch (e) {
    console.error('Error fetching admin data', e)
  }
}

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
      await fetchData()
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

// Navigation Methods
const nextPhase = async (newStatus) => {
  settings.value.status = newStatus;
  await updateSettings();
}

const updateSettings = async () => {
  updateSettingsStatus.value = 'Salvataggio...'
  try {
    const res = await fetch('http://localhost:8787/api/settings', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(settings.value)
    })
    if (res.ok) {
      updateSettingsStatus.value = 'Impostazioni salvate!'
      await fetchData()
    } else {
      updateSettingsStatus.value = 'Errore durante il salvataggio.'
    }
  } catch (e) {
    updateSettingsStatus.value = 'Errore di connessione.'
  }
}

// Registration Phase
const createTeam = async () => {
  createTeamStatus.value = 'Creazione in corso...'
  try {
    const res = await fetch('http://localhost:8787/api/teams', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(newTeam.value)
    })
    if (res.ok) {
      createTeamStatus.value = 'Squadra creata con successo!'
      newTeam.value = { name: '' }
      await fetchData()
    } else {
      createTeamStatus.value = 'Errore: Autorizzazione negata o dati non validi.'
    }
  } catch (e) {
    createTeamStatus.value = 'Errore di connessione al server.'
  }
}

// Groups Setup Phase
const addGroup = () => {
  if (newGroupName.value && !availableGroups.value.includes(newGroupName.value)) {
    availableGroups.value.push(newGroupName.value);
    newGroupName.value = '';
  }
}

let draggedTeamId = null;

const onTeamDragStart = (e, teamId) => {
  draggedTeamId = teamId;
  e.dataTransfer.effectAllowed = 'move';
}

const onTeamDrop = (e, targetGroup) => {
  if (draggedTeamId !== null) {
    const team = teams.value.find(t => t.id === draggedTeamId);
    if (team) {
      team.group_name = targetGroup;
    }
  }
  draggedTeamId = null;
}

const saveGroupsAndPreview = async () => {
  groupsSetupStatus.value = 'Salvataggio gironi in corso...';
  
  const unassigned = teams.value.filter(t => !t.group_name);
  if (unassigned.length > 0) {
    if (!window.confirm(`Ci sono ${unassigned.length} squadre non assegnate. Vuoi continuare comunque? Verranno ignorate.`)) {
      groupsSetupStatus.value = '';
      return;
    }
  }

  try {
    const updates = teams.value.map(t => ({ id: t.id, group_name: t.group_name || '' }));
    const res = await fetch('http://localhost:8787/api/teams/groups', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(updates)
    })
    if (res.ok) {
      groupsSetupStatus.value = 'Gironi salvati!';
      previewType.value = 'groups';
      await generatePreview('groups');
    } else {
      groupsSetupStatus.value = 'Errore durante il salvataggio dei gironi.';
    }
  } catch(e) {
    groupsSetupStatus.value = 'Errore di connessione.';
  }
}

const unassignedTeams = computed(() => teams.value.filter(t => !t.group_name))
const groupedTeams = computed(() => {
  const map = {};
  availableGroups.value.forEach(g => map[g] = []);
  teams.value.filter(t => t.group_name).forEach(t => {
    if (!map[t.group_name]) map[t.group_name] = [];
    map[t.group_name].push(t);
  });
  return map;
})

// Scheduling / Knockout Phase
const generatePreview = async (type) => {
  generateMatchesStatus.value = 'Generazione anteprima...'
  try {
    const endpoint = type === 'groups' ? '/api/matches/preview' : '/api/matches/preview_knockout';
    const body = type === 'knockout' ? JSON.stringify(knockoutConfig.value) : undefined;
    
    const res = await fetch(`http://localhost:8787${endpoint}`, {
      method: 'POST',
      headers: authHeaders(),
      body: body
    })
    if (res.ok) {
      previewMatches.value = await res.json()
      showPreview.value = true
      generateMatchesStatus.value = ''
    } else {
      generateMatchesStatus.value = 'Errore durante la generazione.'
    }
  } catch (e) {
    generateMatchesStatus.value = 'Errore di connessione.'
  }
}

const confirmAndSaveMatches = async () => {
  generateMatchesStatus.value = 'Salvataggio in corso...'
  try {
    const nextStatus = previewType.value === 'groups' ? 'groups_in_progress' : 'knockout_in_progress';
    const res = await fetch('http://localhost:8787/api/matches/bulk', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ matches: previewMatches.value, new_status: nextStatus })
    })
    if (res.ok) {
      generateMatchesStatus.value = 'Torneo avviato con successo!'
      showPreview.value = false
      previewMatches.value = []
      await fetchData()
      router.push('/torneo/admin/calendario')
    } else {
      generateMatchesStatus.value = 'Errore durante il salvataggio.'
    }
  } catch (e) {
    generateMatchesStatus.value = 'Errore di connessione.'
  }
}

const revertStatus = async (fallbackStatus) => {
  if (!window.confirm("SEI SICURO? Tornerai indietro e potresti causare problemi al torneo in corso. Vuoi procedere?")) return;
  settings.value.status = fallbackStatus
  await updateSettings()
}

// Drag & Drop Preview
let draggedMatchIndex = null;
const onDragStart = (e, index) => {
  draggedMatchIndex = index;
  e.dataTransfer.effectAllowed = 'move';
}
const onDrop = (e, targetIndex) => {
  if (draggedMatchIndex !== null && draggedMatchIndex !== targetIndex) {
    const tempTime = previewMatches.value[targetIndex].start_time;
    const tempCourt = previewMatches.value[targetIndex].court;
    previewMatches.value[targetIndex].start_time = previewMatches.value[draggedMatchIndex].start_time;
    previewMatches.value[targetIndex].court = previewMatches.value[draggedMatchIndex].court;
    previewMatches.value[draggedMatchIndex].start_time = tempTime;
    previewMatches.value[draggedMatchIndex].court = tempCourt;
    previewMatches.value.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }
  draggedMatchIndex = null;
}
</script>

<template>
  <div class="app-wrapper">
    <nav class="navbar">
      <div class="container nav-container">
        <div class="brand">
          <router-link to="/torneo/admin" class="brand-text" style="text-decoration: none; color: inherit;">Admin Setup</router-link>
        </div>
        <div class="nav-links">
          <router-link to="/torneo/admin/calendario" class="nav-link" v-if="isAuthenticated">Vai al Calendario</router-link>
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
        <h2 class="text-center mb-4" style="color: var(--accent-green);">Area Amministratore</h2>
        <div class="form-group">
          <label for="secret">Chiave Segreta</label>
          <input type="password" id="secret" v-model="secretKey" @keyup.enter="login" class="form-control" placeholder="Inserisci la secret key" />
        </div>
        <p v-if="loginError" class="error-text">{{ loginError }}</p>
        <button @click="login" class="btn btn-primary w-100 mt-3">Accedi</button>
      </div>

      <div v-else class="admin-panel mt-4">
        <div style="display: flex; justify-content: space-between; align-items: center;" class="mb-4">
          <h1>Gestione Torneo</h1>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <span class="status-badge" :class="settings.status === 'settings_setup' ? 'active' : ''">IMPOSTAZIONI</span>
            <span class="status-badge" :class="settings.status === 'registration' ? 'active' : ''">ISCRIZIONI</span>
            <span class="status-badge" :class="settings.status === 'groups_setup' ? 'active' : ''">GIRONI</span>
            <span class="status-badge" :class="settings.status === 'knockout_setup' ? 'active' : ''">FINALI</span>
          </div>
        </div>
        
        <div v-if="!showPreview">
          
          <!-- PHASE 0: SETTINGS SETUP -->
          <div v-if="settings.status === 'settings_setup'" class="card p-4 mb-4">
            <h3>Impostazioni Base e Fasi</h3>
            <div class="grid-2 mt-3">
              <div class="form-group">
                <label>Formato Torneo</label>
                <select class="form-control" v-model="settings.format">
                  <option value="eliminazione">Solo Eliminazione Diretta</option>
                  <option value="gironi_e_finali">Gironi + Torneo Finale</option>
                </select>
              </div>
              <div class="form-group" v-if="settings.format === 'gironi_e_finali'">
                <label>Partite Andata e Ritorno (Gironi)</label>
                <select class="form-control" v-model="settings.has_return_matches">
                  <option value="true">Sì</option>
                  <option value="false">No (Gara Unica)</option>
                </select>
              </div>
            </div>

            <h3 class="mt-4">Configurazione Campi e Orari</h3>
            <div class="grid-2 mt-3">
              <div class="form-group">
                <label>Numero di Campi disponibili</label>
                <input type="number" class="form-control" v-model="settings.courts_count" min="1" />
              </div>
              <div class="form-group">
                <label>Data e Ora Inizio Torneo</label>
                <input type="datetime-local" class="form-control" v-model="settings.start_date_time" />
              </div>
              <div class="form-group">
                <label>Durata Partita (Minuti)</label>
                <input type="number" class="form-control" v-model="settings.match_duration_minutes" />
              </div>
              <div class="form-group">
                <label>Pausa tra Partite (Minuti)</label>
                <input type="number" class="form-control" v-model="settings.break_between_matches_minutes" />
              </div>
            </div>

            <button @click="nextPhase('registration')" class="btn btn-primary mt-4 w-100">Salva e Passa alle Iscrizioni</button>
            <span v-if="updateSettingsStatus" class="ml-3" style="font-size: 0.9rem;">{{ updateSettingsStatus }}</span>
          </div>

          <!-- PHASE 1: REGISTRATION -->
          <div v-if="settings.status === 'registration'" class="card p-4">
            <h3>Iscrizione Squadre</h3>
            <div style="display: flex; gap: 1rem; align-items: flex-end;" class="mt-3">
              <div class="form-group" style="flex: 1; margin: 0;">
                <label>Nome Squadra</label>
                <input type="text" class="form-control" v-model="newTeam.name" @keyup.enter="createTeam" />
              </div>
              <button @click="createTeam" class="btn btn-primary">Aggiungi</button>
            </div>
            <p v-if="createTeamStatus" class="mt-2 text-secondary" style="font-size: 0.9rem;">{{ createTeamStatus }}</p>

            <div class="mt-4" v-if="teams.length > 0">
              <h4>Squadre Iscritte ({{ teams.length }})</h4>
              <div class="teams-list mt-2">
                <span v-for="t in teams" :key="t.id" class="badge-team">{{ t.name }}</span>
              </div>
            </div>

            <hr style="margin: 2rem 0; border: none; border-top: 1px solid var(--card-border);" />
            <button v-if="settings.format === 'gironi_e_finali'" @click="nextPhase('groups_setup')" class="btn btn-primary w-100">Chiudi Iscrizioni e Crea Gironi</button>
            <button v-else @click="generatePreview('knockout')" class="btn btn-primary w-100">Genera Tabellone Eliminazione</button>
            <button @click="revertStatus('settings_setup')" class="btn btn-danger mt-3 w-100">Torna Indietro</button>
          </div>

          <!-- PHASE 2: GROUPS SETUP -->
          <div v-if="settings.status === 'groups_setup'" class="card p-4">
            <h3>Composizione Gironi</h3>
            <p class="text-secondary mt-2">Trascina le squadre nei vari gironi per assegnarle.</p>

            <div class="mt-3" style="display: flex; gap: 1rem;">
              <input type="text" class="form-control" v-model="newGroupName" placeholder="Nome nuovo girone (es. C)" style="max-width: 200px;" @keyup.enter="addGroup" />
              <button class="btn btn-secondary" @click.prevent="addGroup" type="button">Aggiungi Girone</button>
            </div>

            <div class="groups-layout mt-4">
              <div class="group-bucket unassigned-bucket" @dragover.prevent @drop="onTeamDrop($event, null)">
                <h4>Non Assegnate ({{ unassignedTeams.length }})</h4>
                <div class="teams-bucket">
                  <div v-for="t in unassignedTeams" :key="t.id" class="draggable-team" draggable="true" @dragstart="onTeamDragStart($event, t.id)">{{ t.name }}</div>
                </div>
              </div>

              <div v-for="group in availableGroups" :key="group" class="group-bucket" @dragover.prevent @drop="onTeamDrop($event, group)">
                <h4>Girone {{ group }} ({{ groupedTeams[group].length }})</h4>
                <div class="teams-bucket">
                  <div v-for="t in groupedTeams[group]" :key="t.id" class="draggable-team" draggable="true" @dragstart="onTeamDragStart($event, t.id)">{{ t.name }}</div>
                </div>
              </div>
            </div>

            <hr style="margin: 2rem 0; border: none; border-top: 1px solid var(--card-border);" />
            <button @click="saveGroupsAndPreview" class="btn btn-primary w-100">Salva Gironi e Genera Calendario</button>
            <button @click="revertStatus('registration')" class="btn btn-danger mt-3 w-100">Torna a Iscrizioni</button>
            <p v-if="groupsSetupStatus" class="mt-2 text-center">{{ groupsSetupStatus }}</p>
          </div>

          <!-- PHASE 3: GROUPS IN PROGRESS -->
          <div v-if="settings.status === 'groups_in_progress'" class="card p-4 text-center">
            <h2 style="color: var(--accent-green);">Fase a Gironi in Corso!</h2>
            <p class="mt-3 mb-4">Gestisci le partite, i risultati e le squadre dalla pagina del calendario operativo.</p>
            <router-link to="/torneo/admin/calendario" class="btn btn-primary" style="padding: 1rem 2rem; font-size: 1.2rem;">VAI AL CALENDARIO OPERATIVO</router-link>
            
            <hr style="margin: 3rem 0; border: none; border-top: 1px solid var(--card-border);" />
            
            <div class="p-4" style="border: 2px dashed #e53e3e; border-radius: 1rem;">
              <h3 style="color: #e53e3e;">Termina Fase a Gironi</h3>
              <p class="text-secondary mt-2">I gironi sono finiti? Clicca qui per chiudere la fase a gironi e configurare il tabellone finale a eliminazione diretta.</p>
              <button @click="nextPhase('knockout_setup')" class="btn btn-danger mt-3">PASSA ALLE FASI FINALI</button>
            </div>
          </div>

          <!-- PHASE 4: KNOCKOUT SETUP -->
          <div v-if="settings.status === 'knockout_setup'" class="card p-4">
            <h3>Configurazione Fasi Finali</h3>
            <p class="text-secondary mt-2">Imposta quante squadre passano il turno per ogni girone. Il sistema pescherà le vere qualificate dalla classifica.</p>

            <div class="grid-2 mt-4">
              <div class="form-group">
                <label>Qualificate per ogni Girone</label>
                <input type="number" class="form-control" v-model="knockoutConfig.qualified_per_group" min="1" max="4" />
              </div>
            </div>

            <button @click="generatePreview('knockout')" class="btn btn-primary mt-4 w-100">Genera Tabellone Finale</button>
            <button @click="revertStatus('groups_in_progress')" class="btn btn-danger mt-3 w-100">Annulla e Torna a Gironi</button>
            <p v-if="generateMatchesStatus" class="mt-2 text-center">{{ generateMatchesStatus }}</p>
          </div>

          <!-- PHASE 5: KNOCKOUT IN PROGRESS -->
          <div v-if="settings.status === 'knockout_in_progress'" class="card p-4 text-center">
            <h2 style="color: var(--accent-green);">Fasi Finali in Corso!</h2>
            <p class="mt-3 mb-4">Il tabellone a eliminazione è attivo.</p>
            <router-link to="/torneo/admin/calendario" class="btn btn-primary" style="padding: 1rem 2rem; font-size: 1.2rem;">VAI AL CALENDARIO OPERATIVO</router-link>
          </div>
        </div>

        <!-- SEZIONE PREVIEW E DRAG & DROP (Condivisa tra Gironi e Finali) -->
        <div v-if="showPreview" class="card p-4 mt-4 preview-section">
          <h2>Anteprima Calendario {{ previewType === 'groups' ? 'Gironi' : 'Fasi Finali' }}</h2>
          <p class="mt-2 text-secondary">
            Trascina una partita sopra un'altra per invertirle di campo/orario. 
            Oppure modifica manualmente data, ora e campo nei campi testuali.
          </p>
          
          <div class="preview-grid mt-4">
            <div v-for="(match, index) in previewMatches" :key="index" class="preview-card" draggable="true" @dragstart="onDragStart($event, index)" @dragover.prevent @drop="onDrop($event, index)">
              <div class="drag-handle">☰</div>
              <div class="preview-match-info">
                <span class="badge">{{ match.phase.toUpperCase() }}</span>
                <strong>{{ match.team1_name }}</strong> vs <strong>{{ match.team2_name }}</strong>
              </div>
              <div class="preview-controls">
                <input type="datetime-local" class="form-control form-control-sm" v-model="match.start_time" />
                <input type="text" class="form-control form-control-sm" v-model="match.court" placeholder="Campo" />
              </div>
            </div>
          </div>

          <div class="mt-4" style="display: flex; gap: 1rem; align-items: center;">
            <button @click="confirmAndSaveMatches" class="btn btn-primary" style="background-color: var(--accent-green); border-color: var(--accent-green);">Conferma e Avvia {{ previewType === 'groups' ? 'Gironi' : 'Fasi Finali' }}!</button>
            <button @click="showPreview = false" class="btn btn-danger">Annulla</button>
            <span v-if="generateMatchesStatus" style="font-size: 0.9rem;">{{ generateMatchesStatus }}</span>
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
.form-control-sm {
  padding: 0.4rem;
  font-size: 0.85rem;
}
.w-100 {
  width: 100%;
}
.text-center {
  text-align: center;
}
.text-secondary {
  color: var(--text-secondary);
}
.mb-4 {
  margin-bottom: 1.5rem;
}
.mt-2 {
  margin-top: 0.5rem;
}
.mt-3 {
  margin-top: 1rem;
}
.mt-4 {
  margin-top: 2rem;
}
.ml-3 {
  margin-left: 1rem;
}
.error-text {
  color: #e53e3e;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}
.admin-panel {
  width: 100%;
  max-width: 1000px;
}
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
}
.btn-secondary {
  background-color: var(--card-border);
  color: var(--text-primary);
  border: none;
}
.btn-secondary:hover {
  background-color: var(--accent-grey);
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
.status-badge {
  padding: 0.4rem 1rem;
  border-radius: 9999px;
  font-weight: bold;
  font-size: 0.75rem;
  background-color: var(--card-border);
  color: var(--text-secondary);
}
.status-badge.active {
  background-color: var(--accent-green);
  color: white;
}

/* Teams List */
.teams-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.badge-team {
  background: var(--card-border);
  padding: 0.4rem 0.8rem;
  border-radius: 9999px;
  font-size: 0.9rem;
  font-weight: 600;
}

/* Groups Drag & Drop */
.groups-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  align-items: start;
}
.group-bucket {
  border: 2px solid var(--card-border);
  border-radius: 1rem;
  padding: 1rem;
  background: var(--bg-color);
  min-height: 200px;
}
.unassigned-bucket {
  border-style: dashed;
  background: rgba(0,0,0,0.02);
}
[data-theme="dark"] .unassigned-bucket {
  background: rgba(255,255,255,0.02);
}
.group-bucket h4 {
  margin-bottom: 1rem;
  text-align: center;
  color: var(--accent-green);
}
.teams-bucket {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 150px;
}
.draggable-team {
  background: var(--card-border);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: grab;
  text-align: center;
  font-weight: 600;
  transition: transform 0.1s;
}
.draggable-team:active {
  cursor: grabbing;
  transform: scale(0.95);
}
.empty-state {
  color: var(--text-secondary);
  text-align: center;
  font-style: italic;
  font-size: 0.9rem;
  padding: 2rem 0;
}

/* Preview Drag & Drop */
.preview-section {
  border: 2px dashed var(--accent-green);
}
.preview-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.preview-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(0,0,0,0.02);
  border: 1px solid var(--card-border);
  border-radius: 0.5rem;
  cursor: grab;
  transition: transform 0.1s;
}
[data-theme="dark"] .preview-card {
  background: rgba(255,255,255,0.05);
}
.preview-card:active {
  cursor: grabbing;
  transform: scale(0.99);
}
.drag-handle {
  color: var(--text-secondary);
  font-size: 1.2rem;
  padding: 0 0.5rem;
}
.preview-match-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.badge {
  background: var(--card-border);
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.2rem;
}
.preview-controls {
  display: flex;
  gap: 0.5rem;
  min-width: 300px;
}

@media (max-width: 768px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
  .preview-card {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
