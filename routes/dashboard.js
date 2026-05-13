const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/kpis', authenticateToken, async (req, res) => {
  try {
    const db      = getDb();
    const progRows = await db.prepare('SELECT status,COUNT(*) as c FROM programs GROUP BY status').all();
    const progs    = Object.fromEntries(progRows.map(p => [p.status, p.c]));
    const indStRows = await db.prepare('SELECT status,COUNT(*) as c FROM indicators GROUP BY status').all();
    const indSt    = Object.fromEntries(indStRows.map(i => [i.status, i.c]));
    const avgRow   = await db.prepare('SELECT AVG(progress) as avg FROM programs').get();
    const avgP     = avgRow?.avg || 0;
    const [urgentes, hautes, audiences_suivi, partnerships_actifs] = await Promise.all([
      db.prepare("SELECT COUNT(*) as c FROM diligences WHERE priority='critique' AND status!='fait'").get(),
      db.prepare("SELECT COUNT(*) as c FROM diligences WHERE priority='haute'   AND status!='fait'").get(),
      db.prepare("SELECT COUNT(*) as c FROM audiences WHERE status='tenue' AND suite_a_donner IS NOT NULL AND suite_a_donner!=''").get(),
      db.prepare("SELECT COUNT(*) as c FROM partnerships WHERE status='actif'").get(),
    ]);
    res.json({
      programs:            { total:12, on_track:progs.on_track||0, attention:progs.attention||0, risque:progs.risque||0 },
      diligences:          { urgentes: urgentes.c, hautes: hautes.c },
      audiences_suivi:     audiences_suivi.c,
      indicators:          { on_track:indSt.on_track||0, attention:indSt.attention||0, risque:indSt.risque||0 },
      partnerships_actifs: partnerships_actifs.c,
      avg_progress:        Math.round(avgP),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const [critical_diligences, pending_audience_followups, risk_indicators] = await Promise.all([
      db.prepare("SELECT id,title,source,deadline,priority FROM diligences WHERE priority='critique' AND status!='fait' ORDER BY deadline ASC LIMIT 5").all(),
      db.prepare("SELECT id,institution,suite_a_donner,followup_date FROM audiences WHERE status='tenue' AND suite_a_donner IS NOT NULL AND suite_a_donner!='' ORDER BY followup_date ASC LIMIT 5").all(),
      db.prepare("SELECT code,label,current_value,target,unit FROM indicators WHERE status='risque'").all(),
    ]);
    res.json({ critical_diligences, pending_audience_followups, risk_indicators });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
