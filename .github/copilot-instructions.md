TOTEM AI AGENT. A WhatsApp Sales Bot for Tottem, a company ally of the Calidda
Gas Company

Principles we must follow when writing code:

- Simplicity as a scaling strategy (dumb, explicit, predictable components)
- Minimal moving parts
- Maintainability
- Code as documentation (comments should only be used for non-obvious decisions
  or for JSDoc).
- Files and modules must not god files. Modularization is encouraged where it
  makes sense and makes the codebase maintanable.

ARCHITECTURE: Bun monorepo with 3 apps. Data flow: WhatsApp → webhook.ts →
debouncer.ts → engine.ts → state-machine (packages/core) → Commands →
WhatsApp/DB. Frontend (SvelteKit) reads SQLite. Notifier app sends team alerts
via WhatsApp Web.

WORKSPACE STRUCTURE:

- apps/backend: Hono server, agent engine, SQLite DB (apps/backend/src/db/),
  webhook handler (apps/backend/src/routes/webhook.ts)
- apps/frontend: SvelteKit dashboard, Svelte 5 runes, auth state in
  apps/frontend/src/lib/state.svelte.ts using $state()
- apps/notifier: puppeteer-based WhatsApp Web client for team notifications, QR
  auth on startup
- packages/core: Pure functions only (NO I/O). State machine in
  packages/core/src/state-machine/transitions.ts, eligibility logic, message
  templates
- packages/types: TypeScript types shared across workspace

STATE MACHINE PATTERN (CRITICAL): All conversation logic in
packages/core/src/state-machine/transitions.ts. States: INIT, CONFIRM_CLIENT,
COLLECT_DNI, WAITING_PROVIDER, COLLECT_AGE, OFFER_PRODUCTS, HANDLE_OBJECTION,
CLOSING, ESCALATED. Transitions are pure functions that return {nextState,
commands[], updatedContext}. Commands executed by
apps/backend/src/agent/engine.ts. Command types: CHECK_FNB (credit check),
CHECK_GASO, SEND_MESSAGE, SEND_IMAGES, NOTIFY_TEAM, TRACK_EVENT, ESCALATE (human
takeover).

TWO CUSTOMER SEGMENTS: FNB (higher credit, direct offers) vs GASO (lower credit,
age/NSE eligibility matrix, mandatory kitchen bundle). Segment determined by
provider check.

PROVIDER INTEGRATION: apps/backend/src/services/providers.ts exports FNBProvider
and GasoProvider. FNBProvider: Calidda credit line API, JWT auth with session
caching (3500s expiry), session reused across requests. GasoProvider: PowerBI
REST API queries, 6 parallel queries per DNI check (estado, nombre, saldo, NSE,
serviceCuts, habilitado). Both have circuit-breaker: on auth failure
(401/403/blocked), mark provider unavailable for 30min. Health tracked in
fnbHealth/gasoHealth objects, checked via isProviderAvailable().
getProvidersHealth() exposes status to /health endpoint.

WEBHOOK FLOW: POST /webhook (apps/backend/src/routes/webhook.ts) receives
WhatsApp message → logs to DB → debounceMessage() in
apps/backend/src/agent/debouncer.ts aggregates rapid messages (500ms window) →
processMessage() in apps/backend/src/agent/engine.ts. Engine: loads conversation
from DB via getOrCreateConversation(), checks 3hr session timeout
(checkSessionTimeout), calls transition(), updates DB state
(updateConversationState), executes commands sequentially.

SESSION HANDLING: 3-hour timeout tracked by last_activity_at column. On timeout:
resets state to INIT, preserves lastInterestCategory in context_data JSON column
for smart resume. context_data stores arbitrary session state (offeredCategory,
objectionCount, sessionStartedAt, etc). Context synced between DB columns (dni,
segment, credit_line, nse) and JSON field.

ESCALATION: When bot can't handle (objectionCount >= 2, complex queries):
transition returns ESCALATE command → escalateConversation() sets
status='human_takeover', handover_reason → NOTIFY_TEAM command sends message to
WhatsApp group via notifier app.

DATABASE: SQLite at apps/backend/src/db/. Schema in schema.sql, direct SQL via
db.prepare().run()/.get()/.all(). Booleans as INTEGER (0/1) with CHECK
constraints. No ORM. Key tables: conversations (phone_number PK, current_state,
status, context_data TEXT JSON, last_activity_at), messages (direction:
inbound/outbound, type: text/image), catalog_products (segment: fnb/gaso,
stock_status), analytics_events, users (role: admin/developer/sales_agent),
session (auth tokens).

MESSAGE TEMPLATES: packages/core/src/templates/standard.ts (informational:
GREETING, INVALID*DNI, ESCALATED_TO_HUMAN), sales.ts (offers: FNB_APPROVED,
GASO_OFFER_KITCHEN_BUNDLE). Templates are functions returning strings. Imported
as * as T or \_ as S in transitions.ts.

DEVELOPER COMMANDS: bun install - install all workspaces bun run dev:backend -
start backend :3000 bun run dev:frontend - start frontend :5173 bun run
dev:notifier - start notifier (node index.js) bun run seed - seed DB with test
data

CODE CONVENTIONS:

- Formatting: Biome (not ESLint). 4-space indent, double quotes. Run: bun x
  biome check --write .
- File org: routes in apps/backend/src/routes/, services in
  apps/backend/src/services/, pure logic in packages/core/src/
