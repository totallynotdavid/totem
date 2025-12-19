1. CLIENT EXPERIENCE FLOW (WHATSAPP END-USER)

The client experience is designed to be low-friction, formal, and persuasive. It mimics a helpful consultant rather than a generic chatbot.

1.1. Phase 1: Initiation and Identification

- Entry Point: The user clicks a Facebook/Instagram ad or messages the business number directly.
- Greeting: The system responds with a formal welcome message identifying itself as a Calidda ally.
- Confirmation: The system asks a binary question (Yes/No) to confirm if the user is the service holder.
- Data Collection: The user provides their DNI (National ID).
  - Constraint: The system rejects images/photos for privacy reasons and requests text input.
  - Validation: The input is validated via Regex (8 digits). If invalid, a specific error message guides the user.

1.2. Phase 2: Invisible evaluation (The "wait")
- Feedback: The system sends a "consulting system" message (e.g., "Consultando el sistema... ⏳") to manage expectations while the backend queries providers.
- Routing Logic:
  - Path A (FNB): If the user has enough credit in FNB, they are fast-tracked to offers.
  - Path B (Gasodomestico): If not FNB eligible, the system checks Gasodomestico data. If found, it prompts for Age.
  - Path C (Ineligible): If neither provider returns a valid line, the system sends a polite, opaque rejection message citing "internal policies" to avoid revealing specific risk factors (e.g., service cuts).

1.3. Phase 3: Product Presentation
- FNB Flow:
  - The system presents 3 "Hero Products" based on the user's credit segment.
  - Presentation: Images are sent with captions containing price and specs to minimize notification spam (1 notification per product instead of 2).
  - The system explicitly states the approved credit line amount.
- Gasodomestico Flow:
  - The system presents the mandatory bundle (e.g., Kitchen + Product).
  - Objection Handling: If the user rejects the kitchen ("No quiero cocina"), the system uses a specific sales script to explain the bundle is a financial requirement but highlights the low monthly fee.
  - Escalation: If the user objects a second time, the system triggers a Human Handover.

1.4. Phase 4: Closing or Handover
- Soft Close: If the user selects a product, the system confirms the selection and marks the conversation for human fulfillment.
- Escalation: If the user asks complex questions (outside product specs) or gets stuck in a loop, the system silently flags the chat for "Human Takeover" and notifies the agent team via the Notifier sidecar.

2. OPERATIONAL EXPERIENCE FLOW BY ROLE

The dashboard provides distinct workflows tailored to the three system roles: Sales Agent, Administrator, and Developer. All interfaces adhere to the Totem design system (Cream background, Ink text, Serif headers).

2.1. Sales Agent Experience
- Primary Objective: Close sales and handle escalated conversations.
- Access Scope: Conversations, Catalog (Read/Stock), Simulator.
- Workflow:
  1. Monitoring: The Agent monitors the "Conversations" view, filtering specifically for "MANUAL" status chats (Red badge) which indicate bot escalation or handover.
  2. Intervention: Upon selecting a chat, the Agent reviews the context (Segment, Credit Line) in the sidebar before engaging. They use the "Takeover" input to reply, which automatically pauses the bot for that user.
  3. Reference: The Agent uses the "Catalog" view as a reference tool to answer specific product questions regarding price or specs without needing to leave the dashboard.
  4. Training: The Agent uses the "Simulator" to practice handling objections using new sales scripts before interacting with real clients.

2.2. Administrator Experience
- Primary Objective: Operational oversight and team management.
- Access Scope: Full access, excluding technical debug logs.
- Workflow:
  1. Performance Review: The Admin checks the "Analytics" view to monitor the daily conversion funnel (Eligibility Pass vs. Product Offered) to gauge campaign effectiveness.
  2. User Management: The Admin uses the "Admin" view to onboard new Sales Agents or immediately disable access for departing staff using the status toggle.
  3. Inventory Management: The Admin operates the "Catalog" form to upload new product images, set pricing, and define the active segment (FNB/Gaso) for the bot's rotation.

2.3. Developer Experience
- Primary Objective: System maintenance, debugging, and configuration.
- Access Scope: Full access, including technical logs and raw event data.
- Workflow:
  1. Health Monitoring: The Developer monitors the "Analytics" raw event log to identify patterns of API failures (e.g., repeated Circuit Breaker trips).
  2. Debugging: The Developer uses the "Simulator" to inject edge-case inputs (e.g., SQL injection attempts, malformed DNIs) to verify input sanitization and error handling without incurring WhatsApp API costs.
  3. Integration Checks: The Developer verifies the connection status of the Notifier service and ensures the WhatsApp Web.js session is active and properly mapped to the correct environment groups (dev_team vs agent_team).

3. SYSTEM DATA FLOW

This section details how data moves technically through the architecture.

3.1. Inbound Message Pipeline
1. Ingestion: Meta sends a webhook POST request to the Backend.
2. Sanitization: The Input Sanitizer strips emojis and control characters.
3. Persistence: The raw message is saved to the SQLite `messages` table.
4. Debouncing: The message is added to a memory buffer key-value store (Map). The system waits 3 seconds for subsequent messages to arrive.
5. Trigger: Once the buffer resolves, the aggregated text is passed to the Agent Engine.

3.2. Core Logic Execution
1. Context Retrieval: The Engine fetches the current `Conversation` state from the database.
2. State Transition: The pure `transition()` function (in Core) processes the Input + Context and returns:
   - Next State.
   - List of Commands (Side Effects).
   - Updated Context variables.
3. State Update: The Engine writes the new State and Context to the database.

3.3. Command Execution (Side Effects)
1. Provider Calls:
   - If Command is `CHECK_FNB`: Engine calls FNBProvider -> Checks Circuit Breaker -> Authenticates -> Hits Calidda API -> Updates Context.
   - If Command is `CHECK_GASO`: Engine calls GasoProvider -> Checks Circuit Breaker -> Hits PowerBI Endpoint -> Parses Response -> Updates Context.
2. Messaging:
   - If Command is `SEND_MESSAGE`: Engine calls WhatsAppService -> Hits Meta Cloud API -> Logs outbound message to DB.
   - If Command is `SEND_IMAGES`: Engine iterates through product list -> Sends Image+Caption via WhatsAppService.
3. Notification:
   - If Command is `NOTIFY_TEAM`: Engine calls NotifierService -> POST to Notifier Sidecar -> Queues message -> WhatsApp Web.js sends to internal group (mapped based on role destination).

3.4. Analytics Pipeline
1. Tracking: Specific points in the Engine (e.g., Eligibility Pass) trigger `AnalyticsService.track()`.
2. Logging: A row is inserted into `analytics_events` with metadata (Segment, Credit Amount, Timestamp).
3. Reporting: The Frontend queries `/api/analytics/funnel` which aggregates these rows into counts for visualization.
