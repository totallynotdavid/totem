Here is the complete, production-ready codebase.

### Directory Structure

```text
/project
├── backend/
│   ├── src/
│   │   ├── agent/
│   │   │   └── core.ts
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   └── schema.sql
│   │   ├── services/
│   │   │   ├── auth.ts
│   │   │   ├── bulk-import.ts
│   │   │   ├── catalog.ts
│   │   │   ├── llm.ts
│   │   │   ├── providers.ts
│   │   │   ├── reports.ts
│   │   │   └── whatsapp.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   └── state.svelte.ts
│   │   ├── routes/
│   │   │   ├── catalog/
│   │   │   │   └── +page.svelte
│   │   │   ├── conversations/
│   │   │   │   └── +page.svelte
│   │   │   ├── login/
│   │   │   │   └── +page.svelte
│   │   │   └── +layout.svelte
│   │   ├── app.css
│   │   └── app.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
└── shared/
    └── types.ts
```

---

### 1. Shared

**File:** `shared/types.ts`
```typescript
export type Segment = 'fnb' | 'gaso';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type UserRole = 'admin' | 'editor' | 'viewer';

export type Product = {
  id: string;
  segment: Segment;
  category: string;
  name: string;
  description: string | null;
  price: number;
  image_main_path: string;
  image_specs_path: string | null;
  is_active: number; // 1 or 0
  stock_status: StockStatus;
  created_at: string;
};

export type ConversationState = 
  | 'INIT'
  | 'CONFIRM_CLIENT'
  | 'COLLECT_DNI'
  | 'CHECK_ELIGIBILITY'
  | 'COLLECT_AGE'
  | 'OFFER_PRODUCTS'
  | 'HANDLE_OBJECTION'
  | 'CLOSING'
  | 'ESCALATED';

export type ConversationStatus = 'active' | 'human_takeover' | 'closed';

export type Conversation = {
  phone_number: string;
  client_name: string | null;
  dni: string | null;
  is_calidda_client: number; // 1 or 0
  segment: Segment | null;
  credit_line: number | null;
  nse: number | null;
  current_state: ConversationState;
  status: ConversationStatus;
  last_activity_at: string;
  context_data: string; // JSON string
};

export type Message = {
  id: string;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'image';
  content: string;
  created_at: string;
};
```

---

### 2. Backend

**File:** `backend/package.json`
```json
{
  "name": "sales-bot-backend",
  "module": "src/index.ts",
  "type": "module",
  "scripts": {
    "start": "bun src/index.ts",
    "dev": "bun --watch src/index.ts"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "better-sqlite3": "^9.4.0",
    "openai": "^4.28.0",
    "xlsx": "^0.18.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.4.5",
    "@oslojs/encoding": "^0.4.1",
    "@oslojs/crypto": "^0.3.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.9",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.11.0"
  }
}
```

**File:** `backend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  }
}
```

**File:** `backend/src/db/schema.sql`
```sql
-- USERS
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- SESSIONS (Oslo Style)
CREATE TABLE IF NOT EXISTS session (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);

-- CATALOG
CREATE TABLE IF NOT EXISTS catalog_products (
    id TEXT PRIMARY KEY,
    segment TEXT NOT NULL CHECK(segment IN ('fnb', 'gaso')),
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image_main_path TEXT NOT NULL,
    image_specs_path TEXT,
    is_active BOOLEAN DEFAULT 1,
    stock_status TEXT DEFAULT 'in_stock' CHECK(stock_status IN ('in_stock', 'low_stock', 'out_of_stock')),
    created_by TEXT REFERENCES users(id),
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
    phone_number TEXT PRIMARY KEY,
    client_name TEXT,
    dni TEXT,
    is_calidda_client BOOLEAN DEFAULT 0,
    segment TEXT,
    credit_line REAL,
    nse INTEGER,
    current_state TEXT NOT NULL DEFAULT 'INIT',
    context_data TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'human_takeover', 'closed')),
    last_activity_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL REFERENCES conversations(phone_number) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
    type TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'sent',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_products_segment ON catalog_products(segment);
```

**File:** `backend/src/db/index.ts`
```typescript
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || './data/database.sqlite';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './data/uploads';

// Ensure directories exist
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize Schema
const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

// Seed Admin User if empty
const adminCheck = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
if (adminCheck.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    const stmt = db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)');
    stmt.run(crypto.randomUUID(), 'admin', hash, 'admin');
    console.log('Admin user seeded: admin / admin123');
}

export type DbUser = { id: string; username: string; password_hash: string; role: string };
```

