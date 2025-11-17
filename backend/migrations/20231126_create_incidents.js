/**
 * Migration: Create Incident Response Tracking System
 * Purpose: GDPR Article 33 - 72-hour breach notification compliance
 */

exports.up = function(knex) {
  return knex.schema
    // Incident types lookup table
    .createTable('incident_types', (table) => {
      table.increments('id').primary();
      table.string('name', 100).notNullable().unique();
      table.string('category', 50).notNullable(); // security, privacy, operational, compliance
      table.integer('severity_level').notNullable(); // 1=Critical, 2=High, 3=Medium, 4=Low
      table.boolean('requires_breach_notification').defaultTo(false);
      table.integer('notification_deadline_hours').nullable(); // 72 for GDPR
      table.text('description').nullable();
      table.jsonb('response_template').nullable(); // Predefined response steps
      table.timestamps(true, true);
    })
    
    // Main incidents table
    .createTable('incidents', (table) => {
      table.increments('id').primary();
      table.string('incident_number', 50).notNullable().unique(); // INC-2024-001
      table.integer('type_id').unsigned().references('id').inTable('incident_types');
      
      // Classification
      table.string('title', 255).notNullable();
      table.text('description').notNullable();
      table.string('severity', 20).notNullable(); // critical, high, medium, low
      table.string('category', 50).notNullable(); // data_breach, unauthorized_access, malware, etc.
      table.string('status', 50).notNullable().defaultTo('open'); // open, investigating, contained, resolved, closed
      
      // GDPR Breach Notification
      table.boolean('is_data_breach').defaultTo(false);
      table.boolean('requires_notification').defaultTo(false);
      table.timestamp('breach_discovered_at').nullable();
      table.timestamp('notification_deadline').nullable(); // 72 hours from breach_discovered_at
      table.timestamp('notification_sent_at').nullable();
      table.boolean('notification_completed').defaultTo(false);
      table.text('notification_details').nullable(); // Who was notified, when, how
      
      // Affected Data
      table.jsonb('affected_data').nullable(); // {users: [], cases: [], documents: []}
      table.integer('affected_users_count').defaultTo(0);
      table.integer('affected_records_count').defaultTo(0);
      table.text('data_types_affected').nullable(); // PII, financial, health, etc.
      
      // Detection & Response
      table.string('detected_by', 100).nullable(); // user, system, automated_scan
      table.timestamp('detected_at').notNullable().defaultTo(knex.fn.now());
      table.integer('reported_by_user_id').unsigned().nullable().references('id').inTable('users');
      table.integer('assigned_to_user_id').unsigned().nullable().references('id').inTable('users');
      table.timestamp('response_started_at').nullable();
      table.timestamp('contained_at').nullable();
      table.timestamp('resolved_at').nullable();
      table.timestamp('closed_at').nullable();
      
      // Root Cause & Impact
      table.text('root_cause').nullable();
      table.text('impact_assessment').nullable();
      table.string('impact_level', 20).nullable(); // minimal, significant, severe, catastrophic
      table.decimal('estimated_cost', 12, 2).nullable();
      
      // Response Actions
      table.text('containment_actions').nullable();
      table.text('eradication_actions').nullable();
      table.text('recovery_actions').nullable();
      table.text('lessons_learned').nullable();
      
      // Compliance & Legal
      table.boolean('law_enforcement_notified').defaultTo(false);
      table.timestamp('law_enforcement_notified_at').nullable();
      table.boolean('regulatory_authority_notified').defaultTo(false);
      table.timestamp('regulatory_authority_notified_at').nullable();
      table.text('legal_notes').nullable();
      
      // Metadata
      table.jsonb('metadata').nullable(); // Additional flexible data
      table.text('tags').nullable(); // Comma-separated tags
      table.timestamps(true, true);
      
      // Indexes for performance
      table.index('incident_number');
      table.index('status');
      table.index('severity');
      table.index('is_data_breach');
      table.index('detected_at');
      table.index('notification_deadline');
    })
    
    // Incident timeline/activity log
    .createTable('incident_activities', (table) => {
      table.increments('id').primary();
      table.integer('incident_id').unsigned().notNullable().references('id').inTable('incidents').onDelete('CASCADE');
      table.integer('user_id').unsigned().nullable().references('id').inTable('users');
      
      table.string('action_type', 50).notNullable(); // status_change, assignment, comment, escalation, notification
      table.text('action_description').notNullable();
      table.string('old_value', 255).nullable();
      table.string('new_value', 255).nullable();
      table.jsonb('metadata').nullable();
      
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      
      table.index('incident_id');
      table.index('created_at');
    })
    
    // Incident notifications sent
    .createTable('incident_notifications', (table) => {
      table.increments('id').primary();
      table.integer('incident_id').unsigned().notNullable().references('id').inTable('incidents').onDelete('CASCADE');
      
      table.string('notification_type', 50).notNullable(); // regulatory, user, internal, law_enforcement
      table.string('recipient', 255).notNullable();
      table.string('method', 50).notNullable(); // email, phone, portal, formal_letter
      table.text('message').nullable();
      table.string('status', 50).notNullable().defaultTo('pending'); // pending, sent, failed, acknowledged
      
      table.timestamp('sent_at').nullable();
      table.timestamp('acknowledged_at').nullable();
      table.text('delivery_confirmation').nullable();
      
      table.timestamps(true, true);
      
      table.index('incident_id');
      table.index('notification_type');
      table.index('status');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('incident_notifications')
    .dropTableIfExists('incident_activities')
    .dropTableIfExists('incidents')
    .dropTableIfExists('incident_types');
};
