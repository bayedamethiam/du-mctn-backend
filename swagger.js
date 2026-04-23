const swaggerUi = require('swagger-ui-express');

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'DU-MCTN API',
    version: '1.0.0',
    description: 'API REST — Delivery Unit · Ministère des Collectivités Territoriales et du Numérique · New Deal Technologique Sénégal 2025-2034',
    contact: { name: 'Delivery Unit MCTN', email: 'm.diallo@mctn.sn' },
  },
  servers: [
    { url: 'https://du-mctn-backend-production.up.railway.app', description: 'Production (Railway)' },
    { url: 'http://localhost:3000', description: 'Local' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      User: {
        type: 'object',
        properties: {
          id:         { type: 'string' },
          name:       { type: 'string' },
          email:      { type: 'string', format: 'email' },
          role:       { type: 'string', enum: ['admin','director','coordinator','analyst'] },
          department: { type: 'string' },
          phone:      { type: 'string' },
          is_active:  { type: 'integer', enum: [0,1] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      TokenPair: {
        type: 'object',
        properties: {
          accessToken:  { type: 'string' },
          refreshToken: { type: 'string' },
          user:         { $ref: '#/components/schemas/User' },
        },
      },
      Program: {
        type: 'object',
        properties: {
          id:             { type: 'integer' },
          code:           { type: 'string', example: 'P01' },
          name:           { type: 'string' },
          projects_count: { type: 'integer' },
          budget:         { type: 'number' },
          progress:       { type: 'number' },
          status:         { type: 'string', enum: ['on_track','attention','risque','critique'] },
          color:          { type: 'string' },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id:          { type: 'integer' },
          program_id:  { type: 'integer' },
          name:        { type: 'string' },
          description: { type: 'string' },
          budget:      { type: 'number' },
          progress:    { type: 'number' },
          status:      { type: 'string' },
          start_date:  { type: 'string', format: 'date' },
          end_date:    { type: 'string', format: 'date' },
          responsible: { type: 'string' },
        },
      },
      Diligence: {
        type: 'object',
        properties: {
          id:          { type: 'integer' },
          title:       { type: 'string' },
          source:      { type: 'string' },
          deadline:    { type: 'string', format: 'date' },
          status:      { type: 'string', enum: ['planifie','en_cours','fait','annulee'] },
          responsible: { type: 'string' },
          priority:    { type: 'string', enum: ['critique','haute','moyenne'] },
          type:        { type: 'string' },
          notes:       { type: 'string' },
          updated_at:  { type: 'string', format: 'date-time' },
        },
      },
      Partnership: {
        type: 'object',
        properties: {
          id:          { type: 'integer' },
          name:        { type: 'string' },
          type:        { type: 'string', enum: ['bailleur','technique','institutionnel','prive'] },
          country:     { type: 'string' },
          status:      { type: 'string', enum: ['actif','inactif','en_negociation'] },
          amount:      { type: 'string' },
          contact:     { type: 'string' },
          email:       { type: 'string', format: 'email' },
          description: { type: 'string' },
          start_date:  { type: 'string', format: 'date' },
          end_date:    { type: 'string', format: 'date' },
          projects:    { type: 'string', description: 'JSON array de noms de projets' },
        },
      },
      Audience: {
        type: 'object',
        properties: {
          id:             { type: 'integer' },
          institution:    { type: 'string' },
          contact:        { type: 'string' },
          date:           { type: 'string', format: 'date' },
          objet:          { type: 'string' },
          status:         { type: 'string', enum: ['planifiee','tenue','annulee'] },
          priority:       { type: 'string', enum: ['haute','moyenne'] },
          suite_a_donner: { type: 'string' },
          followup_date:  { type: 'string', format: 'date' },
          notes:          { type: 'string' },
        },
      },
      TeamMember: {
        type: 'object',
        properties: {
          id:             { type: 'integer' },
          name:           { type: 'string' },
          role:           { type: 'string' },
          level:          { type: 'integer' },
          department:     { type: 'string' },
          initials:       { type: 'string' },
          color:          { type: 'string' },
          expertise_json: { type: 'string' },
          email:          { type: 'string', format: 'email' },
          phone:          { type: 'string' },
          bio:            { type: 'string' },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id:          { type: 'integer' },
          user_id:     { type: 'string' },
          user_name:   { type: 'string' },
          action:      { type: 'string' },
          resource:    { type: 'string' },
          resource_id: { type: 'string' },
          created_at:  { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth',         description: 'Authentification & gestion des utilisateurs' },
    { name: 'Dashboard',    description: 'KPIs et alertes' },
    { name: 'Programmes',   description: 'Programmes NDT et projets associés' },
    { name: 'Diligences',   description: 'Suivi des diligences et notes de service' },
    { name: 'Partenariats', description: 'Partenaires et documents' },
    { name: 'Audiences',    description: 'Agenda des audiences' },
    { name: 'S&E',          description: 'Suivi-évaluation, indicateurs, revues' },
    { name: 'Instances',    description: 'Instances de gouvernance et contributions' },
    { name: 'Équipe',       description: 'Membres de la Delivery Unit' },
    { name: 'Audit',        description: 'Journal des actions (admin/director)' },
    { name: 'Système',      description: 'Health check et info API' },
  ],
  paths: {

    // ── AUTH ──────────────────────────────────────────────────────
    '/api/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Connexion', security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['email','password'],
            properties: {
              email:    { type: 'string', format: 'email', example: 'm.diallo@mctn.sn' },
              password: { type: 'string', example: 'Admin@MCTN2025!' },
            },
          }}},
        },
        responses: {
          200: { description: 'Connexion réussie', content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } } },
          400: { description: 'Champs manquants',  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Identifiants incorrects', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'], summary: "Renouveler le token d'accès", security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['refreshToken'],
            properties: { refreshToken: { type: 'string' } },
          }}},
        },
        responses: {
          200: { description: 'Nouveau accessToken', content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' } } } } } },
          401: { description: 'Token invalide ou expiré', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'], summary: 'Déconnexion',
        requestBody: {
          content: { 'application/json': { schema: {
            type: 'object',
            properties: { refreshToken: { type: 'string' } },
          }}},
        },
        responses: {
          200: { description: 'Déconnexion réussie' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'], summary: "Profil de l'utilisateur connecté",
        responses: {
          200: { description: 'Profil utilisateur', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          401: { description: 'Non authentifié' },
        },
      },
    },
    '/api/auth/users': {
      get: {
        tags: ['Auth'], summary: 'Liste des utilisateurs (admin/director)',
        responses: {
          200: { description: 'Liste des utilisateurs', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } },
          403: { description: 'Accès refusé' },
        },
      },
    },
    '/api/auth/users/{id}': {
      put: {
        tags: ['Auth'], summary: 'Modifier un utilisateur',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              name:       { type: 'string' },
              department: { type: 'string' },
              phone:      { type: 'string' },
              role:       { type: 'string', enum: ['admin','director','coordinator','analyst'] },
              is_active:  { type: 'integer', enum: [0,1] },
            },
          }}},
        },
        responses: {
          200: { description: 'Utilisateur mis à jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          403: { description: 'Accès refusé' },
        },
      },
    },
    '/api/auth/change-password': {
      post: {
        tags: ['Auth'], summary: 'Changer son mot de passe',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['currentPassword','newPassword'],
            properties: {
              currentPassword: { type: 'string' },
              newPassword:     { type: 'string', minLength: 8 },
            },
          }}},
        },
        responses: {
          200: { description: 'Mot de passe modifié' },
          401: { description: 'Mot de passe actuel incorrect' },
        },
      },
    },

    // ── DASHBOARD ─────────────────────────────────────────────────
    '/api/dashboard/kpis': {
      get: {
        tags: ['Dashboard'], summary: 'KPIs globaux du tableau de bord',
        responses: {
          200: { description: 'KPIs', content: { 'application/json': { schema: { type: 'object' } } } },
        },
      },
    },
    '/api/dashboard/alerts': {
      get: {
        tags: ['Dashboard'], summary: 'Alertes actives',
        responses: {
          200: { description: 'Liste des alertes', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
        },
      },
    },

    // ── PROGRAMMES ────────────────────────────────────────────────
    '/api/programs': {
      get: {
        tags: ['Programmes'], summary: 'Liste des programmes NDT',
        responses: {
          200: { description: 'Programmes', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Program' } } } } },
        },
      },
    },
    '/api/programs/{id}': {
      get: {
        tags: ['Programmes'], summary: "Détail d'un programme avec ses projets",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Programme + projets', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/Program' }, { type: 'object', properties: { projects: { type: 'array', items: { $ref: '#/components/schemas/Project' } } } }] } } } },
          404: { description: 'Introuvable' },
        },
      },
      put: {
        tags: ['Programmes'], summary: 'Mettre à jour un programme (coordinator+)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              progress: { type: 'number' },
              status:   { type: 'string', enum: ['on_track','attention','risque','critique'] },
              budget:   { type: 'number' },
            },
          }}},
        },
        responses: {
          200: { description: 'Programme mis à jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/Program' } } } },
        },
      },
    },
    '/api/programs/{id}/projects': {
      get: {
        tags: ['Programmes'], summary: "Projets d'un programme",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Projets', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Project' } } } } },
        },
      },
      post: {
        tags: ['Programmes'], summary: 'Ajouter un projet à un programme',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['name'],
            properties: {
              name:        { type: 'string' },
              description: { type: 'string' },
              budget:      { type: 'number' },
              start_date:  { type: 'string', format: 'date' },
              end_date:    { type: 'string', format: 'date' },
              responsible: { type: 'string' },
            },
          }}},
        },
        responses: {
          201: { description: 'Projet créé', content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } },
        },
      },
    },
    '/api/programs/projects/{pid}': {
      put: {
        tags: ['Programmes'], summary: 'Mettre à jour un projet',
        parameters: [{ name: 'pid', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              name:        { type: 'string' },
              description: { type: 'string' },
              budget:      { type: 'number' },
              progress:    { type: 'number' },
              status:      { type: 'string' },
              start_date:  { type: 'string', format: 'date' },
              end_date:    { type: 'string', format: 'date' },
              responsible: { type: 'string' },
            },
          }}},
        },
        responses: {
          200: { description: 'Projet mis à jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } },
        },
      },
      delete: {
        tags: ['Programmes'], summary: 'Supprimer un projet (director/admin)',
        parameters: [{ name: 'pid', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Supprimé', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' } } } } } },
        },
      },
    },

    // ── DILIGENCES ────────────────────────────────────────────────
    '/api/diligences': {
      get: {
        tags: ['Diligences'], summary: 'Liste des diligences',
        parameters: [
          { name: 'status',   in: 'query', schema: { type: 'string', enum: ['planifie','en_cours','fait','annulee'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['critique','haute','moyenne'] } },
        ],
        responses: {
          200: { description: 'Diligences', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Diligence' } } } } },
        },
      },
      post: {
        tags: ['Diligences'], summary: 'Créer une diligence',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['title','source'],
            properties: {
              title:       { type: 'string' },
              source:      { type: 'string' },
              deadline:    { type: 'string', format: 'date' },
              responsible: { type: 'string' },
              priority:    { type: 'string', enum: ['critique','haute','moyenne'], default: 'moyenne' },
              type:        { type: 'string', default: 'Note' },
              notes:       { type: 'string' },
              status:      { type: 'string', enum: ['planifie','en_cours','fait','annulee'], default: 'planifie' },
            },
          }}},
        },
        responses: {
          201: { description: 'Diligence créée', content: { 'application/json': { schema: { $ref: '#/components/schemas/Diligence' } } } },
        },
      },
    },
    '/api/diligences/{id}': {
      get: {
        tags: ['Diligences'], summary: "Détail d'une diligence",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Diligence', content: { 'application/json': { schema: { $ref: '#/components/schemas/Diligence' } } } },
          404: { description: 'Introuvable' },
        },
      },
      put: {
        tags: ['Diligences'], summary: 'Modifier une diligence',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Diligence' } } },
        },
        responses: {
          200: { description: 'Mis à jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/Diligence' } } } },
        },
      },
      delete: {
        tags: ['Diligences'], summary: 'Supprimer une diligence (director/admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Supprimée' },
        },
      },
    },
    '/api/diligences/{id}/status': {
      patch: {
        tags: ['Diligences'], summary: "Changer le statut d'une diligence",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['status'],
            properties: { status: { type: 'string', enum: ['planifie','en_cours','fait','annulee'] } },
          }}},
        },
        responses: {
          200: { description: 'Statut mis à jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/Diligence' } } } },
        },
      },
    },

    // ── PARTENARIATS ──────────────────────────────────────────────
    '/api/partnerships': {
      get: {
        tags: ['Partenariats'], summary: 'Liste des partenariats',
        responses: {
          200: { description: 'Partenariats', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Partnership' } } } } },
        },
      },
      post: {
        tags: ['Partenariats'], summary: 'Créer un partenariat',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Partnership' } } },
        },
        responses: {
          201: { description: 'Partenariat créé', content: { 'application/json': { schema: { $ref: '#/components/schemas/Partnership' } } } },
        },
      },
    },
    '/api/partnerships/{id}': {
      put: {
        tags: ['Partenariats'], summary: 'Modifier un partenariat',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Partnership' } } },
        },
        responses: {
          200: { description: 'Mis à jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/Partnership' } } } },
        },
      },
      delete: {
        tags: ['Partenariats'], summary: 'Supprimer un partenariat (director/admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Supprimé' },
        },
      },
    },
    '/api/partnerships/documents': {
      get: {
        tags: ['Partenariats'], summary: 'Documents des partenariats',
        responses: {
          200: { description: 'Documents', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
        },
      },
      post: {
        tags: ['Partenariats'], summary: 'Uploader un document',
        requestBody: {
          content: { 'multipart/form-data': { schema: {
            type: 'object',
            properties: {
              file:           { type: 'string', format: 'binary' },
              partnership_id: { type: 'integer' },
              title:          { type: 'string' },
              type:           { type: 'string' },
            },
          }}},
        },
        responses: {
          201: { description: 'Document uploadé' },
        },
      },
    },

    // ── AUDIENCES ─────────────────────────────────────────────────
    '/api/audiences': {
      get: {
        tags: ['Audiences'], summary: 'Liste des audiences',
        responses: {
          200: { description: 'Audiences', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Audience' } } } } },
        },
      },
      post: {
        tags: ['Audiences'], summary: 'Créer une audience',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Audience' } } },
        },
        responses: {
          201: { description: 'Audience créée', content: { 'application/json': { schema: { $ref: '#/components/schemas/Audience' } } } },
        },
      },
    },
    '/api/audiences/{id}': {
      put: {
        tags: ['Audiences'], summary: 'Modifier une audience',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Audience' } } },
        },
        responses: {
          200: { description: 'Mis à jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/Audience' } } } },
        },
      },
      delete: {
        tags: ['Audiences'], summary: 'Supprimer une audience (director/admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Supprimée' } },
      },
    },
    '/api/audiences/{id}/status': {
      patch: {
        tags: ['Audiences'], summary: "Changer le statut d'une audience",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['status'],
            properties: { status: { type: 'string', enum: ['planifiee','tenue','annulee'] } },
          }}},
        },
        responses: {
          200: { description: 'Statut mis à jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/Audience' } } } },
        },
      },
    },

    // ── S&E ───────────────────────────────────────────────────────
    '/api/se/stats': {
      get: {
        tags: ['S&E'], summary: 'Statistiques globales S&E',
        responses: {
          200: { description: 'Stats', content: { 'application/json': { schema: { type: 'object' } } } },
        },
      },
    },
    '/api/se/indicators': {
      get: {
        tags: ['S&E'], summary: 'Indicateurs de performance NDT',
        responses: {
          200: { description: 'Indicateurs', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
        },
      },
    },
    '/api/se/revues': {
      get: {
        tags: ['S&E'], summary: 'Revues de performance',
        responses: {
          200: { description: 'Revues', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
        },
      },
    },
    '/api/se/evaluations': {
      get: {
        tags: ['S&E'], summary: 'Évaluations indépendantes',
        responses: {
          200: { description: 'Évaluations', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
        },
      },
    },

    // ── INSTANCES ─────────────────────────────────────────────────
    '/api/instances': {
      get: {
        tags: ['Instances'], summary: 'Instances de gouvernance',
        responses: {
          200: { description: 'Instances', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
        },
      },
      post: {
        tags: ['Instances'], summary: 'Créer une instance',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object', required: ['name','type'],
            properties: {
              name:        { type: 'string' },
              type:        { type: 'string' },
              frequency:   { type: 'string' },
              chair:       { type: 'string' },
              members:     { type: 'string' },
              next_date:   { type: 'string', format: 'date' },
              description: { type: 'string' },
            },
          }}},
        },
        responses: {
          201: { description: 'Instance créée' },
        },
      },
    },
    '/api/instances/{id}': {
      put: {
        tags: ['Instances'], summary: 'Modifier une instance',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          200: { description: 'Mis à jour' },
        },
      },
    },
    '/api/instances/contributions': {
      get: {
        tags: ['Instances'], summary: 'Contributions aux instances',
        responses: {
          200: { description: 'Contributions', content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } } },
        },
      },
      post: {
        tags: ['Instances'], summary: 'Ajouter une contribution',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              instance_id: { type: 'integer' },
              date:        { type: 'string', format: 'date' },
              type:        { type: 'string' },
              title:       { type: 'string' },
              description: { type: 'string' },
            },
          }}},
        },
        responses: {
          201: { description: 'Contribution ajoutée' },
        },
      },
    },

    // ── ÉQUIPE ────────────────────────────────────────────────────
    '/api/team': {
      get: {
        tags: ['Équipe'], summary: 'Membres de la Delivery Unit',
        responses: {
          200: { description: 'Équipe', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TeamMember' } } } } },
        },
      },
      post: {
        tags: ['Équipe'], summary: 'Ajouter un membre (admin)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamMember' } } },
        },
        responses: {
          201: { description: 'Membre ajouté', content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamMember' } } } },
        },
      },
    },
    '/api/team/{id}': {
      put: {
        tags: ['Équipe'], summary: 'Modifier un membre',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamMember' } } },
        },
        responses: {
          200: { description: 'Mis à jour', content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamMember' } } } },
        },
      },
      delete: {
        tags: ['Équipe'], summary: 'Supprimer un membre (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Supprimé' } },
      },
    },

    // ── AUDIT ─────────────────────────────────────────────────────
    '/api/audit': {
      get: {
        tags: ['Audit'], summary: 'Journal des actions (admin/director)',
        parameters: [
          { name: 'limit',    in: 'query', schema: { type: 'integer', default: 100 } },
          { name: 'offset',   in: 'query', schema: { type: 'integer', default: 0 } },
          { name: 'resource', in: 'query', schema: { type: 'string', example: 'diligences' } },
        ],
        responses: {
          200: { description: 'Journal', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } } } } },
          403: { description: 'Accès refusé' },
        },
      },
    },

    // ── SYSTÈME ───────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Système'], summary: 'Health check', security: [],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              status:    { type: 'string', example: 'ok' },
              version:   { type: 'string', example: '1.0.0' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          }}}},
        },
      },
    },
    '/api': {
      get: {
        tags: ['Système'], summary: 'Informations API', security: [],
        responses: {
          200: { description: 'Info API', content: { 'application/json': { schema: { type: 'object' } } } },
        },
      },
    },

  },
};

module.exports = { swaggerUi, spec };
