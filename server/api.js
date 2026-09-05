// ═══════════════════════════════════════════════════════════════════════════
// backend/api.js — AGENDA APP v3.0
// Node.js + Express — REST API completa
//
// DEPENDÊNCIAS:
//   npm install express cors helmet express-rate-limit jsonwebtoken
//   npm install express-validator dotenv morgan uuid
//   npm install mongoose          (para MongoDB)
//   npm install mysql2 sequelize  (para MySQL)
//
// VARIÁVEIS DE AMBIENTE (.env):
//   PORT=3000
//   NODE_ENV=development
//   DB_TYPE=mongo              # 'mongo' ou 'mysql'
//
//   # MongoDB
//   MONGO_URI=mongodb://localhost:27017/agenda
//
//   # MySQL
//   MYSQL_HOST=localhost
//   MYSQL_PORT=3306
//   MYSQL_USER=root
//   MYSQL_PASSWORD=senha
//   MYSQL_DATABASE=agenda
//
//   # Supabase (autenticação) — defina ao menos um:
//   SUPABASE_JWT_SECRET=...   # HS256 legacy — Settings → API → JWT Settings
//   SUPABASE_URL=https://<projeto>.supabase.co  # RS256/ES256 via JWKS
//
//   # CORS
//   ALLOWED_ORIGINS=http://localhost:8081,https://seudominio.com
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

require('dotenv').config();

const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { createAuthenticator } = require('./auth');
const { isDate, eventValidators, noteValidators, pageValidators, page } = require('./validation');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan    = require('morgan');

const { body, param, query, validationResult } = require('express-validator');

// Importa a camada de banco de dados (Mongo ou MySQL, conforme DB_TYPE)
const db = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

const IS_PROD = process.env.NODE_ENV === 'production';
const authenticate = createAuthenticator();

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBAIS
// ═══════════════════════════════════════════════════════════════════════════

// Confie apenas nos endereços/CIDRs dos proxies controlados pelo deploy.
app.set('trust proxy', process.env.TRUST_PROXY ? process.env.TRUST_PROXY.split(',').map(v => v.trim()) : false);

// Cabeçalhos de segurança HTTP
app.use(helmet());

// Logs (desabilitado em testes)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :status :response-time ms'));
}

// CORS — allowlist explícita (nunca '*'). Sem ALLOWED_ORIGINS:
//   • produção → CORS cross-origin desabilitado (apps nativos não mandam Origin
//     e não são afetados; bloqueia páginas web maliciosas de origens arbitrárias)
//   • dev      → libera localhost para o Expo web / dev tools
const corsOrigin = (() => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  }
  if (IS_PROD) {
    console.warn('[AVISO] ALLOWED_ORIGINS não definido em produção — CORS cross-origin desabilitado.');
    return false;
  }
  return [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
})();

app.use(cors({
  origin:         corsOrigin,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON — limite 10 KB para evitar ataques de payload gigante
app.use('/api/notes', express.json({ limit: '320kb' }));
app.use(express.json({ limit: '10kb' }));

// Arquivos estáticos de música (sem autenticação)
app.use('/music', express.static(path.join(__dirname, 'public/music')));

// ─── Rate Limiting ───────────────────────────────────────────────────────────

// Geral: 100 req / 15 min
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Muitas requisições. Tente novamente em breve.' },
});

app.use('/api/', generalLimiter);

// ═══════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normaliza espaços sem destruir pontuação legítima.
 */
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim();
};

