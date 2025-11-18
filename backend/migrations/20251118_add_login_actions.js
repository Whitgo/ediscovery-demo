/**
 * Migration to add login actions to audit_logs
 */

exports.up = function(knex) {
  return knex.schema.raw(`
    ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_action_check;
    
    ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_action_check
    CHECK (action IN ('create', 'update', 'delete', 'export', 'view', 'failed_login', 'successful_login'));
  `);
};

exports.down = function(knex) {
  return knex.schema.raw(`
    ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_action_check;
    
    ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_action_check
    CHECK (action IN ('create', 'update', 'delete', 'export', 'view'));
  `);
};
