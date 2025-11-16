exports.up = function(knex) {
  return knex.schema.table('documents', (table) => {
    table.string('case_number');
    table.string('witness_name');
    table.string('evidence_type');
    table.string('legal_category');
    table.jsonb('custom_metadata').defaultTo('{}');
  });
};

exports.down = function(knex) {
  return knex.schema.table('documents', (table) => {
    table.dropColumn('case_number');
    table.dropColumn('witness_name');
    table.dropColumn('evidence_type');
    table.dropColumn('legal_category');
    table.dropColumn('custom_metadata');
  });
};