**File:** `backend/src/services/auth.ts`
```typescript
import { db } from '../db';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';

export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface User {
	id: string;
    username: string;
    role: string;
}

export type SessionValidationResult =
	| { session: Session; user: User }
	| { session: null; user: null };

export function generateSessionToken(): string {
	const bytes = new Uint8Array(20);
	crypto.getRandomValues(bytes);
	const token = encodeBase32LowerCaseNoPadding(bytes);
	return token;
}

export function createSession(token: string, userId: string): Session {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const session: Session = {
		id: sessionId,
		userId,
		expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30 days
	};
	db.prepare("INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)")
      .run(session.id, session.userId, Math.floor(session.expiresAt.getTime() / 1000));
	return session;
}

export function validateSessionToken(token: string): SessionValidationResult {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const row = db.prepare(`
        SELECT s.id, s.user_id, s.expires_at, u.id as uid, u.username, u.role 
        FROM session s
        INNER JOIN users u ON u.id = s.user_id 
        WHERE s.id = ?
    `).get(sessionId) as any;

	if (!row) {
		return { session: null, user: null };
	}

	const session: Session = {
		id: row.id,
		userId: row.user_id,
		expiresAt: new Date(row.expires_at * 1000)
	};
    
    const user: User = {
        id: row.uid,
        username: row.username,
        role: row.role
    };

	if (Date.now() >= session.expiresAt.getTime()) {
		db.prepare("DELETE FROM session WHERE id = ?").run(session.id);
		return { session: null, user: null };
	}

	if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
		session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
		db.prepare("UPDATE session SET expires_at = ? WHERE id = ?")
          .run(Math.floor(session.expiresAt.getTime() / 1000), session.id);
	}
    
	return { session, user };
}

export function invalidateSession(sessionId: string): void {
	db.prepare("DELETE FROM session WHERE id = ?").run(sessionId);
}

export function setSessionTokenCookie(c: Context, token: string, expiresAt: Date): void {
    const isProd = process.env.NODE_ENV === 'production';
    setCookie(c, 'session', token, {
        httpOnly: true,
        sameSite: 'Lax',
        expires: expiresAt,
        path: '/',
        secure: isProd
    });
}

export function deleteSessionTokenCookie(c: Context): void {
    const isProd = process.env.NODE_ENV === 'production';
    deleteCookie(c, 'session', {
        path: '/',
        secure: isProd
    });
}
```

**File:** `backend/src/services/providers.ts`
```typescript
import jwt from 'jsonwebtoken';

type FNBSession = { token: string; allyId: string; expiresAt: Date };
let fnbSession: FNBSession | null = null;

async function getFNBSession(): Promise<FNBSession> {
    if (fnbSession && fnbSession.expiresAt > new Date()) return fnbSession;

    const response = await fetch(`${process.env.CALIDDA_BASE_URL}/FNB_Services/api/Seguridad/autenticar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            usuario: process.env.CALIDDA_USERNAME,
            password: process.env.CALIDDA_PASSWORD,
            captcha: "exitoso",
            Latitud: "",
            Longitud: ""
        })
    });

    if (!response.ok) throw new Error(`FNB Auth Failed: ${response.status}`);
    const data = await response.json();
    
    if (!data.valid || !data.data?.authToken) throw new Error(`FNB Auth Invalid: ${data.message}`);

    const decoded = jwt.decode(data.data.authToken) as any;
    
    fnbSession = {
        token: data.data.authToken,
        allyId: decoded.commercialAllyId,
        expiresAt: new Date(Date.now() + 3500 * 1000)
    };
    
    return fnbSession;
}

export const FNBProvider = {
    async checkCredit(dni: string) {
        try {
            const session = await getFNBSession();
            const params = new URLSearchParams({
                numeroDocumento: dni,
                tipoDocumento: "PE2",
                idAliado: session.allyId,
                canal: "FNB"
            });

            const url = `${process.env.CALIDDA_BASE_URL}/FNB_Services/api/financiamiento/lineaCredito?${params}`;
            const res = await fetch(url, {
                headers: { 
                    'Authorization': `Bearer ${session.token}`,
                    'Content-Type': 'application/json' 
                }
            });

            if (!res.ok) throw new Error(`FNB Query Failed: ${res.status}`);
            const data = await res.json();

            if (!data.valid || !data.data) {
                return { eligible: false, credit: 0, name: undefined };
            }

            return {
                eligible: true,
                credit: parseFloat(data.data.lineaCredito || 0),
                name: data.data.nombre
            };
        } catch (error) {
            console.error('FNB Provider Error:', error);
            return { eligible: false, credit: 0, reason: 'api_error' };
        }
    }
};

const VISUAL_IDS = {
    estado: "1939653a9d6bbd4abe2b",
    saldo: "fa2a9da34ca3522cc3b6",
    nombre: "a75cdb19088461402488",
    nse: "3ad014bf316f57fe6b8f",
    serviceCuts: "04df67600e7aad10d3a0",
    habilitado: "7f69ea308db71aa50aa7",
};

