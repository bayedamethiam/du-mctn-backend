const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, authorizeRoles, auditLog } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try { res.json(await getDb().prepare('SELECT * FROM programs ORDER BY code').all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const p  = await db.prepare('SELECT * FROM programs WHERE id=?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Programme introuvable' });
    res.json({ ...p, projects: await db.prepare('SELECT * FROM projects WHERE program_id=?').all(p.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticateToken, authorizeRoles('coordinator','director','admin'), auditLog('UPDATE','programs'), async (req, res) => {
  try {
    const { progress, status, budget } = req.body;
    const db = getDb();
    await db.prepare("UPDATE programs SET progress=COALESCE(?,progress),status=COALESCE(?,status),budget=COALESCE(?,budget),updated_at=datetime('now') WHERE id=?")
      .run(progress, status, budget, req.params.id);
    res.json(await db.prepare('SELECT * FROM programs WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/projects', authenticateToken, async (req, res) => {
  try { res.json(await getDb().prepare('SELECT * FROM projects WHERE program_id=? ORDER BY name').all(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/projects', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('CREATE','projects'), async (req, res) => {
  try {
    const { name, description, budget, start_date, end_date, responsible } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    const db = getDb();
    const r  = await db.prepare('INSERT INTO projects (program_id,name,description,budget,start_date,end_date,responsible) VALUES (?,?,?,?,?,?,?)')
                       .run(req.params.id, name, description, budget, start_date, end_date, responsible);
    await db.prepare("UPDATE programs SET projects_count=(SELECT COUNT(*) FROM projects WHERE program_id=?),updated_at=datetime('now') WHERE id=?")
            .run(req.params.id, req.params.id);
    res.status(201).json(await db.prepare('SELECT * FROM projects WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/projects/:pid', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('UPDATE','projects'), async (req, res) => {
  try {
    const { name,description,budget,progress,status,start_date,end_date,responsible } = req.body;
    const db = getDb();
    await db.prepare("UPDATE projects SET name=COALESCE(?,name),description=COALESCE(?,description),budget=COALESCE(?,budget),progress=COALESCE(?,progress),status=COALESCE(?,status),start_date=COALESCE(?,start_date),end_date=COALESCE(?,end_date),responsible=COALESCE(?,responsible),updated_at=datetime('now') WHERE id=?")
      .run(name,description,budget,progress,status,start_date,end_date,responsible,req.params.pid);
    res.json(await db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.pid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/projects/:pid', authenticateToken, authorizeRoles('director','admin'), auditLog('DELETE','projects'), async (req, res) => {
  try {
    const db   = getDb();
    const proj = await db.prepare('SELECT program_id FROM projects WHERE id=?').get(req.params.pid);
    await db.prepare('DELETE FROM projects WHERE id=?').run(req.params.pid);
    if (proj) await db.prepare("UPDATE programs SET projects_count=(SELECT COUNT(*) FROM projects WHERE program_id=?) WHERE id=?").run(proj.program_id, proj.program_id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
