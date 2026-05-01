export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
        
        await env.DB.prepare(
          'UPDATE matches SET score1 = ?, score2 = ?, status = ? WHERE id = ?'
        ).bind(score1, score2, status, id).run();

        // Very basic points calculation on match end
        if (status === 'completed' && team1_id && team2_id) {
            let pts1 = 0; let pts2 = 0;
            if (score1 > score2) pts1 = 3;
            else if (score2 > score1) pts2 = 3;
            else { pts1 = 1; pts2 = 1; }
            
            // This is a naive way, in reality we should recalculate points across all matches. For now just increment.
            // Better to leave recalculation out or do it full.
            await env.DB.batch([
               env.DB.prepare('UPDATE teams SET points = points + ? WHERE id = ?').bind(pts1, team1_id),
               env.DB.prepare('UPDATE teams SET points = points + ? WHERE id = ?').bind(pts2, team2_id)
            ]);
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
        groupKeys.forEach(g => {
            qualified.push(...groups[g].slice(0, passPerGroup));
        });

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

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
};
