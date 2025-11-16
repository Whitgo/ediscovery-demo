exports.seed = async function(knex) {
  // Don't delete existing notifications, just add samples
  
  // Get user IDs for alice and bob (users and managers)
  const alice = await knex('users').where({ email: 'alice@demo.com' }).first();
  const bob = await knex('users').where({ email: 'bob@demo.com' }).first();
  
  if (!alice || !bob) {
    console.log('Users not found, skipping notification seeds');
    return;
  }

  // Get some case IDs
  const case1 = await knex('cases').where({ number: 'AC-2024-001' }).first();
  const case2 = await knex('cases').where({ number: 'GOV-2024-0047' }).first();

  const sampleNotifications = [
    {
      user_id: alice.id,
      type: 'document_uploaded',
      title: 'New Document Uploaded',
      message: 'Bob User uploaded "Financial Report Q3.pdf" to case Acme Inc. v. Globex',
      case_id: case1?.id || 1,
      read: false,
      created_at: new Date(Date.now() - 3600000) // 1 hour ago
    },
    {
      user_id: alice.id,
      type: 'export_completed',
      title: 'Export Completed',
      message: 'Your export of 5 documents from case Government v. John Doe is ready',
      case_id: case2?.id || 2,
      read: false,
      created_at: new Date(Date.now() - 7200000) // 2 hours ago
    },
    {
      user_id: bob.id,
      type: 'document_uploaded',
      title: 'New Document Uploaded',
      message: 'Alice Manager uploaded "Contract Amendment.docx" to case Acme Inc. v. Globex',
      case_id: case1?.id || 1,
      read: false,
      created_at: new Date(Date.now() - 1800000) // 30 minutes ago
    },
    {
      user_id: bob.id,
      type: 'case_updated',
      title: 'Case Status Updated',
      message: 'Case Government v. John Doe status changed to "In Review"',
      case_id: case2?.id || 2,
      read: true,
      created_at: new Date(Date.now() - 86400000) // 1 day ago
    }
  ];

  await knex('notifications').insert(sampleNotifications);
  console.log('Sample notifications created');
};