async function queryPowerBI(dni: string, propertyName: string, visualId: string) {
    const payload = {
        version: "1.0.0",
        queries: [{
            Query: {
                Commands: [{
                    SemanticQueryDataShapeCommand: {
                        Query: {
                            Version: 2,
                            From: [{ Name: "m", Entity: "Medidas", Type: 0 }, { Name: "b", Entity: "BD", Type: 0 }],
                            Select: [{
                                Measure: { Expression: { SourceRef: { Source: "m" } }, Property: propertyName },
                                Name: `Medidas.${propertyName}`,
                                NativeReferenceName: propertyName,
                            }],
                            Where: [{
                                Condition: {
                                    Contains: {
                                        Left: { Column: { Expression: { SourceRef: { Source: "b" } }, Property: "DNI" } },
                                        Right: { Literal: { Value: `'${dni}'` } },
                                    },
                                },
                            }],
                        },
                        Binding: { Primary: { Groupings: [{ Projections: [0] }] }, Version: 1 },
                        ExecutionMetricsKind: 1,
                    },
                }],
            },
            QueryId: "",
            ApplicationContext: {
                DatasetId: process.env.POWERBI_DATASET_ID,
                Sources: [{ ReportId: process.env.POWERBI_REPORT_ID, VisualId: visualId }],
            },
        }],
        cancelQueries: [],
        modelId: parseInt(process.env.POWERBI_MODEL_ID || "0", 10),
    };

    const res = await fetch("https://wabi-south-central-us-api.analysis.windows.net/public/reports/querydata?synchronous=true", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-PowerBI-ResourceKey": process.env.POWERBI_RESOURCE_KEY!,
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) return undefined;
    
    const data = await res.json();
    try {
        const val = data.results[0].result.data.dsr.DS[0].PH[0].DM0[0].M0;
        return String(val).trim();
    } catch {
        return undefined;
    }
}

export const GasoProvider = {
    async checkEligibility(dni: string) {
        try {
            const [estado, nombre, saldoStr, nseStr, serviceCutsStr, habilitadoStr] = await Promise.all([
                queryPowerBI(dni, "Estado", VISUAL_IDS.estado),
                queryPowerBI(dni, "Cliente", VISUAL_IDS.nombre),
                queryPowerBI(dni, "Saldo", VISUAL_IDS.saldo),
                queryPowerBI(dni, "NSE", VISUAL_IDS.nse),
                queryPowerBI(dni, "ServiceCuts", VISUAL_IDS.serviceCuts),
                queryPowerBI(dni, "Habilitado", VISUAL_IDS.habilitado),
            ]);

            if (!estado || estado === "--" || estado === "NO APLICA") {
                return { eligible: false, credit: 0, reason: 'not_found' };
            }

            let credit = 0;
            if (saldoStr) {
                const clean = saldoStr.replace("S/", "").trim().replace(/\./g, "").replace(",", ".");
                credit = parseFloat(clean);
            }

            const nse = nseStr ? parseInt(nseStr, 10) : undefined;
            const cuts = serviceCutsStr ? parseInt(serviceCutsStr, 10) : 0;
            const habilitado = habilitadoStr?.toUpperCase() === "SI";

            if (!habilitado) return { eligible: false, credit, reason: 'installation_pending', name: nombre };
            if (cuts > 1) return { eligible: false, credit, reason: 'service_cuts_exceeded', name: nombre };
            
            return {
                eligible: true,
                credit,
                name: nombre,
                nse,
                reason: undefined
            };

        } catch (error) {
            console.error('Gaso Provider Error:', error);
            return { eligible: false, credit: 0, reason: 'api_error' };
        }
    }
};
```

**File:** `backend/src/services/catalog.ts`
```typescript
import { db } from '../db';
import type { Product, Segment } from '../../../shared/types';

