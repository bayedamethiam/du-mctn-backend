const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');

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
      description TEXT, projects_count INTEGER DEFAULT 0, budget REAL DEFAULT 0,
      progress INTEGER DEFAULT 0, status TEXT DEFAULT 'on_track', color TEXT DEFAULT '#06b6d4',
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER REFERENCES programs(id),
      name TEXT NOT NULL, description TEXT, budget REAL, progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'structuration', start_date TEXT, end_date TEXT, responsible TEXT,
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
    console.log('ℹ️   Données déjà présentes, seed ignoré');
    return;
  }
  const hash = p => bcrypt.hashSync(p, 10);

  // ── USERS ──────────────────────────────────────────────────────────────────
  const iU = db.prepare('INSERT INTO users (id,name,email,password,role,department,phone) VALUES (?,?,?,?,?,?,?)');
  [
    ['usr_md','Mohamed Diaby','m.diaby@mctn.sn',  hash('Admin@MCTN2025!'),'admin',      'Direction','+221770000001'],
    ['usr_fd','Fatou Diallo', 'f.diallo@mctn.sn', hash('Coord@MCTN2025!'),'coordinator','Projets',  '+221770000002'],
    ['usr_is','Ibrahima Sarr','i.sarr@mctn.sn',   hash('SE@MCTN2025!'),  'analyst',    'S&E',      '+221770000003'],
    ['usr_an','Aminata Ndiaye','a.ndiaye@mctn.sn', hash('DPI@MCTN2025!'), 'analyst',   'DPI',      '+221770000004'],
    ['usr_of','Oumar Fall',   'o.fall@mctn.sn',   hash('eGov@MCTN2025!'),'analyst',    'e-Gov',    '+221770000005'],
  ].forEach(u => iU.run(...u));

  // ── PROGRAMMES NDT ─────────────────────────────────────────────────────────
  const iP = db.prepare(`INSERT INTO programs (code,name,description,projects_count,budget,progress,status,color) VALUES (?,?,?,?,?,?,?,?)`);
  const PROGRAMS = [
    ['P01','Gouvernance & Régulation du Numérique',
      'Cadre institutionnel, régulation convergente et pilotage stratégique de la transformation numérique',
      4, 45, 62, 'on_track', '#3b82f6'],
    ['P02','Infrastructures Numériques Souveraines',
      'Cloud souverain, datacenter national, fibre optique et connectivité universelle',
      5, 180, 45, 'on_track', '#3b82f6'],
    ['P03','Cybersécurité & Confiance Numérique',
      'Protection des infrastructures critiques, données sensibles et promotion de la cyberculture',
      4, 65, 48, 'on_track', '#3b82f6'],
    ['P04','Identité Numérique & Registres Civils',
      'Identité numérique unique pour les personnes physiques, le foncier et les entités juridiques',
      4, 95, 52, 'on_track', '#14b8a6'],
    ['P05','Administration Digitale & Guichet Unique',
      'Dématérialisation totale des services publics et portail unique citoyen multicanal',
      5, 120, 58, 'on_track', '#14b8a6'],
    ['P06','Transformation Numérique des Secteurs',
      'Digitalisation des filières clés : santé, éducation, agriculture, justice et protection sociale',
      4, 85, 33, 'attention', '#14b8a6'],
    ['P07','Économie Numérique & Inclusion Financière',
      'Fintech, commerce électronique, inclusion du secteur informel et fonds des services universels',
      4, 90, 40, 'on_track', '#f59e0b'],
    ['P08','IA & Digital Factory',
      'Hub IA national, incubation technologique et émergence de champions numériques sénégalais',
      4, 75, 40, 'on_track', '#f59e0b'],
    ['P09','Compétences & Emploi Numériques',
      'Formation massive aux métiers du numérique : objectif 100 000 diplômés à horizon 2034',
      4, 60, 30, 'attention', '#f59e0b'],
    ['P10','Hub Technologique & Investissements',
      'Positionnement du Sénégal comme hub tech africain et attraction des grands acteurs mondiaux',
      4, 130, 30, 'attention', '#a78bfa'],
    ['P11','Connectivité & Territoires Intelligents',
      'Villes intelligentes, télécentres communautaires et inclusion numérique territoriale',
      4, 80, 28, 'attention', '#a78bfa'],
    ['P12','Diplomatie Numérique & Intégration Africaine',
      'Leadership continental, intégration CEDEAO/UA et diplomatie multilatérale (UIT, UPU, SMSI)',
      4, 55, 48, 'on_track', '#a78bfa'],
  ];
  PROGRAMS.forEach(p => iP.run(...p));

  // ── PROJETS ────────────────────────────────────────────────────────────────
  const progId = code => db.prepare('SELECT id FROM programs WHERE code=?').get(code).id;
  const iPR = db.prepare(`INSERT INTO projects (program_id,name,description,budget,status) VALUES (?,?,?,?,?)`);

  const PROJECTS = {
    'P01': [
      ['GouvNum — Comité de Gouvernance du Numérique','Primature / MCTN',0,'execution'],
      ['Conseil National du Numérique (CNN)','Primature — 20 experts bénévoles · Installé oct. 2025',0,'execution'],
      ['Réforme du Code des Télécommunications','MCTN / ARTP — Modernisation cadre législatif',0,'execution'],
      ['Observatoire des Compétences Numériques','MCTN / MESRI — Suivi des besoins en talents',0,'structuration'],
    ],
    'P02': [
      ['APSARA — Cloud Souverain du Sénégal','SENUM SA — Hébergement données sensibles de l\'État',60,'execution'],
      ['Datacenter National de Diamniadio (Tier III)','SENUM SA — Infrastructure mutualisée ministères',40,'execution'],
      ['Réseau National de Fibre Optique (PAENS)','MCTN / TDS SA — 150M USD Banque Mondiale',55,'execution'],
      ['Déploiement 5G & Connectivité Universelle','ARTP / Opérateurs — Couverture 95% territoire',20,'structuration'],
      ['Programme PRP-2 (Câbles Sous-marins)','MCTN — Redondance connectivité internationale',5,'execution'],
    ],
    'P03': [
      ['Centre National de Cybersécurité (COCS / CSIRT)','DCSSI — Détection, réponse et coordination incidents',20,'execution'],
      ['Infrastructure PKI Nationale & e-Sign','DCSSI — Signature numérique agents de l\'État',15,'maturation'],
      ['Protection des Données Personnelles (CDP)','CDP — Renforcement attributions & sanctions',10,'execution'],
      ['Résilience des Opérateurs d\'Importance Vitale','DCSSI / Sectoriels — Politique sécurité OIV',20,'structuration'],
    ],
    'P04': [
      ['MOSIP — Identité Numérique Biométrique (e-ID)','MCTN / Gates Foundation — Pilote déployé 2025',30,'maturation'],
      ['Registre Foncier Numérique (SENGEC)','Min. Urbanisme / MCTN — Cadastre numérique',25,'execution'],
      ['Registre Civil Numérique & SIPEN','Min. Intérieur — Actes en ligne, état civil numérique',25,'execution'],
      ['e-Passeport & Documents Biométriques','Min. Intérieur / DGE — Modernisation documents',15,'execution'],
    ],
    'P05': [
      ['e-Sénégal — Guichet Unique Citoyen','MCTN / SENUM SA — Lancé 24 mars 2026',35,'execution'],
      ['PRES / e-JOKKOO — Plateforme d\'Interopérabilité','MCTN — Standard X-Road · Lancé par le PM mars 2026',30,'execution'],
      ['e-Visa & e-Consulat','MCTN / Min. Intérieur / MAE — Réciprocité PRES',20,'execution'],
      ['Dématérialisation des Procédures (100+)','MCTN / Ministères sectoriels — 100% démarches prioritaires',25,'execution'],
      ['Portail Diaspora (e-Diaspora)','MCTN / MAE — Services à distance Sénégalais étranger',10,'structuration'],
    ],
    'P06': [
      ['Santé Numérique — Dossier Médical Partagé','Min. Santé / MCTN — Télémédecine & traçabilité',25,'execution'],
      ['Éducation Numérique & Plateformes Pédagogiques','Min. Éducation / MCTN — Contenu, tablettes, écoles',25,'execution'],
      ['Agriculture Numérique (Agri-SEN)','Min. Agriculture / MCTN — SIG foncier, marchés en ligne',20,'structuration'],
      ['Justice Numérique (e-Justice)','Min. Justice / MCTN — Juridictions en ligne, e-notification',15,'structuration'],
    ],
    'P07': [
      ['Fintech & Paiements Numériques Inclusifs','BCEAO / ARTP / MCTN — Interopérabilité wallets & mobile money',25,'execution'],
      ['Numérisation du Secteur Informel','Min. Finances / MCTN — Identifiant fiscal, TPE, e-facture',20,'structuration'],
      ['FDSUT — Fonds des Services Universels des TIC','MCTN / ARTP — Financement accès universel TIC',25,'execution'],
      ['Commerce Électronique & Place de Marché','Min. Commerce / MCTN — Shopmeaway & export numérique',20,'execution'],
    ],
    'P08': [
      ['SEN Hub IA — Scaling Hub Intelligence Artificielle','MCTN / Gates Foundation (INV-095735) — Cas d\'usage IA',20,'execution'],
      ['Digital Factory Nationale','MCTN / SENUM SA — Incubateur solutions numériques souveraines',20,'structuration'],
      ['Goin\'Digital — Transformation Numérique PME','GIZ / MCTN — Accompagnement 1 000 PME/TPE',15,'execution'],
      ['Programme Startups & Champions Numériques','MCTN / FONSIS — Labellisation 500+ startups tech',20,'structuration'],
    ],
    'P09': [
      ['Programme 100 000 Diplômés du Numérique (2034)','MCTN / MESRI — Cursus universitaires et grandes écoles',20,'execution'],
      ['Certifications Pro. & Cycles Courts Numériques','MCTN — IA, Cloud, Cybersécurité, IoT, Blockchain',15,'execution'],
      ['Coding Bootcamps & Écoles du Numérique','MCTN / Secteur privé — Formation 3–6 mois jeunes sans emploi',15,'structuration'],
      ['Partenariats Universités-Entreprises Tech','MESRI / MCTN — Alternance, R&D, chaires numériques',10,'structuration'],
    ],
    'P10': [
      ['Zone Économique Spéciale Numérique — Diamniadio','APIX / MCTN — Zone franche tech, incitations fiscales',40,'execution'],
      ['Attraction des Géants Tech & Hyperscalers','MCTN / APIX — Microsoft, Google, AWS datacenters régionaux',40,'execution'],
      ['Fonds d\'Investissement Numérique (FIN-SEN)','Min. Finances / FONSIS — Co-investissement public-privé',30,'structuration'],
      ['Programme e-Champions Africains','MCTN / FONSIS — 50 entreprises tech à vocation régionale',20,'structuration'],
    ],
    'P11': [
      ['Smart City Diamniadio — Ville Intelligente Pilote','MCTN / APIX — Mobilité, énergie, sécurité connectés',25,'maturation'],
      ['Connectivité Universelle Rurale (Last-Mile)','ARTP / Opérateurs — Zones blanches, satellites LEO',30,'execution'],
      ['Télécentres Multiservices Communautaires','MCTN — 1 000 télécentres accès mutualisé services numériques',15,'structuration'],
      ['Gov\'atour — Tourisme Numérique','Min. Tourisme / MCTN — Promotion & visa électronique',10,'execution'],
    ],
    'P12': [
      ['Initiative IA Afrique — Stratégie Continentale UA','MCTN — Portage stratégie IA africaine à l\'UA/CEDEAO',5,'execution'],
      ['Intégration Numérique CEDEAO & Union Africaine','MCTN / MAE — Marché numérique unique, interopérabilité',10,'execution'],
      ['Diplomatie Multilatérale UIT / UPU / SMSI+20','MCTN — Mandats, candidatures, représentation mondiale',20,'execution'],
      ['Accords Bilatéraux Numériques (Chine, France, EAU…)','MCTN / MAE — Coopération tech, transfert de compétences',20,'execution'],
    ],
  };
  Object.entries(PROJECTS).forEach(([code, projs]) => {
    const pid = progId(code);
    projs.forEach(([name, desc, budget, status]) => iPR.run(pid, name, desc, budget, status));
  });

  // ── DILIGENCES ─────────────────────────────────────────────────────────────
  const iD = db.prepare(`INSERT INTO diligences (title,source,deadline,status,responsible,priority,notes) VALUES (?,?,?,?,?,?,?)`);
  [
    ['Note synthèse NDT pour Conseil des Ministres','Cabinet Ministre','2026-04-25','en_cours','M. Diaby','haute','Programme : P05'],
    ['Tableau de bord avancement e-JOKKOO — rapport mensuel','Primature (GouvNum)','2026-04-15','fait','I. Sarr','haute','Programme : P05'],
    ['Rapport trimestriel Hub IA — Grant INV-095735','Gates Foundation','2026-04-30','en_cours','F. Diallo','haute','Programme : P08'],
    ['Données NDT pour négociations BAD — Comité BID 2026','Min. Économie (MEPC)','2026-05-10','planifie','M. Diaby','moyenne','Programme : P02'],
    ['Préparation mission Forum de Beijing — briefing médias','Cabinet Ministre','2026-04-21','fait','M. Diaby','haute','Programme : P12'],
    ['Contribution à la réforme du Code des Télécommunications','ARTP','2026-05-20','en_cours','I. Sarr','moyenne','Programme : P01'],
    ['Réponse à la commission communication & numérique','Assemblée Nationale','2026-04-18','fait','M. Diaby','haute','Programme : P01'],
  ].forEach(d => iD.run(...d));

  // ── PARTENARIATS ───────────────────────────────────────────────────────────
  const iPT = db.prepare(`INSERT INTO partnerships (name,type,country,status,amount,contact,projects) VALUES (?,?,?,?,?,?,?)`);
  [
    ['Fondation Gates','PTF','USA','actif','923M FCFA/an','Delaney Schultz',JSON.stringify(['P08','P04'])],
    ['Banque Mondiale','PTF','International','actif','150M USD','Task Team Leader',JSON.stringify(['P02','P04'])],
    ['BAD (Banque Africaine de Développement)','PTF','Afrique','en_cours','En négociation','Mission BAD',JSON.stringify(['P02','P07'])],
    ['GIZ (Coopération Allemande)','Coopération bilatérale','Allemagne','actif','Technique','Dir. Programme',JSON.stringify(['P08','P09'])],
    ['Banque Islamique de Développement (BID)','PTF','International','en_cours','Stratégie 2026-28','Groupe de travail',JSON.stringify(['P06','P09'])],
    ['PNUD Sénégal','SNU','International','actif','Technique','Représentant Résident',JSON.stringify(['P09','P06'])],
    ['Smart Africa Alliance','Partenariat régional','Afrique','actif','Technique','Secrétariat Smart Africa',JSON.stringify(['P10','P12'])],
    ['MOSIP Foundation','Partenariat technique','International','actif','Technique','Technical Lead',JSON.stringify(['P04'])],
  ].forEach(p => iPT.run(...p));

  // ── AUDIENCES ──────────────────────────────────────────────────────────────
  const iA = db.prepare(`INSERT INTO audiences (institution,contact,date,objet,status,suite_a_donner) VALUES (?,?,?,?,?,?)`);
  [
    ['GouvNum — Revue mensuelle','DG SENUM, DG ARTP, DCSSI','2026-04-22','Revue mensuelle GouvNum — avancement projets NDT','tenue','Rapport transmis au Comité'],
    ['Atelier IA & Digital Factory','GIZ, PNUD, équipe DU','2026-04-23','Atelier IA & Digital Factory — structuration cas d\'usage','tenue','Feuille de route à valider'],
    ['Mission Gates Foundation','D. Schultz, équipe DU','2026-04-10','Mission Gates Foundation — revue Grant INV-095735','tenue','CR transmis à la Fondation'],
    ['Comité BID','MEPC, MCTN, BID','2026-05-05','Comité BID — Stratégie Partenariat Pays 2026–2028','planifiee','Note de position à préparer'],
    ['Forum BAD','Min. Finances, MCTN, BAD','2026-05-15','Forum BAD — financement NDT phase 2','planifiee','Dossier de financement'],
    ['Revue technique MOSIP','MOSIP Fdn, DGE, MCTN','2026-04-08','Revue technique MOSIP — bilan pilote e-ID','tenue','Recommandations passage à l\'échelle'],
  ].forEach(a => iA.run(...a));

  // ── INDICATEURS S&E ────────────────────────────────────────────────────────
  const iI = db.prepare(`INSERT INTO indicators (code,label,category,target,unit,baseline,current_value,status,program) VALUES (?,?,?,?,?,?,?,?,?)`);
  [
    ['IND-01','Taux de connectivité de qualité','Infrastructure',95,'%',0,52,'on_track','P02'],
    ['IND-02','Procédures administratives dématérialisées','Services',100,'%',0,38,'on_track','P05'],
    ['IND-03','Sénégalais avec identité numérique (e-ID)','Identité',90,'%',0,8,'attention','P04'],
    ['IND-04','Contribution du numérique au PIB','Économie',15,'%',0,6.5,'on_track','P07'],
    ['IND-05','Startups tech labellisées','Innovation',500,'unités',0,87,'attention','P08'],
    ['IND-06','Diplômés du numérique formés/an','Compétences',5000,'personnes',0,1820,'on_track','P09'],
    ['IND-07','Données sensibles hébergées au Sénégal','Souveraineté',100,'%',0,42,'on_track','P02'],
    ['IND-08','Foncier avec identité numérique','Foncier',80,'%',0,22,'attention','P04'],
    ['IND-09','Entreprises ayant atteint la maturité digitale','Économie',95,'%',0,18,'risque','P07'],
    ['IND-10','Taux d\'utilisation services numériques publics','Services',80,'%',0,31,'on_track','P05'],
    ['IND-11','Experts certifiés du numérique','Compétences',90,'%',0,12,'risque','P09'],
    ['IND-12','Score classement e-commerce CNUCED (B2C)','Commerce',3,'rang',0,8,'on_track','P07'],
  ].forEach(i => iI.run(...i));

  // ── INSTANCES INTERNATIONALES ──────────────────────────────────────────────
  const iIN = db.prepare(`INSERT INTO intl_instances (acronym,name,category,niveau,score_presence,score_contribution,score_postes,score_suivi,next_meeting_label,mandats_json) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  [
    ['UIT','Union Internationale des Télécommunications','ONU','influent',29,22,14,7,'CMDT-25 Dubaï',JSON.stringify(['Membre Conseil 2026-2030 (candidature)'])],
    ['UPU','Union Postale Universelle','ONU','membre',27,20,14,7,'Congrès UPU 2026',JSON.stringify(['Membre Comité Stratégique'])],
    ['IGF','Forum de Gouvernance de l\'Internet (FGI/IGF)','ONU/SMSI','membre',22,17,11,5,'IGF 2026 Norvège',JSON.stringify(['Rapporteur thématique IA'])],
    ['CUA','Commission de l\'Union Africaine — Numérique','UA','influent',32,24,16,8,'Sommet UA juillet 2026',JSON.stringify(['Portage Initiative IA Afrique'])],
    ['CEDEAO','CEDEAO — Comité Numérique','CEDEAO','influent',30,22,15,8,'Réunion Abuja juin 2026',JSON.stringify(['Co-Coordinateur interopérabilité'])],
    ['SmartAfrica','Smart Africa Alliance','Régional','membre',28,21,14,7,'Workshop Kigali avr. 2026',JSON.stringify(['Hub IA Sénégal / Kigali'])],
    ['GAF','Global Action Forum','Multilatéral','influent',31,23,16,8,'3ème Conférence Beijing avr. 2026',JSON.stringify(['Délégation ministérielle Beijing 2026'])],
    ['SMSI','Sommet Mondial sur la Société de l\'Information','ONU/ITU','membre',24,18,12,6,'WSIS+20 Genève 2025',JSON.stringify(['Délégation technique SMSI+20'])],
    ['OIF','Francophonie Numérique','OIF','membre',26,19,13,7,'Sommet Francophonie 2026',JSON.stringify(['Membre groupe de travail IA'])],
    ['SN-CN','Partenariat Sénégal-Chine (Numérique)','Bilatéral','influent',33,25,16,8,'Forum Beijing avr. 2026',JSON.stringify(['Accords coopération tech & IA'])],
    ['SN-FR','Partenariat Sénégal-France (Numérique)','Bilatéral','membre',28,21,14,7,'Berlin juin 2026',JSON.stringify(['Séminaire intergouvernemental'])],
    ['SN-EAU','Partenariat Sénégal-EAU (Numérique)','Bilatéral','membre',27,20,14,7,'GITEX oct. 2026',JSON.stringify(['GITEX, Cyber AI Awards'])],
  ].forEach(i => iIN.run(...i));

  // ── ÉQUIPE DU ──────────────────────────────────────────────────────────────
  const iTM = db.prepare(`INSERT INTO team_members (name,role,level,department,initials,color,expertise_json,email) VALUES (?,?,?,?,?,?,?,?)`);
  [
    ['Mohamed DIABY','Coordinateur / Directeur',1,'Direction','MD','#f59e0b',JSON.stringify(['P01','P05','P08','P12']),'m.diaby@mctn.sn'],
    ['Fatou DIALLO','Chargée Partenariats & Financement',2,'Projets','FD','#14b8a6',JSON.stringify(['P08','P09','P07']),'f.diallo@mctn.sn'],
    ['Ibrahima SARR','Analyste Suivi-Évaluation',3,'S&E','IS','#3b82f6',JSON.stringify(['P04','P05','P06']),'i.sarr@mctn.sn'],
    ['Aminata NDIAYE','Chargée Infra & Souveraineté',2,'DPI','AN','#14b8a6',JSON.stringify(['P02','P03','P01']),'a.ndiaye@mctn.sn'],
    ['Oumar FALL','Chargé Économie Numérique',2,'e-Gov','OF','#14b8a6',JSON.stringify(['P07','P08','P10']),'o.fall@mctn.sn'],
    ['Mariame SY','Chargée Digitalisation Services',3,'Services','MS','#3b82f6',JSON.stringify(['P04','P05','P06']),'m.sy@mctn.sn'],
  ].forEach(m => iTM.run(...m));

  // ── REVUE DE RÉFÉRENCE ─────────────────────────────────────────────────────
  const iR = db.prepare(`INSERT INTO revues (date,type,titre,statut,animateur,participants) VALUES (?,?,?,?,?,?)`);
  iR.run('2026-04-22','Mensuelle','Revue mensuelle GouvNum — Avancement NDT avril 2026','terminee','M. Diaby','DG SENUM, DG ARTP, DCSSI, équipe DU');

  console.log('✅  Base initialisée — 5 users · 12 programmes · 50 projets · 7 diligences · 8 partenariats · 6 audiences · 12 indicateurs · 12 instances · 6 membres équipe');
}

module.exports = { getDb, initSchema, seedData };