# CSU-ISS FinTrack (Financial Tracker)

## 1. Overview
**CSU-ISS FinTrack** is a web-based financial tracking and audit-compliant ledger system built for the **Caraga State University – Information System Society (CSU-ISS)**. It replaces manual spreadsheet and paper recordkeeping with role-based transaction management, real-time balance summaries, inactivity screen locking, and an immutable audit trail to ensure financial transparency and accountability for student organization officers and advisers.

- **GitHub Repository:** https://github.com/svt-fintrack/FinTrack
- **Live Deployment:** https://fintrack-q4ik.onrender.com

## 2. Features (Implemented)
- **Role-Based Authentication & Access Control (`FR-001`, `FR-008`, `FR-010`):** Secure login and route protection enforcing distinct permissions for Treasurer/Finance Officers, Organization President, and Organization Adviser.
- **Income & Expense Transaction Management (`FR-002`, `FR-003`, `FR-004`):** Create, edit, and soft-delete financial ledger entries with category tagging, reference numbers, and validation.
- **Search, Filtering & Ledger History (`FR-005`):** Filter transactions by type (Income/Expense), category, date range, and keyword search.
- **Real-Time Financial Dashboard & Liquidation Totals (`FR-006`):** Automatically computes Total Income, Total Expenses, and Current Balance while excluding soft-deleted records (`is_deleted = false`).
- **Immutable Audit Trail & Atomic Logging (`FR-009`, `LW9-F3`):** Every create, edit, soft-delete, and permanent-delete action executes inside an atomic PostgreSQL transaction alongside its corresponding `audit_logs` record.
- **Inactivity Screen Lock (`SRS Sec. 5.1.9`):** Automatically locks active officer sessions after 5 minutes of inactivity to prevent unauthorized access on shared devices.

## 3. Technologies and Versions
- **Runtime & Backend:** Node.js v20 LTS (CommonJS), Express.js v4.x
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES2022)
- **Database:** PostgreSQL 16 (hosted on Supabase via Session Pooler) with `pg` driver
- **Security & Auth:** JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `dotenv`
- **Hosting & Version Control:** Render (Web Service) and GitHub (`svt-fintrack/FinTrack`)

## 4. Installation and Setup
1. **Prerequisites:**
   - Install **Node.js v20 LTS** (or newer) and **npm**
   - Install **Git**
   - Access to a **PostgreSQL 16** database (local PostgreSQL or Supabase project)
2. **Clone the Repository:**
   ```bash
   git clone [https://github.com/svt-fintrack/FinTrack.git](https://github.com/svt-fintrack/FinTrack.git)
   cd FinTrack