# SpendSense — AI-Powered Personal Finance Assistant

SpendSense is a production-quality, premium personal finance dashboard and budgeting engine designed to help users track transactions, forecast savings thresholds, detect subscriptions, analyze receipts via OCR scanning, and get automated AI spending insights.

The interface is dark-themed, minimal, and highly interactive, drawing layout and aesthetics inspiration from Notion, CRED, Monarch Money, and Apple Wallet.

---

## 🚀 Tech Stack

### Frontend
- **Framework**: React 18 with Vite (TypeScript)
- **Styling**: TailwindCSS, PostCSS, Lucide Icons, Custom glassmorphic obsidian tokens
- **Routing**: React Router DOM (v6)
- **State Management & Caching**: TanStack React Query (v5) & React Context API
- **Form Validation**: React Hook Form with Zod schema resolvers
- **Charts & Visualization**: Recharts

### Backend
- **Framework**: Express on Node.js (TypeScript compiled as CommonJS modules)
- **ORM & DB Access**: Prisma ORM targeting PostgreSQL
- **Security & Authorization**: stateless JWTs with Refresh Token Rotation (RTR), Bcryptjs password hashing, Helmet headers, CORS filters, and express-rate-limit brute-force protection
- **Validations**: Zod schema request body parsers
- **Utilities**: Winston logs manager & catchAsync express wrappers

### Deployment & Infrastructure
- **Frontend SPA**: Vercel
- **API Server**: Render
- **Database**: Neon serverless PostgreSQL

---

## 🛠️ Planned Core Features

1. **JWT Session Lifecycle**: Stateless user sign-in/up containing automatic token rotation (RTR) and Axios queue interceptor retries.
2. **Interactive Dashboard**: Modern dark-mode metrics layout detailing cash balances, incomes, expenses, monthly trend charts, and category breakdowns.
3. **Transaction Manager**: Advanced paginated log supporting transaction search, category tag filter, amount constraints, and manual/auto creations.
4. **AI Parsing Entry**: Natural language command inputs (e.g. *"I spent ₹450 on pizza yesterday"*) to automatically extract amount, merchant, category, and payment tags.
5. **Insights Engine**: Auto-generated financial advice comparing monthly budgets, top categories, and daily safe limits.
6. **Smart Goals & Budgets**: Setup limit alerts and tracks savings milestones.
7. **Receipt Scanner (OCR)**: Scans receipts, extracts fields, and matches transactions.

---

## 📂 Project Structure

```
spendsense/
├── package.json                   # Root package (npm workspaces)
├── tsconfig.json                  # Root TypeScript configs
├── LICENSE                        # MIT License
├── PROJECT_KNOWLEDGE.md           # Single Source of Truth documentation
├── backend/                       # REST API Workspace
│   ├── prisma/                    # Schema models & categories seed
│   ├── src/
│   │   ├── app.ts                 # Express initialization & middleware mount
│   │   ├── server.ts              # Server bootstrap & process lifecycle
│   │   ├── controllers/           # HTTP Request handler layer
│   │   ├── services/              # Pure domain business rules
│   │   ├── repositories/          # Data Access objects wrapping Prisma Client
│   │   └── middleware/            # JWT guards, Rate limits, Zod validator injectors
│   └── tsconfig.json
└── frontend/                      # Single Page Client Workspace
    ├── index.html
    ├── src/
    │   ├── main.tsx               # Bootstrap DOM mount
    │   ├── App.tsx                # Context providers, React-router mappings
    │   ├── context/               # AuthContext state manager
    │   ├── features/              # Feature pages (Auth views)
    │   ├── services/              # Axios API instances & React Query mutations
    │   └── components/            # UI Primitives & protected route guards
    └── tsconfig.json
```

---

## 📦 Setup & Installation Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- A running PostgreSQL database (e.g. Neon)

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Sarvesh-Awati/SpendSense.git
   cd SpendSense
   ```

2. **Install Dependencies** (Workspaces link automatically)
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file under `/backend`:
   ```env
   PORT=5001
   NODE_ENV=development
   DATABASE_URL="your-postgresql-neon-url"
   JWT_SECRET="your-access-token-secret"
   JWT_REFRESH_SECRET="your-refresh-token-secret"
   GEMINI_API_KEY="your-gemini-api-key"
   ```

4. **Initialize Database Schema**
   Run Prisma migrations and category seed script:
   ```bash
   npm run prisma:generate --workspace backend
   # To execute database migrations (when database URL is configured):
   # npm run prisma:migrate --workspace backend
   # To run seeder:
   # npx prisma db seed --workspace backend
   ```

5. **Run Development Servers**
   - Run backend server:
     ```bash
     npm run dev:backend
     # Listens at http://localhost:5001
     ```
   - Run frontend server:
     ```bash
     npm run dev:frontend
     # Runs Vite client at http://localhost:3000
     ```

---

## 🗺️ Development Roadmap

- **Phase 1**: Project Architecture & Scaffolding (Complete)
- **Phase 2**: Relational PostgreSQL design, Prisma schema indexes, and Repository patterns (Complete)
- **Phase 3**: JWT authentication, rate limit guards, refresh token rotation, and Axios interceptor queuing (Complete)
- **Phase 4**: Expenses logging CRUD, category aggregates, sorting, and pagination (Next)
- **Phase 5**: Budgeting allocations, goals status, and notification tray alerts
- **Phase 6**: AI spending insights, NLP parsing triggers, and Recommendations Chat
- **Phase 7**: OCR receipt image scanners, upload files middlewares, and text parsers
- **Phase 8**: Performance monitoring, automated testing, and cloud deployments

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
