'use strict';

// Real Sequelize/Mongoose schemas and query builders; database I/O is stubbed.
const originalEnv = { ...process.env };
afterEach(() => { jest.restoreAllMocks(); process.env = { ...originalEnv }; });

function mysql() {
  jest.resetModules();
  process.env.DB_TYPE = 'mysql';
  const { Sequelize } = require('sequelize');
  let connection;
  const define = Sequelize.prototype.define;
  jest.spyOn(Sequelize.prototype, 'define').mockImplementation(function (...args) {
    connection = this;
    return define.apply(this, args);
  });
  const api = require('../database');
  return { api, connection, models: connection.models, Sequelize };
}

function mongo() {
  jest.resetModules();
  process.env.DB_TYPE = 'mongo';
  const mongoose = require('mongoose');
  const api = require('../database');
  return { api, models: mongoose.models };
}

test('rejects an unsupported database selection instead of silently choosing MongoDB', () => {
  jest.resetModules();
  process.env.DB_TYPE = 'typo';
  expect(() => require('../database')).toThrow(/DB_TYPE/);
});

test('MySQL maps native tagsRaw without discarding tags', async () => {
  const { api, models } = mysql();
  jest.spyOn(models.Note, 'findOne').mockResolvedValue({ id: 'n', userId: 'u', tagsRaw: ['work'] });
  expect((await api.getNoteById('n', 'u')).tags).toEqual(['work']);
});

test('MySQL tag and text filtering use one bounded query and map every result', async () => {
  const { api, models, connection, Sequelize } = mysql();
  const rows = [{ id: 'a', userId: 'u', tagsRaw: ['work'] }, { id: 'b', userId: 'u', tagsRaw: ['work'] }];
  const find = jest.spyOn(models.Note, 'findAll').mockResolvedValue(rows);
  jest.spyOn(connection, 'query').mockResolvedValue(rows);
  const notes = await api.getNotesByUser('u', { q: 'budget', tag: 'WORK', limit: 7, offset: 3 });
  expect(notes.map(n => n.id)).toEqual(['a', 'b']);
  expect(notes.every(n => n.userId === 'u' && n.tags[0] === 'work')).toBe(true);
  expect(find).toHaveBeenCalledTimes(1);
  const options = find.mock.calls[0][0];
  expect(options).toMatchObject({ limit: 7, offset: 3, order: [['updatedAt', 'DESC'], ['id', 'ASC']] });
  expect(options.where[Sequelize.Op.or]).toBeDefined();
  const sql = connection.dialect.queryGenerator.selectQuery('notes', options, models.Note);
  expect(sql).toContain('JSON_CONTAINS');
  expect(sql).toContain('budget');
  expect(sql).toContain('work');
});

test('MySQL event reads apply bounded pagination and stable order', async () => {
  const { api, models } = mysql();
  const find = jest.spyOn(models.Event, 'findAll').mockResolvedValue([]);
  await api.getEventsByUser('u');
  expect(find.mock.calls[0][0]).toMatchObject({ limit: 200, offset: 0, order: [['data', 'ASC'], ['hora', 'ASC'], ['id', 'ASC']] });
  await api.getEventsByMonth('u', '2026-09', { limit: 8, offset: 4 });
  expect(find.mock.calls[1][0]).toMatchObject({ limit: 8, offset: 4 });
});

for (const kind of ['Event', 'Note']) {
  test(`MySQL ${kind} retry returns existing content and checks ownership`, async () => {
    const { api, models } = mysql();
    const existing = models[kind].build({ id: 'stable-id', userId: 'A', titulo: 'Original', tagsRaw: ['work'] });
    jest.spyOn(models[kind], 'create').mockRejectedValue(new Error('Unexpected non-idempotent insert'));
    const find = jest.spyOn(models[kind], 'findOrCreate').mockResolvedValue([existing, false]);
    const result = await api[`create${kind}`]({ id: 'stable-id', userId: 'A', titulo: 'Overwrite attempt' });
    expect(result.titulo).toBe('Original');
    expect(find.mock.calls[0][0].where).toEqual({ id: 'stable-id' });
    await expect(api[`create${kind}`]({ id: 'stable-id', userId: 'B' })).rejects.toMatchObject({ status: 409 });
  });

  test(`MySQL ${kind} update reread remains scoped to the owner`, async () => {
    const { api, models } = mysql();
    jest.spyOn(models[kind], 'update').mockResolvedValue([0]);
    const read = jest.spyOn(models[kind], 'findOne').mockResolvedValue(null);
    await api[`update${kind}`]('id', 'owner', { titulo: 'Changed' });
    expect(read.mock.calls[0][0].where).toEqual({ id: 'id', userId: 'owner' });
  });
}