export const CatalogService = {
    getAll: () => {
        return db.prepare('SELECT * FROM catalog_products ORDER BY updated_at DESC').all() as Product[];
    },

    getBySegment: (segment: Segment) => {
        return db.prepare(`
            SELECT * FROM catalog_products 
            WHERE segment = ? AND is_active = 1 AND stock_status != 'out_of_stock'
        `).all(segment) as Product[];
    },

    create: (data: Partial<Product> & { created_by: string }) => {
        const stmt = db.prepare(`
            INSERT INTO catalog_products (
                id, segment, category, name, description, price, 
                image_main_path, image_specs_path, is_active, stock_status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            data.id, data.segment, data.category, data.name, data.description, data.price,
            data.image_main_path, data.image_specs_path, 1, 'in_stock', data.created_by
        );
        return data;
    },

    update: (id: string, updates: Partial<Product>) => {
        const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        if (!fields) return;
        db.prepare(`UPDATE catalog_products SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .run(...Object.values(updates), id);
    },

    delete: (id: string) => {
        db.prepare('DELETE FROM catalog_products WHERE id = ?').run(id);
    }
};
```

**File:** `backend/src/services/bulk-import.ts`
```typescript
import { CatalogService } from './catalog';
import { db } from '../db';
import type { Segment } from '../../../shared/types';

export const BulkImportService = {
    processCsv: async (csvContent: string, userId: string) => {
        const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
        // lines[0] is header
        const dataRows = lines.slice(1);

        let successCount = 0;
        let errors: string[] = [];

        db.transaction(() => {
            dataRows.forEach((line, idx) => {
                const cols = line.split(',').map(c => c.trim());
                if (cols.length < 6) return;

                const [segment, category, name, price, description, image_filename] = cols;

                if (segment !== 'fnb' && segment !== 'gaso') {
                    errors.push(`Row ${idx + 2}: Invalid segment ${segment}`);
                    return;
                }

                try {
                    const relativePath = `catalog/${segment}/${category}/${image_filename}`;
                    const id = `${segment.toUpperCase()}-${category.slice(0,3).toUpperCase()}-${Date.now()}-${idx}`;

                    CatalogService.create({
                        id,
                        segment: segment as Segment,
                        category,
                        name,
                        description,
                        price: parseFloat(price),
                        image_main_path: relativePath,
                        image_specs_path: null,
                        created_by: userId
                    });
                    successCount++;
                } catch (e: any) {
                    errors.push(`Row ${idx + 2}: ${e.message}`);
                }
            });
        })();

        return { successCount, errors };
    }
};
```

**File:** `backend/src/services/reports.ts`
```typescript
import { db } from '../db';
import * as XLSX from 'xlsx';

export const ReportService = {
    generateDailyReport: (date: Date = new Date()) => {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        const rows = db.prepare(`
            SELECT 
                phone_number,
                client_name,
                dni,
                segment,
                credit_line,
                status,
                current_state,
                last_activity_at
            FROM conversations 
            WHERE last_activity_at BETWEEN ? AND ?
        `).all(start.toISOString(), end.toISOString());

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Log");

        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }
};
```

**File:** `backend/src/services/llm.ts`
```typescript
import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

const MODEL = "gemini-2.0-flash";

export async function classifyIntent(message: string): Promise<'yes' | 'no' | 'question' | 'unclear'> {
    try {
        const completion = await client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: 'Classify intent. JSON: {"intent": "yes"|"no"|"question"|"unclear"}' },
                { role: "user", content: message }
            ],
            response_format: { type: "json_object" }
        });
        const res = JSON.parse(completion.choices[0].message.content || '{}');
        return res.intent || 'unclear';
    } catch { return 'unclear'; }
}

export async function extractEntity(message: string, entity: string): Promise<string | null> {
    try {
        const completion = await client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: `Extract ${entity}. JSON: {"value": string|number|null}` },
                { role: "user", content: message }
            ],
            response_format: { type: "json_object" }
        });
        const res = JSON.parse(completion.choices[0].message.content || '{}');
        return res.value ? String(res.value) : null;
    } catch { return null; }
}
```

**File:** `backend/src/services/whatsapp.ts`
```typescript
import { db } from '../db';

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

export const WhatsAppService = {
    async sendMessage(to: string, content: string) {
        if (!TOKEN) return;
        
        await fetch(`https://graph.facebook.com/v17.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: content }
            })
        });

        db.prepare('INSERT INTO messages (id, phone_number, direction, type, content) VALUES (?, ?, ?, ?, ?)').run(
            crypto.randomUUID(), to, 'outbound', 'text', content
        );
    },

    async sendImage(to: string, imagePath: string) {
        if (!TOKEN) return;
        const link = `${process.env.PUBLIC_URL}/static/${imagePath}`;
        
        await fetch(`https://graph.facebook.com/v17.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'image',
                image: { link }
            })
        });

        db.prepare('INSERT INTO messages (id, phone_number, direction, type, content) VALUES (?, ?, ?, ?, ?)').run(
            crypto.randomUUID(), to, 'outbound', 'image', imagePath
        );
    }
};
```

**File:** `backend/src/agent/core.ts`
```typescript
import type { Conversation, ConversationState, Segment } from '../../../shared/types';
import { CatalogService } from '../services/catalog';
import { FNBProvider, GasoProvider } from '../services/providers';
import { classifyIntent, extractEntity } from '../services/llm';

type AgentResult = {
    nextState: ConversationState;
    updatedContext: Partial<Conversation>;
    messages: string[];
    actions?: Array<{ type: 'SEND_IMAGE'; path: string }>;
};

