/**
 * Migration: Add privacy compliance features
 * Purpose: GDPR/CCPA - user consent, data export, deletion requests
 */

exports.up = function(knex) {
  return knex.schema
    // Add privacy policy acceptance tracking
    .table('users', function(table) {
      table.boolean('privacy_policy_accepted').defaultTo(false);
      table.timestamp('privacy_policy_accepted_at');
      table.string('privacy_policy_version', 20);
    })
    
    // Create data subject requests table (for deletion requests, data export requests)
    .createTable('data_subject_requests', function(table) {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.string('request_type', 50).notNullable().comment('export, deletion, rectification, restriction');
      table.string('status', 50).defaultTo('pending').comment('pending, approved, rejected, completed');
      table.text('user_reason').comment('User explanation for the request');
      table.text('admin_notes').comment('Internal notes from admin/manager');
      table.integer('processed_by_user_id').comment('Admin/manager who processed the request');
      table.timestamp('requested_at').defaultTo(knex.fn.now());
      table.timestamp('processed_at').comment('When request was approved/rejected');
      table.timestamp('completed_at').comment('When request action was completed');
      table.text('export_data').comment('JSON export of user data (for export requests)');
      table.index(['user_id', 'request_type']);
      table.index(['status']);
    })
    
    // Create consent log table (track all consent actions)
    .createTable('consent_log', function(table) {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.string('consent_type', 100).notNullable().comment('privacy_policy, terms_of_service, data_processing, cookies');
      table.boolean('granted').notNullable();
      table.string('version', 20).comment('Version of the policy/terms accepted');
      table.string('ip_address', 45).comment('IP address at time of consent');
      table.string('user_agent').comment('Browser user agent');
      table.timestamp('timestamp').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('consent_log')
    .dropTableIfExists('data_subject_requests')
    .table('users', function(table) {
      table.dropColumn('privacy_policy_version');
      table.dropColumn('privacy_policy_accepted_at');
      table.dropColumn('privacy_policy_accepted');
    });
};
