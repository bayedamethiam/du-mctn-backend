const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDb } = require('../db');
const { authenticateToken, authorizeRoles, auditLog } = require('../middleware/auth');
const router = express.Router();

const revueDir = path.join(__dirname, '..', 'uploads', 'revues');
fs.mkdirSync(revueDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req,f,cb) => cb(null, revueDir),
    filename:    (req,f,cb) => cb(null, Date.now() + '-' + f.originalname.replace(/[^a-zA-Z0-9.-]/g,'_')),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── Stats globales ───────────────────────────────────────────
router.get('/stats', authenticateToken, (req, res) => {
  const db   = getDb();
  const inds = db.prepare('SELECT baseline,current_value,target,status FROM indicators').all();
  const avg  = inds.reduce((s,i) => s + Math.min(100, ((i.current_value-i.baseline)/(i.target-i.baseline))*100), 0) / inds.length;
  res.json({
    avg_progress: Math.round(avg),
    by_status:    Object.fromEntries(db.prepare('SELECT status,COUNT(*) as c FROM indicators GROUP BY status').all().map(i=>[i.status,i.c])),
    total_revues:  db.prepare('SELECT COUNT(*) as c FROM revues').get().c,
    revues_tenues: db.prepare("SELECT COUNT(*) as c FROM revues WHERE statut='tenue'").get().c,
    total_decisions: db.prepare('SELECT SUM(decisions) as s FROM revues').get().s || 0,
  });
});

// ─── Indicateurs ─────────────────────────────────────────────
router.get('/indicators', authenticateToken, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM indicators ORDER BY category,code').all().map(i => ({
    ...i,
    milestones: db.prepare('SELECT year,value FROM indicator_milestones WHERE indicator_id=? ORDER BY year').all(i.id),
  })));
});
router.get('/indicators/:id', authenticateToken, (req, res) => {
  const db = getDb(); const i = db.prepare('SELECT * FROM indicators WHERE id=?').get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Introuvable' });
  res.json({ ...i, milestones: db.prepare('SELECT year,value FROM indicator_milestones WHERE indicator_id=? ORDER BY year').all(i.id) });
});
router.put('/indicators/:id', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'), auditLog('UPDATE','indicators'), (req, res) => {
  const { current_value,status,trend,methodology,last_update } = req.body;
  const db = getDb();
  db.prepare("UPDATE indicators SET current_value=COALESCE(?,current_value),status=COALESCE(?,status),trend=COALESCE(?,trend),methodology=COALESCE(?,methodology),last_update=COALESCE(?,last_update),updated_at=datetime('now') WHERE id=?")
    .run(current_value,status,trend,methodology,last_update,req.params.id);
  const i = db.prepare('SELECT * FROM indicators WHERE id=?').get(req.params.id);
  res.json({ ...i, milestones: db.prepare('SELECT year,value FROM indicator_milestones WHERE indicator_id=? ORDER BY year').all(i.id) });
});

