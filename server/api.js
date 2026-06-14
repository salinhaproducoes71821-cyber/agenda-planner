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

const crypto    = require('crypto');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt       = require('jsonwebtoken');
const morgan    = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { body, param, query, validationResult } = require('express-validator');

// Importa a camada de banco de dados (Mongo ou MySQL, conforme DB_TYPE)
const db = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Autenticação via Supabase ───────────────────────────────────────────────
// O backend NÃO emite mais tokens: ele apenas VALIDA o access token do Supabase.
// Login/cadastro/refresh são responsabilidade do Supabase, no app cliente.
//
// O Supabase pode assinar o access token de duas formas:
//   • HS256 (legacy "JWT Secret", simétrico)  → valida com SUPABASE_JWT_SECRET
//   • RS256/ES256 (signing keys, assimétrico)  → valida com a chave pública do
//     JWKS do projeto (SUPABASE_URL/auth/v1/.well-known/jwks.json)
// A escolha é automática pelo header `alg` do token, então funciona nos dois
// casos sem reconfiguração.

const IS_PROD = process.env.NODE_ENV === 'production';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';
const SUPABASE_URL        = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const JWKS_URL = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` : '';

const HAS_HS256 = SUPABASE_JWT_SECRET.length >= 20; // valida tokens HS256 legacy
const HAS_JWKS  = JWKS_URL.length > 0;              // valida tokens assimétricos

// Precisa de pelo menos uma forma de validar o token. Sem nenhuma, toda
// requisição autenticada seria rejeitada — em produção isso é erro fatal.
if (!HAS_HS256 && !HAS_JWKS) {
  const msg =
    'Nenhum método de validação de token configurado. Defina SUPABASE_JWT_SECRET ' +
    '(Settings → API → JWT Settings → JWT Secret) e/ou SUPABASE_URL (para validar ' +
    'tokens assinados por chave assimétrica via JWKS).';
  if (IS_PROD) { console.error(`[FATAL] ${msg}`); process.exit(1); }
  console.warn(`[AVISO] ${msg}`);
}

// Log de diagnóstico (apenas valores públicos). JSON.stringify revela aspas/
// espaços acidentais na variável (ex.: "https://...co " com espaço no fim).
console.log(
  `[auth-config] HAS_HS256=${HAS_HS256} HAS_JWKS=${HAS_JWKS} ` +
  `SUPABASE_URL=${JSON.stringify(process.env.SUPABASE_URL || null)} ` +
  `JWKS_URL=${JSON.stringify(JWKS_URL)}`
);

// Cache simples do JWKS (chaves públicas do Supabase). Recarrega quando expira
// o TTL ou quando aparece um `kid` desconhecido (rotação de chave).
let _jwksCache = { keys: [], fetchedAt: 0 };
const JWKS_TTL_MS = 10 * 60 * 1000;

async function getSupabasePublicKey(kid) {
  if (!JWKS_URL) throw new Error('SUPABASE_URL não configurado para validação assimétrica.');
  const fresh = Date.now() - _jwksCache.fetchedAt < JWKS_TTL_MS;
  let jwk = fresh ? _jwksCache.keys.find(k => k.kid === kid) : null;
  if (!jwk) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error(`Falha ao buscar JWKS (${res.status}).`);
    const data = await res.json();
    _jwksCache = { keys: Array.isArray(data.keys) ? data.keys : [], fetchedAt: Date.now() };
    jwk = _jwksCache.keys.find(k => k.kid === kid);
  }
  if (!jwk) throw new Error('Chave de assinatura não encontrada no JWKS.');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBAIS
// ═══════════════════════════════════════════════════════════════════════════

// Confia em exatamente 1 proxy (Railway/Heroku) para que req.ip e o rate-limit
// vejam o IP real do cliente. NUNCA usar `true`: permitiria spoof de
// X-Forwarded-For e bypass total do rate limiting.
app.set('trust proxy', 1);

// Cabeçalhos de segurança HTTP
app.use(helmet());

// Logs (desabilitado em testes)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
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
app.use(express.json({ limit: '10kb' }));

// Arquivos estáticos de música (sem autenticação)
app.use('/music', express.static('public/music'));

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
 * Remove caracteres perigosos para evitar XSS/injection
 */
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'`]/g, '').trim();
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

