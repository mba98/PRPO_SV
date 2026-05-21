# Procurement Workflow Portal

JavaScript-only Next.js 14 App Router procurement portal. See `cursor-prompt-procurement-portal.merged.md` for the full specification.

## Requirements

- Node.js ≥ 20
- MongoDB
- SAP Business One Service Layer, SAP HANA ODBC, AWS S3, SMTP (for integration phases)

## Setup

```bash
cp .env.local.example .env.local
# Edit .env.local with your values (see MongoDB SRV vs non-SRV formats in the example file)
npm install
npm run db:check   # verify Atlas/local connectivity (no secrets logged)
npm run seed       # fresh database only
npm run dev
```

**Windows Server + MongoDB Atlas:** Use Node.js **20 LTS** (see `.nvmrc`). If `mongodb+srv` fails with `querySrv ECONNREFUSED`, switch to the non-SRV URI from Atlas Connect → Drivers. Whitelist the server's public IP in Atlas Network Access.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run seed` | Seed roles, approval matrix, email groups, admin user |

## Phase 0

Foundations only: project scaffold, Mongoose models, health checks (`GET /api/health`, Admin-only), and database seed.
