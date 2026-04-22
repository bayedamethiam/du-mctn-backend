const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getDb } = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const router = express.Router();
const RS = process.env.REFRESH_SECRET || JWT_SECRET + '_refresh';

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const user = getDb().prepare('SELECT * FROM users WHERE email=? AND is_active=1').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Identifiants incorrects' });
  const payload = { id:user.id, name:user.name, email:user.email, role:user.role, department:user.department };
  const accessToken  = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  const refreshToken = jwt.sign({ id:user.id }, RS, { expiresIn: '7d' });
  const exp = new Date(Date.now() + 7 * 86400000).toISOString();
  getDb().prepare('INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES (?,?,?)')
         .run(user.id, refreshToken, exp);
  res.json({ accessToken, refreshToken, user: payload });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requis' });
  try {
    const dec    = jwt.verify(refreshToken, RS);
    const stored = getDb().prepare('SELECT * FROM refresh_tokens WHERE token=? AND user_id=?').get(refreshToken, dec.id);
    if (!stored || new Date(stored.expires_at) < new Date())
      return res.status(401).json({ error: 'Token expiré' });
    const user = getDb().prepare('SELECT * FROM users WHERE id=?').get(dec.id);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    const payload = { id:user.id, name:user.name, email:user.email, role:user.role, department:user.department };
    res.json({ accessToken: jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' }) });
  } catch { res.status(401).json({ error: 'Token invalide' }); }
});

router.post('/logout', authenticateToken, (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) getDb().prepare('DELETE FROM refresh_tokens WHERE token=?').run(refreshToken);
  res.json({ message: 'Déconnexion réussie' });
});

router.get('/me', authenticateToken, (req, res) => {
  res.json(getDb().prepare('SELECT id,name,email,role,department,phone,created_at FROM users WHERE id=?').get(req.user.id));
});

router.get('/users', authenticateToken, (req, res) => {
  if (!['admin','director'].includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
  res.json(getDb().prepare('SELECT id,name,email,role,department,phone,is_active,created_at FROM users').all());
});

router.put('/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id)
    return res.status(403).json({ error: 'Accès refusé' });
  const { name, department, phone, role, is_active } = req.body;
  const db = getDb();
  db.prepare("UPDATE users SET name=COALESCE(?,name),department=COALESCE(?,department),phone=COALESCE(?,phone),role=COALESCE(?,role),is_active=COALESCE(?,is_active),updated_at=datetime('now') WHERE id=?")
    .run(name, department, phone, role, is_active, req.params.id);
  res.json(db.prepare('SELECT id,name,email,role,department,phone,is_active FROM users WHERE id=?').get(req.params.id));
});

router.post('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = getDb().prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  if ((newPassword || '').length < 8)
    return res.status(400).json({ error: 'Minimum 8 caractères' });
  getDb().prepare("UPDATE users SET password=?,updated_at=datetime('now') WHERE id=?")
         .run(bcrypt.hashSync(newPassword, 10), req.user.id);
  res.json({ message: 'Mot de passe modifié avec succès' });
});

module.exports = router;
