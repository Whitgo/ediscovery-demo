/**
 * Add Outlook integration tables
 */
exports.up = function(knex) {
  return knex.schema.createTable('outlook_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().unique();
    table.text('access_token').notNullable().comment('OAuth2 access token');
    table.text('refresh_token').comment('OAuth2 refresh token for token renewal');
    table.timestamp('expires_at').notNullable().comment('Token expiration timestamp');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Foreign key constraint
    table.foreign('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    
    // Indexes
    table.index('user_id');
    table.index('expires_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('outlook_tokens');
};
