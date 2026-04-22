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
    console.log('ℹ️   Données déjà présentes, seed ignoré');
    return;
  }
  const hash = p => require('bcryptjs').hashSync(p, 10);

  // Users
  const iU = db.prepare('INSERT INTO users (id,name,email,password,role,department,phone) VALUES (?,?,?,?,?,?,?)');
  [
    ['usr_md','Mohamed Diallo','m.diallo@mctn.sn',hash('Admin@MCTN2025!'),'admin','Direction','+221770000001'],
    ['usr_fd','Fatou Diallo','f.diallo@mctn.sn',hash('Coord@MCTN2025!'),'coordinator','Projets','+221770000002'],
    ['usr_is','Ibrahima Sarr','i.sarr@mctn.sn',hash('SE@MCTN2025!'),'analyst','S&E','+221770000003'],
    ['usr_ab','Aissatou Ba','a.ba@mctn.sn',hash('DPI@MCTN2025!'),'analyst','DPI','+221770000004'],
    ['usr_on','Ousmane Ndiaye','o.ndiaye@mctn.sn',hash('eGov@MCTN2025!'),'analyst','e-Gov','+221770000005'],
  ].forEach(u => iU.run(...u));

  // Programs (12 NDT)
  const iP = db.prepare('INSERT INTO programs (code,name,projects_count,budget,progress,status,color) VALUES (?,?,?,?,?,?,?)');
  [
    ['P01','Infrastructure Numérique',6,45.2,38,'on_track','#06b6d4'],
    ['P02','e-Gouvernement',5,12.8,62,'on_track','#10b981'],
    ['P03','Mobile Money & Fintech',4,8.5,45,'attention','#f59e0b'],
    ['P04','e-ID & DPI',3,22.0,28,'on_track','#8b5cf6'],
    ['P05','Éducation Numérique',5,18.5,55,'on_track','#3b82f6'],
    ['P06','Santé Numérique',3,9.2,32,'attention','#ec4899'],
    ['P07','Agriculture Numérique',4,11.5,41,'on_track','#10b981'],
    ['P08','Souveraineté Numérique',3,25.0,22,'risque','#ef4444'],
    ['P09','Innovation & IA',4,15.5,35,'on_track','#06b6d4'],
    ['P10','Cybersécurité',3,12.0,48,'on_track','#10b981'],
    ['P11','Économie Numérique',4,8.8,30,'attention','#f59e0b'],
    ['P12','Inclusion Numérique',4,22.0,42,'on_track','#8b5cf6'],
  ].forEach(p => iP.run(...p));

  // Diligences
  const iD = db.prepare('INSERT INTO diligences (title,source,deadline,status,responsible,priority,type) VALUES (?,?,?,?,?,?,?)');
  [
    ['Note de cadrage e-ID pour PM','Cabinet PM','2026-03-20','en_cours','Mohamed Diallo','critique','Note'],
    ['Rapport PAENS Q1 2026','Banque Mondiale','2026-03-31','en_cours','Fatou Diallo','haute','Rapport'],
    ['CR Séminaire Sénégal-France','Cabinet Ministre','2026-03-15','fait','Mohamed Diallo','moyenne','Compte rendu'],
    ['Présentation Conseil des Ministres NDT','Présidence','2026-04-02','planifie','Mohamed Diallo','critique','Présentation'],
    ['Note supervision jeux en ligne','ARTP','2026-03-25','en_cours','Ibrahima Sarr','haute','Note'],
    ['Rapport exécution PRES Q1','PM','2026-04-10','planifie','Fatou Diallo','haute','Rapport'],
  ].forEach(d => iD.run(...d));

  // Partnerships
  const iPA = db.prepare('INSERT INTO partnerships (name,type,country,status,amount,contact,email,description,start_date,end_date,projects) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  [
    ['Banque Mondiale','bailleur','International','actif','150M USD','Représentation Dakar','wb.dakar@worldbank.org','Financement principal PAENS ($150M)','2024-01-15','2028-12-31','["PAENS"]'],
    ['Gates Foundation','fondation','États-Unis','actif','5M USD','Pape Thiam','senegal@gatesfoundation.org','Financement pilote MOSIP e-ID','2025-03-01','2027-03-01','["e-ID/MOSIP"]'],
    ['GIZ','bilateral','Allemagne','actif','3.2M EUR','Klaus Weber','giz.senegal@giz.de','Projet Goin Digital','2024-06-01','2027-05-31','["Goin Digital"]'],
    ['Expertise France','bilateral','France','actif','2.5M EUR','Marie Leroux','ef.sn@expertisefrance.fr','Coopération franco-sénégalaise','2024-05-15','2027-05-14','["Goin Digital"]'],
    ['OCDE','multilateral','International','actif','Assistance Technique','Bureau OCDE Dakar','going.digital@ocde.org','Programme Going Digital','2024-09-01','2026-08-31','["Going Digital"]'],
  ].forEach(p => iPA.run(...p));

  // Audiences
  const iA = db.prepare('INSERT INTO audiences (institution,contact,date,objet,status,priority,suite_a_donner,followup_date,notes) VALUES (?,?,?,?,?,?,?,?,?)');
  [
    ['LONASE','DG Mamadou Diop','2026-03-10','Supervision plateformes paris en ligne','tenue','haute','Préparer note technique pour ARTP','2026-03-25','8 sites non bloqués, problèmes de connectivité'],
    ['ARTP','Directeur Général','2026-03-12','Cadre réglementaire Mobile Money 2026','tenue','haute','Partager rapport PRES et organiser réunion tripartite','2026-03-22','Accord sur nécessité cadre unifié'],
    ['BOCS','DG Aliou Sow','2026-03-08','Taxation mobile money — mesures PRES','tenue','critique','Rédiger note technique pour MFB','2026-03-18','Résistance sur les taux. Arbitrage PM requis.'],
    ['GIZ / Expertise France','Coordination Goin Digital','2026-03-14','Point étape Goin Digital Q1','planifiee','moyenne','Valider plan de travail Q2','2026-04-01',''],
    ['ADIE','DG Cheikh Bakhoum','2026-03-05','Déploiement SENGEC Phase 2','tenue','moyenne','Valider feuille de route phase 2','2026-03-19','Phase 2 confirmée Q2 2026'],
  ].forEach(a => iA.run(...a));

  // Indicators + milestones
  const iInd = db.prepare('INSERT INTO indicators (code,label,category,target,unit,baseline,current_value,trend,status,responsible,program,methodology,last_update) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const iMil = db.prepare('INSERT INTO indicator_milestones (indicator_id,year,value) VALUES (?,?,?)');
  const INDICATORS = [
    {code:'C1',label:'Taux de connectivité de qualité, à moindre coût',cat:'connect',target:95,unit:'%',base:42,cur:58,trend:3.2,st:'on_track',resp:'ARTP/DU',prog:'P01',meth:'Enquête nationale annuelle + données opérateurs',upd:'Fév 2026',
     mil:[{y:'2025',v:50},{y:'2026',v:58},{y:'2028',v:74},{y:'2030',v:85},{y:'2034',v:95}]},
    {code:'C2',label:"Taux d'utilisation des services numériques",cat:'connect',target:80,unit:'%',base:28,cur:39,trend:4.5,st:'on_track',resp:'ADIE/DU',prog:'P02',meth:'Enquête ménages ANSD + rapports ARTP',upd:'Fév 2026',
     mil:[{y:'2025',v:35},{y:'2026',v:39},{y:'2028',v:55},{y:'2030',v:67},{y:'2034',v:80}]},
    {code:'C3',label:"Sénégalais disposant d'une identité numérique",cat:'connect',target:90,unit:'%',base:12,cur:24,trend:6.1,st:'attention',resp:'ADIE/DU',prog:'P04',meth:'Base ADIE + enquête terrain biannuelle',upd:'Mar 2026',
     mil:[{y:'2025',v:18},{y:'2026',v:24},{y:'2028',v:45},{y:'2030',v:68},{y:'2034',v:90}]},
    {code:'C4',label:'Foncier enregistré avec identité numérique',cat:'connect',target:80,unit:'%',base:8,cur:14,trend:2.8,st:'risque',resp:'DGID/DU',prog:'P04',meth:'Données cadastrales DGID',upd:'Mar 2026',
     mil:[{y:'2025',v:11},{y:'2026',v:14},{y:'2028',v:30},{y:'2030',v:55},{y:'2034',v:80}]},
    {code:'T1',label:'Start-up Tech labélisées',cat:'competences',target:500,unit:'start-ups',base:45,cur:138,trend:22,st:'on_track',resp:'DER/DINUM/DU',prog:'P09',meth:'Registre DINUM + appels DER',upd:'Fév 2026',
     mil:[{y:'2025',v:115},{y:'2026',v:138},{y:'2028',v:220},{y:'2030',v:360},{y:'2034',v:500}]},
    {code:'T2',label:'e-Champions africains formés',cat:'competences',target:50,unit:'personnes',base:0,cur:14,trend:5,st:'on_track',resp:'MCTN/DU',prog:'P09',meth:'Programme Smart Africa',upd:'Jan 2026',
     mil:[{y:'2025',v:9},{y:'2026',v:14},{y:'2028',v:28},{y:'2030',v:40},{y:'2034',v:50}]},
    {code:'T3',label:'Diplômés du Numérique (cumulé)',cat:'competences',target:100000,unit:'personnes',base:8000,cur:22400,trend:3200,st:'on_track',resp:'MES/DU',prog:'P05',meth:'Données MES + universités',upd:'Fév 2026',
     mil:[{y:'2025',v:19200},{y:'2026',v:22400},{y:'2028',v:42000},{y:'2030',v:68000},{y:'2034',v:100000}]},
    {code:'T4',label:'Experts certifiés du Numérique / an',cat:'competences',target:5000,unit:'experts/an',base:400,cur:1240,trend:180,st:'on_track',resp:'MCTN/DU',prog:'P05',meth:'Certifications + CESTI',upd:'Fév 2026',
     mil:[{y:'2025',v:1060},{y:'2026',v:1240},{y:'2028',v:2400},{y:'2030',v:3800},{y:'2034',v:5000}]},
    {code:'E1',label:'Indice CNUCED B2C (gain de points)',cat:'eco',target:30,unit:'pts',base:0,cur:8,trend:2.5,st:'attention',resp:'MFB/DU',prog:'P11',meth:'Publication annuelle CNUCED',upd:'Nov 2025',
     mil:[{y:'2025',v:6},{y:'2026',v:8},{y:'2028',v:14},{y:'2030',v:22},{y:'2034',v:30}]},
    {code:'E2',label:'Emplois directs créés par le numérique',cat:'eco',target:150000,unit:'emplois',base:18000,cur:42000,trend:5500,st:'on_track',resp:'MFPE/DU',prog:'P11',meth:'Enquête emploi ANSD',upd:'Fév 2026',
     mil:[{y:'2025',v:36500},{y:'2026',v:42000},{y:'2028',v:75000},{y:'2030',v:112000},{y:'2034',v:150000}]},
    {code:'E3',label:'Emplois indirects induits par le numérique',cat:'eco',target:200000,unit:'emplois',base:22000,cur:58000,trend:7200,st:'on_track',resp:'MFPE/DU',prog:'P11',meth:'Modèle spillover ANSD',upd:'Fév 2026',
     mil:[{y:'2025',v:50800},{y:'2026',v:58000},{y:'2028',v:100000},{y:'2030',v:150000},{y:'2034',v:200000}]},
    {code:'E4',label:'Contribution du numérique au PIB',cat:'eco',target:15,unit:'%',base:4.2,cur:6.1,trend:0.5,st:'attention',resp:'DPEE/DU',prog:'P11',meth:'Comptes nationaux DPEE',upd:'Déc 2025',
     mil:[{y:'2025',v:5.6},{y:'2026',v:6.1},{y:'2028',v:8.5},{y:'2030',v:11},{y:'2034',v:15}]},
    {code:'A1',label:'Procédures administratives dématérialisées',cat:'admin',target:90,unit:'%',base:12,cur:38,trend:5.2,st:'on_track',resp:'ADIE/DU',prog:'P02',meth:'Inventaire procédures CEFORE + ministères',upd:'Mar 2026',
     mil:[{y:'2025',v:32},{y:'2026',v:38},{y:'2028',v:58},{y:'2030',v:75},{y:'2034',v:90}]},
    {code:'A2',label:'Entreprises ayant atteint la maturité digitale',cat:'admin',target:95,unit:'%',base:8,cur:22,trend:3.8,st:'attention',resp:'MFPE/DU',prog:'P11',meth:'Baromètre maturité ANSD',upd:'Jan 2026',
     mil:[{y:'2025',v:18},{y:'2026',v:22},{y:'2028',v:45},{y:'2030',v:70},{y:'2034',v:95}]},
    {code:'A3',label:'Données sensibles hébergées au Sénégal',cat:'admin',target:100,unit:'%',base:35,cur:52,trend:4.1,st:'attention',resp:'ANSSI/DU',prog:'P08',meth:'Audit annuel cloud APSARA',upd:'Mar 2026',
     mil:[{y:'2025',v:48},{y:'2026',v:52},{y:'2028',v:68},{y:'2030',v:82},{y:'2034',v:100}]},
  ];
  INDICATORS.forEach(i => {
    const r = iInd.run(i.code,i.label,i.cat,i.target,i.unit,i.base,i.cur,i.trend,i.st,i.resp,i.prog,i.meth,i.upd);
    i.mil.forEach(m => iMil.run(r.lastInsertRowid, m.y, m.v));
  });

  // Revues
  const iR = db.prepare('INSERT INTO revues (date,type,titre,statut,animateur,participants,alertes,decisions,rapport) VALUES (?,?,?,?,?,?,?,?,?)');
  [
    ['2026-03-05','mensuelle','Revue mensuelle M15 — Février 2026','tenue','Mohamed Diallo','DU + 5 programmes NDT',2,6,1],
    ['2026-02-04','mensuelle','Revue mensuelle M14 — Janvier 2026','tenue','Ibrahima Sarr','DU + 4 programmes NDT',1,4,1],
    ['2025-12-10','annuelle','Évaluation annuelle indépendante — An 1 NDT','tenue','Cabinet BearingPoint','Évaluateurs + PM + DU',5,12,1],
    ['2026-04-02','mensuelle','Revue mensuelle M16 — Mars 2026','planifiee','Mohamed Diallo','DU + Coordinateurs',0,0,0],
    ['2026-06-04','trimestrielle','Revue trimestrielle T2 2026','planifiee','Mohamed Diallo','Ministre + Cabinet + DU',0,0,0],
    ['2026-12-10','annuelle','Évaluation annuelle indépendante — An 2 NDT','planifiee','À désigner','TBD',0,0,0],
  ].forEach(r => iR.run(...r));

  // Evaluations
  const iEv = db.prepare('INSERT INTO evaluations (annee,statut,evaluateur,commanditaire,date,rapport,note_globale,notes_json,conclusions_json,recommandations_json,alertes_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  iEv.run('An 1 — 2025','terminee','BearingPoint Afrique','DU / Cabinet PM','Décembre 2025','Rapport_Eval_An1.pdf',68,
    JSON.stringify({pertinence:82,efficacite:72,efficience:65,impact:58,durabilite:62}),
    JSON.stringify(['Démarrage solide sur e-Gouvernement et Infrastructures','Retards sur e-ID liés à la coordination interministérielle','La DU a structuré un suivi rigoureux']),
    JSON.stringify(['Accélérer le pilote MOSIP','Formaliser la DU par décret Q2 2026','Renforcer capacités des 12 ministères']),
    JSON.stringify(['Risque décrochage indicateur C4 si pas interopérabilité DGID','Réviser méthodologie contribution PIB avec DPEE'])
  );
  iEv.run('An 2 — 2026','planifiee','À désigner (AO Q3 2026)','DU / Cabinet PM','Décembre 2026',null,null,
    '{}','[]','[]', JSON.stringify(['Lancer AO évaluateur avant fin juin 2026'])
  );

  // Team
  const iTm = db.prepare('INSERT INTO team_members (user_id,name,role,level,department,initials,color,expertise_json,email,phone,bio) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  [
    ['usr_md','Mohamed Diallo',"Directeur de l'Unité de Livraison",1,'Direction','MD','#06b6d4',JSON.stringify(['Gouvernance NDT','Coordination interministérielle','Stratégie numérique']),'m.diallo@mctn.sn','+221770000001',"Directeur de la Delivery Unit, responsable du pilotage du NDT 2025-2034."],
    ['usr_fd','Fatou Diallo','Coordinatrice Projets & Programmes',2,'Projets','FD','#8b5cf6',JSON.stringify(['Gestion de projets','Banque Mondiale','PAENS','Procurement']),'f.diallo@mctn.sn','+221770000002','Coordonne le portefeuille de 50+ projets NDT.'],
    ['usr_is','Ibrahima Sarr','Coordinateur Suivi-Évaluation',2,'S&E','IS','#8b5cf6',JSON.stringify(['Suivi & Évaluation','KPI','Rapportage PM']),'i.sarr@mctn.sn','+221770000003','Responsable du système de suivi-évaluation.'],
    ['usr_ab','Aissatou Ba','Chargée de mission DPI & e-ID',3,'DPI','AB','#10b981',JSON.stringify(['DPI','e-ID','MOSIP','Gates Foundation']),'a.ba@mctn.sn','+221770000004','Experte DPI, pilote le programme e-ID avec MOSIP.'],
    ['usr_on','Ousmane Ndiaye','Chargé de mission e-Gouvernement',3,'e-Gov','ON','#10b981',JSON.stringify(['e-Gouvernement','SENGEC','Interopérabilité']),'o.ndiaye@mctn.sn','+221770000005','Coordonne les projets e-gouvernement.'],
    [null,'Mariama Touré','Chargée de mission Partenariats',3,'Partenariats','MT','#10b981',JSON.stringify(['Relations bailleurs','Fundraising','MOU']),'m.toure@mctn.sn','+221770000006','Gère les relations avec les partenaires techniques et financiers.'],
    [null,'Cheikh Fall','Chargé de mission Innovation & IA',3,'Innovation','CF','#10b981',JSON.stringify(['IA & Big Data','Startups','Écosystème numérique']),'c.fall@mctn.sn','+221770000007','Coordonne les initiatives IA et innovation numérique.'],
    [null,'Rokhaya Mbaye','Assistante de Direction',4,'Administration','RM','#f59e0b',JSON.stringify(['Administration','Protocole','Agenda DU']),'r.mbaye@mctn.sn','+221770000008','Assiste la direction dans la gestion administrative.'],
    [null,'Pathé Sy','Assistant Technique & SI',4,'SI','PS','#f59e0b',JSON.stringify(['Systèmes information','Dashboard','IT']),'p.sy@mctn.sn','+221770000009','Administre les outils et SI de la DU.'],
    [null,'Khady Gueye','Assistante Communication',4,'Communication','KG','#f59e0b',JSON.stringify(['Communication institutionnelle','Rapports visuels']),'k.gueye@mctn.sn','+221770000010','En charge de la communication institutionnelle.'],
  ].forEach(t => iTm.run(...t));

  console.log('✅  Seed data inséré (users, programmes, diligences, partenariats, audiences, indicateurs, revues, évaluations, équipe)');
}

module.exports = { getDb, initSchema, seedData };