/**
 * Middleware que responde 422 se express-validator encontrar erros
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE DE AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS — USUÁRIO / PERFIL
//
// A autenticação (login/cadastro/sessão) é feita pelo Supabase no app cliente.
// Aqui só mantemos um perfil leve (nome/avatar) chaveado pelo UID do Supabase.
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/users/me — cria o perfil na primeira chamada (lazy)
app.get('/api/users/me', authenticate, async (req, res) => {
  try {
    const profile = await db.getOrCreateProfile(req.userId, {
      email: req.userEmail,
      name:  sanitize(req.userName),
    });
    return res.json({ id: profile.id, name: profile.name, email: profile.email, avatar: profile.avatar || null });
  } catch (err) {
    console.error('[GET /users/me]', err.name);
    return res.status(500).json({ error: 'Erro ao buscar usuário.' });
  }
});

// PUT /api/users/profile
app.put('/api/users/profile',
  authenticate,
  [body('name').isString().bail().trim().isLength({ min: 2, max: 80 }).withMessage('Nome: 2–80 caracteres')],
  validate,
  async (req, res) => {
    try {
      const updated = await db.updateProfile(req.userId, { name: sanitize(req.body.name) });
      return res.json({ id: updated.id, name: updated.name, email: updated.email, avatar: updated.avatar || null });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    }
  }
);

// PUT /api/users/avatar
app.put('/api/users/avatar',
  authenticate,
  [
    body('uri')
      .isString().bail()
      .trim()
      .notEmpty().withMessage('URI da imagem inválida')
      .isLength({ max: 2048 }).withMessage('URI da imagem muito longa (máx. 2048).')
      .isURL({ protocols: ['https'], require_protocol: true, disallow_auth: true })
      .withMessage('Avatar remoto deve usar uma URL HTTPS válida.'),
  ],
  validate,
  async (req, res) => {
    try {
      const updated = await db.updateProfile(req.userId, { avatar: req.body.uri });
      return res.json({ avatar: updated.avatar });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar avatar.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS — EVENTOS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/events?mes=YYYY-MM
app.get('/api/events',
  authenticate,
  [...pageValidators, query('mes').optional().custom(value => typeof value === 'string' && isDate(value + '-01')).withMessage('Mês inválido; use YYYY-MM')],
  validate,
  async (req, res) => {
    try {
      const events = req.query.mes
        ? await db.getEventsByMonth(req.userId, req.query.mes, page(req))
        : await db.getEventsByUser(req.userId, page(req));
      return res.json(events);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar eventos.' });
    }
  }
);

// GET /api/events/:id
app.get('/api/events/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const event = await db.getEventById(req.params.id, req.userId);
      if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
      return res.json(event);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar evento.' });
    }
  }
);

// POST /api/events
app.post('/api/events', authenticate, eventValidators, validate, async (req, res) => {
  try {
    const { titulo, data, hora, cor, lembrete, alarmSound, descricao } = req.body;
    const event = await db.createEvent({
      id:         req.body.id || randomUUID(),
      userId:     req.userId,
      titulo:     sanitize(titulo),
      data,
      hora,
      cor:        cor        || '#c9923a',
      lembrete:   lembrete   ?? false,
      alarmSound: alarmSound || 'gentle',
      descricao:  sanitize(descricao || ''),
    });
    return res.status(201).json(event);
  } catch (err) {
    return res.status(err.status === 409 ? 409 : 500).json({ error: err.status === 409 ? 'Identificador indisponível.' : 'Erro ao criar evento.' });
  }
});

// PUT /api/events/:id
app.put('/api/events/:id',
  authenticate,
  [param('id').isUUID(), ...eventValidators],
  validate,
  async (req, res) => {
    try {
      const existing = await db.getEventById(req.params.id, req.userId);
      if (!existing) return res.status(404).json({ error: 'Evento não encontrado.' });

      const { titulo, data, hora, cor, lembrete, alarmSound, descricao } = req.body;
      const updated = await db.updateEvent(req.params.id, req.userId, {
        titulo:     sanitize(titulo),
        data,
        hora,
        cor:        cor        || existing.cor,
        lembrete:   lembrete   ?? existing.lembrete,
        alarmSound: alarmSound || existing.alarmSound,
        descricao:  sanitize(descricao || ''),
      });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar evento.' });
    }
  }
);

// DELETE /api/events/:id
app.delete('/api/events/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const deleted = await db.deleteEvent(req.params.id, req.userId);
      if (!deleted) return res.status(404).json({ error: 'Evento não encontrado.' });
      return res.json({ message: 'Evento removido.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao remover evento.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS — NOTAS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/notes?q=termo&tag=pessoal
app.get('/api/notes',
  authenticate,
  [
    ...pageValidators,
    query('q').optional().isString().withMessage('q inválido').trim().isLength({ max: 200 }),
    query('tag').optional().isString().withMessage('tag inválida').trim().isLength({ max: 50 }),
  ],
  validate,
  async (req, res) => {
  try {
    const notes = await db.getNotesByUser(req.userId, {
      ...page(req),
      q:   req.query.q,
      tag: req.query.tag,
    });
    return res.json(notes);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar notas.' });
  }
});

// GET /api/notes/:id
app.get('/api/notes/:id', authenticate, [param('id').isUUID()], validate, async (req, res) => {
  try {
    const note = await db.getNoteById(req.params.id, req.userId);
    if (!note) return res.status(404).json({ error: 'Nota não encontrada.' });
    return res.json(note);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar nota.' });
  }
});

// POST /api/notes
app.post('/api/notes',
  authenticate,
  noteValidators,
  validate,
  async (req, res) => {
    try {
      const { titulo = '', conteudo = '', tags = [] } = req.body;
      const note = await db.createNote({
        id:        req.body.id || randomUUID(),
        userId:    req.userId,
        titulo:    sanitize(titulo),
        conteudo,
        tags:      tags.map(t => sanitize(String(t).toLowerCase())).slice(0, 20),
        updatedAt: new Date().toISOString().split('T')[0],
      });
      return res.status(201).json(note);
    } catch (err) {
      return res.status(err.status === 409 ? 409 : 500).json({ error: err.status === 409 ? 'Identificador indisponível.' : 'Erro ao criar nota.' });
    }
  }
);

// PUT /api/notes/:id
app.put('/api/notes/:id',
  authenticate,
  [param('id').isUUID(), ...noteValidators],
  validate,
  async (req, res) => {
    try {
      const existing = await db.getNoteById(req.params.id, req.userId);
      if (!existing) return res.status(404).json({ error: 'Nota não encontrada.' });

      const { titulo, conteudo, tags } = req.body;
      const updated = await db.updateNote(req.params.id, req.userId, {
        titulo:    titulo    !== undefined ? sanitize(titulo)                                            : existing.titulo,
        conteudo:  conteudo  !== undefined ? conteudo                                                   : existing.conteudo,
        tags:      tags      !== undefined ? tags.map(t => sanitize(String(t).toLowerCase())).slice(0, 20) : existing.tags,
        updatedAt: new Date().toISOString().split('T')[0],
      });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar nota.' });
    }
  }
);

// DELETE /api/notes/:id
app.delete('/api/notes/:id', authenticate, [param('id').isUUID()], validate, async (req, res) => {
  try {
    const deleted = await db.deleteNote(req.params.id, req.userId);
    if (!deleted) return res.status(404).json({ error: 'Nota não encontrada.' });
    return res.json({ message: 'Nota removida.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao remover nota.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS — HUMOR
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/moods?days=14
app.get('/api/moods', authenticate, [query('days').optional().isInt({ min: 1, max: 90 }).toInt()], validate, async (req, res) => {
  try {
    const days  = Math.min(parseInt(req.query.days, 10) || 14, 90);
    const moods = await db.getMoodsByUser(req.userId, days);
    return res.json(moods);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar humores.' });
  }
});

// POST /api/moods — cria ou atualiza o humor do dia
app.post('/api/moods',
  authenticate,
  [
    body('nivel').isInt({ min: 1, max: 5 }).withMessage('Nível deve ser entre 1 e 5'),
    body('data').optional().custom(isDate).withMessage('Data inválida'),
  ],
  validate,
  async (req, res) => {
    try {
      const data = req.body.data || new Date().toISOString().split('T')[0];
      const mood = await db.upsertMood(req.userId, data, req.body.nivel);
      return res.status(201).json(mood);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao salvar humor.' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: process.env.DB_TYPE || 'mongo', timestamp: new Date().toISOString() });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// ─── Error handler global ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500;
  if (status === 500) console.error('[request] internal error', err.name);
  res.status(status).json({ error: status === 413 ? 'Conteúdo excede o limite permitido.' : status === 400 ? 'JSON inválido.' : 'Erro interno do servidor.' });
});

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) (async () => {
  try {
    await db.connect();
    app.listen(PORT, () => {
      console.log(`🗓  Agenda API rodando na porta ${PORT} [${process.env.NODE_ENV || 'development'}] [DB: ${process.env.DB_TYPE || 'mongo'}]`);
    });
  } catch (err) {
    console.error('❌ Falha ao conectar ao banco de dados:', err.name);
    process.exit(1);
  }
})();

module.exports = app;
