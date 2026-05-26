// ═══════════════════════════════════════════════════════════════════════════
// backend/api.js — AGENDA APP v3.0
// Node.js + Express — REST API completa
//
// DEPENDÊNCIAS:
//   npm install express cors helmet express-rate-limit bcryptjs jsonwebtoken
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
//   # JWT
//   JWT_SECRET=sua_chave_secreta_longa
//   JWT_REFRESH_SECRET=outra_chave_secreta
//   JWT_EXPIRES_IN=15m
//   JWT_REFRESH_EXPIRES_IN=7d
//
//   # CORS
//   ALLOWED_ORIGINS=http://localhost:8081,https://seudominio.com
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const morgan    = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { body, param, query, validationResult } = require('express-validator');

// Importa a camada de banco de dados (Mongo ou MySQL, conforme DB_TYPE)
const db = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Constantes JWT ──────────────────────────────────────────────────────────

const JWT_SECRET         = process.env.JWT_SECRET         || 'TROQUE_EM_PRODUCAO';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'TROQUE_REFRESH_EM_PRODUCAO';
const JWT_EXPIRES_IN     = process.env.JWT_EXPIRES_IN     || '15m';
const JWT_REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS      = 12;

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBAIS
// ═══════════════════════════════════════════════════════════════════════════

// Cabeçalhos de segurança HTTP
app.use(helmet());

// Logs (desabilitado em testes)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : '*';

app.use(cors({
  origin:         allowedOrigins,
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

// Auth: 10 req / 15 min (proteção contra brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
});

app.use('/api/',      generalLimiter);
app.use('/api/auth/', authLimiter);

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
 * Gera par de tokens JWT (access + refresh)
 */
const generateTokens = (userId) => {
  const accessToken  = jwt.sign(
    { sub: String(userId), type: 'access'  },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  const refreshToken = jwt.sign(
    { sub: String(userId), type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXP }
  );
  return { accessToken, refreshToken };
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

const authenticate = (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    if (payload.type !== 'access') throw new Error('Tipo de token inválido');
    req.userId = payload.sub;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Token expirado. Faça login novamente.'
      : 'Token inválido.';
    return res.status(401).json({ error: msg });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// VALIDADORES REUTILIZÁVEIS
// ═══════════════════════════════════════════════════════════════════════════

const passwordRules = [
  body('password')
    .isLength({ min: 8 }).withMessage('Senha: mínimo 8 caracteres')
    .matches(/[A-Z]/).withMessage('Senha: ao menos uma letra maiúscula')
    .matches(/[a-z]/).withMessage('Senha: ao menos uma letra minúscula')
    .matches(/\d/).withMessage('Senha: ao menos um número')
    .matches(/[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]/).withMessage('Senha: ao menos um caractere especial'),
];

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
// ROTAS — AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register',
  [
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Nome: 2–80 caracteres'),
    body('email').trim().toLowerCase().isEmail().withMessage('E-mail inválido').normalizeEmail(),
    ...passwordRules,
    body('confirmPassword')
      .custom((val, { req }) => val === req.body.password)
      .withMessage('As senhas não coincidem'),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      const existing = await db.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'E-mail já cadastrado.' });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = await db.createUser({
        id:   uuidv4(),
        name: sanitize(name),
        email,
        passwordHash,
      });

      const { accessToken, refreshToken } = generateTokens(user.id);
      await db.saveRefreshToken(user.id, refreshToken);

      return res.status(201).json({
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar || null },
      });
    } catch (err) {
      console.error('[POST /register]', err);
      return res.status(500).json({ error: 'Erro ao criar conta.' });
    }
  }
);

// POST /api/auth/login
app.post('/api/auth/login',
  [
    body('email').trim().toLowerCase().isEmail().withMessage('E-mail inválido').normalizeEmail(),
    body('password').notEmpty().withMessage('Informe a senha'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await db.getUserByEmail(email);
      if (!user) {
        // Hash dummy para tempo constante (evita user enumeration)
        await bcrypt.hash('dummy_timing_protection', BCRYPT_ROUNDS);
        return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      }

      const { accessToken, refreshToken } = generateTokens(user.id);
      await db.saveRefreshToken(user.id, refreshToken);

      return res.json({
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar || null },
      });
    } catch (err) {
      console.error('[POST /login]', err);
      return res.status(500).json({ error: 'Erro ao autenticar.' });
    }
  }
);

// POST /api/auth/refresh — Rotação de refresh token
app.post('/api/auth/refresh',
  [body('refreshToken').notEmpty().withMessage('refreshToken obrigatório')],
  validate,
  async (req, res) => {
    const { refreshToken } = req.body;
    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      if (payload.type !== 'refresh') throw new Error('Tipo inválido');

      const stored = await db.getRefreshToken(payload.sub, refreshToken);
      if (!stored) {
        return res.status(401).json({ error: 'Token revogado ou inválido.' });
      }

      // Rotação: invalida o token usado, emite um novo par
      await db.deleteRefreshToken(payload.sub, refreshToken);
      const { accessToken, refreshToken: newRefresh } = generateTokens(payload.sub);
      await db.saveRefreshToken(payload.sub, newRefresh);

      return res.json({ accessToken, refreshToken: newRefresh });
    } catch (err) {
      return res.status(401).json({ error: 'Token de atualização inválido ou expirado.' });
    }
  }
);

// POST /api/auth/logout
app.post('/api/auth/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.deleteRefreshToken(req.userId, refreshToken);
    }
    return res.json({ message: 'Sessão encerrada.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao encerrar sessão.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS — USUÁRIO
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/users/me
app.get('/api/users/me', authenticate, async (req, res) => {
  try {
    const user = await db.getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    return res.json({ id: user.id, name: user.name, email: user.email, avatar: user.avatar || null });
  } catch (err) {
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
      const updated = await db.updateUser(req.userId, { name: sanitize(req.body.name) });
      return res.json({ id: updated.id, name: updated.name, email: updated.email, avatar: updated.avatar || null });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    }
  }
);

// PUT /api/users/avatar
app.put('/api/users/avatar',
  authenticate,
  [body('uri').trim().notEmpty().withMessage('URI da imagem inválida')],
  validate,
  async (req, res) => {
    try {
      const updated = await db.updateUser(req.userId, { avatar: req.body.uri });
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
app.get('/api/notes', authenticate, async (req, res) => {
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
