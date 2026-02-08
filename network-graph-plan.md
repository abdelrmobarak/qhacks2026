# CRM Network Graph Page

## What this is

The app already pulls in your emails and calendar events, and figures out who you interact with most (people and organizations). There's a backend endpoint (`/crm/graph`) and a database artifact type for a graph, but right now it only stores 5 people with zero connections between them and there's no frontend page to show it.

This plan fills that gap: compute real connections between people on the backend, and build an interactive network visualization page on the frontend.

---

## How it works

### The graph is built once, not every page load

When a user signs in with Google, the app kicks off a "snapshot" that ingests their emails and calendar. At the end of that process, the graph gets computed and saved to the database. When you open the network page, it just reads that saved graph -- no recomputation.

### How connections are found

Two people are "connected" if they show up together in the same emails or meetings. The more emails/meetings they share, the stronger the connection. This is done with a database query (self-join on the entity-evidence table), not AI -- it's fast and deterministic.

People are also linked to their organization based on their email domain, which creates natural visual clusters.

### The "You" node

You (the authenticated user) sit at the center of the graph. Every person in the graph connects back to you since they're all extracted from your inbox/calendar.

---

## Backend changes

### 1. New setting: `max_graph_nodes`
**File**: `backend/app/core/env.py`

Configurable cap for how many people show up in the graph (default 30).

### 2. Better graph computation
**File**: `backend/app/jobs/ingest_snapshot.py` (replaces the current ~15-line stub at lines 1374-1387)

New `compute_graph_artifact()` function that builds:
- **Nodes**: Top 30 people (by interaction score) + top 5 organizations + a "you" node. Each node carries metadata: name, email, domain, score, meeting count, email count, total meeting minutes.
- **Person-to-person edges**: Found by querying which entities share the same evidence items. Weight = number of shared emails/meetings. Weak connections (only 1 shared item) are pruned.
- **Person-to-you edges**: Weight = total emails + meetings with that person.
- **Person-to-org edges**: Matched by email domain. Creates visual clustering.

### 3. Richer graph data model
**File**: `backend/app/api/routes/crm.py`

The `GraphNode` model gets additional fields (email, domain, score, meeting_count, email_count, total_meeting_minutes) so the frontend can render meaningful details. The endpoint logic itself doesn't change.

---

## Frontend changes

### 4. New dependency: `react-force-graph-2d`
**Install**: `pnpm add react-force-graph-2d` (from `frontend/`)

Canvas-based force-directed graph library. Wraps d3-force, supports zoom/pan/drag out of the box. ~45KB.

### 5. API types and function
**File**: `frontend/src/renderer/src/lib/api.ts`

New interfaces (`GraphNode`, `GraphEdge`, `GraphResponse`) and a `getGraph()` method.

### 6. The network page
**New file**: `frontend/src/renderer/src/pages/network.tsx` (~200 lines)

- Full-screen interactive graph canvas
- Nodes sized by interaction score, colored by organization/domain
- "You" node is larger and uses the primary accent color
- Organization nodes look visually different from people
- Labels scale with zoom level
- Click any node to open a detail panel on the right with:
  - Name, email, domain
  - Stats: meetings, emails, total hours
  - "View Story" button to see the full relationship narrative
- Loading skeleton while data fetches
- Empty states for "no data yet" and "still processing"

### 7. New route
**File**: `frontend/src/renderer/src/App.tsx`

Adds `/network` route.

---

## Files at a glance

| File | What happens |
|------|-------------|
| `backend/app/core/env.py` | Add 1 setting |
| `backend/app/jobs/ingest_snapshot.py` | Replace ~15-line stub with ~60-line function |
| `backend/app/api/routes/crm.py` | Add fields to GraphNode model |
| `frontend/package.json` | New dependency via pnpm |
| `frontend/src/renderer/src/lib/api.ts` | Add types + getGraph() |
| `frontend/src/renderer/src/pages/network.tsx` | **New file** - the whole page |
| `frontend/src/renderer/src/App.tsx` | Add route |

---

## Build order

1. Backend: setting in `env.py`
2. Backend: graph computation in `ingest_snapshot.py`
3. Backend: model enrichment in `crm.py`
4. Frontend: install `react-force-graph-2d`
5. Frontend: types + API call in `api.ts`
6. Frontend: create `network.tsx` page
7. Frontend: add route in `App.tsx`

---

## How to test

1. **Backend**: Trigger a new snapshot (sign in with Google), then hit `GET /crm/graph` -- should return nodes with metadata and a non-empty edges array
2. **Frontend**: Navigate to `#/network` -- graph should render with interactive nodes, zoom/pan should work, clicking a node should open the detail panel
3. **Edge cases**: Loading skeleton while fetching, "no data" message when no snapshot exists

---

## Notes

- **Old data**: If someone already has a processed snapshot, their graph artifact is already saved (with empty edges). The `/crm/graph` endpoint will lazily recompute the graph if it detects the stored one has no edges, so existing users aren't stuck.
- **Connections are pattern-based, not AI-labeled**: We don't use AI to label edges as "colleague" or "client." Instead, the visual clustering by domain/color communicates the same thing. Two people at the same company cluster together naturally.