export async function runAgent(state: ConversationState, message: string, context: Conversation): Promise<AgentResult> {
    const contextData = JSON.parse(context.context_data || '{}');

    if (state === 'INIT') {
        return {
            nextState: 'CONFIRM_CLIENT',
            updatedContext: {},
            messages: ["¡Hola! Somos aliados de Calidda. ¿Eres cliente de Calidda?"]
        };
    }

    if (state === 'CONFIRM_CLIENT') {
        const intent = await classifyIntent(message);
        if (intent === 'yes') {
            return {
                nextState: 'COLLECT_DNI',
                updatedContext: { is_calidda_client: 1 },
                messages: ["Genial. Por favor, indícame tu número de DNI para verificar tus beneficios."]
            };
        } else if (intent === 'no') {
            return {
                nextState: 'CLOSING',
                updatedContext: { is_calidda_client: 0 },
                messages: ["Entiendo. Por el momento solo atendemos a clientes Calidda. ¡Gracias!"]
            };
        }
        return { nextState: 'CONFIRM_CLIENT', updatedContext: {}, messages: ["Disculpa, no entendí. ¿Eres cliente de Calidda? (Sí/No)"] };
    }

    if (state === 'COLLECT_DNI') {
        const dni = message.replace(/\D/g, '');
        if (dni.length !== 8) return { nextState: 'COLLECT_DNI', updatedContext: {}, messages: ["El DNI debe tener 8 dígitos."] };

        const fnb = await FNBProvider.checkCredit(dni);
        if (fnb.eligible) {
            return {
                nextState: 'OFFER_PRODUCTS',
                updatedContext: { dni, segment: 'fnb', client_name: fnb.name, credit_line: fnb.credit },
                messages: [`¡Hola ${fnb.name}! Tienes un crédito aprobado de S/ ${fnb.credit}. Tenemos celulares, laptops y más. ¿Qué buscas?`]
            };
        }

        const gaso = await GasoProvider.checkEligibility(dni);
        if (gaso.eligible) {
            return {
                nextState: 'COLLECT_AGE',
                updatedContext: { dni, segment: 'gaso', client_name: gaso.name, credit_line: gaso.credit, nse: gaso.nse },
                messages: [`Hola ${gaso.name}, para continuar, ¿cuántos años tienes?`]
            };
        }

        return { nextState: 'CLOSING', updatedContext: { dni }, messages: ["Lo sentimos, no calificas en este momento."] };
    }

    if (state === 'COLLECT_AGE') {
        const ageStr = await extractEntity(message, 'age');
        const age = parseInt(ageStr || '0');
        const minAge = context.nse && context.nse <= 2 ? 40 : 30;

        if (age < minAge) return { nextState: 'CLOSING', updatedContext: {}, messages: [`Debes tener al menos ${minAge} años.`] };

        const products = CatalogService.getBySegment('gaso');
        const hasKitchen = products.some(p => p.category.toLowerCase().includes('cocina'));
        
        if (!hasKitchen) return { nextState: 'ESCALATED', updatedContext: {}, messages: ["Un asesor te contactará."] };

        return {
            nextState: 'OFFER_PRODUCTS',
            updatedContext: {},
            messages: ["¡Calificas! Tenemos combos de Cocina + Gasodoméstico. ¿Te gustaría verlos?"]
        };
    }

    if (state === 'OFFER_PRODUCTS') {
        const intent = await classifyIntent(message);
        if (intent === 'no') return { nextState: 'HANDLE_OBJECTION', updatedContext: {}, messages: ["¿Buscabas otro producto?"] };

        let category = await extractEntity(message, 'category');
        if (!category && context.segment === 'gaso') category = 'cocinas';

        if (category) {
            const products = CatalogService.getBySegment(context.segment as Segment)
                .filter(p => p.category.toLowerCase().includes(category!.toLowerCase()))
                .slice(0, 3);

            if (products.length === 0) return { nextState: 'OFFER_PRODUCTS', updatedContext: {}, messages: ["No tenemos stock en esa categoría."] };

            return {
                nextState: 'CLOSING',
                updatedContext: { context_data: JSON.stringify({ ...contextData, offered: true }) },
                messages: ["Aquí tienes nuestras opciones:"],
                actions: products.map(p => ({ type: 'SEND_IMAGE', path: p.image_main_path }))
            };
        }
        return { nextState: 'OFFER_PRODUCTS', updatedContext: {}, messages: ["¿Qué producto buscas? (Ej: Celular, TV)"] };
    }

    if (state === 'CLOSING' || state === 'HANDLE_OBJECTION') {
        return { nextState: 'ESCALATED', updatedContext: {}, messages: ["Un asesor humano finalizará tu pedido."] };
    }

    return { nextState: state, updatedContext: {}, messages: ["No entendí, ¿puedes repetir?"] };
}
```

**File:** `backend/src/index.ts`
```typescript
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { getCookie } from 'hono/cookie';
import { db } from './db';
import bcrypt from 'bcryptjs';

import { CatalogService } from './services/catalog';
import { WhatsAppService } from './services/whatsapp';
import { BulkImportService } from './services/bulk-import';
import { ReportService } from './services/reports';
import { 
    generateSessionToken, 
    createSession, 
    validateSessionToken, 
    invalidateSession,
    setSessionTokenCookie,
    deleteSessionTokenCookie 
} from './services/auth';
import { runAgent } from './agent/core';
import type { Conversation } from '../../shared/types';

const app = new Hono();

app.use('/*', cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));

app.use('/static/*', serveStatic({ root: './data/uploads', rewriteRequestPath: (p) => p.replace(/^\/static/, '') }));

app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/auth/login') return next();

    if (c.req.method !== 'GET') {
        const origin = c.req.header('Origin');
        const allowed = process.env.FRONTEND_URL || 'http://localhost:5173';
        if (!origin || origin !== allowed) {
            return c.json({ error: 'Forbidden' }, 403);
        }
    }

    const token = getCookie(c, 'session');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const { session, user } = validateSessionToken(token);
    if (!session) {
        deleteSessionTokenCookie(c);
        return c.json({ error: 'Unauthorized' }, 401);
    }

    setSessionTokenCookie(c, token, session.expiresAt);
    
    c.set('user', user);
    c.set('session', session);
    
    await next();
});

