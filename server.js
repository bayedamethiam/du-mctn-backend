require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
const { initSchema, seedData, getDb } = require('./db');
const { swaggerUi, spec } = require('./swagger');

const app          = express();
const PORT         = process.env.PORT         || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin:       [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials:  true,
  methods:      ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.options('*', cors());
app.use(rateLimit({ windowMs: 15*60*1000, max: 300, standardHeaders: true }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 10, message: { error: 'Trop de tentatives de connexion' } }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'DU-MCTN API Docs' }));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/programs',     require('./routes/programs'));
app.use('/api/diligences',   require('./routes/diligences'));
app.use('/api/partnerships', require('./routes/partnerships'));
app.use('/api/audiences',    require('./routes/audiences'));
app.use('/api/se',           require('./routes/se'));
app.use('/api/instances',    require('./routes/instances'));
app.use('/api/team',         require('./routes/team'));

// Audit log (admin/director only)
app.get('/api/audit', require('./middleware/auth').authenticateToken, (req, res) => {
  if (!['admin','director'].includes(req.user.role))
    return res.status(403).json({ error: 'Accès refusé' });
  const { limit=100, offset=0, resource } = req.query;
  let q = 'SELECT * FROM audit_log WHERE 1=1'; const p = [];
  if (resource) { q += ' AND resource=?'; p.push(resource); }
  q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  p.push(parseInt(limit), parseInt(offset));
  res.json(getDb().prepare(q).all(...p));
});

app.get('/health', (req, res) => res.json({ status:'ok', version:'1.0.0', timestamp: new Date().toISOString() }));
app.get('/api', (req, res) => res.json({
  name: 'DU-MCTN API', version: '1.0.0',
  description: 'Delivery Unit MCTN — New Deal Technologique 2025-2034',
  endpoints: {
    auth:         'POST /api/auth/login | logout | refresh | GET /api/auth/me',
    dashboard:    'GET  /api/dashboard/kpis | alerts',
    programs:     'GET/PUT /api/programs | GET/POST /api/programs/:id/projects',
    diligences:   'GET/POST/PUT/PATCH/DELETE /api/diligences',
    partnerships: 'GET/POST/PUT/DELETE /api/partnerships | /documents',
    audiences:    'GET/POST/PUT/PATCH/DELETE /api/audiences',
    se:           'GET /api/se/stats | indicators | revues | evaluations',
    instances:    'GET/POST/PUT /api/instances | contributions',
    team:         'GET/POST/PUT/DELETE /api/team',
    audit:        'GET /api/audit',
  },
}));

app.use((req, res) => res.status(404).json({ error: `Route introuvable: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Fichier trop volumineux (max 50MB)' });
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Erreur serveur interne' : err.message });
});

initSchema();
seedData();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  DU-MCTN API démarrée sur le port ${PORT}`);
  console.log(`📖  Swagger : http://localhost:${PORT}/api-docs`);
  console.log(`🩺  Santé : http://localhost:${PORT}/health\n`);
});
