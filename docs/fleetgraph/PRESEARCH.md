# FleetGraph Pre-Search

Completed before writing any code. This document captures the design decisions, use cases, and architecture for the FleetGraph project intelligence agent.

---

## Phase 1: Define Your Agent

### 1. Agent Responsibility Scoping

**What events in Ship should the agent monitor proactively?**

1. **Sprint state decay** — Issues sitting in `in_progress` for >5 days with no `document_history` updates. Issues in `triage` for >3 days with no assignee. Issues in `in_review` for >2 days with no activity. These are time-based detections that require polling because the signal is the *absence* of activity, not an event.

2. **Sprint health indicators** — Active sprints with unassigned issues, sprints approaching their end date with low completion rates (burndown off-track), sprints that haven't been started despite passing their start date.

3. **Accountability escalation** — Ship already has an accountability service (`api/src/services/accountability.ts`) that detects missing standups, plans, and retros. FleetGraph doesn't duplicate this. Instead, it monitors when accountability items remain unresolved for >2 days and escalates up the `reports_to` management chain with impact context.

4. **Sprint carryover risk** — 2 business days before a sprint's end date, the agent analyzes remaining incomplete issues against historical velocity to identify which issues are unlikely to finish.

5. **Cross-project status changes** — Weekly aggregation across all programs and projects: issues completed, issues carried over, blockers identified, velocity trends.

**What constitutes a condition worth surfacing?**

A condition is worth surfacing when:
- It represents a risk to sprint delivery that the responsible person may not be aware of (stale issues, carryover risk)
- It requires action from someone who hasn't taken it within the expected timeframe (escalation)
- It provides a summary that saves a Director/VP 30+ minutes of manual data gathering (weekly digest)
- The agent can provide specific, actionable next steps — not just "something is wrong"

The agent stays quiet when:
- All issues are progressing normally (no stale items, burndown on track)
- Accountability items are being resolved within the expected window
- The data hasn't changed since the last check (cache-based dedup)

**What is the agent allowed to do without human approval?**

- Create draft wiki documents (status reports, weekly digests) — these are drafts, not published
- Add comments on issues with findings (e.g., "This issue has been in_progress for 7 days with no updates")
- Update low-risk metadata on issues (tags, labels) — no state changes
- Log its own findings in Ship's document system for audit trail

**What must always require confirmation?**

- Reassigning issues to different people
- Moving issues between sprints
- Changing issue state (especially closing, cancelling, or moving to done)
- Creating new issues (even from detected problems)
- Sending notifications to other team members
- Escalating to managers — the agent surfaces the escalation to the PM first, who decides whether to forward it
- Any action in the AI Factory pipeline (merge, deploy, branch creation)

**How does the agent know who is on a project?**

- `GET /api/team/assignments` — maps issues to people, showing who is allocated to which sprint/project
- `GET /api/team/people` — full team roster with `reports_to` field linking person documents in a management hierarchy
- `document_associations` with `relationship_type: 'project'` or `'sprint'` — shows which issues/sprints belong to which projects
- `properties.owner_id` on sprint and project documents — identifies the sprint/project owner
- `properties.assignee_id` on issue documents — identifies who is responsible for each issue

**How does the agent know who to notify?**

- **Sprint owner** (`properties.owner_id`) receives sprint health and carryover alerts
- **Issue assignee** (`properties.assignee_id`) receives stale issue nudges
- **Manager** (via `reports_to` on person documents) receives escalations when direct reports have unresolved accountability items
- **Program/project owner** receives weekly digests for their scope
- Notifications are delivered as Ship comments on the relevant document + WebSocket `accountability:updated` event for real-time UI updates

**How does the on-demand mode use context from the current view?**

The chat component passes the current document ID from the URL (`/documents/:id`). The agent calls `GET /api/claude/context?context_type=sprint&sprint_id=:id` (or equivalent for project/program) which returns the full context chain: program → project → sprint → issues → standups → retros. This context is injected into the LLM prompt so the agent can answer questions specific to what the user is viewing.

At MVP, the full page context is always included. In Phase 2, a smaller routing sub-agent will decide if broader context (related sprints, other projects in the program) is needed, to save tokens and latency.

---

### 2. Use Case Discovery

