const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'du-mctn-secret-CHANGE-IN-PRODUCTION';
const ROLE_HIERARCHY = {
  admin:8, director:7, coordinator:6, analyst:5,
  partner:4, viewer:3, auditor:2, guest:1,
};

function authenticateToken(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requis' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide ou expiré' });
    req.user = user;
    next();
  });
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    const userLvl = ROLE_HIERARCHY[req.user.role] || 0;
    const minLvl  = Math.min(...roles.map(r => ROLE_HIERARCHY[r] || 0));
    if (userLvl < minLvl) return res.status(403).json({ error: 'Rôle insuffisant' });
    next();
  };
}

function auditLog(action, resource) {
  return (req, res, next) => {
    const orig = res.json.bind(res);
    res.json = body => {
      if (res.statusCode < 400 && req.user) {
        try {
          getDb().prepare(
            'INSERT INTO audit_log (user_id,user_name,action,resource,resource_id,ip) VALUES (?,?,?,?,?,?)'
          ).run(req.user.id, req.user.name, action, resource,
               req.params.id || body?.id || null,
               req.ip || req.connection?.remoteAddress);
        } catch {}
      }
      return orig(body);
    };
    next();
  };
}

module.exports = { authenticateToken, authorizeRoles, auditLog, JWT_SECRET, ROLE_HIERARCHY };
