exports.up = function(knex) {
  return knex.schema.table('documents', (table) => {
    table.boolean('encrypted').defaultTo(false);
    table.string('encryption_iv', 32); // 16 bytes = 32 hex chars
    table.string('encryption_auth_tag', 32); // 16 bytes = 32 hex chars
    table.string('encryption_salt', 128); // 64 bytes = 128 hex chars
    table.string('encryption_algorithm', 50).defaultTo('aes-256-gcm');
  });
};

exports.down = function(knex) {
  return knex.schema.table('documents', (table) => {
    table.dropColumn('encrypted');
    table.dropColumn('encryption_iv');
    table.dropColumn('encryption_auth_tag');
    table.dropColumn('encryption_salt');
    table.dropColumn('encryption_algorithm');
  });
};
