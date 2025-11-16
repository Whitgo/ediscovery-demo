/**
 * Migration: Add data retention and soft delete support
 * Purpose: GDPR/CCPA compliance - data retention policies and right to deletion
 */

exports.up = function(knex) {
  return knex.schema
    // Add retention fields to cases table
    .table('cases', function(table) {
      table.date('retention_date').comment('Date when case data should be deleted (typically 10 years from creation)');
      table.string('retention_policy', 50).defaultTo('10_years').comment('Retention policy: 10_years, 7_years, indefinite, custom');
      table.boolean('legal_hold').defaultTo(false).comment('If true, prevent automatic deletion regardless of retention date');
      table.timestamp('deleted_at').comment('Soft delete timestamp for GDPR right to deletion');
    })
    
    // Add soft delete to documents table
    .table('documents', function(table) {
      table.timestamp('deleted_at').comment('Soft delete timestamp');
    })
    
    // Add soft delete to users table
    .table('users', function(table) {
      table.timestamp('deleted_at').comment('Soft delete timestamp for GDPR right to deletion');
      table.string('deletion_reason').comment('Reason for deletion: user_request, retention_policy, admin_action');
    })
    
    // Add soft delete to audit_logs (anonymize instead of delete)
    .table('audit_logs', function(table) {
      table.boolean('anonymized').defaultTo(false).comment('If true, user field has been pseudonymized');
    })
    
    // Create data retention log table
    .createTable('data_retention_log', function(table) {
      table.increments('id').primary();
      table.string('action', 50).notNullable().comment('Action: case_deleted, documents_purged, user_anonymized');
      table.integer('case_id').comment('Case ID if applicable');
      table.integer('user_id').comment('User ID if applicable');
      table.integer('records_affected').comment('Number of records deleted/anonymized');
      table.text('details').comment('JSON details of what was deleted');
      table.string('triggered_by', 100).comment('auto_retention, manual_admin, user_request');
      table.string('performed_by_user').comment('User who triggered manual deletion');
      table.timestamp('executed_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('data_retention_log')
    .table('audit_logs', function(table) {
      table.dropColumn('anonymized');
    })
    .table('users', function(table) {
      table.dropColumn('deletion_reason');
      table.dropColumn('deleted_at');
    })
    .table('documents', function(table) {
      table.dropColumn('deleted_at');
    })
    .table('cases', function(table) {
      table.dropColumn('deleted_at');
      table.dropColumn('legal_hold');
      table.dropColumn('retention_policy');
      table.dropColumn('retention_date');
    });
};
