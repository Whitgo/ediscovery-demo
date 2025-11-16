exports.up = function(knex) {
  return knex.schema.table('cases', function(table) {
    table.string('disposition', 100);
    table.text('disposition_notes');
  });
};

exports.down = function(knex) {
  return knex.schema.table('cases', function(table) {
    table.dropColumn('disposition');
    table.dropColumn('disposition_notes');
  });
};
