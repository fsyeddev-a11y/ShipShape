"use strict";
/**
 * audit-seed.ts
 * Supplements the existing seed data to meet audit requirements:
 *   - 500+ total documents
 *   - 20+ users
 *
 * Run with:
 *   DATABASE_URL=postgres://ship:ship_dev_password@localhost:5432/ship_dev npx tsx scripts/audit-seed.ts
 *
 * Safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING for users,
 * and checks document counts before inserting to avoid duplicates.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pg_1 = require("pg");
var bcrypt_1 = require("bcrypt");
var Pool = pg_1.default.Pool;
var pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://ship:ship_dev_password@localhost:5432/ship_dev',
});
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
var TARGET_DOCUMENTS = 500;
var TARGET_USERS = 20;
var WORKSPACE_ID = '1970e4e3-28a3-4aaa-aeea-c0335c5ec567'; // Ship Workspace
// Extra users to add (beyond the 12 already seeded)
var EXTRA_USERS = [
    { email: 'karen.white@ship.local', name: 'Karen White' },
    { email: 'leo.harris@ship.local', name: 'Leo Harris' },
    { email: 'mia.clark@ship.local', name: 'Mia Clark' },
    { email: 'noah.lewis@ship.local', name: 'Noah Lewis' },
    { email: 'olivia.young@ship.local', name: 'Olivia Young' },
    { email: 'paul.walker@ship.local', name: 'Paul Walker' },
    { email: 'quinn.hall@ship.local', name: 'Quinn Hall' },
    { email: 'rose.allen@ship.local', name: 'Rose Allen' },
    { email: 'sam.scott@ship.local', name: 'Sam Scott' },
    { email: 'tina.adams@ship.local', name: 'Tina Adams' },
];
// Wiki document templates — varied realistic content
var WIKI_TITLES = [
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
var ISSUE_STATES = ['backlog', 'in_progress', 'in_review', 'done', 'cancelled'];
var ISSUE_PRIORITIES = ['urgent', 'high', 'medium', 'low'];
function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function makeTiptapContent(text) {
    return {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [{ type: 'text', text: text }],
            },
        ],
    };
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var client, counts, currentDocs, currentUsers, passwordHash, usersAdded, needed, toAdd, _i, toAdd_1, u, exists, result, userId, allUsers, userIds, programs, programIds, refreshedCount, docCount, docsNeeded, wikiIndex, wikiDocsAdded, baseTitle, suffix, title, createdBy, content, currentIssues, issueCount, issuesToAdd, issuesAdded, issueTitles, sprints, sprintIds, ticketOffset, nextTicket, i, title, createdBy, assigneeId, state, priority, programId, issueResult, issueId, sprintId, final, f;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.connect()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 36, 38]);
                    return [4 /*yield*/, client.query("\n      SELECT\n        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1) as docs,\n        (SELECT COUNT(*) FROM users) as users\n    ", [WORKSPACE_ID])];
                case 3:
                    counts = _a.sent();
                    currentDocs = parseInt(counts.rows[0].docs, 10);
                    currentUsers = parseInt(counts.rows[0].users, 10);
                    console.log("Current state: ".concat(currentDocs, " documents, ").concat(currentUsers, " users"));
                    return [4 /*yield*/, bcrypt_1.default.hash('admin123', 10)];
                case 4:
                    passwordHash = _a.sent();
                    usersAdded = 0;
                    if (!(currentUsers < TARGET_USERS)) return [3 /*break*/, 12];
                    needed = TARGET_USERS - currentUsers;
                    toAdd = EXTRA_USERS.slice(0, needed);
                    _i = 0, toAdd_1 = toAdd;
                    _a.label = 5;
                case 5:
                    if (!(_i < toAdd_1.length)) return [3 /*break*/, 11];
                    u = toAdd_1[_i];
                    return [4 /*yield*/, client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [u.email])];
                case 6:
                    exists = _a.sent();
                    if (exists.rows.length > 0)
                        return [3 /*break*/, 10];
                    return [4 /*yield*/, client.query("INSERT INTO users (email, password_hash, name, last_workspace_id)\n           VALUES ($1, $2, $3, $4)\n           RETURNING id", [u.email, passwordHash, u.name, WORKSPACE_ID])];
                case 7:
                    result = _a.sent();
                    userId = result.rows[0].id;
                    // Add workspace membership
                    return [4 /*yield*/, client.query("INSERT INTO workspace_memberships (workspace_id, user_id, role)\n           VALUES ($1, $2, 'member')\n           ON CONFLICT (workspace_id, user_id) DO NOTHING", [WORKSPACE_ID, userId])];
                case 8:
                    // Add workspace membership
                    _a.sent();
                    // Create person document
                    return [4 /*yield*/, client.query("INSERT INTO documents (workspace_id, document_type, title, properties, created_by)\n           VALUES ($1, 'person', $2, $3, $4)", [
                            WORKSPACE_ID,
                            u.name,
                            JSON.stringify({ user_id: userId, email: u.email }),
                            userId,
                        ])];
                case 9:
                    // Create person document
                    _a.sent();
                    usersAdded++;
                    _a.label = 10;
                case 10:
                    _i++;
                    return [3 /*break*/, 5];
                case 11:
                    console.log("\u2705 Added ".concat(usersAdded, " users (total now ~").concat(currentUsers + usersAdded, ")"));
                    return [3 /*break*/, 13];
                case 12:
                    console.log('ℹ️  Users already meet target (20+)');
                    _a.label = 13;
                case 13: return [4 /*yield*/, client.query("SELECT u.id FROM users u\n       JOIN workspace_memberships wm ON wm.user_id = u.id AND wm.workspace_id = $1", [WORKSPACE_ID])];
                case 14:
                    allUsers = _a.sent();
                    userIds = allUsers.rows.map(function (r) { return r.id; });
                    return [4 /*yield*/, client.query("SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'program'", [WORKSPACE_ID])];
                case 15:
                    programs = _a.sent();
                    programIds = programs.rows.map(function (r) { return r.id; });
                    return [4 /*yield*/, client.query('SELECT COUNT(*) as docs FROM documents WHERE workspace_id = $1', [WORKSPACE_ID])];
                case 16:
                    refreshedCount = _a.sent();
                    docCount = parseInt(refreshedCount.rows[0].docs, 10);
                    docsNeeded = Math.max(0, TARGET_DOCUMENTS - docCount);
                    if (!(docsNeeded === 0)) return [3 /*break*/, 17];
                    console.log('ℹ️  Documents already meet target (500+)');
                    return [3 /*break*/, 21];
                case 17:
                    console.log("Adding ".concat(docsNeeded, " wiki documents..."));
                    wikiIndex = 0;
                    wikiDocsAdded = 0;
                    _a.label = 18;
                case 18:
                    if (!(wikiDocsAdded < docsNeeded)) return [3 /*break*/, 20];
                    baseTitle = WIKI_TITLES[wikiIndex % WIKI_TITLES.length];
                    suffix = Math.floor(wikiIndex / WIKI_TITLES.length) > 0
                        ? " (v".concat(Math.floor(wikiIndex / WIKI_TITLES.length) + 1, ")")
                        : '';
                    title = baseTitle + suffix;
                    createdBy = randomItem(userIds);
                    content = makeTiptapContent("This document covers ".concat(title.toLowerCase(), ". It was created as part of the audit seed dataset."));
                    return [4 /*yield*/, client.query("INSERT INTO documents (workspace_id, document_type, title, content, created_by)\n           VALUES ($1, 'wiki', $2, $3, $4)", [WORKSPACE_ID, title, JSON.stringify(content), createdBy])];
                case 19:
                    _a.sent();
                    wikiDocsAdded++;
                    wikiIndex++;
                    if (wikiDocsAdded % 50 === 0) {
                        console.log("  ... ".concat(wikiDocsAdded, "/").concat(docsNeeded, " wiki docs added"));
                    }
                    return [3 /*break*/, 18];
                case 20:
                    console.log("\u2705 Added ".concat(wikiDocsAdded, " wiki documents"));
                    _a.label = 21;
                case 21: return [4 /*yield*/, client.query("SELECT COUNT(*) as cnt FROM documents WHERE workspace_id = $1 AND document_type = 'issue'", [WORKSPACE_ID])];
                case 22:
                    currentIssues = _a.sent();
                    issueCount = parseInt(currentIssues.rows[0].cnt, 10);
                    if (!(issueCount < 150)) return [3 /*break*/, 33];
                    issuesToAdd = 150 - issueCount;
                    console.log("Adding ".concat(issuesToAdd, " extra issues for load test headroom..."));
                    issuesAdded = 0;
                    issueTitles = [
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
                    return [4 /*yield*/, client.query("SELECT id FROM documents WHERE workspace_id = $1 AND document_type = 'sprint' LIMIT 10", [WORKSPACE_ID])];
                case 23:
                    sprints = _a.sent();
                    sprintIds = sprints.rows.map(function (r) { return r.id; });
                    return [4 /*yield*/, client.query("SELECT COALESCE(MAX(ticket_number), 0) as max FROM documents WHERE workspace_id = $1", [WORKSPACE_ID])];
                case 24:
                    ticketOffset = _a.sent();
                    nextTicket = parseInt(ticketOffset.rows[0].max, 10) + 1;
                    i = 0;
                    _a.label = 25;
                case 25:
                    if (!(i < issuesToAdd)) return [3 /*break*/, 32];
                    title = issueTitles[i % issueTitles.length] + " #".concat(nextTicket);
                    createdBy = randomItem(userIds);
                    assigneeId = randomItem(userIds);
                    state = randomItem(ISSUE_STATES);
                    priority = randomItem(ISSUE_PRIORITIES);
                    programId = programIds.length > 0 ? randomItem(programIds) : null;
                    return [4 /*yield*/, client.query("INSERT INTO documents (workspace_id, document_type, title, ticket_number, properties, created_by)\n           VALUES ($1, 'issue', $2, $3, $4, $5)\n           RETURNING id", [
                            WORKSPACE_ID,
                            title,
                            nextTicket,
                            JSON.stringify({ state: state, priority: priority, assignee_id: assigneeId }),
                            createdBy,
                        ])];
                case 26:
                    issueResult = _a.sent();
                    issueId = issueResult.rows[0].id;
                    if (!(sprintIds.length > 0)) return [3 /*break*/, 28];
                    sprintId = randomItem(sprintIds);
                    return [4 /*yield*/, client.query("INSERT INTO document_associations (document_id, related_id, relationship_type)\n             VALUES ($1, $2, 'sprint')\n             ON CONFLICT DO NOTHING", [issueId, sprintId])];
                case 27:
                    _a.sent();
                    _a.label = 28;
                case 28:
                    if (!programId) return [3 /*break*/, 30];
                    return [4 /*yield*/, client.query("INSERT INTO document_associations (document_id, related_id, relationship_type)\n             VALUES ($1, $2, 'program')\n             ON CONFLICT DO NOTHING", [issueId, programId])];
                case 29:
                    _a.sent();
                    _a.label = 30;
                case 30:
                    nextTicket++;
                    issuesAdded++;
                    _a.label = 31;
                case 31:
                    i++;
                    return [3 /*break*/, 25];
                case 32:
                    console.log("\u2705 Added ".concat(issuesAdded, " extra issues"));
                    return [3 /*break*/, 34];
                case 33:
                    console.log('ℹ️  Issues already above 150');
                    _a.label = 34;
                case 34: return [4 /*yield*/, client.query("\n      SELECT\n        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1) as total_documents,\n        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND document_type = 'issue') as issues,\n        (SELECT COUNT(*) FROM users) as users,\n        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND document_type = 'sprint') as sprints,\n        (SELECT COUNT(*) FROM documents WHERE workspace_id = $1 AND document_type = 'wiki') as wikis\n    ", [WORKSPACE_ID])];
                case 35:
                    final = _a.sent();
                    f = final.rows[0];
                    console.log('\n=== Final counts ===');
                    console.log("Total documents : ".concat(f.total_documents, " (target: 500+)"));
                    console.log("Issues          : ".concat(f.issues, " (target: 100+)"));
                    console.log("Users           : ".concat(f.users, " (target: 20+)"));
                    console.log("Sprints         : ".concat(f.sprints, " (target: 10+)"));
                    console.log("Wikis           : ".concat(f.wikis));
                    return [3 /*break*/, 38];
                case 36:
                    client.release();
                    return [4 /*yield*/, pool.end()];
                case 37:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 38: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('Seed error:', err);
    process.exit(1);
});