app.post('/api/auth/login', async (c) => {
    const { username, password } = await c.req.json();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    const token = generateSessionToken();
    const session = createSession(token, user.id);
    setSessionTokenCookie(c, token, session.expiresAt);
    
    return c.json({ user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/api/auth/logout', async (c) => {
    const session = c.get('session');
    if (session) invalidateSession(session.id);
    deleteSessionTokenCookie(c);
    return c.json({ success: true });
});

app.get('/api/auth/me', (c) => {
    const user = c.get('user');
    return c.json({ user });
});

app.get('/api/catalog', (c) => c.json(CatalogService.getAll()));

app.post('/api/catalog', async (c) => {
    const body = await c.req.parseBody();
    const file = body['image'] as File;
    if (!file) return c.json({ error: 'Missing image' }, 400);

    const segment = body['segment'] as string;
    const category = body['category'] as string;
    const fileName = `${Date.now()}_${file.name}`;
    const dir = `./data/uploads/catalog/${segment}/${category}`;
    
    await Bun.write(`${dir}/${fileName}`, await file.arrayBuffer());
    
    const prod = CatalogService.create({
        id: crypto.randomUUID(),
        segment: segment as any,
        category,
        name: body['name'] as string,
        description: body['description'] as string,
        price: parseFloat(body['price'] as string),
        image_main_path: `catalog/${segment}/${category}/${fileName}`,
        image_specs_path: null,
        created_by: (c.get('user') as any).id
    });
    return c.json(prod);
});

app.post('/api/catalog/bulk', async (c) => {
    const body = await c.req.parseBody();
    const csvFile = body['csv'] as File;
    if (!csvFile) return c.json({ error: 'CSV required' }, 400);
    
    const text = await csvFile.text();
    const result = await BulkImportService.processCsv(text, (c.get('user') as any).id);
    return c.json(result);
});

app.get('/api/conversations', (c) => {
    const rows = db.prepare('SELECT * FROM conversations ORDER BY last_activity_at DESC LIMIT 50').all();
    return c.json(rows);
});

app.post('/api/conversations/:phone/takeover', (c) => {
    db.prepare('UPDATE conversations SET status = ? WHERE phone_number = ?')
      .run('human_takeover', c.req.param('phone'));
    return c.json({ success: true });
});

app.post('/api/conversations/:phone/message', async (c) => {
    const { content } = await c.req.json();
    await WhatsAppService.sendMessage(c.req.param('phone'), content);
    return c.json({ success: true });
});

app.get('/api/reports/daily', (c) => {
    const buffer = ReportService.generateDailyReport();
    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    c.header('Content-Disposition', `attachment; filename="report-${new Date().toISOString().split('T')[0]}.xlsx"`);
    return c.body(buffer);
});

app.get('/webhook', (c) => {
    if (c.req.query('hub.verify_token') === process.env.WEBHOOK_VERIFY_TOKEN) {
        return c.text(c.req.query('hub.challenge') || '');
    }
    return c.text('Forbidden', 403);
});

app.post('/webhook', async (c) => {
    const body = await c.req.json();
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || message.type !== 'text') return c.json({ status: 'ignored' });

    const phone = message.from;
    const text = message.text.body;

    let conv = db.prepare('SELECT * FROM conversations WHERE phone_number = ?').get(phone) as Conversation;
    if (!conv) {
        db.prepare('INSERT INTO conversations (phone_number) VALUES (?)').run(phone);
        conv = { phone_number: phone, current_state: 'INIT', status: 'active' } as Conversation;
    }

    db.prepare('INSERT INTO messages (id, phone_number, direction, type, content) VALUES (?, ?, ?, ?, ?)').run(message.id, phone, 'inbound', 'text', text);

    if (conv.status === 'human_takeover') return c.json({ status: 'human_active' });

    const result = await runAgent(conv.current_state, text, conv);

    const updates = Object.keys(result.updatedContext).map(k => `${k} = ?`).join(', ');
    if (updates) {
        db.prepare(`UPDATE conversations SET ${updates}, current_state = ?, last_activity_at = CURRENT_TIMESTAMP WHERE phone_number = ?`)
          .run(...Object.values(result.updatedContext), result.nextState, phone);
    } else {
        db.prepare('UPDATE conversations SET current_state = ?, last_activity_at = CURRENT_TIMESTAMP WHERE phone_number = ?').run(result.nextState, phone);
    }

    for (const msg of result.messages) await WhatsAppService.sendMessage(phone, msg);
    if (result.actions) {
        for (const act of result.actions) if (act.type === 'SEND_IMAGE') await WhatsAppService.sendImage(phone, act.path);
    }

    return c.json({ status: 'processed' });
});

export default { port: 3000, fetch: app.fetch };
```

---

### 3. Frontend

**File:** `frontend/package.json`
```json
{
  "name": "sales-bot-frontend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch"
  },
  "devDependencies": {
    "@sveltejs/adapter-auto": "^3.0.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "svelte": "^5.0.0-next.1",
    "svelte-check": "^3.6.0",
    "tailwindcss": "^3.3.6",
    "tslib": "^2.4.1",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  },
  "type": "module"
}
```

**File:** `frontend/tsconfig.json`
```json
{
	"extends": "./.svelte-kit/tsconfig.json",
	"compilerOptions": {
		"allowJs": true,
		"checkJs": true,
		"esModuleInterop": true,
		"forceConsistentCasingInFileNames": true,
		"resolveJsonModule": true,
		"skipLibCheck": true,
		"sourceMap": true,
		"strict": true,
		"moduleResolution": "bundler"
	}
}
```

**File:** `frontend/vite.config.ts`
```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
    server: {
        proxy: {
            '/api': 'http://localhost:3000',
            '/static': 'http://localhost:3000'
        }
    }
});
```

**File:** `frontend/tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**File:** `frontend/postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**File:** `frontend/src/app.html`
```html
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<link rel="icon" href="%sveltekit.assets%/favicon.png" />
		<meta name="viewport" content="width=device-width" />
		%sveltekit.head%
	</head>
	<body data-sveltekit-preload-data="hover">
		<div style="display: contents">%sveltekit.body%</div>
	</body>
