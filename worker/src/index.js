function nextPowerOfTwo(n) {
  if (n <= 0) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

async function propagateWinner(env, matchId, score1, score2, currentRound, currentPhase) {
  const roundOrder = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];
  const roundIdx = roundOrder.indexOf(currentRound);
  if (roundIdx === -1 || roundIdx >= roundOrder.length - 1) return; // no next round

  const nextRound = roundOrder[roundIdx + 1];

  // Determine winner team name and id
  const { results: matchData } = await env.DB.prepare(
    'SELECT t1.name as team1_name, t1.id as team1_id, t2.name as team2_name, t2.id as team2_id FROM matches m LEFT JOIN teams t1 ON m.team1_id = t1.id LEFT JOIN teams t2 ON m.team2_id = t2.id WHERE m.id = ?'
  ).bind(matchId).all();
  if (!matchData[0]) return;

  const winnerId = score1 > score2 ? matchData[0].team1_id : matchData[0].team2_id;
  const winnerName = score1 > score2 ? matchData[0].team1_name : matchData[0].team2_name;
  if (!winnerId) return;

  // Find this match's position within its round (ordered by id)
  const { results: roundMatches } = await env.DB.prepare(
    'SELECT id FROM matches WHERE round = ? AND (phase = ? OR ? IN (\'knockout\', \'final\')) ORDER BY id ASC'
  ).bind(currentRound, currentPhase, currentPhase).all();
  const position = roundMatches.findIndex(m => m.id == matchId);
  if (position === -1) return;
  const pos1 = position + 1; // 1-indexed

  // Target position in next round
  const targetPos = Math.ceil(pos1 / 2);
  const isTeam1 = pos1 % 2 === 1; // odd → team1, even → team2

  // Find target match in next round
  const { results: nextRoundMatches } = await env.DB.prepare(
    'SELECT id FROM matches WHERE round = ? ORDER BY id ASC'
  ).bind(nextRound).all();
  if (targetPos > nextRoundMatches.length) return;
  const targetMatchId = nextRoundMatches[targetPos - 1]?.id;
  if (!targetMatchId) return;

  // Update the target match: set team id and clear placeholder
  if (isTeam1) {
    await env.DB.prepare(
      'UPDATE matches SET team1_id = ?, placeholder_team1 = NULL WHERE id = ?'
    ).bind(winnerId, targetMatchId).run();
  } else {
    await env.DB.prepare(
      'UPDATE matches SET team2_id = ?, placeholder_team2 = NULL WHERE id = ?'
    ).bind(winnerId, targetMatchId).run();
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    };

    try {
      const checkAuth = () => {
        const authHeader = request.headers.get('Authorization');
        return authHeader === `Bearer ${env.SECRET_KEY}`;
      };

      // --- AUTH ---
      if (request.method === 'GET' && path === '/api/auth/verify') {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        return jsonResponse({ success: true });
      }

      // --- TEAMS ---
      if (request.method === 'GET' && path === '/api/teams') {
        const { results } = await env.DB.prepare('SELECT * FROM teams ORDER BY points DESC, name ASC').all();
        return jsonResponse(results);
      }

      if (request.method === 'POST' && path === '/api/teams') {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        const { name, group_name } = await request.json();
        if (!name) return jsonResponse({ error: 'Invalid data' }, 400);
        await env.DB.prepare('INSERT INTO teams (name, group_name, points) VALUES (?, ?, 0)').bind(name, group_name || '').run();
        return jsonResponse({ success: true });
      }

      if (request.method === 'PUT' && path.startsWith('/api/teams/')) {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        const id = path.split('/').pop();
        const { name } = await request.json();
        if (!name) return jsonResponse({ error: 'Invalid data' }, 400);
        await env.DB.prepare('UPDATE teams SET name = ? WHERE id = ?').bind(name, id).run();
        return jsonResponse({ success: true });
      }

      if (request.method === 'DELETE' && path.startsWith('/api/teams/')) {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        const id = path.split('/').pop();
        await env.DB.batch([
          env.DB.prepare('UPDATE matches SET team1_id = NULL WHERE team1_id = ?').bind(id),
          env.DB.prepare('UPDATE matches SET team2_id = NULL WHERE team2_id = ?').bind(id),
          env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(id),
        ]);
        return jsonResponse({ success: true });
      }

      if (request.method === 'POST' && path === '/api/teams/groups') {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        const updates = await request.json();
        const statements = [];
        for (const u of updates) {
          statements.push(env.DB.prepare('UPDATE teams SET group_name = ? WHERE id = ?').bind(u.group_name, u.id));
        }
        if (statements.length > 0) await env.DB.batch(statements);
        return jsonResponse({ success: true });
      }

      // --- MATCHES ---
      if (request.method === 'GET' && path === '/api/matches') {
        const { results } = await env.DB.prepare(`
          SELECT m.id, m.score1, m.score2, m.status, m.phase, m.round, m.start_time, m.court, m.placeholder_team1, m.placeholder_team2,
                 t1.name as team1_name, t1.group_name as group1, t1.id as t1_id,
                 t2.name as team2_name, t2.group_name as group2, t2.id as t2_id
          FROM matches m
          LEFT JOIN teams t1 ON m.team1_id = t1.id
          LEFT JOIN teams t2 ON m.team2_id = t2.id
          ORDER BY m.start_time ASC, m.id ASC
        `).all();
        return jsonResponse(results);
      }

      // Update single match
      if (request.method === 'PUT' && path.startsWith('/api/matches/')) {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        const id = path.split('/').pop();
        const { score1, score2, status, team1_id, team2_id } = await request.json();

        // Fetch current match to check its phase and round
        const { results: matchRows } = await env.DB.prepare('SELECT phase, round, team1_id, team2_id FROM matches WHERE id = ?').bind(id).all();
        const currentPhase = matchRows[0]?.phase;
        const currentRound = matchRows[0]?.round;

        // Block draws in knockout / final phases
        const isKnockoutPhase = currentPhase === 'knockout' || currentPhase === 'final';
        if (isKnockoutPhase && status === 'completed' && score1 === score2) {
          return jsonResponse({ error: 'Draw not allowed in knockout/final phases' }, 400);
        }
        
        await env.DB.prepare(
          'UPDATE matches SET score1 = ?, score2 = ?, status = ? WHERE id = ?'
        ).bind(score1, score2, status, id).run();

        // Very basic points calculation on match end
        if (status === 'completed' && team1_id && team2_id) {
            let pts1 = 0; let pts2 = 0;
            if (score1 > score2) pts1 = 3;
            else if (score2 > score1) pts2 = 3;
            else { pts1 = 1; pts2 = 1; }
            
            // For knockout, assign 2pts / 0pts to help ranking (though normally not used)
            if (isKnockoutPhase) {
              pts1 = score1 > score2 ? 2 : 0;
              pts2 = score2 > score1 ? 2 : 0;
            }
            
            await env.DB.batch([
               env.DB.prepare('UPDATE teams SET points = points + ? WHERE id = ?').bind(pts1, team1_id),
               env.DB.prepare('UPDATE teams SET points = points + ? WHERE id = ?').bind(pts2, team2_id)
            ]);

            // Propagate winner to next round in knockout/final phases
            if (isKnockoutPhase) {
              await propagateWinner(env, id, score1, score2, currentRound, currentPhase);
            }
        }

        return jsonResponse({ success: true });
      }

      if (request.method === 'POST' && path === '/api/matches/preview') {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        
        const { results: teams } = await env.DB.prepare('SELECT * FROM teams').all();
        const { results: settingsRows } = await env.DB.prepare('SELECT * FROM tournament_settings').all();
        const settings = {};
        for (const r of settingsRows) settings[r.setting_key] = r.setting_value;
        const hasReturn = settings.has_return_matches === 'true';
        const courtsCount = parseInt(settings.courts_count || '1');
        const durationMin = parseInt(settings.match_duration_minutes || '40');
        const breakMin = parseInt(settings.break_between_matches_minutes || '5');
        const startTimeStr = settings.start_date_time || new Date().toISOString();
        let currentTimestamp = new Date(startTimeStr).getTime();
        if (isNaN(currentTimestamp)) currentTimestamp = Date.now();
        
        const groups = {};
        for (const t of teams) {
          if (!t.group_name) continue; // Skip unassigned
          if (!groups[t.group_name]) groups[t.group_name] = [];
          groups[t.group_name].push(t);
        }
        
        const generatedMatches = [];
        let matchIdCounter = 1;
        
        const courtAvailability = Array(courtsCount).fill(currentTimestamp);
        const assignTimeAndCourt = () => {
          let earliestCourt = 0;
          let earliestTime = courtAvailability[0];
          for (let c = 1; c < courtsCount; c++) {
            if (courtAvailability[c] < earliestTime) {
              earliestTime = courtAvailability[c];
              earliestCourt = c;
            }
          }
          const assignedTime = new Date(earliestTime).toISOString().slice(0, 16);
          courtAvailability[earliestCourt] = earliestTime + (durationMin + breakMin) * 60000;
          return { time: assignedTime, court: `Campo ${earliestCourt + 1}` };
        };
        
        // FASE A GIRONI ONLY
        for (const groupTeams of Object.values(groups)) {
          for (let i = 0; i < groupTeams.length; i++) {
            for (let j = i + 1; j < groupTeams.length; j++) {
              const { time, court } = assignTimeAndCourt();
              generatedMatches.push({
                id: `preview-${matchIdCounter++}`,
                team1_id: groupTeams[i].id,
                team2_id: groupTeams[j].id,
                placeholder_team1: null,
                placeholder_team2: null,
                team1_name: groupTeams[i].name,
                team2_name: groupTeams[j].name,
                group1: groupTeams[i].group_name,
                phase: 'groups',
                round: '1',
                start_time: time,
                court: court,
                status: 'scheduled'
              });
              
              if (hasReturn) {
                 const { time: timeR, court: courtR } = assignTimeAndCourt();
                 generatedMatches.push({
                  id: `preview-${matchIdCounter++}`,
                  team1_id: groupTeams[j].id,
                  team2_id: groupTeams[i].id,
                  placeholder_team1: null,
                  placeholder_team2: null,
                  team1_name: groupTeams[j].name,
                  team2_name: groupTeams[i].name,
                  group1: groupTeams[i].group_name,
                  phase: 'groups',
                  round: '2',
                  start_time: timeR,
                  court: courtR,
                  status: 'scheduled'
                });
              }
            }
          }
        }

        return jsonResponse(generatedMatches);
      }

      if (request.method === 'POST' && path === '/api/matches/preview_knockout') {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        
        const body = await request.json(); // { qualified_per_group: 2, wildcards: 0 }
        const passPerGroup = parseInt(body.qualified_per_group || 2);
        
        const { results: teams } = await env.DB.prepare('SELECT * FROM teams ORDER BY points DESC, name ASC').all();
        const { results: settingsRows } = await env.DB.prepare('SELECT * FROM tournament_settings').all();
        const settings = {};
        for (const r of settingsRows) settings[r.setting_key] = r.setting_value;
        const courtsCount = parseInt(settings.courts_count || '1');
        const durationMin = parseInt(settings.match_duration_minutes || '40');
        const breakMin = parseInt(settings.break_between_matches_minutes || '5');
        const startTimeStr = settings.start_date_time || new Date().toISOString(); // Potremmo usare la fine dell'ultima partita
        let currentTimestamp = new Date(startTimeStr).getTime() + (86400000); // +1 giorno approx per le finali
        
        const courtAvailability = Array(courtsCount).fill(currentTimestamp);
        const assignTimeAndCourt = () => {
          let earliestCourt = 0;
          let earliestTime = courtAvailability[0];
          for (let c = 1; c < courtsCount; c++) {
            if (courtAvailability[c] < earliestTime) {
              earliestTime = courtAvailability[c];
              earliestCourt = c;
            }
          }
          const assignedTime = new Date(earliestTime).toISOString().slice(0, 16);
          courtAvailability[earliestCourt] = earliestTime + (durationMin + breakMin) * 60000;
          return { time: assignedTime, court: `Campo ${earliestCourt + 1}` };
        };

        const groups = {};
        teams.forEach(t => {
            if (!t.group_name) return;
            if (!groups[t.group_name]) groups[t.group_name] = [];
            groups[t.group_name].push(t);
        });

        // Prendi le qualificate
        let qualified = [];
        const groupKeys = Object.keys(groups).sort();
        if (groupKeys.length > 0) {
          groupKeys.forEach(g => {
              qualified.push(...groups[g].slice(0, passPerGroup));
          });
        } else {
          // Modalità solo eliminazione diretta: tutte le squadre vanno nel tabellone
          qualified = teams.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
        }

        // Basic knockout generation
        const generatedMatches = [];
        let matchIdCounter = 1;

        if (qualified.length === 2) {
             const { time: t3, court: c3 } = assignTimeAndCourt();
             generatedMatches.push({
                 id: `preview-${matchIdCounter++}`,
                 team1_id: qualified[0].id, team2_id: qualified[1].id,
                 placeholder_team1: null, placeholder_team2: null,
                 team1_name: qualified[0].name, team2_name: qualified[1].name,
                 phase: 'final', round: 'F', start_time: t3, court: c3, status: 'scheduled'
             });
        } else if (qualified.length === 4) {
             const { time: t1, court: c1 } = assignTimeAndCourt();
             generatedMatches.push({ id: `preview-${matchIdCounter++}`, team1_id: qualified[0].id, team2_id: qualified[3].id, placeholder_team1: null, placeholder_team2: null, team1_name: qualified[0].name, team2_name: qualified[3].name, phase: 'knockout', round: 'SF', start_time: t1, court: c1, status: 'scheduled' });
             const { time: t2, court: c2 } = assignTimeAndCourt();
             generatedMatches.push({ id: `preview-${matchIdCounter++}`, team1_id: qualified[1].id, team2_id: qualified[2].id, placeholder_team1: null, placeholder_team2: null, team1_name: qualified[1].name, team2_name: qualified[2].name, phase: 'knockout', round: 'SF', start_time: t2, court: c2, status: 'scheduled' });
             
             const { time: t3, court: c3 } = assignTimeAndCourt();
             generatedMatches.push({ id: `preview-${matchIdCounter++}`, team1_id: null, team2_id: null, placeholder_team1: `Vincente SF 1`, placeholder_team2: `Vincente SF 2`, team1_name: `Vincente SF 1`, team2_name: `Vincente SF 2`, phase: 'final', round: 'F', start_time: t3, court: c3, status: 'scheduled' });
        } else if (qualified.length === 8) {
             // QF
             for(let i=0; i<4; i++) {
                 const { time, court } = assignTimeAndCourt();
                 generatedMatches.push({ id: `preview-${matchIdCounter++}`, team1_id: qualified[i].id, team2_id: qualified[7-i].id, placeholder_team1: null, placeholder_team2: null, team1_name: qualified[i].name, team2_name: qualified[7-i].name, phase: 'knockout', round: 'QF', start_time: time, court: court, status: 'scheduled' });
             }
             // SF
             for(let i=0; i<2; i++) {
                 const { time, court } = assignTimeAndCourt();
                 generatedMatches.push({ id: `preview-${matchIdCounter++}`, team1_id: null, team2_id: null, placeholder_team1: `Vincente QF ${i*2+1}`, placeholder_team2: `Vincente QF ${i*2+2}`, team1_name: `Vincente QF ${i*2+1}`, team2_name: `Vincente QF ${i*2+2}`, phase: 'knockout', round: 'SF', start_time: time, court: court, status: 'scheduled' });
             }
             // F
             const { time, court } = assignTimeAndCourt();
             generatedMatches.push({ id: `preview-${matchIdCounter++}`, team1_id: null, team2_id: null, placeholder_team1: `Vincente SF 1`, placeholder_team2: `Vincente SF 2`, team1_name: `Vincente SF 1`, team2_name: `Vincente SF 2`, phase: 'final', round: 'F', start_time: time, court: court, status: 'scheduled' });
        } else if (qualified.length >= 9) {
             const numTeams = nextPowerOfTwo(qualified.length);
             const numRounds = Math.log2(numTeams);
             const roundNames = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];
             const firstRound = roundNames[roundNames.length - numRounds];
             // Round 1 (e.g. R16 / QF)
             const matchesInFirstRound = numTeams / 2;
             for (let i = 0; i < matchesInFirstRound; i++) {
                 const idx1 = i;
                 const idx2 = numTeams - 1 - i;
                 if (idx1 < qualified.length && idx2 < qualified.length) {
                     const { time, court } = assignTimeAndCourt();
                     generatedMatches.push({ id: `preview-${matchIdCounter++}`, team1_id: qualified[idx1].id, team2_id: qualified[idx2].id, placeholder_team1: null, placeholder_team2: null, team1_name: qualified[idx1].name, team2_name: qualified[idx2].name, phase: 'knockout', round: firstRound, start_time: time, court: court, status: 'scheduled' });
                 }
             }
             // Subsequent rounds (placeholders)
             let prevRound = firstRound;
             for (let r = 1; r < numRounds; r++) {
                 const currRound = roundNames[roundNames.length - numRounds + r];
                 const matchesInRound = numTeams / Math.pow(2, r + 1);
                 for (let i = 0; i < matchesInRound; i++) {
                     const { time, court } = assignTimeAndCourt();
                     const isFinal = r === numRounds - 1;
                     generatedMatches.push({
                         id: `preview-${matchIdCounter++}`,
                         team1_id: null, team2_id: null,
                         placeholder_team1: `Vincente ${prevRound} ${i * 2 + 1}`,
                         placeholder_team2: `Vincente ${prevRound} ${i * 2 + 2}`,
                         team1_name: `Vincente ${prevRound} ${i * 2 + 1}`,
                         team2_name: `Vincente ${prevRound} ${i * 2 + 2}`,
                         phase: isFinal ? 'final' : 'knockout',
                         round: currRound,
                         start_time: time, court: court,
                         status: 'scheduled'
                     });
                 }
                 prevRound = currRound;
             }
        }

        return jsonResponse(generatedMatches);
      }

      if (request.method === 'POST' && path === '/api/matches/bulk') {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        const { matches, new_status } = await request.json();
        
        const statements = [];
        for (const m of matches) {
          statements.push(env.DB.prepare(`
            INSERT INTO matches (team1_id, team2_id, placeholder_team1, placeholder_team2, status, phase, round, start_time, court) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(m.team1_id, m.team2_id, m.placeholder_team1, m.placeholder_team2, 'scheduled', m.phase, m.round, m.start_time, m.court));
        }
        
        if (new_status) {
           statements.push(env.DB.prepare("INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('status', ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=?").bind(new_status, new_status));
        }
        
        if (statements.length > 0) await env.DB.batch(statements);
        return jsonResponse({ success: true, count: matches.length });
      }

      // --- SETTINGS ---
      if (request.method === 'GET' && path === '/api/settings') {
        const { results } = await env.DB.prepare('SELECT * FROM tournament_settings').all();
        const settings = {};
        for (const row of results) {
          settings[row.setting_key] = row.setting_value;
        }
        return jsonResponse(settings);
      }

      if (request.method === 'POST' && path === '/api/settings') {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        const settings = await request.json();
        
        const statements = [];
        for (const [key, value] of Object.entries(settings)) {
          statements.push(env.DB.prepare(
            'INSERT INTO tournament_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value'
          ).bind(key, String(value)));
        }
        if (statements.length > 0) await env.DB.batch(statements);
        return jsonResponse({ success: true });
      }

      // --- RESET ---
      if (request.method === 'POST' && path === '/api/reset') {
        if (!checkAuth()) return jsonResponse({ error: 'Unauthorized' }, 401);
        
        await env.DB.batch([
          env.DB.prepare('DELETE FROM matches'),
          env.DB.prepare('DELETE FROM teams'),
          env.DB.prepare("INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('format', 'gironi_e_finali') ON CONFLICT(setting_key) DO UPDATE SET setting_value='gironi_e_finali'"),
          env.DB.prepare("INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('has_return_matches', 'false') ON CONFLICT(setting_key) DO UPDATE SET setting_value='false'"),
          env.DB.prepare("INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('status', 'settings_setup') ON CONFLICT(setting_key) DO UPDATE SET setting_value='settings_setup'"),
          env.DB.prepare("INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('courts_count', '2') ON CONFLICT(setting_key) DO UPDATE SET setting_value='2'"),
          env.DB.prepare("INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('match_duration_minutes', '40') ON CONFLICT(setting_key) DO UPDATE SET setting_value='40'"),
          env.DB.prepare("INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('break_between_matches_minutes', '5') ON CONFLICT(setting_key) DO UPDATE SET setting_value='5'"),
          env.DB.prepare("INSERT INTO tournament_settings (setting_key, setting_value) VALUES ('start_date_time', '') ON CONFLICT(setting_key) DO UPDATE SET setting_value=''"),
        ]);
        
        return jsonResponse({ success: true, message: 'Tutti i dati sono stati cancellati. Il torneo è stato resettato.' });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
};
