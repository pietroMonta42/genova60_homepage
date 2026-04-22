<script setup>
import { ref, onMounted } from 'vue'

const isDarkMode = ref(false)

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light')
}

onMounted(() => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (prefersDark) {
    isDarkMode.value = true
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})
</script>

<template>
  <div class="app-wrapper">
    <!-- Navigation -->
    <nav class="navbar">
      <div class="container nav-container">
        <div class="brand">
          <img src="./assets/genova60_logo.jpg" alt="Logo Genova 60" class="brand-logo" />
          <span class="brand-text">Genova 60</span>
        </div>
        
        <div class="nav-links">
          <a href="#chisiamo" class="nav-link">Chi Siamo</a>
          <a href="#branche" class="nav-link">Branche</a>
          <a href="#storia" class="nav-link">Storia</a>
          <a href="#contatti" class="nav-link">Contatti</a>
          <button @click="toggleTheme" class="theme-toggle" aria-label="Toggle Dark Mode">
            <svg v-if="!isDarkMode" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          </button>
        </div>
      </div>
    </nav>

    <main>
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-overlay"></div>
        <div class="hero-content container">
          <div class="hero-text-box animate-fade-in">
            <h1 class="hero-title">AGESCI Genova 60</h1>
            <p class="hero-subtitle">
              Siamo un'associazione educativa che si propone di formare buoni cittadini e buoni cristiani attraverso il metodo scout.
            </p>
            <div class="hero-actions">
              <a href="#contatti" class="btn btn-primary">Unisciti all'avventura</a>
            </div>
          </div>
        </div>
      </section>

      <!-- Chi Siamo & Missione -->
      <section id="chisiamo" class="section container">
        <div class="section-header">
          <h2>La Nostra Missione</h2>
          <p>L'AGESCI è la più grande realtà scout in Italia. Il nostro percorso si fonda su tre pilastri principali.</p>
        </div>
        
        <div class="grid-3">
          <div class="card mission-card">
            <div class="card-icon">🌍</div>
            <h3>Cittadinanza</h3>
            <p>Educazione alla cittadinanza per imparare a essere membri attivi e responsabili della società.</p>
          </div>
          <div class="card mission-card">
            <div class="card-icon">🕊️</div>
            <h3>Fede</h3>
            <p>Un cammino di crescita spirituale alla luce del Vangelo.</p>
          </div>
          <div class="card mission-card">
            <div class="card-icon">🤝</div>
            <h3>Coeducazione</h3>
            <p>Ragazzi e ragazze crescono insieme, imparando il rispetto reciproco e la parità.</p>
          </div>
        </div>

        <div class="method-section mt-5 card p-4">
          <h2>Il Metodo: Imparare facendo</h2>
          <p>A differenza di una scuola tradizionale, nell'AGESCI si impara attraverso l'esperienza pratica:</p>
          <ul>
            <li><strong>Vita all'aperto:</strong> Il contatto con la natura è l'aula principale.</li>
            <li><strong>Piccoli gruppi:</strong> La "squadriglia" permette di assumersi responsabilità concrete fin da piccoli.</li>
            <li><strong>La Promessa:</strong> Ogni scout sceglie consapevolmente di impegnarsi a fare "del proprio meglio" per aiutare gli altri.</li>
          </ul>
        </div>
      </section>

      <!-- Le Branche -->
      <section id="branche" class="section container bg-soft rounded-section">
        <div class="section-header">
          <h2>Le Branche</h2>
          <p>Il percorso scout è diviso in tre momenti, adattati alla crescita psicofisica dei ragazzi.</p>
        </div>
        
        <div class="grid-3">
          <div class="card branca-card lc">
            <div class="branca-header">
              <h3>Cerchio / Branco</h3>
              <span class="age-badge">8 - 11/12 anni</span>
            </div>
            <div class="branca-body">
              <p><strong>Ambiente:</strong> Il Gioco, la Giungla o il Bosco.</p>
              <p>Si vive in un clima di gioia e fantasia, imparando le prime regole del vivere insieme.</p>
            </div>
          </div>
          
          <div class="card branca-card eg">
            <div class="branca-header">
              <h3>Reparto</h3>
              <span class="age-badge">12 - 16 anni</span>
            </div>
            <div class="branca-body">
              <p><strong>Ambiente:</strong> L'Avventura.</p>
              <p>Si vive in squadriglie, si impara la tecnica, l'autonomia e si dorme in tenda.</p>
            </div>
          </div>
          
          <div class="card branca-card rs">
            <div class="branca-header">
              <h3>Noviziato / Clan</h3>
              <span class="age-badge">17 - 21 anni</span>
            </div>
            <div class="branca-body">
              <p><strong>Ambiente:</strong> Il Servizio e la Strada.</p>
              <p>Si viaggia con lo zaino in spalla, si sceglie la Comunità e ci si impegna nel sociale e per il prossimo.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Storia -->
      <section id="storia" class="section container">
        <div class="card history-card">
          <div class="history-content">
            <h2>La Nostra Storia</h2>
            <h3>Come si è aperto il Genova 60?</h3>
            <p>Nell'autunno del 1987 un paio di capi del gruppo Genova 50 cominciarono a lavorare per formare un primo nucleo di ragazzi che provassero l'esperienza scout, da cui fondare un primo reparto, cosa che avvenne con le prime promesse nel febbraio del 1988.</p>
            <p>Quell'estate ci fu il primo campo del reparto MacKenzie a Tana d'Orso, nell'entroterra di Ronco Scrivia. Eravamo ancora parte del gruppo Genova 50 e portavamo il fazzolettone bianco e rosso.</p>
            <p><strong>La nascita ufficiale:</strong> Avvenne nell'autunno del 1991. Con una cerimonia ci fu il cambio dei fazzolettoni, da quello rosso e bianco a quello <strong>verde e grigio</strong>, scelti perché colori complementari dei primi due.</p>
            
            <h3 class="mt-3">Come mai ci chiamiamo così?</h3>
            <p>Quando si dovette scegliere un numero, c'erano già 50, 51, 52, 53, 56 e 58 nella nostra zona. Il 54 e 55 erano a Ponente. Così è stata fatta la richiesta per il 60. Il "Genova" è fisso: è la regola dell'associazione che prende il nome dal comune della sede del gruppo.</p>
          </div>
        </div>
      </section>

      <!-- Contact Section -->
      <section id="contatti" class="section container">
        <div class="section-header">
          <h2>Contatti</h2>
          <p>Vuoi unirti a noi o chiederci informazioni? Ecco dove trovarci!</p>
        </div>
        <div class="grid-3 contact-grid">
          <a href="https://maps.google.com/?q=via+Guido+Poli+5,+16164+Genova" target="_blank" class="card contact-card">
            <div class="contact-icon-wrapper">📍</div>
            <h3>Vieni a Trovarci</h3>
            <p>via Guido Poli 5<br/>16164 Genova</p>
          </a>
          
          <a href="mailto:genova60@liguria.agesci.it" class="card contact-card">
            <div class="contact-icon-wrapper">✉️</div>
            <h3>Scrivici</h3>
            <p>genova60@liguria.agesci.it</p>
          </a>

          <a href="https://www.instagram.com/genova60_/" target="_blank" class="card contact-card">
            <div class="contact-icon-wrapper">📸</div>
            <h3>Seguici</h3>
            <p>@genova60_</p>
          </a>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container footer-content">
        <img src="./assets/AGESCI.png" alt="Logo AGESCI" class="footer-logo" />
        <p>&copy; {{ new Date().getFullYear() }} AGESCI Gruppo Genova 60. Tutti i diritti riservati.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* App Wrapper */
