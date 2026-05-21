# Procurement Workflow Portal

JavaScript-only Next.js 14 App Router procurement portal. See `cursor-prompt-procurement-portal.merged.md` for the full specification.

## Requirements

- Node.js ≥ 20
- MongoDB
- SAP Business One Service Layer, SAP HANA ODBC, AWS S3, SMTP (for integration phases)

## Setup

```bash
cp .env.local.example .env.local
# Edit .env.local with your values
npm install
npm run seed    # fresh database only
npm run dev
```

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
