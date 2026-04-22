# DU-MCTN Backend API

## Stack
Node.js 20 · Express 4 · SQLite (better-sqlite3) · JWT · Multer · CORS

## Installation locale
```bash
npm install
cp .env.example .env
# Modifier JWT_SECRET dans .env
npm start
```

## Déploiement Railway
```bash
npm install -g @railway/cli
railway login && railway init && railway up
# Ajouter les variables d'env dans le dashboard Railway
```

## Endpoints principaux
- POST   /api/auth/login
- GET    /api/dashboard/kpis
- GET    /api/programs
- GET/POST/PUT/DELETE  /api/diligences
- GET/POST/PUT/DELETE  /api/partnerships
- POST   /api/partnerships/:id/documents
- GET/POST/PUT/DELETE  /api/audiences
- GET    /api/se/indicators
- GET    /api/se/revues
- POST   /api/se/revues/:id/documents
- GET    /api/se/evaluations
- GET    /api/instances
- GET    /api/team
- GET    /api/audit
- GET    /health

## Comptes par défaut
| Email                | Mot de passe      | Rôle        |
|----------------------|-------------------|-------------|
| m.diallo@mctn.sn     | Admin@MCTN2025!   | admin       |
| f.diallo@mctn.sn     | Coord@MCTN2025!   | coordinator |
| i.sarr@mctn.sn       | SE@MCTN2025!      | analyst     |
| a.ba@mctn.sn         | DPI@MCTN2025!     | analyst     |
| o.ndiaye@mctn.sn     | eGov@MCTN2025!    | analyst     |

⚠️  Changer TOUS les mots de passe en production.
