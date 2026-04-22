const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, authorizeRoles, auditLog } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const { status, priority } = req.query; let q = 'SELECT * FROM audiences WHERE 1=1'; const p = [];
  if (status)   { q += ' AND status=?';   p.push(status); }
  if (priority) { q += ' AND priority=?'; p.push(priority); }
  q += " ORDER BY CASE priority WHEN 'critique' THEN 1 WHEN 'haute' THEN 2 ELSE 3 END, date DESC";
  res.json(getDb().prepare(q).all(...p));
});
router.get('/:id', authenticateToken, (req, res) => {
  const a = getDb().prepare('SELECT * FROM audiences WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Introuvable' }); res.json(a);
});
router.post('/', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('CREATE','audiences'), (req, res) => {
  const { institution,contact,date,objet,status,priority,suite_a_donner,followup_date,notes } = req.body;
  if (!institution) return res.status(400).json({ error: 'Institution requise' });
  const db = getDb();
  const r  = db.prepare('INSERT INTO audiences (institution,contact,date,objet,status,priority,suite_a_donner,followup_date,notes) VALUES (?,?,?,?,?,?,?,?,?)')
               .run(institution,contact,date,objet,status||'planifiee',priority||'haute',suite_a_donner,followup_date,notes);
  res.status(201).json(db.prepare('SELECT * FROM audiences WHERE id=?').get(r.lastInsertRowid));
});
router.put('/:id', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('UPDATE','audiences'), (req, res) => {
  const { institution,contact,date,objet,status,priority,suite_a_donner,followup_date,notes } = req.body;
  const db = getDb();
  db.prepare("UPDATE audiences SET institution=COALESCE(?,institution),contact=COALESCE(?,contact),date=COALESCE(?,date),objet=COALESCE(?,objet),status=COALESCE(?,status),priority=COALESCE(?,priority),suite_a_donner=COALESCE(?,suite_a_donner),followup_date=COALESCE(?,followup_date),notes=COALESCE(?,notes),updated_at=datetime('now') WHERE id=?")
    .run(institution,contact,date,objet,status,priority,suite_a_donner,followup_date,notes,req.params.id);
  res.json(db.prepare('SELECT * FROM audiences WHERE id=?').get(req.params.id));
});
router.patch('/:id/status', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('STATUS','audiences'), (req, res) => {
  const db = getDb();
  db.prepare("UPDATE audiences SET status=?,updated_at=datetime('now') WHERE id=?").run(req.body.status, req.params.id);
  res.json(db.prepare('SELECT * FROM audiences WHERE id=?').get(req.params.id));
});
router.delete('/:id', authenticateToken, authorizeRoles('director','admin'), auditLog('DELETE','audiences'), (req, res) => {
  getDb().prepare('DELETE FROM audiences WHERE id=?').run(req.params.id); res.json({ success: true });
});
module.exports = router;
