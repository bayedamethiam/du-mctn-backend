const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'du_mctn.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'analyst',
      department TEXT, phone TEXT, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      projects_count INTEGER DEFAULT 0, budget REAL DEFAULT 0, progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'on_track', color TEXT DEFAULT '#06b6d4',
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER REFERENCES programs(id),
      name TEXT NOT NULL, description TEXT, budget REAL, progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'on_track', start_date TEXT, end_date TEXT, responsible TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS diligences (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, source TEXT NOT NULL,
      deadline TEXT, status TEXT DEFAULT 'planifie', responsible TEXT,
      priority TEXT DEFAULT 'moyenne', type TEXT DEFAULT 'Note', notes TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS partnerships (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL,
      country TEXT, status TEXT DEFAULT 'actif', amount TEXT, contact TEXT, email TEXT,
      description TEXT, start_date TEXT, end_date TEXT, projects TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS partnership_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partnership_id INTEGER REFERENCES partnerships(id) ON DELETE CASCADE,
      name TEXT NOT NULL, file_type TEXT, size TEXT, file_path TEXT,
      date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audiences (
      id INTEGER PRIMARY KEY AUTOINCREMENT, institution TEXT NOT NULL, contact TEXT,
      date TEXT, objet TEXT, status TEXT DEFAULT 'planifiee', priority TEXT DEFAULT 'haute',
      suite_a_donner TEXT, followup_date TEXT, notes TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS indicators (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, label TEXT NOT NULL,
      category TEXT NOT NULL, target REAL NOT NULL, unit TEXT NOT NULL,
      baseline REAL NOT NULL, current_value REAL NOT NULL, trend REAL DEFAULT 0,
      status TEXT DEFAULT 'on_track', responsible TEXT, program TEXT,
      methodology TEXT, last_update TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS indicator_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicator_id INTEGER REFERENCES indicators(id) ON DELETE CASCADE,
      year TEXT NOT NULL, value REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS revues (
      id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, type TEXT NOT NULL,
      titre TEXT NOT NULL, statut TEXT DEFAULT 'planifiee', animateur TEXT,
      participants TEXT, alertes INTEGER DEFAULT 0, decisions INTEGER DEFAULT 0,
      rapport INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS revue_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      revue_id INTEGER REFERENCES revues(id) ON DELETE CASCADE,
      name TEXT NOT NULL, file_type TEXT, size TEXT, tag TEXT DEFAULT 'Autre',
      file_path TEXT, date TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, annee TEXT NOT NULL,
      statut TEXT DEFAULT 'planifiee', evaluateur TEXT, commanditaire TEXT,
      date TEXT, rapport TEXT, note_globale INTEGER,
      notes_json TEXT DEFAULT '{}', conclusions_json TEXT DEFAULT '[]',
      recommandations_json TEXT DEFAULT '[]', alertes_json TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS intl_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT, acronym TEXT NOT NULL, name TEXT NOT NULL,
      category TEXT NOT NULL, siege TEXT, niveau TEXT DEFAULT 'membre',
      responsible TEXT, focal TEXT,
      score_presence INTEGER DEFAULT 0, score_contribution INTEGER DEFAULT 0,
      score_postes INTEGER DEFAULT 0, score_suivi INTEGER DEFAULT 0,
      next_meeting_label TEXT, next_meeting_date TEXT, next_meeting_lieu TEXT,
      mandats_json TEXT DEFAULT '[]', gaps_json TEXT DEFAULT '[]',
      ndt_link TEXT, priority TEXT DEFAULT 'moyenne',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS intl_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER REFERENCES intl_instances(id) ON DELETE CASCADE,
      titre TEXT NOT NULL, date TEXT, statut TEXT DEFAULT 'planifie',
      impact TEXT DEFAULT 'moyenne', created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL, role TEXT NOT NULL, level INTEGER NOT NULL,
      department TEXT, initials TEXT, color TEXT DEFAULT '#06b6d4',
      expertise_json TEXT DEFAULT '[]', email TEXT, phone TEXT, bio TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, user_name TEXT,
      action TEXT NOT NULL, resource TEXT NOT NULL, resource_id TEXT,
      details TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  console.log('✅  Schéma SQLite OK (16 tables)');
}

function seedData() {
  const db = getDb();
  if (db.prepare('SELECT COUNT(*) as c FROM users').get().c > 0) {
    console.log('ℹ️   Utilisateurs déjà présents, seed ignoré');
    return;
  }
  const hash = p => require('bcryptjs').hashSync(p, 10);

  // Comptes utilisateurs uniquement — pas de données de démonstration
  const iU = db.prepare('INSERT INTO users (id,name,email,password,role,department,phone) VALUES (?,?,?,?,?,?,?)');
  [
    ['usr_md','Mohamed Diallo','m.diallo@mctn.sn',hash('Admin@MCTN2025!'),'admin','Direction','+221770000001'],
    ['usr_fd','Fatou Diallo','f.diallo@mctn.sn',hash('Coord@MCTN2025!'),'coordinator','Projets','+221770000002'],
    ['usr_is','Ibrahima Sarr','i.sarr@mctn.sn',hash('SE@MCTN2025!'),'analyst','S&E','+221770000003'],
    ['usr_ab','Aissatou Ba','a.ba@mctn.sn',hash('DPI@MCTN2025!'),'analyst','DPI','+221770000004'],
    ['usr_on','Ousmane Ndiaye','o.ndiaye@mctn.sn',hash('eGov@MCTN2025!'),'analyst','e-Gov','+221770000005'],
  ].forEach(u => iU.run(...u));

  // Cadre des 12 programmes NDT (structure réelle, pas de données fictives)
  const iP = db.prepare('INSERT INTO programs (code,name,projects_count,budget,progress,status,color) VALUES (?,?,?,?,?,?,?)');
  [
    ['P01','Infrastructure Numérique',0,0,0,'on_track','#06b6d4'],
    ['P02','e-Gouvernement',0,0,0,'on_track','#10b981'],
    ['P03','Mobile Money & Fintech',0,0,0,'on_track','#f59e0b'],
    ['P04','e-ID & DPI',0,0,0,'on_track','#8b5cf6'],
    ['P05','Éducation Numérique',0,0,0,'on_track','#3b82f6'],
    ['P06','Santé Numérique',0,0,0,'on_track','#ec4899'],
    ['P07','Agriculture Numérique',0,0,0,'on_track','#10b981'],
    ['P08','Souveraineté Numérique',0,0,0,'on_track','#ef4444'],
    ['P09','Innovation & IA',0,0,0,'on_track','#06b6d4'],
    ['P10','Cybersécurité',0,0,0,'on_track','#10b981'],
    ['P11','Économie Numérique',0,0,0,'on_track','#f59e0b'],
    ['P12','Inclusion Numérique',0,0,0,'on_track','#8b5cf6'],
  ].forEach(p => iP.run(...p));

  console.log('✅  Base initialisée — 5 comptes utilisateurs + 12 programmes NDT (vides)');
}

module.exports = { getDb, initSchema, seedData };
