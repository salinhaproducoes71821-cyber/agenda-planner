// ═══════════════════════════════════════════════════════════════════════════
// backend/database.js — AGENDA APP v3.0
// Camada de dados com dois adaptadores intercambiáveis:
//   • MongoDB  via Mongoose
//   • MySQL    via mysql2 + Sequelize
//
// Selecione o banco pelo .env:
//   DB_TYPE=mongo    → usa MongoDB
//   DB_TYPE=mysql    → usa MySQL
//
// A API pública é idêntica nos dois casos — o backend (api.js)
// não precisa saber qual banco está ativo.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const crypto = require('crypto');

// Refresh tokens são JWTs de alta entropia, então guardamos só o hash SHA-256
// (sem necessidade de salt). Um vazamento do banco não expõe tokens utilizáveis.
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const DB_TYPE = (process.env.DB_TYPE || 'mongo').toLowerCase();

if (DB_TYPE === 'mysql') {
  module.exports = createMySQLAdapter();
} else {
  module.exports = createMongoAdapter();
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTADOR — MONGODB  (via Mongoose)
//
// Variáveis de ambiente necessárias:
//   MONGO_URI=mongodb://localhost:27017/agenda
//   (ou MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/agenda)
// ═══════════════════════════════════════════════════════════════════════════

function createMongoAdapter() {
  const mongoose = require('mongoose');
  const { Schema, model, Types } = mongoose;

  // ─── Schemas ──────────────────────────────────────────────────────────────

  const UserSchema = new Schema({
    _id:          { type: String, default: () => new Types.ObjectId().toString() },
    name:         { type: String, required: true, trim: true, maxlength: 80 },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatar:       { type: String, default: null },
  }, { timestamps: true });

  const RefreshTokenSchema = new Schema({
    userId:    { type: String, required: true, index: true },
    token:     { type: String, required: true, unique: true },
    createdAt: { type: Date,   default: Date.now, expires: '7d' }, // TTL automático
  });

  const EventSchema = new Schema({
    _id:        { type: String, default: () => new Types.ObjectId().toString() },
    userId:     { type: String, required: true, index: true },
    titulo:     { type: String, required: true, maxlength: 120 },
    data:       { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    hora:       { type: String, required: true, default: '09:00', match: /^\d{2}:\d{2}$/ },
    cor:        { type: String, default: '#c9923a', match: /^#[0-9a-fA-F]{6}$/ },
    lembrete:   { type: Boolean, default: false },
    alarmSound: { type: String, default: 'gentle', enum: ['gentle','birds','piano','classic','vibrate'] },
    descricao:  { type: String, default: '', maxlength: 500 },
  }, { timestamps: true });

  EventSchema.index({ userId: 1, data: 1 });

  const NoteSchema = new Schema({
    _id:       { type: String, default: () => new Types.ObjectId().toString() },
    userId:    { type: String, required: true, index: true },
    titulo:    { type: String, default: '', maxlength: 200 },
    conteudo:  { type: String, default: '', maxlength: 50000 },
    tags:      { type: [String], default: [] },
    updatedAt: { type: String },
  }, { timestamps: true });

  NoteSchema.index({ userId: 1, updatedAt: -1 });

  const MoodSchema = new Schema({
    userId: { type: String, required: true },
    data:   { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    nivel:  { type: Number, required: true, min: 1, max: 5 },
  }, { timestamps: true });

  MoodSchema.index({ userId: 1, data: 1 }, { unique: true });

  // ─── Models (lazy — criados apenas uma vez) ───────────────────────────────

  const User         = mongoose.models.User         || model('User',         UserSchema);
  const RefreshToken = mongoose.models.RefreshToken || model('RefreshToken', RefreshTokenSchema);
  const Event        = mongoose.models.Event        || model('Event',        EventSchema);
  const Note         = mongoose.models.Note         || model('Note',         NoteSchema);
  const Mood         = mongoose.models.Mood         || model('Mood',         MoodSchema);

  // ─── Mapeador: documento Mongoose → objeto plano ─────────────────────────

  const mapUser  = (d) => d ? ({ id: d._id, name: d.name, email: d.email, avatar: d.avatar, passwordHash: d.passwordHash }) : null;
  const mapEvent = (d) => d ? ({ id: d._id, userId: d.userId, titulo: d.titulo, data: d.data, hora: d.hora, cor: d.cor, lembrete: d.lembrete, alarmSound: d.alarmSound, descricao: d.descricao }) : null;
  const mapNote  = (d) => d ? ({ id: d._id, userId: d.userId, titulo: d.titulo, conteudo: d.conteudo, tags: d.tags, updatedAt: d.updatedAt }) : null;
  const mapMood  = (d) => d ? ({ id: d._id?.toString(), userId: d.userId, data: d.data, nivel: d.nivel }) : null;

  // ─── API pública ──────────────────────────────────────────────────────────

  return {
    // ── Conexão ──────────────────────────────────────────────────────────────
    connect: async () => {
      const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/agenda';
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('[MongoDB] Conectado:', uri.replace(/:\/\/.*@/, '://***@'));
    },

    close: async () => {
      await mongoose.connection.close();
    },

    // ── Usuários ──────────────────────────────────────────────────────────────
    getUserByEmail: async (email) => {
      const doc = await User.findOne({ email: email.toLowerCase() }).lean();
      return mapUser(doc);
    },

    getUserById: async (id) => {
      const doc = await User.findById(id).lean();
      return mapUser(doc);
    },

    createUser: async ({ id, name, email, passwordHash }) => {
      const doc = await User.create({ _id: id, name, email, passwordHash });
      return mapUser(doc);
    },

    updateUser: async (id, fields) => {
      const doc = await User.findByIdAndUpdate(id, { $set: fields }, { new: true }).lean();
      return mapUser(doc);
    },

    // ── Refresh tokens (guardados como hash SHA-256) ───────────────────────────
    saveRefreshToken: async (userId, token) => {
      await RefreshToken.create({ userId, token: hashToken(token) });
    },

    getRefreshToken: async (userId, token) => {
      return RefreshToken.findOne({ userId, token: hashToken(token) }).lean();
    },

    deleteRefreshToken: async (userId, token) => {
      await RefreshToken.deleteOne({ userId, token: hashToken(token) });
    },

    // ── Eventos ───────────────────────────────────────────────────────────────
    getEventsByUser: async (userId) => {
      const docs = await Event.find({ userId }).sort({ data: 1, hora: 1 }).lean();
      return docs.map(mapEvent);
    },

    getEventsByMonth: async (userId, mes) => {
      // mes = 'YYYY-MM' — usa regex para corresponder ao prefixo da data
      const docs = await Event.find({ userId, data: { $regex: `^${mes}` } }).sort({ data: 1, hora: 1 }).lean();
      return docs.map(mapEvent);
    },

    getEventById: async (id, userId) => {
      const doc = await Event.findOne({ _id: id, userId }).lean();
      return mapEvent(doc);
    },

    createEvent: async (event) => {
      const doc = await Event.create({
        _id: event.id, userId: event.userId, titulo: event.titulo,
        data: event.data, hora: event.hora, cor: event.cor,
        lembrete: event.lembrete, alarmSound: event.alarmSound, descricao: event.descricao,
      });
      return mapEvent(doc);
    },

    updateEvent: async (id, userId, fields) => {
      const doc = await Event.findOneAndUpdate({ _id: id, userId }, { $set: fields }, { new: true }).lean();
      return mapEvent(doc);
    },

    deleteEvent: async (id, userId) => {
      const res = await Event.deleteOne({ _id: id, userId });
      return res.deletedCount > 0;
    },

    // ── Notas ─────────────────────────────────────────────────────────────────
    getNotesByUser: async (userId, { q, tag } = {}) => {
      const filter = { userId };
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ titulo: re }, { conteudo: re }];
      }
      if (tag) {
        filter.tags = tag.toLowerCase();
      }
      const docs = await Note.find(filter).sort({ updatedAt: -1 }).lean();
      return docs.map(mapNote);
    },

    getNoteById: async (id, userId) => {
      const doc = await Note.findOne({ _id: id, userId }).lean();
      return mapNote(doc);
    },

    createNote: async (note) => {
      const doc = await Note.create({
        _id: note.id, userId: note.userId, titulo: note.titulo,
        conteudo: note.conteudo, tags: note.tags, updatedAt: note.updatedAt,
      });
      return mapNote(doc);
    },

    updateNote: async (id, userId, fields) => {
      const doc = await Note.findOneAndUpdate({ _id: id, userId }, { $set: fields }, { new: true }).lean();
      return mapNote(doc);
    },

    deleteNote: async (id, userId) => {
      const res = await Note.deleteOne({ _id: id, userId });
      return res.deletedCount > 0;
    },

    // ── Humores ───────────────────────────────────────────────────────────────
    getMoodsByUser: async (userId, days) => {
      const desde = new Date();
      desde.setDate(desde.getDate() - days);
      const desdStr = desde.toISOString().split('T')[0];

      const docs = await Mood.find({ userId, data: { $gte: desdStr } }).sort({ data: 1 }).lean();
      return docs.map(mapMood);
    },

    upsertMood: async (userId, data, nivel) => {
      const doc = await Mood.findOneAndUpdate(
        { userId, data },
        { $set: { nivel } },
        { new: true, upsert: true }
      ).lean();
      return mapMood(doc);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTADOR — MYSQL  (via Sequelize + mysql2)
//
// Variáveis de ambiente necessárias:
//   MYSQL_HOST=localhost
//   MYSQL_PORT=3306
//   MYSQL_USER=root
//   MYSQL_PASSWORD=senha
//   MYSQL_DATABASE=agenda
// ═══════════════════════════════════════════════════════════════════════════

function createMySQLAdapter() {
  const { Sequelize, DataTypes, Op } = require('sequelize');

  // ─── Conexão ──────────────────────────────────────────────────────────────

  const sequelize = new Sequelize({
    dialect:  'mysql',
    host:     process.env.MYSQL_HOST     || 'localhost',
    port:     parseInt(process.env.MYSQL_PORT || '3306', 10),
    username: process.env.MYSQL_USER     || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'agenda',
    logging:  process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max:     10,
      min:     0,
      acquire: 30000,
      idle:    10000,
    },
    define: {
      // Usa snake_case nas colunas automaticamente
      underscored:    true,
      freezeTableName: false,
    },
    dialectOptions: {
      // Obrigatório para MySQL 8+
      charset: 'utf8mb4',
    },
  });

  // ─── Models ───────────────────────────────────────────────────────────────

  const User = sequelize.define('User', {
    id:           { type: DataTypes.STRING(36),  primaryKey: true },
    name:         { type: DataTypes.STRING(80),  allowNull: false },
    email:        { type: DataTypes.STRING(255), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
    avatar:       { type: DataTypes.TEXT,        allowNull: true, defaultValue: null },
  }, { tableName: 'users', timestamps: true, underscored: true });

  const RefreshToken = sequelize.define('RefreshToken', {
    id:     { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING(36),  allowNull: false, field: 'user_id' },
    token:  { type: DataTypes.TEXT,        allowNull: false, unique: true },
  }, { tableName: 'refresh_tokens', timestamps: true, updatedAt: false, underscored: true });

  const Event = sequelize.define('Event', {
    id:         { type: DataTypes.STRING(36),  primaryKey: true },
    userId:     { type: DataTypes.STRING(36),  allowNull: false, field: 'user_id' },
    titulo:     { type: DataTypes.STRING(120), allowNull: false },
    data:       { type: DataTypes.DATEONLY,    allowNull: false },
    hora:       { type: DataTypes.TIME,        allowNull: false, defaultValue: '09:00:00' },
    cor:        { type: DataTypes.STRING(7),   defaultValue: '#c9923a' },
    lembrete:   { type: DataTypes.BOOLEAN,     defaultValue: false },
    alarmSound: { type: DataTypes.STRING(20),  defaultValue: 'gentle', field: 'alarm_sound' },
    descricao:  { type: DataTypes.TEXT,        defaultValue: '' },
  }, { tableName: 'events', timestamps: true, underscored: true });

  const Note = sequelize.define('Note', {
    id:        { type: DataTypes.STRING(36),    primaryKey: true },
    userId:    { type: DataTypes.STRING(36),    allowNull: false, field: 'user_id' },
    titulo:    { type: DataTypes.STRING(200),   defaultValue: '' },
    conteudo:  { type: DataTypes.TEXT('long'),  defaultValue: '' },
    // Tags armazenadas como JSON string; MySQL 5.7+ suporta JSON nativo
    tagsRaw:   { type: DataTypes.JSON,          defaultValue: '[]', field: 'tags' },
    updatedAt: { type: DataTypes.DATEONLY,      field: 'updated_at' },
  }, {
    tableName: 'notes',
    timestamps: true,
    underscored: true,
    // Sequelize gerencia updatedAt automaticamente, mas precisamos do campo customizado também
  });

  const Mood = sequelize.define('Mood', {
    id:     { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING(36), allowNull: false, field: 'user_id' },
    data:   { type: DataTypes.DATEONLY,   allowNull: false },
    nivel:  { type: DataTypes.TINYINT,   allowNull: false, validate: { min: 1, max: 5 } },
  }, {
    tableName: 'moods',
    timestamps: false,
    indexes: [{ unique: true, fields: ['user_id', 'data'] }],
  });

  // ─── Mapeadores ───────────────────────────────────────────────────────────

  const mapUser = (r) => r ? ({
    id: r.id, name: r.name, email: r.email, avatar: r.avatar || null, passwordHash: r.passwordHash,
  }) : null;

  const mapEvent = (r) => r ? ({
    id: r.id, userId: r.userId, titulo: r.titulo,
    // Sequelize retorna DATEONLY como string 'YYYY-MM-DD', TIME como 'HH:MM:SS'
    data:       typeof r.data === 'object' ? r.data.toISOString().split('T')[0] : String(r.data),
    hora:       String(r.hora || '').slice(0, 5),
    cor:        r.cor, lembrete: !!r.lembrete, alarmSound: r.alarmSound, descricao: r.descricao,
  }) : null;

  const mapNote = (r) => r ? ({
    id: r.id, userId: r.userId, titulo: r.titulo, conteudo: r.conteudo,
    tags:      Array.isArray(r.tagsRaw) ? r.tagsRaw : (r.tagsRaw ? JSON.parse(r.tagsRaw) : []),
    updatedAt: typeof r.updatedAt === 'object' && r.updatedAt?.toISOString ? r.updatedAt.toISOString().split('T')[0] : String(r.updatedAt || ''),
  }) : null;

  const mapMood = (r) => r ? ({
    id: r.id, userId: r.userId,
    data:  typeof r.data === 'object' ? r.data.toISOString().split('T')[0] : String(r.data),
    nivel: r.nivel,
  }) : null;

  // ─── API pública ──────────────────────────────────────────────────────────

  return {
    // ── Conexão ──────────────────────────────────────────────────────────────
    connect: async () => {
      await sequelize.authenticate();
      // sync({ alter: true }) em dev; em produção use migrações Sequelize CLI
      await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
      console.log('[MySQL] Conectado e schema sincronizado.');
    },

    close: async () => {
      await sequelize.close();
    },

    // ── Usuários ──────────────────────────────────────────────────────────────
    getUserByEmail: async (email) => {
      const row = await User.findOne({ where: { email: email.toLowerCase() }, raw: true });
      return mapUser(row);
    },

    getUserById: async (id) => {
      const row = await User.findByPk(id, { raw: true });
      return mapUser(row);
    },

    createUser: async ({ id, name, email, passwordHash }) => {
      const row = await User.create({ id, name, email, passwordHash });
      return mapUser(row.get({ plain: true }));
    },

    updateUser: async (id, fields) => {
      await User.update(fields, { where: { id } });
      const row = await User.findByPk(id, { raw: true });
      return mapUser(row);
    },

    // ── Refresh tokens (guardados como hash SHA-256) ───────────────────────────
    saveRefreshToken: async (userId, token) => {
      await RefreshToken.create({ userId, token: hashToken(token) });
    },

    getRefreshToken: async (userId, token) => {
      return RefreshToken.findOne({ where: { userId, token: hashToken(token) }, raw: true });
    },

    deleteRefreshToken: async (userId, token) => {
      await RefreshToken.destroy({ where: { userId, token: hashToken(token) } });
    },

    // ── Eventos ───────────────────────────────────────────────────────────────
    getEventsByUser: async (userId) => {
      const rows = await Event.findAll({ where: { userId }, order: [['data', 'ASC'], ['hora', 'ASC']], raw: true });
      return rows.map(mapEvent);
    },

    getEventsByMonth: async (userId, mes) => {
      // mes = 'YYYY-MM' — filtra com LIKE no campo data (DATEONLY guardado como string)
      const rows = await Event.findAll({
        where: {
          userId,
          data: { [Op.like]: `${mes}%` },
        },
        order: [['data', 'ASC'], ['hora', 'ASC']],
        raw: true,
      });
      return rows.map(mapEvent);
    },

    getEventById: async (id, userId) => {
      const row = await Event.findOne({ where: { id, userId }, raw: true });
      return mapEvent(row);
    },

    createEvent: async (event) => {
      const row = await Event.create({
        id: event.id, userId: event.userId, titulo: event.titulo,
        data: event.data, hora: event.hora, cor: event.cor,
        lembrete: event.lembrete, alarmSound: event.alarmSound, descricao: event.descricao,
      });
      return mapEvent(row.get({ plain: true }));
    },

    updateEvent: async (id, userId, fields) => {
      await Event.update(
        {
          titulo: fields.titulo, data: fields.data, hora: fields.hora,
          cor: fields.cor, lembrete: fields.lembrete,
          alarmSound: fields.alarmSound, descricao: fields.descricao,
        },
        { where: { id, userId } }
      );
      const row = await Event.findOne({ where: { id }, raw: true });
      return mapEvent(row);
    },

    deleteEvent: async (id, userId) => {
      const count = await Event.destroy({ where: { id, userId } });
      return count > 0;
    },

    // ── Notas ─────────────────────────────────────────────────────────────────
    getNotesByUser: async (userId, { q, tag } = {}) => {
      const where = { userId };
      if (q) {
        where[Op.or] = [
          { titulo:   { [Op.like]: `%${q}%` } },
          { conteudo: { [Op.like]: `%${q}%` } },
        ];
      }
      // Para tag: MySQL JSON_CONTAINS — usamos query raw para evitar overhead do Sequelize
      if (tag) {
        const [rows] = await sequelize.query(
          'SELECT * FROM notes WHERE user_id = ? AND JSON_CONTAINS(tags, ?) ORDER BY updated_at DESC',
          { replacements: [userId, JSON.stringify(tag.toLowerCase())], type: Sequelize.QueryTypes.SELECT }
        );
        // rows pode ser array ou objeto dependendo da versão do mysql2
        const list = Array.isArray(rows) ? rows : [rows].filter(Boolean);
        return list.map(r => mapNote({ ...r, tagsRaw: r.tags }));
      }
      const rows = await Note.findAll({ where, order: [['updatedAt', 'DESC']], raw: true });
      return rows.map(r => mapNote({ ...r, tagsRaw: r.tags }));
    },

    getNoteById: async (id, userId) => {
      const row = await Note.findOne({ where: { id, userId }, raw: true });
      return row ? mapNote({ ...row, tagsRaw: row.tags }) : null;
    },

    createNote: async (note) => {
      const row = await Note.create({
        id: note.id, userId: note.userId, titulo: note.titulo,
        conteudo: note.conteudo, tagsRaw: note.tags, updatedAt: note.updatedAt,
      });
      const plain = row.get({ plain: true });
      return mapNote({ ...plain, tagsRaw: plain.tags });
    },

    updateNote: async (id, userId, fields) => {
      await Note.update(
        { titulo: fields.titulo, conteudo: fields.conteudo, tagsRaw: fields.tags, updatedAt: fields.updatedAt },
        { where: { id, userId } }
      );
      const row = await Note.findOne({ where: { id }, raw: true });
      return row ? mapNote({ ...row, tagsRaw: row.tags }) : null;
    },

    deleteNote: async (id, userId) => {
      const count = await Note.destroy({ where: { id, userId } });
      return count > 0;
    },

    // ── Humores ───────────────────────────────────────────────────────────────
    getMoodsByUser: async (userId, days) => {
      const desde = new Date();
      desde.setDate(desde.getDate() - days);
      const rows = await Mood.findAll({
        where: { userId, data: { [Op.gte]: desde } },
        order: [['data', 'ASC']],
        raw: true,
      });
      return rows.map(mapMood);
    },

    upsertMood: async (userId, data, nivel) => {
      // MySQL: INSERT ... ON DUPLICATE KEY UPDATE
      await sequelize.query(
        `INSERT INTO moods (user_id, data, nivel)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE nivel = VALUES(nivel)`,
        { replacements: [userId, data, nivel] }
      );
      const row = await Mood.findOne({ where: { userId, data }, raw: true });
      return mapMood(row);
    },
  };
}
