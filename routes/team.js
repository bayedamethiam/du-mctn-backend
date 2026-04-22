const express = require('express');
const { getDb } = require('../db');
const { authenticateToken, authorizeRoles, auditLog } = require('../middleware/auth');
const router = express.Router();

const parse = m => ({ ...m, expertise: JSON.parse(m.expertise_json || '[]') });

router.get('/', authenticateToken, (req, res) =>
  res.json(getDb().prepare('SELECT * FROM team_members WHERE is_active=1 ORDER BY level,name').all().map(parse))
);
router.post('/', authenticateToken, authorizeRoles('director','admin'), auditLog('CREATE','team'), (req, res) => {
  const { name,role,level,department,initials,color,expertise,email,phone,bio } = req.body;
  if (!name || !role || !level) return res.status(400).json({ error: 'Nom, rôle et niveau requis' });
  const db = getDb();
  const r  = db.prepare('INSERT INTO team_members (name,role,level,department,initials,color,expertise_json,email,phone,bio) VALUES (?,?,?,?,?,?,?,?,?,?)')
               .run(name,role,level,department,initials,color||'#06b6d4',JSON.stringify(expertise||[]),email,phone,bio);
  res.status(201).json(parse(db.prepare('SELECT * FROM team_members WHERE id=?').get(r.lastInsertRowid)));
});
router.put('/:id', authenticateToken, authorizeRoles('director','admin'), auditLog('UPDATE','team'), (req, res) => {
  const { name,role,level,department,initials,color,expertise,email,phone,bio } = req.body;
  const db = getDb();
  db.prepare("UPDATE team_members SET name=COALESCE(?,name),role=COALESCE(?,role),level=COALESCE(?,level),department=COALESCE(?,department),initials=COALESCE(?,initials),color=COALESCE(?,color),expertise_json=COALESCE(?,expertise_json),email=COALESCE(?,email),phone=COALESCE(?,phone),bio=COALESCE(?,bio),updated_at=datetime('now') WHERE id=?")
    .run(name,role,level,department,initials,color,expertise?JSON.stringify(expertise):null,email,phone,bio,req.params.id);
  res.json(parse(db.prepare('SELECT * FROM team_members WHERE id=?').get(req.params.id)));
});
router.delete('/:id', authenticateToken, authorizeRoles('admin'), auditLog('DELETE','team'), (req, res) => {
  getDb().prepare("UPDATE team_members SET is_active=0,updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ success: true });
});
module.exports = router;
