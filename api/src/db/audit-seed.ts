/**
 * audit-seed.ts
 * Supplements the existing seed data to meet audit requirements:
 *   - 500+ total documents
 *   - 20+ users
 *
 * Run with:
 *   DATABASE_URL=postgres://ship:ship_dev_password@localhost:5432/ship_dev ./api/node_modules/.bin/tsx api/src/db/audit-seed.ts
 *
 * Safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING for users,
 * and checks document counts before inserting to avoid duplicates.
 */

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://ship:ship_dev_password@localhost:5432/ship_dev',
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TARGET_DOCUMENTS = 500;
const TARGET_USERS = 20;
const WORKSPACE_ID = '1970e4e3-28a3-4aaa-aeea-c0335c5ec567'; // Ship Workspace

// Extra users to add (beyond the 12 already seeded)
const EXTRA_USERS = [
  { email: 'karen.white@ship.local',   name: 'Karen White' },
  { email: 'leo.harris@ship.local',    name: 'Leo Harris' },
  { email: 'mia.clark@ship.local',     name: 'Mia Clark' },
  { email: 'noah.lewis@ship.local',    name: 'Noah Lewis' },
  { email: 'olivia.young@ship.local',  name: 'Olivia Young' },
  { email: 'paul.walker@ship.local',   name: 'Paul Walker' },
  { email: 'quinn.hall@ship.local',    name: 'Quinn Hall' },
  { email: 'rose.allen@ship.local',    name: 'Rose Allen' },
  { email: 'sam.scott@ship.local',     name: 'Sam Scott' },
  { email: 'tina.adams@ship.local',    name: 'Tina Adams' },
];

// Wiki document templates — varied realistic content
const WIKI_TITLES = [
  'Onboarding Guide',
  'Engineering Handbook',
  'Deployment Process',
  'Code Review Standards',
  'Incident Response Playbook',
  'API Design Guidelines',
  'Database Migration Checklist',
  'Security Policy',
  'Accessibility Standards',
  'Performance Benchmarks',
  'Release Notes',
  'Architecture Decision Records',
  'Team Norms',
  'Sprint Ceremonies',
  'Stakeholder Map',
  'Product Roadmap',
  'Data Dictionary',
  'Monitoring & Alerting',
  'Runbook: Database Failover',
  'Runbook: Service Restart',
  'Runbook: Rollback Procedure',
  'Feature Flag Management',
  'Local Dev Setup',
  'CI/CD Pipeline Overview',
  'Testing Strategy',
  'Error Handling Standards',
  'Logging Guidelines',
  'Third-Party Integrations',
  'Secrets Management',
  'Disaster Recovery Plan',
];