test('MySQL production startup never synchronizes schemas', async () => {
  process.env.NODE_ENV = 'production';
  const { api, connection } = mysql();
  jest.spyOn(connection, 'authenticate').mockResolvedValue();
  const sync = jest.spyOn(connection, 'sync').mockResolvedValue();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await api.connect();
  expect(sync).not.toHaveBeenCalled();
});

test('MySQL development startup does not alter existing tables', async () => {
  process.env.NODE_ENV = 'development';
  const { api, connection } = mysql();
  jest.spyOn(connection, 'authenticate').mockResolvedValue();
  const sync = jest.spyOn(connection, 'sync').mockResolvedValue();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await api.connect();
  expect(sync).toHaveBeenCalledWith();
});

test('MySQL TLS configuration verifies certificates', () => {
  process.env.MYSQL_SSL = 'true';
  process.env.MYSQL_SSL_CA = '-----BEGIN CERTIFICATE-----\nconfigured-ca\n-----END CERTIFICATE-----';
  const { connection } = mysql();
  expect(connection.options.dialectOptions.ssl).toEqual({ rejectUnauthorized: true, ca: process.env.MYSQL_SSL_CA });
});

test('MongoDB event and note lists apply limit, offset and stable ordering', async () => {
  const { api, models } = mongo();
  const query = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
  jest.spyOn(models.Event, 'find').mockReturnValue(query);
  jest.spyOn(models.Note, 'find').mockReturnValue(query);
  await api.getEventsByUser('u', { limit: 9, offset: 2 });
  expect(query.limit).toHaveBeenLastCalledWith(9);
  expect(query.skip).toHaveBeenLastCalledWith(2);
  expect(query.sort).toHaveBeenLastCalledWith({ data: 1, hora: 1, _id: 1 });
  await api.getEventsByMonth('u', '2026-09');
  expect(query.limit).toHaveBeenLastCalledWith(200);
  await api.getNotesByUser('u', { limit: 5, offset: 10 });
  expect(query.limit).toHaveBeenLastCalledWith(5);
  expect(query.skip).toHaveBeenLastCalledWith(10);
  expect(query.sort).toHaveBeenLastCalledWith({ updatedAt: -1, _id: 1 });
});

for (const kind of ['Event', 'Note']) {
  test(`MongoDB ${kind} uses owner-scoped insert-once writes and reports collisions`, async () => {
    const { api, models } = mongo();
    jest.spyOn(models[kind], 'create').mockRejectedValue(new Error('Unexpected non-idempotent insert'));
    const lean = jest.fn().mockResolvedValue({ _id: 'id', userId: 'A', titulo: 'Original' });
    const upsert = jest.spyOn(models[kind], 'findOneAndUpdate').mockReturnValue({ lean });
    const result = await api[`create${kind}`]({ id: 'id', userId: 'A', titulo: 'Overwrite attempt' });
    expect(result.titulo).toBe('Original');
    const [filter, update, options] = upsert.mock.calls[0];
    expect(filter).toEqual({ _id: 'id', userId: 'A' });
    expect(update.$set).toBeUndefined();
    expect(update.$setOnInsert.titulo).toBe('Overwrite attempt');
    expect(options).toMatchObject({ upsert: true, runValidators: true });
    lean.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
    jest.spyOn(models[kind], 'findOne').mockReturnValue({ lean: async () => null });
    await expect(api[`create${kind}`]({ id: 'id', userId: 'B' })).rejects.toMatchObject({ status: 409 });
  });
}

test('MongoDB update operations enforce schema validators', async () => {
  const { api, models } = mongo();
  for (const kind of ['Event', 'Note']) {
    const update = jest.spyOn(models[kind], 'findOneAndUpdate').mockReturnValue({ lean: async () => null });
    await api[`update${kind}`]('id', 'u', { titulo: 'New title' });
    expect(update.mock.calls[0][2]).toMatchObject({ runValidators: true });
  }
  const mood = jest.spyOn(models.Mood, 'findOneAndUpdate').mockReturnValue({ lean: async () => null });
  await api.upsertMood('u', '2026-09-05', 9);
  expect(mood.mock.calls[0][2]).toMatchObject({ runValidators: true });
});
