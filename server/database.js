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

// A autenticação (login/cadastro/sessão) é feita pelo Supabase. Esta camada
// guarda apenas os DADOS do app (eventos/notas/humor) e um PERFIL leve por
// usuário (nome/avatar), sempre chaveado pelo UID do Supabase.

const DB_TYPE = (process.env.DB_TYPE || 'mongo').toLowerCase();
if (!['mongo', 'mysql'].includes(DB_TYPE)) {
  throw new Error('DB_TYPE deve ser mongo ou mysql.');
}

function idConflict() {
  return Object.assign(new Error('Identificador indisponível.'), { status: 409 });
}

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

  // Perfil leve. O _id é o UID do usuário no Supabase (string UUID).
  // Não há senha aqui — a autenticação é responsabilidade do Supabase.
  const ProfileSchema = new Schema({
    _id:    { type: String },
    name:   { type: String, default: '', trim: true, maxlength: 80 },
    email:  { type: String, default: '', lowercase: true, trim: true },
    avatar: { type: String, default: null },
  }, { timestamps: true, _id: false });

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

  const Profile = mongoose.models.Profile || model('Profile', ProfileSchema);
  const Event   = mongoose.models.Event   || model('Event',   EventSchema);
  const Note    = mongoose.models.Note    || model('Note',    NoteSchema);
  const Mood    = mongoose.models.Mood    || model('Mood',    MoodSchema);

  // ─── Mapeador: documento Mongoose → objeto plano ─────────────────────────

  const mapProfile = (d) => d ? ({ id: d._id, name: d.name, email: d.email, avatar: d.avatar || null }) : null;
  const mapEvent = (d) => d ? ({ id: d._id, userId: d.userId, titulo: d.titulo, data: d.data, hora: d.hora, cor: d.cor, lembrete: d.lembrete, alarmSound: d.alarmSound, descricao: d.descricao }) : null;
  const mapNote  = (d) => d ? ({ id: d._id, userId: d.userId, titulo: d.titulo, conteudo: d.conteudo, tags: d.tags, updatedAt: d.updatedAt }) : null;
  const mapMood  = (d) => d ? ({ id: d._id?.toString(), userId: d.userId, data: d.data, nivel: d.nivel }) : null;

  // Retry-safe creation: never replace an existing record or touch another owner.
  const createOnce = async (Model, fields) => {
    const id = fields._id || new Types.ObjectId().toString();
    const filter = { _id: id, userId: fields.userId };
    try {
      return await Model.findOneAndUpdate(filter, {
        $setOnInsert: { ...fields, _id: id, createdAt: new Date(), updatedAt: fields.updatedAt || new Date() },
      }, { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, timestamps: false }).lean();
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Two simultaneous retries may race on the unique ID. Read only our owner.
      const existing = await Model.findOne(filter).lean();
      if (existing) return existing;
      throw idConflict();
    }
  };

  // ─── API pública ──────────────────────────────────────────────────────────

  return {
    // ── Conexão ──────────────────────────────────────────────────────────────
    connect: async () => {
      const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/agenda';
      await mongoose.connect(uri, {
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 60000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('[MongoDB] Conectado.');
    },

    close: async () => {
      await mongoose.connection.close();
    },

    // ── Perfil ────────────────────────────────────────────────────────────────
    // Cria o perfil na primeira vez que o usuário (já autenticado no Supabase)
    // bate no backend; nas próximas, só retorna o existente.
    getOrCreateProfile: async (uid, { email, name } = {}) => {
      const doc = await Profile.findByIdAndUpdate(
        uid,
        { $setOnInsert: { name: name || '', email: email || '' } },
        { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
      ).lean();
      return mapProfile(doc);
    },

    getProfileById: async (uid) => {
      const doc = await Profile.findById(uid).lean();
      return mapProfile(doc);
    },

    updateProfile: async (uid, fields) => {
      const doc = await Profile.findByIdAndUpdate(uid, { $set: fields }, { new: true, upsert: true, runValidators: true }).lean();
      return mapProfile(doc);
    },

    // ── Eventos ───────────────────────────────────────────────────────────────
    getEventsByUser: async (userId, { limit = 200, offset = 0 } = {}) => {
      const docs = await Event.find({ userId }).sort({ data: 1, hora: 1, _id: 1 }).skip(offset).limit(limit).lean();
      return docs.map(mapEvent);
    },

    getEventsByMonth: async (userId, mes, { limit = 200, offset = 0 } = {}) => {
      // mes = 'YYYY-MM' — usa regex para corresponder ao prefixo da data
      const docs = await Event.find({ userId, data: { $regex: `^${mes}` } }).sort({ data: 1, hora: 1, _id: 1 }).skip(offset).limit(limit).lean();
      return docs.map(mapEvent);
    },

    getEventById: async (id, userId) => {
      const doc = await Event.findOne({ _id: id, userId }).lean();
      return mapEvent(doc);
    },

    createEvent: async (event) => {
      const doc = await createOnce(Event, {
        _id: event.id, userId: event.userId, titulo: event.titulo,
        data: event.data, hora: event.hora, cor: event.cor,
        lembrete: event.lembrete, alarmSound: event.alarmSound, descricao: event.descricao,
      });
      return mapEvent(doc);
    },

    updateEvent: async (id, userId, fields) => {
      const doc = await Event.findOneAndUpdate({ _id: id, userId }, { $set: fields }, { new: true, runValidators: true }).lean();
      return mapEvent(doc);
    },

    deleteEvent: async (id, userId) => {
      const res = await Event.deleteOne({ _id: id, userId });
      return res.deletedCount > 0;
    },

    // ── Notas ─────────────────────────────────────────────────────────────────
    getNotesByUser: async (userId, { q, tag, limit = 200, offset = 0 } = {}) => {
      const filter = { userId };
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ titulo: re }, { conteudo: re }];
      }
      if (tag) {
        filter.tags = tag.toLowerCase();
      }
      const docs = await Note.find(filter).sort({ updatedAt: -1, _id: 1 }).skip(offset).limit(limit).lean();
      return docs.map(mapNote);
    },

    getNoteById: async (id, userId) => {
      const doc = await Note.findOne({ _id: id, userId }).lean();
      return mapNote(doc);
    },

    createNote: async (note) => {
      const doc = await createOnce(Note, {
        _id: note.id, userId: note.userId, titulo: note.titulo,
        conteudo: note.conteudo, tags: note.tags, updatedAt: note.updatedAt,
      });
      return mapNote(doc);
    },

    updateNote: async (id, userId, fields) => {
      const doc = await Note.findOneAndUpdate({ _id: id, userId }, { $set: fields }, { new: true, runValidators: true }).lean();
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
        { new: true, upsert: true, runValidators: true }
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
      ...((process.env.MYSQL_SSL === 'true' || process.env.MYSQL_SSL_CA) ? {
        ssl: {
          rejectUnauthorized: true,
          ...(process.env.MYSQL_SSL_CA ? { ca: process.env.MYSQL_SSL_CA.replace(/\\n/g, '\n') } : {}),
        },
      } : {}),
    },
  });

  // ─── Models ───────────────────────────────────────────────────────────────

  // Perfil leve — o id é o UID do usuário no Supabase. Sem senha (auth = Supabase).
  const Profile = sequelize.define('Profile', {
    id:     { type: DataTypes.STRING(64),  primaryKey: true },
    name:   { type: DataTypes.STRING(80),  allowNull: false, defaultValue: '' },
    email:  { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    avatar: { type: DataTypes.TEXT,        allowNull: true,  defaultValue: null },
  }, { tableName: 'profiles', timestamps: true, underscored: true });

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
    tagsRaw:   { type: DataTypes.JSON,          defaultValue: [], field: 'tags' },
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

  const mapProfile = (r) => r ? ({
    id: r.id, name: r.name, email: r.email, avatar: r.avatar || null,
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

  const createOnce = async (Model, fields) => {
    const [record] = await Model.findOrCreate({ where: { id: fields.id }, defaults: fields });
    const row = record.get({ plain: true });
    if (row.userId !== fields.userId) throw idConflict();
    return row;
  };

  // ─── API pública ──────────────────────────────────────────────────────────

  return {
    // ── Conexão ──────────────────────────────────────────────────────────────
    connect: async () => {
      await sequelize.authenticate();
      // Production schema changes require explicit migrations.
      if (['development', 'test'].includes(process.env.NODE_ENV)) await sequelize.sync();
      console.log('[MySQL] Conectado.');
    },

    close: async () => {
      await sequelize.close();
    },

    // ── Perfil ────────────────────────────────────────────────────────────────
    getOrCreateProfile: async (uid, { email, name } = {}) => {
      const [row] = await Profile.findOrCreate({
        where:    { id: uid },
        defaults: { id: uid, name: name || '', email: email || '' },
      });
      return mapProfile(row.get({ plain: true }));
    },

    getProfileById: async (uid) => {
      const row = await Profile.findByPk(uid, { raw: true });
      return mapProfile(row);
    },

    updateProfile: async (uid, fields) => {
      await Profile.upsert({ id: uid, ...fields });
      const row = await Profile.findByPk(uid, { raw: true });
      return mapProfile(row);
    },

    // ── Eventos ───────────────────────────────────────────────────────────────
    getEventsByUser: async (userId, { limit = 200, offset = 0 } = {}) => {
      const rows = await Event.findAll({ where: { userId }, order: [['data', 'ASC'], ['hora', 'ASC'], ['id', 'ASC']], limit, offset, raw: true });
      return rows.map(mapEvent);
    },

    getEventsByMonth: async (userId, mes, { limit = 200, offset = 0 } = {}) => {
      // mes = 'YYYY-MM' — filtra com LIKE no campo data (DATEONLY guardado como string)
      const rows = await Event.findAll({
        where: {
          userId,
          data: { [Op.like]: `${mes}%` },
        },
        order: [['data', 'ASC'], ['hora', 'ASC'], ['id', 'ASC']],
        limit, offset,
        raw: true,
      });
      return rows.map(mapEvent);
    },

    getEventById: async (id, userId) => {
      const row = await Event.findOne({ where: { id, userId }, raw: true });
      return mapEvent(row);
    },

    createEvent: async (event) => {
      const row = await createOnce(Event, {
        id: event.id, userId: event.userId, titulo: event.titulo,
        data: event.data, hora: event.hora, cor: event.cor,
        lembrete: event.lembrete, alarmSound: event.alarmSound, descricao: event.descricao,
      });
      return mapEvent(row);
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
      const row = await Event.findOne({ where: { id, userId }, raw: true });
      return mapEvent(row);
    },

    deleteEvent: async (id, userId) => {
      const count = await Event.destroy({ where: { id, userId } });
      return count > 0;
    },

    // ── Notas ─────────────────────────────────────────────────────────────────
    getNotesByUser: async (userId, { q, tag, limit = 200, offset = 0 } = {}) => {
      const where = { userId };
      if (q) {
        where[Op.or] = [
          { titulo:   { [Op.like]: `%${q}%` } },
          { conteudo: { [Op.like]: `%${q}%` } },
        ];
      }
      if (tag) {
        // Sequelize escapes the JSON string as a value, preserving q + tag together.
        where[Op.and] = Sequelize.where(
          Sequelize.fn('JSON_CONTAINS', Sequelize.col('tags'), JSON.stringify(tag.toLowerCase())), 1
        );
      }
      const rows = await Note.findAll({ where, order: [['updatedAt', 'DESC'], ['id', 'ASC']], limit, offset, raw: true });
      return rows.map(mapNote);
    },

    getNoteById: async (id, userId) => {
      const row = await Note.findOne({ where: { id, userId }, raw: true });
      return mapNote(row);
    },

    createNote: async (note) => {
      const row = await createOnce(Note, {
        id: note.id, userId: note.userId, titulo: note.titulo,
        conteudo: note.conteudo, tagsRaw: note.tags, updatedAt: note.updatedAt,
      });
      return mapNote(row);
    },

    updateNote: async (id, userId, fields) => {
      await Note.update(
        { titulo: fields.titulo, conteudo: fields.conteudo, tagsRaw: fields.tags, updatedAt: fields.updatedAt },
        { where: { id, userId } }
      );
      const row = await Note.findOne({ where: { id, userId }, raw: true });
      return mapNote(row);
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
