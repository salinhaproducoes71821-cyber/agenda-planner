'use strict';
const { body, query } = require('express-validator');
function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 9999 &&
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
const eventValidators = [
  body('id').optional().isUUID(),
  body('titulo').isString().bail().trim().isLength({ min: 1, max: 120 }),
  body('data').custom(isDate).withMessage('Data inválida.'),
  body('hora').isString().bail().matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/).withMessage('Hora inválida.'),
  body('cor').optional().isString().bail().matches(/^#[0-9a-fA-F]{6}$/),
  body('lembrete').optional().isBoolean({ strict: true }),
  body('alarmSound').optional().isIn(['gentle','birds','piano','classic','vibrate']),
  body('descricao').optional().isString().bail().isLength({ max: 500 }),
];
const noteValidators = [
  body('id').optional().isUUID(),
  body('titulo').optional().isString().bail().trim().isLength({ max: 200 }),
  body('conteudo').optional().isString().bail().isLength({ max: 50000 }),
  body('tags').optional().isArray({ max: 20 }),
  body('tags.*').isString().bail().trim().isLength({ min: 1, max: 50 }),
];
const pageValidators = [query('limit').optional().isInt({ min: 1, max: 200 }).toInt(), query('offset').optional().isInt({ min: 0, max: 100000 }).toInt()];
const page = req => ({ limit: req.query.limit || 200, offset: req.query.offset || 0 });
module.exports = { isDate, eventValidators, noteValidators, pageValidators, page };
