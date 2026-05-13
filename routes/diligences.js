const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, authorizeRoles, auditLog } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, priority } = req.query;
    let q = 'SELECT * FROM diligences WHERE 1=1'; const p = [];
    if (status)   { q += ' AND status=?';   p.push(status); }
    if (priority) { q += ' AND priority=?'; p.push(priority); }
    q += " ORDER BY CASE priority WHEN 'critique' THEN 1 WHEN 'haute' THEN 2 ELSE 3 END, deadline ASC";
    res.json(await getDb().prepare(q).all(...p));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const d = await getDb().prepare('SELECT * FROM diligences WHERE id=?').get(req.params.id);
    if (!d) return res.status(404).json({ error: 'Introuvable' });
    res.json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('CREATE','diligences'), async (req, res) => {
  try {
    const { title,source,deadline,responsible,priority,type,notes,status } = req.body;
    if (!title || !source) return res.status(400).json({ error: 'Titre et source requis' });
    const db = getDb();
    const r  = await db.prepare('INSERT INTO diligences (title,source,deadline,responsible,priority,type,notes,status) VALUES (?,?,?,?,?,?,?,?)')
                       .run(title, source, deadline, responsible, priority||'moyenne', type||'Note', notes, status||'planifie');
    res.status(201).json(await db.prepare('SELECT * FROM diligences WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('UPDATE','diligences'), async (req, res) => {
  try {
    const { title,source,deadline,responsible,priority,type,notes,status } = req.body;
    const db = getDb();
    await db.prepare("UPDATE diligences SET title=COALESCE(?,title),source=COALESCE(?,source),deadline=COALESCE(?,deadline),responsible=COALESCE(?,responsible),priority=COALESCE(?,priority),type=COALESCE(?,type),notes=COALESCE(?,notes),status=COALESCE(?,status),updated_at=datetime('now') WHERE id=?")
      .run(title,source,deadline,responsible,priority,type,notes,status,req.params.id);
    res.json(await db.prepare('SELECT * FROM diligences WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/status', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('STATUS','diligences'), async (req, res) => {
  try {
    const db = getDb();
    await db.prepare("UPDATE diligences SET status=?,updated_at=datetime('now') WHERE id=?").run(req.body.status, req.params.id);
    res.json(await db.prepare('SELECT * FROM diligences WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticateToken, authorizeRoles('director','admin'), auditLog('DELETE','diligences'), async (req, res) => {
  try {
    await getDb().prepare('DELETE FROM diligences WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
