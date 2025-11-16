exports.seed = async function(knex) {
  await knex('audit_logs').del();
  await knex('documents').del();
  await knex('cases').del();
  await knex('users').del();

  await knex('users').insert([
    {
      id: 1,
      name: "Alice Manager",
      email: "alice@demo.com",
      role: "manager",
      password_hash: "$2b$10$CwTycUXWue0Thq9StjUM0uJ8PCZUMga1pH4IY/eYPp1fT0TRdc5aO", // demo123
    },
    {
      id: 2,
      name: "Bob User",
      email: "bob@demo.com",
      role: "user",
      password_hash: "$2b$10$CwTycUXWue0Thq9StjUM0uJ8PCZUMga1pH4IY/eYPp1fT0TRdc5aO",
    },
    {
      id: 3,
      name: "Sandra Support",
      email: "sandra@demo.com",
      role: "support",
      password_hash: "$2b$10$CwTycUXWue0Thq9StjUM0uJ8PCZUMga1pH4IY/eYPp1fT0TRdc5aO",
    },
    {
      id: 4,
      name: "Victor Viewer",
      email: "victor@demo.com",
      role: "viewer",
      password_hash: "$2b$10$CwTycUXWue0Thq9StjUM0uJ8PCZUMga1pH4IY/eYPp1fT0TRdc5aO",
    }
  ]);

  await knex('cases').insert([
    {
      id: 1,
      name: "Acme Inc. v. Globex",
      number: "AC-2024-001",
      status: "open",
      disposition: "settlement",
      assigned_to: "Alice Manager",
      notes: "Large contract dispute. Lots of PDFs involved. Settled out of court.",
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      name: "Government v. John Doe",
      number: "GOV-2024-0047",
      status: "open",
      disposition: "plea",
      assigned_to: "Bob User",
      notes: "White-collar criminal case, intensive research required. Plea agreement reached.",
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 3,
      name: "State v. Jane Smith",
      number: "ST-2024-0089",
      status: "closed",
      disposition: "dismissed",
      assigned_to: "Alice Manager",
      notes: "Criminal case dismissed due to insufficient evidence.",
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 4,
      name: "Tech Corp Securities Investigation",
      number: "SEC-2024-0122",
      status: "flagged",
      assigned_to: "Bob User",
      notes: "Ongoing SEC investigation, high priority case.",
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 5,
      name: "Miller Family Estate",
      number: "EST-2024-0034",
      status: "closed",
      disposition: "probation",
      assigned_to: "Sandra Support",
      notes: "Estate dispute resolved with probation terms.",
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);

  await knex('documents').insert([
    {
      id: 1,
      case_id: 1,
      name: "Master Contract.pdf",
      file_type: "application/pdf",
      size: 532416,
      category: "Contract",
      folder: "Legal",
      uploaded_by: "Alice Manager",
      file_url: "https://example.com/docs/master_contract.pdf",
      tags: JSON.stringify(["important", "contract", "2024"]),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      case_id: 1,
      name: "Purchase Orders.xlsx",
      file_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 84120,
      category: "Finance",
      folder: "Documents",
      uploaded_by: "Bob User",
      file_url: "https://example.com/docs/purchase_orders.xlsx",
      tags: JSON.stringify(["spreadsheet", "finance"]),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 3,
      case_id: 2,
      name: "Indictment.docx",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 31288,
      category: "Pleadings",
      folder: "Court",
      uploaded_by: "Sandra Support",
      file_url: "https://example.com/docs/indictment.docx",
      tags: JSON.stringify(["pleading", "court"]),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 4,
      case_id: 3,
      name: "Evidence Photo.jpg",
      file_type: "image/jpeg",
      size: 1245888,
      category: "Evidence",
      folder: "Media",
      uploaded_by: "Alice Manager",
      file_url: "https://example.com/docs/evidence_photo.jpg",
      tags: JSON.stringify(["photo", "evidence"]),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 5,
      case_id: 4,
      name: "Financial Statement.pdf",
      file_type: "application/pdf",
      size: 722340,
      category: "Finance",
      folder: "Documents",
      uploaded_by: "Bob User",
      file_url: "https://example.com/docs/financial_statement.pdf",
      tags: JSON.stringify(["finance", "sec"]),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 6,
      case_id: 4,
      name: "Board Minutes.docx",
      file_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 45120,
      category: "Corporate",
      folder: "Documents",
      uploaded_by: "Bob User",
      file_url: "https://example.com/docs/board_minutes.docx",
      tags: JSON.stringify(["corporate", "minutes"]),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 7,
      case_id: 5,
      name: "Will Document.pdf",
      file_type: "application/pdf",
      size: 186720,
      category: "Legal",
      folder: "Estate",
      uploaded_by: "Sandra Support",
      file_url: "https://example.com/docs/will.pdf",
      tags: JSON.stringify(["will", "estate"]),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);

  await knex('audit_logs').insert([
    {
      case_id: 1,
      user: "Alice Manager",
      action: "create",
      object_type: "case",
      object_id: 1,
      details: JSON.stringify({ name: "Acme Inc. v. Globex" }),
      timestamp: knex.fn.now()
    },
    {
      case_id: 1,
      user: "Alice Manager",
      action: "create",
      object_type: "document",
      object_id: 1,
      details: JSON.stringify({ name: "Master Contract.pdf" }),
      timestamp: knex.fn.now()
    },
    {
      case_id: 2,
      user: "Sandra Support",
      action: "create",
      object_type: "document",
      object_id: 3,
      details: JSON.stringify({ name: "Indictment.docx" }),
      timestamp: knex.fn.now()
    }
  ]);
};