const ISSUE_STATES = ['backlog', 'in_progress', 'in_review', 'done', 'cancelled'];
const ISSUE_PRIORITIES = ['urgent', 'high', 'medium', 'low'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function makeTiptapContent(text: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

async function main() {
  const client = await pool.connect();

  try {
    // -----------------------------------------------------------------------
    // 1. Count current state
    // -----------------------------------------------------------------------
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1) as docs,
        (SELECT COUNT(*) FROM users) as users
    `, [WORKSPACE_ID]);

    const currentDocs = parseInt(counts.rows[0].docs, 10);
    const currentUsers = parseInt(counts.rows[0].users, 10);

    console.log(`Current state: ${currentDocs} documents, ${currentUsers} users`);

    // -----------------------------------------------------------------------
    // 2. Add extra users if needed
    // -----------------------------------------------------------------------
    // Reuse existing password hash from a seeded user rather than importing bcrypt
    const existingHash = await client.query(
      `SELECT password_hash FROM users WHERE password_hash IS NOT NULL LIMIT 1`
    );
    const passwordHash: string = existingHash.rows[0]?.password_hash ?? '';
    let usersAdded = 0;

    if (currentUsers < TARGET_USERS) {
      const needed = TARGET_USERS - currentUsers;
      const toAdd = EXTRA_USERS.slice(0, needed);

      for (const u of toAdd) {
        const exists = await client.query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
          [u.email]
        );
        if (exists.rows.length > 0) continue;

        const result = await client.query(
          `INSERT INTO users (email, password_hash, name, last_workspace_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [u.email, passwordHash, u.name, WORKSPACE_ID]
        );
        const userId = result.rows[0].id;

        // Add workspace membership
        await client.query(
          `INSERT INTO workspace_memberships (workspace_id, user_id, role)
           VALUES ($1, $2, 'member')
           ON CONFLICT (workspace_id, user_id) DO NOTHING`,
          [WORKSPACE_ID, userId]
        );

        // Create person document
        await client.query(
          `INSERT INTO documents (workspace_id, document_type, title, properties, created_by)
           VALUES ($1, 'person', $2, $3, $4)`,
          [
            WORKSPACE_ID,
            u.name,
            JSON.stringify({ user_id: userId, email: u.email }),
            userId,
          ]
        );

        usersAdded++;
      }

      console.log(`✅ Added ${usersAdded} users (total now ~${currentUsers + usersAdded})`);
    } else {
      console.log('ℹ️  Users already meet target (20+)');
    }

    // -----------------------------------------------------------------------
    // 3. Get all user IDs for document ownership
    // -----------------------------------------------------------------------
    const allUsers = await client.query(
      `SELECT u.id FROM users u
       JOIN workspace_memberships wm ON wm.user_id = u.id AND wm.workspace_id = $1`,
      [WORKSPACE_ID]
    );
    const userIds: string[] = allUsers.rows.map((r: { id: string }) => r.id);

    // Get programs for issue association
    const programs = await client.query(
      `SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'program'`,
      [WORKSPACE_ID]
    );
    const programIds: string[] = programs.rows.map((r: { id: string }) => r.id);

    // -----------------------------------------------------------------------
    // 4. Add wiki documents until we hit 500 total
    // -----------------------------------------------------------------------
    const refreshedCount = await client.query(
      'SELECT COUNT(*) as docs FROM documents WHERE workspace_id = $1',
      [WORKSPACE_ID]
    );
    let docCount = parseInt(refreshedCount.rows[0].docs, 10);
    const docsNeeded = Math.max(0, TARGET_DOCUMENTS - docCount);

    if (docsNeeded === 0) {
      console.log('ℹ️  Documents already meet target (500+)');
    } else {
      console.log(`Adding ${docsNeeded} wiki documents...`);

      let wikiIndex = 0;
      let wikiDocsAdded = 0;

      while (wikiDocsAdded < docsNeeded) {
        const baseTitle = WIKI_TITLES[wikiIndex % WIKI_TITLES.length]!;
        const suffix = Math.floor(wikiIndex / WIKI_TITLES.length) > 0
          ? ` (v${Math.floor(wikiIndex / WIKI_TITLES.length) + 1})`
          : '';
        const title = baseTitle + suffix;
        const createdBy = randomItem(userIds);
        const content = makeTiptapContent(
          `This document covers ${title.toLowerCase()}. It was created as part of the audit seed dataset.`
        );

        await client.query(
          `INSERT INTO documents (workspace_id, document_type, title, content, created_by)
           VALUES ($1, 'wiki', $2, $3, $4)`,
          [WORKSPACE_ID, title, JSON.stringify(content), createdBy]
        );

        wikiDocsAdded++;
        wikiIndex++;

        if (wikiDocsAdded % 50 === 0) {
          console.log(`  ... ${wikiDocsAdded}/${docsNeeded} wiki docs added`);
        }
      }

      console.log(`✅ Added ${wikiDocsAdded} wiki documents`);
    }

    // -----------------------------------------------------------------------
    // 5. Add additional issues if we want more issue volume
    //    (already at 105 which meets 100+ requirement, but add 50 more for
    //     meaningful load testing headroom)
    // -----------------------------------------------------------------------
    const currentIssues = await client.query(
      `SELECT COUNT(*) as cnt FROM documents WHERE workspace_id = $1 AND document_type = 'issue'`,
      [WORKSPACE_ID]
    );
    const issueCount = parseInt(currentIssues.rows[0].cnt, 10);

    if (issueCount < 150) {
      const issuesToAdd = 150 - issueCount;
      console.log(`Adding ${issuesToAdd} extra issues for load test headroom...`);

      let issuesAdded = 0;
      const issueTitles = [
        'Fix pagination on issues list',
        'Add keyboard shortcuts',
        'Improve search performance',
        'Resolve session timeout edge case',
        'Update dependency versions',
        'Write unit tests for auth flow',
        'Add error boundary to editor',
        'Fix broken CI pipeline step',
        'Migrate legacy endpoint to new schema',
        'Improve accessibility on modal dialogs',
        'Reduce bundle size',
        'Add rate limiting to public endpoints',
        'Fix N+1 query in projects route',
        'Add database connection pooling metrics',
        'Implement optimistic UI updates',
        'Add E2E test for sprint creation',
        'Fix date timezone handling',
        'Improve error messages on validation failures',
        'Add audit log for admin actions',
        'Resolve flaky E2E tests',
      ];

      // Get any sprint for association
      const sprints = await client.query(
        `SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'sprint' LIMIT 10`,
        [WORKSPACE_ID]
      );
      const sprintIds: string[] = sprints.rows.map((r: { id: string }) => r.id);

      let ticketOffset = await client.query(
        `SELECT COALESCE(MAX(ticket_number), 0) as max FROM documents WHERE workspace_id = $1`,
        [WORKSPACE_ID]
      );
      let nextTicket = parseInt(ticketOffset.rows[0].max, 10) + 1;

      for (let i = 0; i < issuesToAdd; i++) {
        const title = issueTitles[i % issueTitles.length]! + ` #${nextTicket}`;
        const createdBy = randomItem(userIds);
        const assigneeId = randomItem(userIds);
        const state = randomItem(ISSUE_STATES);
        const priority = randomItem(ISSUE_PRIORITIES);
        const programId = programIds.length > 0 ? randomItem(programIds) : null;

        const issueResult = await client.query(
          `INSERT INTO documents (workspace_id, document_type, title, ticket_number, properties, created_by)
           VALUES ($1, 'issue', $2, $3, $4, $5)
           RETURNING id`,
          [
            WORKSPACE_ID,
            title,
            nextTicket,
            JSON.stringify({ state, priority, assignee_id: assigneeId }),
            createdBy,
          ]
        );
        const issueId = issueResult.rows[0].id;

        // Associate with a sprint and program
        if (sprintIds.length > 0) {
          const sprintId = randomItem(sprintIds);
          await client.query(
            `INSERT INTO document_associations (document_id, related_id, relationship_type)
             VALUES ($1, $2, 'sprint')
             ON CONFLICT DO NOTHING`,
            [issueId, sprintId]
          );
        }
        if (programId) {
          await client.query(
            `INSERT INTO document_associations (document_id, related_id, relationship_type)
             VALUES ($1, $2, 'program')
             ON CONFLICT DO NOTHING`,
            [issueId, programId]
          );
        }

        nextTicket++;
        issuesAdded++;
      }

      console.log(`✅ Added ${issuesAdded} extra issues`);
    } else {
      console.log('ℹ️  Issues already above 150');
    }

    // -----------------------------------------------------------------------
    // 6. Final counts
    // -----------------------------------------------------------------------
    const final = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1) as total_documents,
        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND document_type = 'issue') as issues,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND document_type = 'sprint') as sprints,
        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND document_type = 'wiki') as wikis
    `, [WORKSPACE_ID]);

    const f = final.rows[0];
    console.log('\n=== Final counts ===');
    console.log(`Total documents : ${f.total_documents} (target: 500+)`);
    console.log(`Issues          : ${f.issues} (target: 100+)`);
    console.log(`Users           : ${f.users} (target: 20+)`);
    console.log(`Sprints         : ${f.sprints} (target: 10+)`);
    console.log(`Wikis           : ${f.wikis}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