// ─── Revues ───────────────────────────────────────────────────
router.get('/revues', authenticateToken, (req, res) => {
  const db = getDb(); const { type } = req.query;
  let q = 'SELECT * FROM revues WHERE 1=1'; const p = [];
  if (type) { q += ' AND type=?'; p.push(type); }
  q += ' ORDER BY date DESC';
  res.json(db.prepare(q).all(...p).map(r => ({
    ...r,
    documents: db.prepare('SELECT id,name,file_type,size,tag,date FROM revue_documents WHERE revue_id=?').all(r.id),
  })));
});
router.post('/revues', authenticateToken, authorizeRoles('coordinator','director','admin'), auditLog('CREATE','revues'), (req, res) => {
  const { date,type,titre,statut,animateur,participants,alertes,decisions } = req.body;
  if (!date || !type || !titre) return res.status(400).json({ error: 'Date, type et titre requis' });
  const db = getDb();
  const r  = db.prepare('INSERT INTO revues (date,type,titre,statut,animateur,participants,alertes,decisions) VALUES (?,?,?,?,?,?,?,?)')
               .run(date,type,titre,statut||'planifiee',animateur,participants,alertes||0,decisions||0);
  res.status(201).json(db.prepare('SELECT * FROM revues WHERE id=?').get(r.lastInsertRowid));
});
router.put('/revues/:id', authenticateToken, authorizeRoles('coordinator','director','admin'), auditLog('UPDATE','revues'), (req, res) => {
  const { date,type,titre,statut,animateur,participants,alertes,decisions,rapport } = req.body;
  const db = getDb();
  db.prepare("UPDATE revues SET date=COALESCE(?,date),type=COALESCE(?,type),titre=COALESCE(?,titre),statut=COALESCE(?,statut),animateur=COALESCE(?,animateur),participants=COALESCE(?,participants),alertes=COALESCE(?,alertes),decisions=COALESCE(?,decisions),rapport=COALESCE(?,rapport),updated_at=datetime('now') WHERE id=?")
    .run(date,type,titre,statut,animateur,participants,alertes,decisions,rapport,req.params.id);
  res.json(db.prepare('SELECT * FROM revues WHERE id=?').get(req.params.id));
});
router.post('/revues/:id/documents', authenticateToken, authorizeRoles('analyst','coordinator','director','admin'),
  upload.single('file'), auditLog('UPLOAD','revue_documents'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const ft  = ext==='.pdf'?'pdf':ext.match(/\.docx?/)?'word':ext.match(/\.xlsx?/)?'excel':ext.match(/\.pptx?/)?'ppt':'default';
  const sz  = req.file.size >= 1048576 ? `${(req.file.size/1048576).toFixed(1)} MB` : `${Math.round(req.file.size/1024)} KB`;
  const db  = getDb();
  const r   = db.prepare('INSERT INTO revue_documents (revue_id,name,file_type,size,tag,file_path) VALUES (?,?,?,?,?,?)')
                .run(req.params.id, req.file.originalname, ft, sz, req.body.tag||'Autre', req.file.path);
  db.prepare("UPDATE revues SET rapport=1,updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.status(201).json(db.prepare('SELECT id,name,file_type,size,tag,date FROM revue_documents WHERE id=?').get(r.lastInsertRowid));
});
router.get('/revues/:id/documents/:docId/download', authenticateToken, (req, res) => {
  const doc = getDb().prepare('SELECT * FROM revue_documents WHERE id=? AND revue_id=?').get(req.params.docId, req.params.id);
  if (!doc || !fs.existsSync(doc.file_path)) return res.status(404).json({ error: 'Fichier introuvable' });
  res.download(doc.file_path, doc.name);
});
router.delete('/revues/:id/documents/:docId', authenticateToken, authorizeRoles('coordinator','director','admin'), (req, res) => {
  const db  = getDb();
  const doc = db.prepare('SELECT * FROM revue_documents WHERE id=? AND revue_id=?').get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document introuvable' });
  if (doc.file_path && fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
  db.prepare('DELETE FROM revue_documents WHERE id=?').run(req.params.docId);
  res.json({ success: true });
});

// ─── Évaluations ─────────────────────────────────────────────
router.get('/evaluations', authenticateToken, (req, res) => {
  res.json(getDb().prepare('SELECT * FROM evaluations ORDER BY annee').all().map(e => ({
    ...e,
    notes_json:           JSON.parse(e.notes_json           || '{}'),
    conclusions_json:     JSON.parse(e.conclusions_json     || '[]'),
    recommandations_json: JSON.parse(e.recommandations_json || '[]'),
    alertes_json:         JSON.parse(e.alertes_json         || '[]'),
  })));
});
router.put('/evaluations/:id', authenticateToken, authorizeRoles('director','admin'), auditLog('UPDATE','evaluations'), (req, res) => {
  const { statut,evaluateur,commanditaire,date,rapport,note_globale,notes_json,conclusions_json,recommandations_json,alertes_json } = req.body;
  const db = getDb();
  db.prepare("UPDATE evaluations SET statut=COALESCE(?,statut),evaluateur=COALESCE(?,evaluateur),commanditaire=COALESCE(?,commanditaire),date=COALESCE(?,date),rapport=COALESCE(?,rapport),note_globale=COALESCE(?,note_globale),notes_json=COALESCE(?,notes_json),conclusions_json=COALESCE(?,conclusions_json),recommandations_json=COALESCE(?,recommandations_json),alertes_json=COALESCE(?,alertes_json),updated_at=datetime('now') WHERE id=?")
    .run(statut,evaluateur,commanditaire,date,rapport,note_globale,
        notes_json?JSON.stringify(notes_json):null, conclusions_json?JSON.stringify(conclusions_json):null,
        recommandations_json?JSON.stringify(recommandations_json):null, alertes_json?JSON.stringify(alertes_json):null,
        req.params.id);
  res.json(db.prepare('SELECT * FROM evaluations WHERE id=?').get(req.params.id));
});

module.exports = router;