- No I/O in packages/core - keep testable
- SQLite booleans: store as INTEGER 0/1, use CHECK(field IN (0,1))
- Frontend: Svelte 5 runes, $state() for reactive state
- Auth: Session-based (not JWT). Session tokens in cookies,
  validateSessionToken() middleware in apps/backend/src/middleware/auth.ts

ADDING FEATURES: New conversation state: (1) Add to ConversationState type in
packages/types/src/index.ts, (2) Add handler function in
packages/core/src/state-machine/transitions.ts matching pattern
handleStateName(), (3) If new command needed, add to Command union in
packages/core/src/state-machine/types.ts and execute in
apps/backend/src/agent/engine.ts executeCommand(). New message template: Add to
packages/core/src/templates/standard.ts or sales.ts as exported const or
function. New product category: Insert into catalog_products table with segment
(fnb/gaso), category, image_main_path. Images served via /static/ endpoint
(serveStatic from data/uploads/).

ENV VARS (Backend): WHATSAPP_TOKEN, WHATSAPP_PHONE_ID,
WHATSAPP_WEBHOOK_VERIFY_TOKEN, CALIDDA_BASE_URL, CALIDDA_USERNAME,
CALIDDA_PASSWORD, POWERBI_DATASET_ID, POWERBI_REPORT_ID, POWERBI_MODEL_ID,
POWERBI_RESOURCE_KEY, PUBLIC_URL (for image links), FRONTEND_URL (CORS).

REGEX VALIDATION: packages/core/src/validation/regex.ts exports extractDNI() (8
digits), extractAge() (1-3 digits). Input sanitization in
packages/core/src/validation/input-sanitizer.ts (removes emojis, normalizes
whitespace).

ANALYTICS: trackEvent() in apps/backend/src/services/analytics.ts logs to
analytics_events table (event_type: session_start, dni_collected,
eligibility_passed/failed, products_offered). Reports in
apps/backend/src/services/reports.ts generate Excel via
ReportService.generateDailyReport().

NOTIFIER: WhatsApp Web client (whatsapp-web.js). Auto-registers groups when
receiving "@activate" command. groupMapping stored in
data/notifier/group_mapping.json. getGroupJID() resolves channel (agent/dev) to
group JID, checks env vars first (WHATSAPP_GROUP_AGENT, WHATSAPP_GROUP_DEV) then
mapping file.

CONTEXT SYNC PATTERN: conversation state split between DB columns (phone_number,
dni, segment, credit_line, nse, current_state, status) and context_data JSON
column. buildStateContext() merges both into StateContext object.
updateConversationState() writes to both destinations. This allows structured
queries on DB columns while preserving arbitrary context in JSON.

Business context:

- Our company (Totem) is an ally of Calidda, a gas utility provider.
- Calidda offers its customers a line of credit.
- Our company sells household appliances that customers pay through their
  monthly Calidda bill.
- Payments, collections, and credit enforcement are handled entirely by Calidda.
- Our company operates only in Lima Metropolitana and Callao.

Some of the products offered:

- Smartphones
- Kitchens
- Refrigerators
- Laptops
- TVs
- Other household appliances

Client types:

FNB clients (premium):

- Good payment history for over one year.
- Up to date with Calidda payments.
- Preferable clients.

Gasodomestico clients:

- Majority of users.
- More restrictive rules.
- Can only purchase specific product combinations.

High-level bot objective:

- Qualify the client.
- Determine eligibility. We first check if it is a FNB client.
- Offer appropriate products.
- Drive the conversation toward a sale.
- Escalate to a human when necessary.
- Avoid overwhelming or confusing the client.
- Avoid exposing internal validation rules.

Core eligibility checks (internal, not exposed verbatim to users):

Step 1: Client identification

- Confirm whether the caller is a Calidda client.
- Collect DNI.
- Query the appropriate platform (first FNB, then Gasodomestico as fallback).

Step 2: FNB client flow

- Check available credit.
- Offer products tailored to the credit line.
- Ask clarifying questions before sending flyers.
- If the client expresses interest in a category (e.g. smartphones), send up to
  3 relevant flyers.
- FNB clients may:
  - Combine products.
  - Request products outside the catalog.
  - Exceed their available credit under special conditions.
- These exceptional cases must be escalated to a human agent.

Step 3: Gasodomestico client flow

- Gasodomestico clients can only purchase combinations.
- Mandatory bundle includes a kitchen or a product picked by the sales team
  (configurable).
  - If strongly rejected, a therma may be offered as a last resort.
  - This alternative should be used sparingly.
- Eligibility checks:
  - Age
  - Available credit
  - Socioeconomic stratum (1–5)
    - Stratum 1–2:
      - Minimum age: 40
      - Max credit: 3000
      - Max installments: 18

    - Stratum 3:
      - Minimum age: 30
      - Max credit: 5000
      - Max installments: 18

    - Stratum 4–5:
      - No age restriction
      - Max credit: 5000
      - Max installments: 60

  - Client must not be flagged as "cliente no está habilitado" (installation
    still in progress).
  - In technical data:
    - No more than 1 service cut in the last 12 months.

- Only if all checks pass can products be offered.
- Each product has two flyers: a main one and one with the specs of the product.
- The agent should also inform the user (if they ask for it) of the amount of
  installments (these are mentioned in the main flyer).

Communication rules:

- The bot must only use native Spanish.
- Do not expose all internal checks to the client.
- It is acceptable to inform the client of their available credit.
- The bot must remain polite, persuasive, and sales-oriented.
- The bot must handle non-sales interactions gracefully and redirect or
  disengage safely.
