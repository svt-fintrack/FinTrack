# CSU-ISS FinTrack (Financial Tracker)

A web-based financial tracking and audit-compliant ledger system built for the **Caraga State University – Information System Society (CSU-ISS)**. FinTrack replaces manual recordkeeping with role-based transaction management, real-time balance summaries, inactivity screen locking, and an immutable audit trail[cite: 6, 17].

- **Live Deployment:** https://fintrack-q4ik.onrender.com[cite: 3, 4]
- **Course:** CSC 106 – Software Engineering 1 (Phase 4)[cite: 6, 17]

---

## Team SVT
- **Ezekiah S. Garcia** – Project Leader / Backend & Database Architecture[cite: 6, 17]
- **Lucea Kaye P. Alejo** – Authentication, RBAC & Documentation Lead[cite: 6, 17]
- **Kate Angel M. Evaristo** – Reporting, Audit Trail & QA Lead[cite: 6, 17]
- **Cian Ynthoni Cesario P. Milabat** – Frontend UI/UX & Client Modules[cite: 6, 17]

---

## Tech Stack & Architecture
FinTrack follows a **3-Tier Layered Modular Monolith** architecture[cite: 7, 17]:
- **Presentation Tier:** HTML5, CSS3, and Vanilla JavaScript (hosted on Render)[cite: 7, 17]
- **Application / Business Logic Tier:** Node.js v20 LTS & Express.js REST API (`jwt`, `bcryptjs`)[cite: 7, 17]
- **Data Access & Persistence Tier:** PostgreSQL 16 via `pg.Pool` (hosted on Supabase IPv4 Session Pooler)[cite: 7, 17]

---

## Project Structure
```text
csu-iss-fintrack/
├── public/                       # Tier 1: Presentation Layer (Client Web UI)
│   ├── index.html                # Main dashboard, ledger, and screen lock views
│   ├── style.css                 # Responsive institutional styling
│   └── js/                       # Modular client scripts
│       ├── apiClient.js          # Centralized fetch wrapper with JWT headers
│       ├── auth.js               # Login and inactivity Screen Lock handler
│       ├── dashboard.js          # Summary cards and analytics rendering
│       └── transactions.js       # Transaction CRUD and search/filter UI
├── src/
│   ├── middleware/
│   │   └── authMiddleware.js     # Tier 2: JWT verification & RBAC route guard
│   ├── services/                 # Tier 2: Business Logic & Domain Services
│   │   ├── authService.js        # Credential verification & profile updates
│   │   ├── transactionService.js # CRUD, soft/hard delete & atomic audit UoW
│   │   ├── reportingService.js   # Dashboard totals & liquidation reports
│   │   └── auditService.js       # Immutable activity audit trail
│   ├── repositories/             # Tier 3: Data Access Repositories
│   │   ├── userRepository.js
│   │   ├── transactionRepository.js
│   │   └── auditRepository.js
│   └── db/
│       └── databasePool.js       # PostgreSQL SSL connection pool & transaction helper
├── schema.sql                    # PostgreSQL relational schema & seed accounts
├── server.js                     # Express application entry point
├── package.json                  # Project dependencies and start scripts
├── STYLE_GUIDE.md                # Team coding & architectural conventions
├── CONTRIBUTING.md               # Git branching, commit & PR workflow
└── .gitignore                    # Excludes node_modules/ and .env secrets
```[cite: 17]

---

## Local Setup & Run Instructions

### Prerequisites
- **Node.js** (v18 or v20 LTS) and **npm**
- A **PostgreSQL** database or free **Supabase** project

### Installation Steps
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR-ORG-NAME/csu-iss-fintrack.git](https://github.com/YOUR-ORG-NAME/csu-iss-fintrack.git)
   cd csu-iss-fintrack
   ```[cite: 17]

2. **Install dependencies:**
   ```bash
   npm install
   ```[cite: 17]

3. **Configure environment variables:**
   Create a `.env` file in the project root (never commit this file to Git):
   ```env
   DATABASE_URL=postgresql://postgres.<PROJECT-REF>:<YOUR-PASSWORD>@[aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres](https://aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres)
   JWT_SECRET=csu_iss_fintrack_prod_secret_2026
   PORT=5000
   ```[cite: 17]

4. **Initialize the database schema:**
   Open your Supabase **SQL Editor** (or local PostgreSQL client), paste the contents of `schema.sql`, and run it to create the `users`, `transactions`, and `audit_logs` tables along with the seed accounts.

5. **Run the application:**
   ```bash
   npm start
   ```
   Open your browser and visit `http://localhost:5000`[cite: 17].

---

## Default Officer Credentials (Testing)
| Role | Username | Default Password |
| :--- | :--- | :--- |
| **President** | `president` | `password123` |
| **Treasurer** | `treasurer` | `password123` |
| **Vice President** | `vp` | `password123` |
| **Auditor** | `auditor` | `password123` |
| **Adviser** | `adviser` | `password123` |