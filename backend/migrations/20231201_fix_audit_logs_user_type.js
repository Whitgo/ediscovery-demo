/**
 * Fix audit_logs.user column type from VARCHAR to INTEGER
 * This fixes the security dashboard error where user ID comparison was failing
 */
exports.up = async function(knex) {
  // First, update any string usernames to user IDs or set to NULL
  await knex.raw(`
    UPDATE audit_logs 
    SET "user" = NULL 
    WHERE "user" IS NOT NULL AND "user" !~ '^[0-9]+$'
  `);
  
  // Now alter the column type
  await knex.schema.alterTable('audit_logs', (table) => {
    table.integer('user').alter();
  });
  
  // Add foreign key constraint
  await knex.schema.alterTable('audit_logs', (table) => {
    table.foreign('user').references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = async function(knex) {
  // Drop foreign key constraint
  await knex.schema.alterTable('audit_logs', (table) => {
    table.dropForeign('user');
  });
  
  // Revert to VARCHAR
  await knex.schema.alterTable('audit_logs', (table) => {
    table.string('user', 255).alter();
  });
};
