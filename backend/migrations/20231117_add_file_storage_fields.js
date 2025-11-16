exports.up = function(knex) {
  return knex.schema.table('documents', (table) => {
    table.string('file_type');
    table.string('stored_filename');
  });
};

exports.down = function(knex) {
  return knex.schema.table('documents', (table) => {
    table.dropColumn('file_type');
    table.dropColumn('stored_filename');
  });
};
