exports.up = function(knex) {
  return knex.schema.createTable('notification_preferences', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.boolean('document_uploads_enabled').defaultTo(true);
    table.boolean('exports_enabled').defaultTo(true);
    table.boolean('case_updates_enabled').defaultTo(true);
    table.boolean('only_assigned_cases').defaultTo(true); // Only notify for assigned cases
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('notification_preferences');
};