.app-wrapper {
  display: flex;
  flex-direction: column;
}

/* Navigation */
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

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
}

.brand-logo {
  height: 40px;
  width: auto;
  border-radius: 50%; /* Make the logo round if it's square */
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.nav-link {
  font-weight: 700;
  color: var(--text-secondary);
  transition: color 0.2s ease;
  font-family: 'Fredoka', sans-serif;
  font-size: 1.1rem;
}

.nav-link:hover {
  color: var(--accent-green);
}

.theme-toggle {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.theme-toggle:hover {
  color: var(--accent-green);
  background: rgba(56, 161, 105, 0.1);
}

/* Hero Section */
.hero {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Using one of the provided photos */
  background-image: url('./assets/IMG_8056.webp');
  background-size: cover;
  background-position: center;
}

.hero-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.7));
}

.hero-content {
  position: relative;
  z-index: 1;
  width: 100%;
}

.hero-text-box {
  max-width: 600px;
  background: rgba(253, 251, 247, 0.95);
  padding: 3rem;
  border-radius: 2rem;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  border: 4px solid var(--accent-green);
}

[data-theme="dark"] .hero-text-box {
  background: rgba(26, 32, 44, 0.95);
}

.hero-title {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--accent-green);
}

.hero-subtitle {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  color: var(--text-secondary);
  font-weight: 600;
}

