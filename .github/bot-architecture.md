DATA_FLOW (WhatsApp Conversation):

1. User sends WhatsApp message → Meta webhook fires POST /webhook
2. Webhook (apps/backend/src/routes/webhook.ts) extracts message text and phone
   number
3. Call processMessage(phoneNumber, message) in apps/backend/src/agent/engine.ts
4. Engine retrieves/creates conversation context from SQLite (includes current
   state, user data)
5. Check for 3-hour session timeout, reset to INIT if expired
6. Call state machine: transition({ currentState, message, context })
7. State machine returns: { nextState, commands, updatedContext }
8. Update conversation state in database
9. Execute commands sequentially:
   - CHECK_FNB/CHECK_GASO → Call provider APIs
     (apps/backend/src/services/providers.ts)
   - SEND_MESSAGE → WhatsApp Meta Graph API
     (apps/backend/src/services/whatsapp.ts)
   - SEND_IMAGES → Upload images to WhatsApp, send media messages
   - TRACK_EVENT → Log to analytics_events table
   - NOTIFY_TEAM → Queue message in notifier service
   - ESCALATE → Update conversation status to 'human_takeover'
10. Response sent to user, conversation state persisted for next message

WEBHOOK_ENDPOINTS:

- POST /webhook: Receives incoming WhatsApp messages from Meta
  - Extracts message text, phone number, sender info
  - Passes to processMessage() for handling
- GET /webhook: Meta challenge verification
  - Required for webhook setup
  - Validates hub.verify_token and returns hub.challenge

LLM_INTEGRATION: Gemini via OpenAI client at apps/backend/src/services/llm.ts

- classifyIntent(msg) → yes|no|question|unclear
- extractEntity(msg, entity) → extracted value
- Prefer regex (packages/core/src/validation/regex.ts) for structured data like
  DNI, age
- Used sparingly, state machine handles most logic

CONVERSATION_STATES: Flow in packages/core/src/state-machine/transitions.ts INIT
→ CONFIRM_CLIENT → COLLECT_DNI → WAITING_PROVIDER → COLLECT_AGE → OFFER_PRODUCTS
→ HANDLE_OBJECTION → CLOSING

- INIT: Greeting, explain service
- CONFIRM_CLIENT: Ask if they're a Calidda client
- COLLECT_DNI: Request DNI for lookup
- WAITING_PROVIDER: Query FNB (first) then GASO (fallback)
- COLLECT_AGE: For GASO clients, collect age for eligibility
- OFFER_PRODUCTS: Present catalog based on segment/credit
- HANDLE_OBJECTION: Address concerns, clarify
- CLOSING: Confirm interest, schedule follow-up, or end conversation

ELIGIBILITY_RULES:

Client Identification:

1. Confirm Calidda client status
2. Collect DNI
3. Query FNB platform first, then Gasodomestico as fallback

FNB Client Flow:

- Check available credit
- Offer products tailored to credit line
- Ask clarifying questions before sending flyers
- If client expresses interest in category (e.g., smartphones), send up to 3
  relevant flyers
- FNB clients may:
  - Combine products
  - Request products outside catalog
  - Exceed available credit under special conditions
- Exceptional cases: Escalate to human agent

Gasodomestico Client Flow:

- Can only purchase product combinations
- Mandatory bundle includes kitchen or sales team-picked product (configurable)
- If strongly rejected, therma may be offered as last resort (use sparingly)

Eligibility Checks:

- Age
- Available credit
- Socioeconomic stratum (NSE 1-5):
  - Stratum 1-2:
    - Minimum age: 40
    - Max credit: 3000
    - Max installments: 18
  - Stratum 3:
    - Minimum age: 30
    - Max credit: 5000
    - Max installments: 18
  - Stratum 4-5:
    - No age restriction
    - Max credit: 5000
    - Max installments: 60
- Client must not be flagged as "cliente no está habilitado" (installation in
  progress)
- Technical data: No more than 1 service cut in last 12 months

Only if all checks pass can products be offered.

PRODUCT_DELIVERY:

- Each product has two flyers:
  - Main flyer (product image, price, installments)
  - Specs flyer (detailed specifications)
- Inform user of installment options if asked (mentioned in main flyer)
- Static files: /static/\* → data/uploads/catalog/{segment}/{category}/

COMMUNICATION_RULES:

- Language: Native Spanish only
- Privacy: Do not expose all internal checks to client
- Transparency: OK to inform client of available credit
- Tone: Polite, persuasive, sales-oriented
- Non-sales: Handle gracefully, redirect or disengage safely

SESSION_MANAGEMENT:

- Timeout: 3 hours inactivity
- Behavior: Resets conversation to INIT state
- Implementation: apps/backend/src/agent/context.ts
- Context storage: SQLite (conversations table with context_data JSON field)