| # | Role | Trigger | Agent Detects / Produces | Human Decides |
|---|------|---------|--------------------------|---------------|
| 1 | PM | Poll (daily 9am + every 5 min) | **Sprint Health Report**: Unassigned issues in active sprint, issues blocked >2 days, burndown off-track. Structured digest with specific action items. | Whether to reassign, adjust scope, or escalate |
| 2 | Engineer/PM | Poll (every 5 min) | **Stale Issue Alert**: Issues in `in_progress` >5 days with no `document_history` updates, issues in `triage` >3 days with no assignee. Adds a comment on the issue with the finding. | Whether to reassign, reprioritize, or close |
| 3 | Director/VP | Poll (every 2 days) | **Escalation Intelligence**: Ship accountability items unresolved >2 days. Agent follows `reports_to` chain, provides downstream impact context (e.g., "Sprint X has 3 members who haven't posted standups in 4 days — this sprint is invisible to leadership"). | Whether to intervene, schedule a sync, or dismiss |
| 4 | PM | Poll (2 days before sprint end) | **Sprint Carryover Risk**: Issues unlikely to complete based on velocity (days remaining vs typical completion time for similar issues). Ranked list of carryover candidates. | Which issues to carry over, push to complete, or cancel |
| 5 | Director/VP | Poll (weekly, Monday 8am) | **Weekly Status Digest**: Auto-generated summary across all programs — issues completed, issues slipped, who's blocked, velocity trends. Created as a Ship wiki document. | Whether to share with stakeholders, add commentary, adjust priorities |
| 6 | Any | User invokes chat | **Context-Aware Q&A**: "What's blocking this sprint?" — agent fetches sprint context, analyzes issue states, identifies blockers, provides actionable recommendations. | Whether to act on recommendations |
| 7 | PM | State change (feature → researched) | **Factory Lite — Spec Generation**: Research Agent takes a PM's feature description, analyzes existing Ship documentation and specs, and produces a structured planning packet: acceptance criteria, test plan, edge cases, dependencies, and complexity estimate. MVP scope is strictly spec generation — no code generation, no autonomous implementation. The output is a Ship document linked to the original feature request. Future phases may extend to code generation and automated QA, but MVP focuses on turning vague feature requests into actionable, well-structured specs. | PM reviews the generated spec, edits as needed, approves or requests changes |

**How use cases were discovered:**

These weren't invented — they map to real pain points described in the PRD: "Issues go stale, sprints slip, standups don't get logged, blockers sit unresolved for days." Each use case targets a specific role (PM, Engineer, Director) with a specific failure mode (stale work, missing accountability, invisible progress). Factory Lite (Use Case 7) extends this from detection to structured planning — turning vague feature requests into actionable specs.

---

### 3. Trigger Model Decision

**Decision: Hybrid (scheduled polling + event-driven state changes)**