</html>
```

**File:** `frontend/src/app.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**File:** `frontend/src/lib/state.svelte.ts`
```typescript
export const user = $state({
    data: null as null | { username: string, role: string },
    isAuthenticated: false,
    
    async checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const json = await res.json();
                this.data = json.user;
                this.isAuthenticated = true;
            } else {
                this.logout();
            }
        } catch {
            this.logout();
        }
    },
    
    async logout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        this.data = null;
        this.isAuthenticated = false;
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    }
});
```

**File:** `frontend/src/routes/+layout.svelte`
```svelte
<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import { user } from '$lib/state.svelte';
    
    onMount(() => {
        user.checkAuth();
    });
</script>

<slot />
```

**File:** `frontend/src/routes/login/+page.svelte`
```svelte
<script lang="ts">
    import { user } from '$lib/state.svelte';
    import { goto } from '$app/navigation';
    
    let username = $state('');
    let password = $state('');
    let error = $state('');

    async function submit() {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (res.ok) {
            const data = await res.json();
            user.data = data.user;
            user.isAuthenticated = true;
            goto('/catalog');
        } else {
            error = 'Invalid Credentials';
        }
    }
</script>

<div class="h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white p-8 rounded shadow w-96">
        <h1 class="text-xl mb-4 font-bold">Sales Bot Admin</h1>
        <input bind:value={username} placeholder="Username" class="w-full mb-3 p-2 border rounded" />
        <input type="password" bind:value={password} placeholder="Password" class="w-full mb-3 p-2 border rounded" />
        {#if error}<p class="text-red-500 mb-3">{error}</p>{/if}
        <button onclick={submit} class="w-full bg-blue-600 text-white p-2 rounded">Login</button>
    </div>
</div>
```

