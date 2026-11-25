# CSU-ISS FinTrack — Team Style Guide (Team SVT)

## 1. Language & Runtime Standards
- **Backend:** Node.js v20 LTS (CommonJS `require`/`module.exports`) with Express.js and `pg`.
- **Frontend:** Semantic HTML5, CSS3, and Vanilla ES2022 JavaScript (`fetch` + `async/await`).
- **Database:** PostgreSQL 16 (Supabase) using parameterized queries (`$1, $2`).

## 2. Naming Conventions
- **Variables & Functions:** `camelCase` (e.g., `computeDashboardTotals`, `fetchActiveTransactions`).
- **Classes & Constructors:** `PascalCase` (e.g., `TransactionService`, `AuditRepository`).
- **Constants & Environment Keys:** `UPPER_SNAKE_CASE` (e.g., `DATABASE_URL`, `JWT_SECRET`, `LOCK_TIMEOUT_MS`).
- **Booleans:** Prefix with `is`, `has`, or `can` (e.g., `isDeleted`, `hasAuditEntry`, `canPurgeExpired`).
- **Database Tables & Columns:** `snake_case` (e.g., `audit_logs`, `transaction_id`, `is_deleted`).
- **Files:** `camelCase.js` for JS modules (`transactionService.js`); `UPPER_SNAKE_CASE.md` for root docs.

## 3. Formatting Rules
- Indent with **2 spaces** (no tabs); use **single quotes** (`'...'`) for JS strings and **semicolons** (`;`).
- Wrap lines at **100 characters** maximum and include trailing commas in multiline objects/arrays.

## 4. Architectural & Folder Boundaries (Enforced from LW9 Refined HLD)
- **Strict Layer Isolation:** Presentation (`public/`) -> Middleware/Services (`src/middleware/`, `src/services/`) -> Repositories (`src/repositories/`) -> Database (`src/db/`).
- **No SQL Outside Repositories (LW9-F1):** Only files inside `src/repositories/` may import `databasePool.js` or contain SQL strings.
- **Atomic Audit Writes (LW9-F3):** Any mutation in `TransactionService` must execute inside `databasePool.withTransaction()` so `TransactionRepository` and `AuditRepository` commit or roll back together.

## 5. Error Handling
- Use `async/await` with `try/catch` in all route handlers and forward errors to centralized Express error middleware.
- Return consistent JSON error objects (`{ error: 'Human-readable message' }`) with proper HTTP status codes (`400`, `401`, `403`, `404`, `500`). Never leak raw SQL or stack traces to the client.

## 6. Comments & JSDoc Docstrings
- Every exported class and public function must begin with a JSDoc comment documenting `@param`, `@returns`, and `@implements` with the traced SRS Requirement ID and LW9 Finding ID:
  ```javascript
  /**
   * Soft-deletes a financial transaction and records an immutable audit entry.
   * @implements FR-004, FR-009, FR-010, LW9-F3, LW9-F4
   * @param {number} transactionId - Target transaction primary key
   * @param {number} userId - Authenticated officer ID performing the deletion
   * @returns {Promise<Object>} Updated soft-deleted transaction record
   */