| Trigger Type | Frequency | Use Cases | Cost per Run |
|-------------|-----------|-----------|-------------|
| High-frequency poll | Every 5 min | Stale issues (#2), Sprint health (#1) | Low (API calls only, LLM invoked only if state changed) |
| Daily scheduled | 9am weekdays | Sprint health digest (#1) | Medium (~5K tokens for digest generation) |
| Weekly scheduled | Monday 8am | Weekly digest (#5) | Medium-High (~15K tokens for cross-project summary) |
| Condition-based | 2 days before sprint end | Carryover risk (#4) | Medium (~8K tokens for velocity analysis) |
| Escalation check | Every 2 days | Escalation (#3) | Low-Medium (piggybacks on accountability API) |
| On-demand | User action | Chat Q&A (#6) | Medium (~10K tokens per conversation turn) |
| State-change | Spec → in_sprint | AI Factory (#7) | High (~20K tokens for Research Agent) |

**Tradeoffs:**

| Approach | Pros | Cons |
|----------|------|------|
| **Pure polling** | Simple, guaranteed coverage, predictable cost | Wastes resources when nothing changed; higher latency for event-driven cases |
| **Pure event-driven** | Lowest cost, instant response to changes | Misses time-decay problems (stale issues are defined by *absence* of events); Ship's WebSocket events are limited to `accountability:updated` and `title:updated` |
| **Hybrid (our choice)** | Achieves <5 min detection latency for time-based issues; instant response for state changes; cost-efficient with caching | More complex trigger management; need to prevent duplicate detection between poll and event paths |

**Why hybrid is defensible:**

1. Ship's WebSocket only emits 2 event types. Most of our detections need time-decay awareness (stale = no activity for N days), which requires polling.
2. The AI Factory needs instant response to state changes — polling every 5 min would add unnecessary latency.
3. Cost is controlled via **cache-based dedup**: fetch data first (cheap API calls), hash the result, skip LLM if hash matches previous run. At 100 projects, this reduces ~28,800 polls/day to ~2,000 actual LLM calls.

**Staleness tolerance by use case:**

| Use Case | Max acceptable staleness |
|----------|------------------------|
| Stale issues | 5 min (poll frequency) |
| Sprint health | 5 min for alerts, daily for digest |
| Escalation | 2 days (check interval) |
| Carryover | 1 day (checked 2 days before sprint end) |
| Weekly digest | 1 week (generated Monday) |
| Chat Q&A | 0 (real-time) |
| AI Factory | 0 (state-change triggered) |

**Cost at scale:**

| Scale | Polls/day | LLM calls/day (with caching) | Est. cost/day |
|-------|-----------|------------------------------|---------------|
| 10 projects | 2,880 | ~200 | ~$0.50 |
| 100 projects | 28,800 | ~2,000 | ~$5.00 |
| 1,000 projects | 288,000 | ~20,000 | ~$50.00 |

---

## Phase 2: Graph Architecture

### 4. Node Design

**Context Nodes:**
- `context_router` — Determines mode (proactive vs on-demand), identifies the user/workspace, extracts the current view context (document ID from URL for on-demand mode)
- `context_enricher` — Fetches user role, workspace membership, team relationships via `/api/team/people`

**Fetch Nodes (run in parallel where possible):**
- `fetch_issues` — `GET /api/issues` with filters for the relevant project/sprint
- `fetch_sprint` — `GET /api/weeks/:id` with sprint details, plan, review status
- `fetch_team` — `GET /api/team/assignments` + `GET /api/team/people` for roster and allocations
- `fetch_accountability` — `GET /api/accountability/action-items` for existing accountability data
- `fetch_document_context` — `GET /api/claude/context` for on-demand mode (full context chain)
- `fetch_history` — `GET /api/activity/:entityType/:entityId` for change history on specific items

Parallel grouping: `fetch_issues`, `fetch_sprint`, and `fetch_team` always run in parallel. `fetch_accountability` and `fetch_document_context` run conditionally based on mode.

**Reasoning Nodes:**
- `analyze_sprint_health` — LLM examines issue states, dates, assignments. Produces findings with severity (info/warning/critical)
- `analyze_stale_issues` — Compares `updated_at` and `document_history` timestamps against thresholds
- `analyze_escalation` — Cross-references accountability items with resolution status and `reports_to` chain
- `analyze_carryover` — Velocity calculation + LLM reasoning about completion likelihood
- `generate_digest` — LLM synthesizes cross-project data into a readable summary
- `research_feature` — Research Agent sub-graph for AI Factory use case
- `chat_reasoning` — General-purpose reasoning for on-demand Q&A

**Conditional Edges:**
- `reasoning → clean_exit` — No problems found, log and exit
- `reasoning → finding_output` — Problems detected, format and notify
- `reasoning → action_proposal` — Problems detected AND agent has a suggested fix → route to human gate
- `human_gate → execute_action` — Human approved
- `human_gate → dismiss` — Human rejected → log and exit
- `human_gate → snooze` — Human deferred → schedule re-check

**LangSmith Trace Differentiation:**

A "clean run" and a "problem-detected run" will produce visibly different traces in LangSmith:

| Trace Path | Clean Run | Problem Detected | Action Required |
|------------|-----------|------------------|-----------------|
| Nodes executed | context → fetch (parallel) → reasoning → **clean_exit** | context → fetch (parallel) → reasoning → **finding_output** → notify | context → fetch (parallel) → reasoning → **action_proposal** → **human_gate** → execute/dismiss |
| LLM calls | 1 (reasoning — concludes "no issues") | 1 (reasoning — identifies problems + formats findings) | 1-2 (reasoning + action formatting) |
| Ship API writes | 0 | 1+ (comment on issue) | 1+ (comment + state change if approved) |
| Total nodes | 4-5 | 6-7 | 7-9 |
| Execution time | ~3s | ~5s | ~8s+ (includes human wait) |

The structural difference is visible in LangSmith's graph view: clean runs terminate at `clean_exit` (short trace), problem runs extend through `finding_output` or `action_proposal` → `human_gate` (longer trace with branching). The conditional edge from reasoning is the fork point — LangSmith shows which branch was taken and why (the reasoning node's output determines the route).

**Action Nodes:**
- `create_comment` — Add a comment on a Ship document with findings
- `create_document` — Create a wiki document (weekly digest, spec draft)
- `update_issue` — Modify issue properties (requires human gate for state changes)
- `notify_user` — Broadcast via WebSocket events

**Error/Fallback Nodes:**
- `handle_api_error` — Ship API returns 4xx/5xx → log error, retry once, then degrade gracefully
- `handle_missing_data` — Expected data not found → skip that detection, continue with available data
- `handle_timeout` — LLM or API call exceeds timeout → return partial results with disclaimer

### 5. State Management

**State carried across a single graph run (session state):**
```typescript
interface FleetGraphState {
  mode: 'proactive' | 'on_demand';
  trigger: 'poll' | 'schedule' | 'event' | 'chat';
  userId?: string;
  documentId?: string;
  chatMessage?: string;
  workspaceId: string;
  userRole: 'admin' | 'member';
  currentView?: { type: string; id: string };
  issues: Issue[];
  sprints: Sprint[];
  team: TeamMember[];
  accountability: AccountabilityItem[];
  documentContext?: any;
  findings: Finding[];
  severity: 'none' | 'info' | 'warning' | 'critical';
  suggestedActions: Action[];
  response?: string;
  notifications: Notification[];
  actionsExecuted: Action[];
  errors: string[];
  retryCount: number;
}
```

**State persisted between proactive runs (stored in Ship as documents or in a cache):**
- `lastRunHash` per use case per project — SHA-256 of the fetched data. If hash matches, skip LLM reasoning.
- `lastRunTimestamp` — When the agent last checked each project/sprint.
- `snoozedItems` — Items the human deferred, with snooze expiry time.
- `escalationHistory` — Which accountability items have been escalated and when, to prevent re-escalation.

**How to avoid redundant API calls:**
- **Data hash comparison:** Before invoking the LLM, hash the fetched API data. If it matches the previous run's hash, skip reasoning entirely. This is the primary cost-saving mechanism.
- **Conditional fetch:** Only fetch data relevant to the current use case. Sprint health doesn't need document content. Stale issues don't need team roster.
- **Rate-limited checks:** Escalation runs every 2 days, not every 5 minutes. Weekly digest runs once per week.

### 6. Human-in-the-Loop Design

**Which actions require confirmation?**
- Any issue state change (triage → backlog, in_progress → done, etc.)
- Issue reassignment (changing `assignee_id`)
- Moving issues between sprints (updating sprint association)
- Creating new issues
- Escalating to a manager
- Merging code (AI Factory)

**What does the confirmation experience look like in Ship?**

The human-in-the-loop interaction happens through the **embedded chat interface**, not a separate approval queue. The flow:

1. **Agent surfaces a finding** — The agent posts a structured comment on the relevant Ship document (issue, sprint, project). The comment includes:
   - **Finding:** What was detected and why it matters
   - **Recommendation:** The specific action the agent proposes
   - **Context:** Supporting data (e.g., "7 days since last update, sprint ends in 2 days")

2. **User sees it in context** — The comment appears on the document the user is already working on. If the user opens the embedded chat on that document, the agent's finding is part of the conversation context.

3. **User responds via chat** — The user can:
   - **Approve:** "Yes, reassign it to Sarah" → agent executes the action via Ship API (`PATCH /api/issues/:id`)
   - **Modify:** "Reassign it but change priority to high first" → agent adjusts and executes
   - **Dismiss:** "Not now, this is expected" → agent logs the dismissal and suppresses this finding
   - **Snooze:** "Remind me tomorrow" → agent defers for 24 hours
   - **Ignore:** User doesn't respond — after 48 hours, finding re-surfaces with increased severity

4. **Agent confirms execution** — After taking action, the agent posts a follow-up comment: "Done — reassigned ISS-42 to Sarah, priority set to high."

**Example interaction (stale issue detection):**

```
[FleetGraph Agent - Comment on ISS-42]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Stale Issue Detected

ISS-42 "Implement pagination for issues API" has been in_progress
for 7 days with no updates. Sprint ends in 2 days.

Recommendation: Move to next sprint as carryover, or reassign
to someone with available capacity.

Team capacity:
- Sarah: 2 issues, 4h estimated remaining
- James: 5 issues, 12h estimated remaining

Reply in chat to approve, modify, or dismiss.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[User via chat]
> Move it to next sprint and assign to Sarah

[FleetGraph Agent]
✓ Moved ISS-42 to Sprint 4 (Week of Mar 23)
✓ Assigned to Sarah
✓ Added carryover label
```

**Why chat-based instead of buttons:** Ship's comment system doesn't support interactive buttons natively. Building a custom button UI would require frontend changes outside FleetGraph's scope. Chat-based approval keeps the interaction within the embedded chat component that we're building anyway, and it allows nuanced responses ("reassign but also change priority") that binary buttons can't express.

**What happens if the human dismisses or snoozes?**
- **Dismiss:** The finding is logged and not re-surfaced for that specific condition (e.g., "Issue #42 stale" won't be flagged again unless it gets new activity and goes stale again).
- **Snooze:** The finding is suppressed for 24 hours, then re-evaluated. If the condition persists, it's surfaced again.
- **No response (timeout):** After 48 hours with no response, the finding is re-surfaced with increased severity.

### 7. Error and Failure Handling

**What does the agent do when Ship API is down?**
- Retry once after 30 seconds
- If still down, log the error and skip the current run
- Resume on next poll cycle
- Never crash or hang — all API calls have 10-second timeouts

**How does it degrade gracefully?**
- If one fetch node fails (e.g., `/api/team/assignments` returns 500), the agent continues with available data
- Missing data is noted in the output: "Note: Team assignment data unavailable — sprint health analysis may be incomplete"
- The agent never makes a recommendation based on incomplete data without disclaiming it

**What gets cached and for how long?**
- Team roster (people, reports_to): cached for 1 hour (rarely changes)
- Sprint metadata (dates, status): cached for 5 minutes
- Issue states: never cached (always fresh for stale detection)
- Accountability items: cached for 5 minutes
- Document content: cached for 15 minutes (only relevant for on-demand mode)

---

## Phase 3: Stack and Deployment

### 8. Deployment Model

**Architecture: Separate Python service communicating with Ship via REST API**

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Ship Web   │────→│  Ship API    │────→│ Postgres │
│  (React)    │     │  (Express)   │     │          │
│  Render     │     │  Render      │     │  Render  │
└──────┬──────┘     └──────────────┘     └──────────┘
       │                    ↑
       │                    │ REST API calls
       ↓                    │ (Bearer token auth)
┌──────────────┐            │
│ FleetGraph   │────────────┘
│ (Python +    │
│  LangGraph + │
│  OpenAI)     │
│  Render      │
└──────────────┘
```

**Why a separate service:**
- LangGraph is Python-native. Ship is Node.js/Express. Mixing runtimes in one service creates unnecessary complexity.
- Agent runs are CPU/memory heavy (LLM calls, large context windows). Isolation prevents the agent from starving the API under load.
- Independent scaling — agent can scale horizontally without touching the API.
- Independent deploys — agent changes don't require API redeployment.
- Clean API boundary — agent only uses Ship's public REST API. No direct database access.

**FleetGraph service details:**
- **Runtime:** Python 3.11+ with `langgraph`, `langchain`, `openai`, `langsmith`
- **Framework:** FastAPI (lightweight, async, good for LLM streaming)
- **Endpoints exposed:**
  - `POST /api/chat` — on-demand mode (Ship web calls this directly)
  - `POST /api/trigger` — manual trigger for proactive runs (admin/debug)
  - `GET /api/health` — health check for Render
- **Proactive scheduling:** `APScheduler` or Python `asyncio` loop within the service process
- **No database of its own at MVP** — uses Ship's document system for persistence (findings as comments/docs, run state as metadata). Phase 2 could add Redis for caching and dedup hashes.

**Where does the proactive agent run when no user is present?**

FleetGraph runs as its own Render web service. The proactive scheduler runs in-process alongside the FastAPI server. Render keeps the service alive as long as it receives health check pings (via cron-job.org hitting `/api/health` every 10 minutes).

**How is it kept alive?**

Same pattern as Ship API — external ping service (cron-job.org) hits `https://fleetgraph.onrender.com/api/health` every 10 minutes to prevent Render from sleeping the free-tier instance.

**How does it authenticate with Ship without a user session?**

API tokens (`POST /api/api-tokens`). The token is:
- Created once during setup by an admin user
- Stored as an environment variable (`FLEETGRAPH_API_TOKEN`)
- Workspace-scoped and user-bound (actions are attributable in Ship's audit logs)
- Uses Bearer auth: `Authorization: Bearer ship_<token>`
- No CSRF protection needed (Bearer tokens aren't auto-attached by browsers)
- Set to never expire (or 365 days)

**Environment variables for FleetGraph service:**
```
OPENAI_API_KEY=sk-...
LANGCHAIN_API_KEY=ls-...        # LangSmith tracing
LANGCHAIN_TRACING_V2=true
SHIP_API_URL=https://shipshape-prod-api.onrender.com
FLEETGRAPH_API_TOKEN=ship_...   # Bearer token for Ship API
```

**Latency tradeoff:** On-demand chat adds 2 extra network hops (Ship Web → FleetGraph → Ship Web) vs being in-process. But LLM latency (2-5s) dominates, so the extra ~50ms of network round-trip is negligible.

### 9. Performance

**How does your trigger model achieve the < 5 minute detection latency goal?**

The high-frequency poll runs every 5 minutes. The sequence is:
1. Fetch data from Ship API (~500ms for parallel fetches)
2. Hash the data and compare to last run (~1ms)
3. If unchanged, exit (~0 additional cost)
4. If changed, invoke LLM reasoning (~2-5 seconds)
5. Format and deliver output (~500ms)

Total worst case: ~6 seconds from poll trigger to output delivery. Since polls run every 5 minutes, the maximum detection latency is 5 minutes + 6 seconds.

**What is your token budget per invocation?**

| Use Case | Input Tokens | Output Tokens | Total | Est. Cost |
|----------|-------------|---------------|-------|-----------|
| Sprint health | ~3,000 | ~1,000 | ~4,000 | $0.002 |
| Stale issues | ~2,000 | ~500 | ~2,500 | $0.001 |
| Escalation | ~4,000 | ~1,500 | ~5,500 | $0.003 |
| Carryover risk | ~5,000 | ~2,000 | ~7,000 | $0.004 |
| Weekly digest | ~10,000 | ~3,000 | ~13,000 | $0.008 |
| Chat Q&A | ~8,000 | ~2,000 | ~10,000 | $0.006 |
| Research Agent | ~15,000 | ~5,000 | ~20,000 | $0.012 |

Based on OpenAI gpt-4o pricing (~$2.50/1M input, $10/1M output).

**Where are the cost cliffs in your architecture?**

1. **Weekly digest at scale:** At 100 programs with 10 projects each, the digest needs to summarize 1,000 projects. Token count scales linearly. Mitigation: hierarchical summarization (summarize per-program first, then roll up).

2. **AI Factory SWE Agent (Phase 2):** Each implementation attempt reads significant codebase context. At 50K tokens per attempt with 3 retries, a single spec could cost $1.50. Mitigation: budget cap per spec.

3. **On-demand chat with deep context:** If the user is viewing a program with 50 projects and 500 issues, the full context could exceed 100K tokens. Mitigation: progressive context loading (Phase 2) — start with the immediate document, expand only if needed.

4. **Polling without caching:** Without the data hash dedup, 100 projects × 288 polls/day × ~5K tokens = 144M tokens/day ($360/day). With caching, ~95% of polls skip the LLM, reducing to ~$5/day.
