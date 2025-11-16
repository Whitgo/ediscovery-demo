exports.up = function(knex) {
  return knex.schema
    .createTable('users', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('email').notNullable().unique();
      t.string('role').notNullable();
      t.string('password_hash').notNullable();
      t.timestamps(true, true);
    })
    .createTable('cases', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('number').notNullable().unique();
      t.string('status').notNullable();
      t.string('assigned_to');
      t.text('notes');
      t.timestamps(true, true);
    })
    .createTable('documents', t => {
      t.increments('id').primary();
      t.integer('case_id').unsigned().references('cases.id').onDelete('CASCADE');
      t.string('name').notNullable();
      t.bigInteger('size');
      t.string('category');
      t.string('folder');
      t.string('uploaded_by');
      t.string('file_url');
      t.jsonb('tags');
      t.timestamps(true, true);
    })
    .createTable('audit_logs', t => {
      t.increments('id').primary();
      t.integer('case_id').unsigned();
      t.string('user');
      t.enum('action', ['create', 'update', 'delete', 'export', 'view']);
      t.string('object_type');
      t.integer('object_id');
      t.jsonb('details');
      t.timestamp('timestamp').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('documents')
    .dropTableIfExists('cases')
    .dropTableIfExists('users');
};