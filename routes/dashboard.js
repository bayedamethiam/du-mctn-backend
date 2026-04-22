const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/kpis', authenticateToken, (req, res) => {
  const db = getDb();
  const progs  = Object.fromEntries(db.prepare('SELECT status,COUNT(*) as c FROM programs GROUP BY status').all().map(p => [p.status, p.c]));
  const indSt  = Object.fromEntries(db.prepare('SELECT status,COUNT(*) as c FROM indicators GROUP BY status').all().map(i => [i.status, i.c]));
  const avgP   = db.prepare('SELECT AVG(progress) as avg FROM programs').get().avg || 0;
  res.json({
    programs: { total:12, on_track:progs.on_track||0, attention:progs.attention||0, risque:progs.risque||0 },
    diligences: {
      urgentes: db.prepare("SELECT COUNT(*) as c FROM diligences WHERE priority='critique' AND status!='fait'").get().c,
      hautes:   db.prepare("SELECT COUNT(*) as c FROM diligences WHERE priority='haute'   AND status!='fait'").get().c,
    },
    audiences_suivi: db.prepare("SELECT COUNT(*) as c FROM audiences WHERE status='tenue' AND suite_a_donner IS NOT NULL AND suite_a_donner!=''").get().c,
    indicators: { on_track:indSt.on_track||0, attention:indSt.attention||0, risque:indSt.risque||0 },
    partnerships_actifs: db.prepare("SELECT COUNT(*) as c FROM partnerships WHERE status='actif'").get().c,
    avg_progress: Math.round(avgP),
  });
});

router.get('/alerts', authenticateToken, (req, res) => {
  const db = getDb();
  res.json({
    critical_diligences:      db.prepare("SELECT id,title,source,deadline,priority FROM diligences WHERE priority='critique' AND status!='fait' ORDER BY deadline ASC LIMIT 5").all(),
    pending_audience_followups: db.prepare("SELECT id,institution,suite_a_donner,followup_date FROM audiences WHERE status='tenue' AND suite_a_donner IS NOT NULL AND suite_a_donner!='' ORDER BY followup_date ASC LIMIT 5").all(),
    risk_indicators:           db.prepare("SELECT code,label,current_value,target,unit FROM indicators WHERE status='risque'").all(),
  });
});

module.exports = router;
