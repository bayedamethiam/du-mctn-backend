const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, authorizeRoles, auditLog } = require('../middleware/auth');
const router = express.Router();

const parse = i => ({
  ...i,
  scores:      { presence:i.score_presence, contribution:i.score_contribution, postes:i.score_postes, suivi:i.score_suivi },
  mandats:     JSON.parse(i.mandats_json || '[]'),
  gaps:        JSON.parse(i.gaps_json    || '[]'),
  nextMeeting: { label:i.next_meeting_label, date:i.next_meeting_date, lieu:i.next_meeting_lieu },
});

router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM intl_instances ORDER BY category,acronym').all().map(i => ({
    ...parse(i),
    contributions: db.prepare('SELECT * FROM intl_contributions WHERE instance_id=? ORDER BY date DESC').all(i.id),
  })));
});
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDb(); const i = db.prepare('SELECT * FROM intl_instances WHERE id=?').get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ...parse(i), contributions: db.prepare('SELECT * FROM intl_contributions WHERE instance_id=?').all(i.id) });
});
router.post('/', authenticateToken, authorizeRoles('coordinator','director','admin'), auditLog('CREATE','intl_instances'), (req, res) => {
  const { acronym,name,category,siege,niveau,responsible,focal,scores,next_meeting_label,next_meeting_date,next_meeting_lieu,mandats,gaps,ndt_link,priority } = req.body;
  if (!acronym || !name || !category) return res.status(400).json({ error: 'Acronyme, nom et catégorie requis' });
  const db = getDb();
  const r  = db.prepare('INSERT INTO intl_instances (acronym,name,category,siege,niveau,responsible,focal,score_presence,score_contribution,score_postes,score_suivi,next_meeting_label,next_meeting_date,next_meeting_lieu,mandats_json,gaps_json,ndt_link,priority) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
               .run(acronym,name,category,siege,niveau||'membre',responsible,focal,
                   scores?.presence||0,scores?.contribution||0,scores?.postes||0,scores?.suivi||0,
                   next_meeting_label,next_meeting_date,next_meeting_lieu,
                   JSON.stringify(mandats||[]),JSON.stringify(gaps||[]),ndt_link,priority||'moyenne');
  res.status(201).json(parse(db.prepare('SELECT * FROM intl_instances WHERE id=?').get(r.lastInsertRowid)));
});
router.put('/:id', authenticateToken, authorizeRoles('coordinator','director','admin'), auditLog('UPDATE','intl_instances'), (req, res) => {
  const { niveau,responsible,focal,scores,next_meeting_label,next_meeting_date,next_meeting_lieu,mandats,gaps,ndt_link,priority } = req.body;
  const db = getDb();
  db.prepare("UPDATE intl_instances SET niveau=COALESCE(?,niveau),responsible=COALESCE(?,responsible),focal=COALESCE(?,focal),score_presence=COALESCE(?,score_presence),score_contribution=COALESCE(?,score_contribution),score_postes=COALESCE(?,score_postes),score_suivi=COALESCE(?,score_suivi),next_meeting_label=COALESCE(?,next_meeting_label),next_meeting_date=COALESCE(?,next_meeting_date),next_meeting_lieu=COALESCE(?,next_meeting_lieu),mandats_json=COALESCE(?,mandats_json),gaps_json=COALESCE(?,gaps_json),ndt_link=COALESCE(?,ndt_link),priority=COALESCE(?,priority),updated_at=datetime('now') WHERE id=?")
    .run(niveau,responsible,focal,scores?.presence,scores?.contribution,scores?.postes,scores?.suivi,
        next_meeting_label,next_meeting_date,next_meeting_lieu,
        mandats?JSON.stringify(mandats):null, gaps?JSON.stringify(gaps):null,
        ndt_link,priority,req.params.id);
  res.json(parse(db.prepare('SELECT * FROM intl_instances WHERE id=?').get(req.params.id)));
});
router.post('/:id/contributions', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('CREATE','intl_contributions'), (req, res) => {
  const { titre,date,statut,impact } = req.body;
  if (!titre) return res.status(400).json({ error: 'Titre requis' });
  const db = getDb();
  const r  = db.prepare('INSERT INTO intl_contributions (instance_id,titre,date,statut,impact) VALUES (?,?,?,?,?)')
               .run(req.params.id,titre,date,statut||'planifie',impact||'moyenne');
  res.status(201).json(db.prepare('SELECT * FROM intl_contributions WHERE id=?').get(r.lastInsertRowid));
});
router.put('/:id/contributions/:cid', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), (req, res) => {
  const { titre,date,statut,impact } = req.body;
  const db = getDb();
  db.prepare('UPDATE intl_contributions SET titre=COALESCE(?,titre),date=COALESCE(?,date),statut=COALESCE(?,statut),impact=COALESCE(?,impact) WHERE id=? AND instance_id=?')
    .run(titre,date,statut,impact,req.params.cid,req.params.id);
  res.json(db.prepare('SELECT * FROM intl_contributions WHERE id=?').get(req.params.cid));
});
router.delete('/:id/contributions/:cid', authenticateToken, authorizeRoles('coordinator','director','admin'), (req, res) => {
  getDb().prepare('DELETE FROM intl_contributions WHERE id=? AND instance_id=?').run(req.params.cid,req.params.id);
  res.json({ success: true });
});
module.exports = router;