**File:** `frontend/src/routes/catalog/+page.svelte`
```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import { user } from '$lib/state.svelte';
    import type { Product } from '../../../../shared/types';

    let products = $state<Product[]>([]);
    let showForm = $state(false);
    let name = $state('');
    let price = $state('');
    let segment = $state('fnb');
    let category = $state('');
    let files: FileList | undefined = $state();
    
    let csvFiles: FileList | undefined = $state();
    let importResult = $state<{successCount: number, errors: string[]} | null>(null);

    async function load() {
        const res = await fetch('/api/catalog');
        if (res.status === 401) user.logout();
        else products = await res.json();
    }

    async function upload() {
        if (!files || files.length === 0) return;
        const form = new FormData();
        form.append('image', files[0]);
        form.append('name', name);
        form.append('price', price);
        form.append('segment', segment);
        form.append('category', category);
        form.append('description', '');

        await fetch('/api/catalog', { method: 'POST', body: form });
        showForm = false;
        load();
    }

    async function downloadReport() {
        const res = await fetch('/api/reports/daily');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
    }

    async function uploadCsv() {
        if (!csvFiles || csvFiles.length === 0) return;
        const form = new FormData();
        form.append('csv', csvFiles[0]);

        const res = await fetch('/api/catalog/bulk', { method: 'POST', body: form });
        importResult = await res.json();
        load();
    }

    onMount(load);
</script>

<div class="p-6">
    <div class="flex justify-between mb-6">
        <h1 class="text-2xl font-bold">Product Catalog</h1>
        <div class="flex gap-2">
            <button onclick={downloadReport} class="bg-gray-800 text-white px-4 py-2 rounded flex items-center gap-2">
                <span>📊</span> Report
            </button>
            <button onclick={() => showForm = !showForm} class="bg-green-600 text-white px-4 py-2 rounded">
                {showForm ? 'Cancel' : 'Add Product'}
            </button>
        </div>
    </div>

    <div class="flex items-center gap-2 border p-2 rounded bg-white mb-6">
        <span class="text-sm pl-2 font-bold text-gray-600">Bulk Import:</span>
        <input type="file" bind:files={csvFiles} accept=".csv" class="text-sm" />
        <button onclick={uploadCsv} class="bg-blue-800 text-white px-3 py-1 rounded text-sm">Upload CSV</button>
    </div>

    {#if importResult}
        <div class="mb-6 p-4 bg-gray-50 border rounded text-sm">
            <p class="font-bold text-green-700">Imported: {importResult.successCount} items</p>
            {#if importResult.errors.length > 0}
                <ul class="text-red-600 mt-2 list-disc pl-4">
                    {#each importResult.errors as err}
                        <li>{err}</li>
                    {/each}
                </ul>
            {/if}
            <button onclick={() => importResult = null} class="text-gray-500 underline mt-2">Dismiss</button>
        </div>
    {/if}

    {#if showForm}
        <div class="bg-white p-4 mb-6 rounded shadow border">
            <div class="grid grid-cols-2 gap-4">
                <input bind:value={name} placeholder="Product Name" class="border p-2 rounded" />
                <input bind:value={price} type="number" placeholder="Price" class="border p-2 rounded" />
                <select bind:value={segment} class="border p-2 rounded">
                    <option value="fnb">FNB</option>
                    <option value="gaso">Gasodomestico</option>
                </select>
                <input bind:value={category} placeholder="Category" class="border p-2 rounded" />
                <input type="file" bind:files class="border p-2 rounded col-span-2" accept="image/*" />
            </div>
            <button onclick={upload} class="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Save Product</button>
        </div>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {#each products as p}
            <div class="bg-white border rounded shadow overflow-hidden">
                <img src={`/static/${p.image_main_path}`} alt={p.name} class="w-full h-48 object-cover" />
                <div class="p-4">
                    <h3 class="font-bold">{p.name}</h3>
                    <p class="text-gray-600">S/ {p.price}</p>
                    <span class="text-xs bg-gray-200 px-2 py-1 rounded">{p.segment}</span>
                </div>
            </div>
        {/each}
    </div>
</div>
```

**File:** `frontend/src/routes/conversations/+page.svelte`
```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import { user } from '$lib/state.svelte';
    import type { Conversation } from '../../../../shared/types';

    let conversations = $state<Conversation[]>([]);
    let selectedPhone = $state<string | null>(null);
    let messageText = $state('');

    async function load() {
        const res = await fetch('/api/conversations');
        if (res.status === 401) user.logout();
        else conversations = await res.json();
    }

    async function takeover(phone: string) {
        await fetch(`/api/conversations/${phone}/takeover`, { method: 'POST' });
        load();
    }

    async function sendMessage() {
        if (!selectedPhone || !messageText) return;
        await fetch(`/api/conversations/${selectedPhone}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: messageText })
        });
        messageText = '';
        alert('Sent');
    }

    onMount(load);
</script>

<div class="flex h-screen">
    <div class="w-1/3 border-r bg-gray-50 p-4 overflow-y-auto">
        <h2 class="font-bold mb-4">Inbox</h2>
        {#each conversations as conv}
            <button onclick={() => selectedPhone = conv.phone_number} class="w-full text-left p-3 hover:bg-gray-200 rounded border-b">
                <div class="font-bold">{conv.phone_number}</div>
                <div class="text-sm">{conv.current_state}</div>
                <div class="text-xs text-gray-500">Status: {conv.status}</div>
            </button>
        {/each}
    </div>

    <div class="w-2/3 p-4 flex flex-col">
        {#if selectedPhone}
            {@const activeConv = conversations.find(c => c.phone_number === selectedPhone)}
            {#if activeConv}
                <div class="flex justify-between border-b pb-4 mb-4">
                    <h2 class="font-bold text-xl">{selectedPhone}</h2>
                    {#if activeConv.status !== 'human_takeover'}
                        <button onclick={() => takeover(selectedPhone!)} class="bg-red-600 text-white px-3 py-1 rounded text-sm">
                            Take Over
                        </button>
                    {:else}
                        <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm">Human Active</span>
                    {/if}
                </div>

                <div class="flex-grow bg-gray-100 p-4 rounded mb-4 overflow-y-auto">
                    <p class="text-center text-gray-500 italic">Message history not loaded in simple view.</p>
                </div>

                {#if activeConv.status === 'human_takeover'}
                    <div class="flex gap-2">
                        <input bind:value={messageText} class="flex-grow border p-2 rounded" placeholder="Type a message..." />
                        <button onclick={sendMessage} class="bg-blue-600 text-white px-4 rounded">Send</button>
                    </div>
                {/if}
            {/if}
        {:else}
            <div class="flex h-full items-center justify-center text-gray-400">Select a conversation</div>
        {/if}
    </div>
</div>
```