const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, authorizeRoles, auditLog } = require('../middleware/auth');
const router = express.Router();

const parse = m => ({ ...m, expertise: JSON.parse(m.expertise_json || '[]') });

router.get('/', authenticateToken, async (req, res) => {
  try { res.json((await getDb().prepare('SELECT * FROM team_members WHERE is_active=1 ORDER BY level,name').all()).map(parse)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticateToken, authorizeRoles('director','admin'), auditLog('CREATE','team'), async (req, res) => {
  try {
    const { name,role,level,department,initials,color,expertise,email,phone,bio } = req.body;
    if (!name || !role || !level) return res.status(400).json({ error: 'Nom, rôle et niveau requis' });
    const db = getDb();
    const r  = await db.prepare('INSERT INTO team_members (name,role,level,department,initials,color,expertise_json,email,phone,bio) VALUES (?,?,?,?,?,?,?,?,?,?)')
                       .run(name,role,level,department,initials,color||'#06b6d4',JSON.stringify(expertise||[]),email,phone,bio);
    res.status(201).json(parse(await db.prepare('SELECT * FROM team_members WHERE id=?').get(r.lastInsertRowid)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticateToken, authorizeRoles('director','admin'), auditLog('UPDATE','team'), async (req, res) => {
  try {
    const { name,role,level,department,initials,color,expertise,email,phone,bio } = req.body;
    const db = getDb();
    await db.prepare("UPDATE team_members SET name=COALESCE(?,name),role=COALESCE(?,role),level=COALESCE(?,level),department=COALESCE(?,department),initials=COALESCE(?,initials),color=COALESCE(?,color),expertise_json=COALESCE(?,expertise_json),email=COALESCE(?,email),phone=COALESCE(?,phone),bio=COALESCE(?,bio),updated_at=datetime('now') WHERE id=?")
      .run(name,role,level,department,initials,color,expertise?JSON.stringify(expertise):null,email,phone,bio,req.params.id);
    res.json(parse(await db.prepare('SELECT * FROM team_members WHERE id=?').get(req.params.id)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticateToken, authorizeRoles('admin'), auditLog('DELETE','team'), async (req, res) => {
  try {
    await getDb().prepare("UPDATE team_members SET is_active=0,updated_at=datetime('now') WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
