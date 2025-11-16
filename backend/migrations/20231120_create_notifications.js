exports.up = function(knex) {
  return knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 50).notNullable(); // 'document_uploaded', 'export_completed', 'case_updated'
    table.string('title', 255).notNullable();
    table.text('message').notNullable();
    table.integer('case_id').unsigned().references('id').inTable('cases').onDelete('CASCADE');
    table.integer('document_id').unsigned().references('id').inTable('documents').onDelete('SET NULL');
    table.boolean('read').defaultTo(false);
    table.text('metadata'); // JSON string for additional data
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('notifications');
};
