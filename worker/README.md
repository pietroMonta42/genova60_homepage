# Backend Torneo (Cloudflare Worker + D1)

Questo backend è progettato per ospitare i dati del torneo di pallavolo in modo **completamente gratuito** utilizzando l'ecosistema Cloudflare.

## Limiti del Piano Gratuito (Al 2026)
Cloudflare D1 e Workers offrono limiti gratuiti generosi, più che sufficienti per un piccolo torneo:
- **Cloudflare D1 (Database SQL):**
  - Storage Totale: 5 GB
  - Letture: 5 Milioni al giorno
  - Scritture: 100.000 al giorno
- **Cloudflare Workers (API):**
  - Richieste: 100.000 al giorno

## Come pubblicare in Produzione

Per pubblicare online questo backend, segui questi passaggi usando il terminale dal tuo computer (dentro la cartella `worker`):

### 1. Login su Cloudflare
Se non sei già loggato, esegui:
```bash
npx wrangler login
```

### 2. Creare il Database D1 (Produzione)
Crea il database remoto su Cloudflare:
```bash
npx wrangler d1 create torneo-db
```
Questo comando restituirà un `database_id` lungo (es. `xxx-yyy-zzz`).
**Copia quel `database_id` e incollalo nel file `wrangler.toml`** sostituendo quello fasullo (`00000000...`).

### 3. Popolare il Database
Invia la struttura delle tabelle (schema) al database di produzione:
```bash
npx wrangler d1 execute torneo-db --remote --file=./schema.sql
```

### 4. Impostare la Password Segreta
Per accedere alla pagina `/torneo/admin`, l'API richiede un `SECRET_KEY`.
Essendo una chiave di sicurezza, **non** va scritta nel codice, ma salvata nei "Secrets" di Cloudflare:
```bash
npx wrangler secret put SECRET_KEY
```
Il terminale ti chiederà di digitare il valore. Inserisci ad esempio `admin123` (o un'altra password a tua scelta).

### 5. Pubblicare il Worker
Infine, pubblica il codice dell'API online:
```bash
npx wrangler deploy
```
Wrangler ti restituirà un URL pubblico (es. `https://torneo-api.<tuo-nome>.workers.dev`).

### 6. Configurare il Frontend per la Produzione

Su Cloudflare Pages, imposta una variabile d'ambiente `VITE_API_URL` con l'URL del worker:

```bash
npx wrangler pages secret put VITE_API_URL
```

Oppure nella dashboard Cloudflare Pages → nome-progetto → **Settings → Environment variables**:
- **Variable name**: `VITE_API_URL`
- **Value**: `https://torneo-api.<tuo-nome>.workers.dev`

Poi ridistribuisci il frontend. Il sistema userà automaticamente l'URL di produzione invece di `http://localhost:8787`.
