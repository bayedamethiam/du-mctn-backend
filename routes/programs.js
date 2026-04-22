const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, authorizeRoles, auditLog } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, (req, res) =>
  res.json(getDb().prepare('SELECT * FROM programs ORDER BY code').all())
);
router.get('/:id', authenticateToken, (req, res) => {
  const p = getDb().prepare('SELECT * FROM programs WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Programme introuvable' });
  res.json({ ...p, projects: getDb().prepare('SELECT * FROM projects WHERE program_id=?').all(p.id) });
});
router.put('/:id', authenticateToken, authorizeRoles('coordinator','director','admin'), auditLog('UPDATE','programs'), (req, res) => {
  const { progress, status, budget } = req.body;
  const db = getDb();
  db.prepare("UPDATE programs SET progress=COALESCE(?,progress),status=COALESCE(?,status),budget=COALESCE(?,budget),updated_at=datetime('now') WHERE id=?")
    .run(progress, status, budget, req.params.id);
  res.json(db.prepare('SELECT * FROM programs WHERE id=?').get(req.params.id));
});
router.get('/:id/projects', authenticateToken, (req, res) =>
  res.json(getDb().prepare('SELECT * FROM projects WHERE program_id=? ORDER BY name').all(req.params.id))
);
router.post('/:id/projects', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('CREATE','projects'), (req, res) => {
  const { name, description, budget, start_date, end_date, responsible } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const db = getDb();
  const r = db.prepare('INSERT INTO projects (program_id,name,description,budget,start_date,end_date,responsible) VALUES (?,?,?,?,?,?,?)')
              .run(req.params.id, name, description, budget, start_date, end_date, responsible);
  db.prepare("UPDATE programs SET projects_count=(SELECT COUNT(*) FROM projects WHERE program_id=?),updated_at=datetime('now') WHERE id=?")
    .run(req.params.id, req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id=?').get(r.lastInsertRowid));
});
router.put('/projects/:pid', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('UPDATE','projects'), (req, res) => {
  const { name,description,budget,progress,status,start_date,end_date,responsible } = req.body;
  const db = getDb();
  db.prepare("UPDATE projects SET name=COALESCE(?,name),description=COALESCE(?,description),budget=COALESCE(?,budget),progress=COALESCE(?,progress),status=COALESCE(?,status),start_date=COALESCE(?,start_date),end_date=COALESCE(?,end_date),responsible=COALESCE(?,responsible),updated_at=datetime('now') WHERE id=?")
    .run(name,description,budget,progress,status,start_date,end_date,responsible,req.params.pid);
  res.json(db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.pid));
});
router.delete('/projects/:pid', authenticateToken, authorizeRoles('director','admin'), auditLog('DELETE','projects'), (req, res) => {
  const db = getDb();
  const proj = db.prepare('SELECT program_id FROM projects WHERE id=?').get(req.params.pid);
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.pid);
  if (proj) db.prepare("UPDATE programs SET projects_count=(SELECT COUNT(*) FROM projects WHERE program_id=?) WHERE id=?").run(proj.program_id, proj.program_id);
  res.json({ success: true });
});
module.exports = router;
