-- ============================================================================
-- CSU-ISS FinTrack — PostgreSQL Schema (pgAdmin 4)
-- Matches your exact app.js data structures
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(40) NOT NULL CHECK (role IN ('President', 'Treasurer', 'Vice President', 'Auditor', 'Adviser')),
    position VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(30) PRIMARY KEY,
    date DATE NOT NULL,
    type VARCHAR(15) NOT NULL CHECK (type IN ('Income', 'Expense')),
    category VARCHAR(80) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    recorded_by VARCHAR(120) NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    retention_expired BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(30) PRIMARY KEY,
    user_label VARCHAR(160) NOT NULL,
    action VARCHAR(40) NOT NULL,
    transaction_id VARCHAR(30),
    details TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED DATA (Matches INITIAL_USERS, INITIAL_TRANSACTIONS, INITIAL_AUDIT_LOGS)
-- Default login password: "password123"
-- ============================================================================
INSERT INTO users (id, username, email, password_hash, name, role, position) VALUES
('USR-001', 'president', 'president@csu-iss.edu.ph', 'password123', 'Ezekiah S. Garcia', 'President', 'CSU-ISS President'),
('USR-002', 'treasurer', 'treasurer@csu-iss.edu.ph', 'password123', 'Lucea Kaye P. Alejo', 'Treasurer', 'CSU-ISS Treasurer'),
('USR-003', 'vp', 'vp@csu-iss.edu.ph', 'password123', 'Kate Angel M. Evaristo', 'Vice President', 'CSU-ISS Vice President'),
('USR-004', 'auditor', 'auditor@csu-iss.edu.ph', 'password123', 'Cian Ynthoni Cesario P. Milabat', 'Auditor', 'CSU-ISS Auditor'),
('USR-005', 'adviser', 'adviser@csu-iss.edu.ph', 'password123', 'Elbert S. Moyon', 'Adviser', 'Organization Adviser')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transactions (id, date, type, category, amount, description, recorded_by, is_deleted, retention_expired) VALUES
('TXN-2026-001', '2026-08-15', 'Income', 'Membership Fees', 15500.00, '1st Semester ISS Membership Fee Collection (Batch 1)', 'Lucea Kaye P. Alejo', FALSE, FALSE),
('TXN-2026-002', '2026-08-22', 'Income', 'Sponsorship & Grants', 8000.00, 'Tech Week External Sponsor Contribution', 'Ezekiah S. Garcia', FALSE, FALSE),
('TXN-2026-003', '2026-09-04', 'Expense', 'Event Operations', 4250.00, 'General Assembly Sound System & Venue Decoration', 'Lucea Kaye P. Alejo', FALSE, FALSE),
('TXN-2026-004', '2026-09-18', 'Expense', 'Office & Printing Supplies', 1350.50, 'Official Receipts, Tarpaulin Printing & Certificates', 'Kate Angel M. Evaristo', FALSE, FALSE),
('TXN-2026-005', '2026-10-05', 'Income', 'Merchandise Sales', 12400.00, 'CSU-ISS Department Lanyard & T-Shirt Proceeds', 'Lucea Kaye P. Alejo', FALSE, FALSE),
('TXN-2026-006', '2026-10-12', 'Expense', 'Refreshments & Catering', 3100.00, 'Officers Planning & Hackathon Facilitators Meals', 'Lucea Kaye P. Alejo', FALSE, FALSE),
('TXN-2024-099', '2024-05-10', 'Expense', 'Miscellaneous', 950.00, 'Archived AY 2023-2024 Year-End Logistics (Retention Expired)', 'System Archive', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit_logs (id, user_label, action, transaction_id, details, timestamp) VALUES
('AUD-001', 'Lucea Kaye P. Alejo (Treasurer)', 'CREATE', 'TXN-2026-001', 'Recorded Income: ₱15,500.00 (Membership Fees)', '2026-08-15 09:30:12'),
('AUD-002', 'Ezekiah S. Garcia (President)', 'CREATE', 'TXN-2026-002', 'Recorded Income: ₱8,000.00 (Sponsorship & Grants)', '2026-08-22 14:15:44'),
('AUD-003', 'Lucea Kaye P. Alejo (Treasurer)', 'CREATE', 'TXN-2026-003', 'Recorded Expense: ₱4,250.00 (Event Operations)', '2026-09-04 16:42:05')
ON CONFLICT (id) DO NOTHING;