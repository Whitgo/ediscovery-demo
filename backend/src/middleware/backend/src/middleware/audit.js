const knexConfig = require('../../config/knexfile')[process.env.NODE_ENV || 'development'];
const knex = require('knex')(knexConfig);

async function audit({ action, user, objectType, objectId, caseId, details }) {
  await knex('audit_logs').insert({
    action,
    user,
    object_type: objectType,
    object_id: objectId,
    case_id: caseId,
    details: details ? JSON.stringify(details) : null,
    timestamp: new Date()
  });
}

module.exports = audit;