const authenticate = async (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.decode(token, { complete: true });
    const alg = decoded?.header?.alg;
    if (!alg) throw new Error('Token malformado.');

    const opts = { audience: 'authenticated' };
    let payload;
    if (alg === 'HS256') {
      // Token assinado com o legacy JWT Secret (simétrico).
      if (!HAS_HS256) throw new Error('Token HS256 recebido, mas SUPABASE_JWT_SECRET não está configurado.');
      payload = jwt.verify(token, SUPABASE_JWT_SECRET, { ...opts, algorithms: ['HS256'] });
    } else if (alg === 'RS256' || alg === 'ES256') {
      // Token assinado com signing key assimétrica — valida via JWKS.
      const key = await getSupabasePublicKey(decoded.header.kid);
      payload = jwt.verify(token, key, { ...opts, algorithms: [alg] });
    } else {
      throw new Error(`Algoritmo de assinatura não suportado: ${alg}`);
    }

    req.userId    = payload.sub;                     // UID do Supabase (UUID)
    req.userEmail = payload.email || '';
    req.userName  = payload.user_metadata?.name || '';
    next();
  } catch (err) {
    // Log de diagnóstico (server-side apenas — não vaza detalhes ao cliente).
    let hdr = {};
    try { hdr = jwt.decode(token, { complete: true })?.header || {}; } catch {}
    console.warn(
      `[auth] falha na validação: ${err.name || 'Error'}: ${err.message} ` +
      `| alg=${hdr.alg || '?'} kid=${hdr.kid || '-'} ` +
      `| HAS_HS256=${HAS_HS256} HAS_JWKS=${HAS_JWKS}`
    );
    const msg = err.name === 'TokenExpiredError'
      ? 'Token expirado. Faça login novamente.'
      : 'Token inválido.';
    return res.status(401).json({ error: msg });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// VALIDADORES REUTILIZÁVEIS
// ═══════════════════════════════════════════════════════════════════════════

const eventValidators = [
  body('titulo')
    .trim()
    .isLength({ min: 1, max: 120 }).withMessage('Título obrigatório (máx. 120 chars)'),
  body('data')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Data no formato AAAA-MM-DD'),
  body('hora')
    .matches(/^\d{2}:\d{2}$/).withMessage('Hora no formato HH:MM'),
  body('cor')
    .optional()
    .matches(/^#[0-9a-fA-F]{6}$/).withMessage('Cor hexadecimal inválida'),
  body('lembrete')
    .optional()
    .isBoolean(),
  body('alarmSound')
    .optional()
    .isIn(['gentle', 'birds', 'piano', 'classic', 'vibrate'])
    .withMessage('Som de alarme inválido'),
  body('descricao')
    .optional()
    .isLength({ max: 500 }).withMessage('Descrição máx. 500 chars'),
];

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
    console.error('[GET /users/me]', err);
    return res.status(500).json({ error: 'Erro ao buscar usuário.' });
  }
});

// PUT /api/users/profile
app.put('/api/users/profile',
  authenticate,
  [body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Nome: 2–80 caracteres')],
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
      .trim()
      .notEmpty().withMessage('URI da imagem inválida')
      .isLength({ max: 2048 }).withMessage('URI da imagem muito longa (máx. 2048).')
      .not().matches(/^\s*(javascript|vbscript|data:text\/html)/i)
      .withMessage('Esquema de URI não permitido.'),
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
  [query('mes').optional().matches(/^\d{4}-\d{2}$/).withMessage('Mês no formato YYYY-MM')],
  validate,
  async (req, res) => {
    try {
      const events = req.query.mes
        ? await db.getEventsByMonth(req.userId, req.query.mes)
        : await db.getEventsByUser(req.userId);
      return res.json(events);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar eventos.' });
    }
  }
);

// GET /api/events/:id
app.get('/api/events/:id',
  authenticate,
  [param('id').notEmpty()],
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
      id:         uuidv4(),
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
    return res.status(500).json({ error: 'Erro ao criar evento.' });
  }
});

// PUT /api/events/:id
app.put('/api/events/:id',
  authenticate,
  [param('id').notEmpty(), ...eventValidators],
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
  [param('id').notEmpty()],
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
    query('q').optional().isString().withMessage('q inválido').trim().isLength({ max: 200 }),
    query('tag').optional().isString().withMessage('tag inválida').trim().isLength({ max: 50 }),
  ],
  validate,
  async (req, res) => {
  try {
    const notes = await db.getNotesByUser(req.userId, {
      q:   req.query.q,
      tag: req.query.tag,
    });
    return res.json(notes);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar notas.' });
  }
});

// GET /api/notes/:id
app.get('/api/notes/:id', authenticate, async (req, res) => {
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
  [
    body('titulo').optional().isLength({ max: 200 }).withMessage('Título máx. 200 chars'),
    body('conteudo').optional().isLength({ max: 50000 }).withMessage('Conteúdo máx. 50.000 chars'),
    body('tags').optional().isArray({ max: 20 }).withMessage('Máx. 20 tags'),
  ],
  validate,
  async (req, res) => {
    try {
      const { titulo = '', conteudo = '', tags = [] } = req.body;
      const note = await db.createNote({
        id:        uuidv4(),
        userId:    req.userId,
        titulo:    sanitize(titulo),
        conteudo,
        tags:      tags.map(t => sanitize(String(t).toLowerCase())).slice(0, 20),
        updatedAt: new Date().toISOString().split('T')[0],
      });
      return res.status(201).json(note);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao criar nota.' });
    }
  }
);

// PUT /api/notes/:id
app.put('/api/notes/:id',
  authenticate,
  [
    param('id').notEmpty(),
    body('titulo').optional().isLength({ max: 200 }),
    body('conteudo').optional().isLength({ max: 50000 }),
    body('tags').optional().isArray({ max: 20 }),
  ],
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
app.delete('/api/notes/:id', authenticate, async (req, res) => {
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
app.get('/api/moods', authenticate, async (req, res) => {
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
    body('data').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Data inválida'),
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
  console.error('[ERRO NÃO TRATADO]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

(async () => {
  try {
    await db.connect();
    app.listen(PORT, () => {
      console.log(`🗓  Agenda API rodando na porta ${PORT} [${process.env.NODE_ENV || 'development'}] [DB: ${process.env.DB_TYPE || 'mongo'}]`);
    });
  } catch (err) {
    console.error('❌ Falha ao conectar ao banco de dados:', err);
    process.exit(1);
  }
})();

module.exports = app;
