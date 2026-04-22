const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDb } = require('../db');
const { authenticateToken, authorizeRoles, auditLog } = require('../middleware/auth');
const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'partnerships');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => cb(null, uploadDir),
    filename:    (req, f, cb) => cb(null, Date.now() + '-' + f.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const withDocs = (p, db) => ({
  ...p,
  projects: JSON.parse(p.projects || '[]'),
  documents: db.prepare('SELECT id,name,file_type,size,date FROM partnership_documents WHERE partnership_id=?').all(p.id),
});

router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM partnerships ORDER BY name').all().map(p => withDocs(p, db)));
});
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDb(); const p = db.prepare('SELECT * FROM partnerships WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Introuvable' });
  res.json(withDocs(p, db));
});
router.post('/', authenticateToken, authorizeRoles('coordinator','director','admin'), auditLog('CREATE','partnerships'), (req, res) => {
  const { name,type,country,status,amount,contact,email,description,start_date,end_date,projects } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nom et type requis' });
  const db = getDb();
  const r = db.prepare('INSERT INTO partnerships (name,type,country,status,amount,contact,email,description,start_date,end_date,projects) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
              .run(name,type,country,status||'actif',amount,contact,email,description,start_date,end_date,JSON.stringify(projects||[]));
  res.status(201).json(db.prepare('SELECT * FROM partnerships WHERE id=?').get(r.lastInsertRowid));
});
router.put('/:id', authenticateToken, authorizeRoles('coordinator','director','admin'), auditLog('UPDATE','partnerships'), (req, res) => {
  const { name,type,country,status,amount,contact,email,description,start_date,end_date,projects } = req.body;
  const db = getDb();
  db.prepare("UPDATE partnerships SET name=COALESCE(?,name),type=COALESCE(?,type),country=COALESCE(?,country),status=COALESCE(?,status),amount=COALESCE(?,amount),contact=COALESCE(?,contact),email=COALESCE(?,email),description=COALESCE(?,description),start_date=COALESCE(?,start_date),end_date=COALESCE(?,end_date),projects=COALESCE(?,projects),updated_at=datetime('now') WHERE id=?")
    .run(name,type,country,status,amount,contact,email,description,start_date,end_date,projects?JSON.stringify(projects):null,req.params.id);
  res.json(withDocs(db.prepare('SELECT * FROM partnerships WHERE id=?').get(req.params.id), db));
});
router.delete('/:id', authenticateToken, authorizeRoles('director','admin'), auditLog('DELETE','partnerships'), (req, res) => {
  const db = getDb();
  db.prepare('SELECT file_path FROM partnership_documents WHERE partnership_id=?').all(req.params.id)
    .forEach(d => { if (d.file_path && fs.existsSync(d.file_path)) fs.unlinkSync(d.file_path); });
  db.prepare('DELETE FROM partnerships WHERE id=?').run(req.params.id);
  res.json({ success: true });
});
router.post('/:id/documents', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'),
  upload.single('file'), auditLog('UPLOAD','partnership_documents'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const ft  = ext==='.pdf'?'pdf':ext.match(/\.docx?/)?'word':ext.match(/\.xlsx?/)?'excel':'default';
  const sz  = req.file.size >= 1048576 ? `${(req.file.size/1048576).toFixed(1)} MB` : `${Math.round(req.file.size/1024)} KB`;
  const db  = getDb();
  const r   = db.prepare('INSERT INTO partnership_documents (partnership_id,name,file_type,size,file_path) VALUES (?,?,?,?,?)')
                .run(req.params.id, req.file.originalname, ft, sz, req.file.path);
  res.status(201).json(db.prepare('SELECT id,name,file_type,size,date FROM partnership_documents WHERE id=?').get(r.lastInsertRowid));
});
router.get('/:id/documents/:docId/download', authenticateToken, (req, res) => {
  const doc = getDb().prepare('SELECT * FROM partnership_documents WHERE id=? AND partnership_id=?').get(req.params.docId, req.params.id);
  if (!doc || !fs.existsSync(doc.file_path)) return res.status(404).json({ error: 'Fichier introuvable' });
  res.download(doc.file_path, doc.name);
});
router.delete('/:id/documents/:docId', authenticateToken, authorizeRoles('coordinator','director','admin'), (req, res) => {
  const db  = getDb();
  const doc = db.prepare('SELECT * FROM partnership_documents WHERE id=? AND partnership_id=?').get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });
  if (doc.file_path && fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
  db.prepare('DELETE FROM partnership_documents WHERE id=?').run(req.params.docId);
  res.json({ success: true });
});
module.exports = router;