/* Typography Utilities */
.mt-3 { margin-top: 1.5rem; }
.mt-5 { margin-top: 3rem; }
.p-4 { padding: 2rem; }

/* Generic Sections */
.section {
  padding: 5rem 1.5rem;
}

.section-header {
  margin-bottom: 3rem;
  text-align: center;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

.section-header h2 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.bg-soft {
  background-color: rgba(56, 161, 105, 0.05);
}

[data-theme="dark"] .bg-soft {
  background-color: rgba(56, 161, 105, 0.1);
}

.rounded-section {
  border-radius: 2rem;
  margin-top: 2rem;
  margin-bottom: 2rem;
}

/* Grids */
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

/* Cards */
.mission-card {
  padding: 2.5rem 1.5rem;
  text-align: center;
}

.card-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.mission-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

/* Branche */
.branca-card {
  display: flex;
  flex-direction: column;
}

.branca-header {
  padding: 1.5rem;
  background: var(--accent-green);
  color: white;
  text-align: center;
}

.branca-header h3 {
  color: white;
  margin-bottom: 0.5rem;
}

.age-badge {
  display: inline-block;
  background: rgba(255,255,255,0.2);
  padding: 0.2rem 0.8rem;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.9rem;
}

.branca-body {
  padding: 1.5rem;
}

/* Custom colors for each branca (Yellow, Green, Red) */
.lc .branca-header { background: #ecc94b; } /* Yellow for Lupetti */
.lc .branca-header h3, .lc .age-badge { color: #744210; }

.eg .branca-header { background: #38a169; } /* Green for Esploratori */

.rs .branca-header { background: #e53e3e; } /* Red for Rover */

/* History */
.history-card {
  padding: 3rem;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2338a169' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.history-card h2 {
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
}

.history-card h3 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

/* Contact */
.contact-card {
  padding: 2.5rem 1.5rem;
  text-align: center;
  display: block;
}

.contact-card:hover {
  border-color: var(--accent-green);
}

.contact-icon-wrapper {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

/* Footer */
.footer {
  background: var(--card-bg);
  padding: 3rem 0;
  border-top: 1px solid var(--card-border);
  text-align: center;
  margin-top: auto;
}

.footer-logo {
  height: 60px;
  width: auto;
  margin-bottom: 1rem;
  opacity: 0.8;
}

/* Responsive */
@media (max-width: 900px) {
  .grid-3 {
    grid-template-columns: 1fr;
  }
  
  .hero-text-box {
    margin: 0 1.5rem;
    padding: 2rem;
  }
  
  .hero-title {
    font-size: 2.5rem;
  }
}

@media (max-width: 768px) {
  .nav-links {
    display: none; /* Can add a hamburger menu if needed, keeping it simple */
  }
  
  .nav-container {
    justify-content: space-between;
  }
  
  .theme-toggle {
    display: block;
  }
}
</style>
