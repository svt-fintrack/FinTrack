const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'csu_iss_fintrack_jwt_secret_2026';

// ============================================================================
// HELPER: AUDIT LOGGING (FR-009)
// ============================================================================
async function recordAudit(userLabel, action, transactionId, details) {
  const id = `AUD-${Date.now().toString().slice(-6)}`;
  await pool.query(
    `INSERT INTO audit_logs (id, user_label, action, transaction_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userLabel, action, transactionId, details]
  );
}

// ============================================================================
// MIDDLEWARE: AUTH & ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================================================
function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired session token' });
    req.user = decoded;
    next();
  });
}

function requireWriteRole(req, res, next) {
  const writers = ['President', 'Treasurer', 'Vice President'];
  if (!writers.includes(req.user.role)) {
    return res.status(403).json({ error: `${req.user.role} role has Read-Only permissions.` });
  }
  next();
}

function requirePresident(req, res, next) {
  if (req.user.role !== 'President') {
    return res.status(403).json({ error: 'Only the CSU-ISS President can permanently purge expired records.' });
  }
  next();
}

// ============================================================================
// 1. AUTHENTICATION & UNLOCK (FR-001)
// ============================================================================
app.post('/api/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
      [identifier.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials. Access to CSU-ISS financial records is denied.' });
    }

    const user = result.rows[0];
    const validPassword =
      user.password_hash.startsWith('$2')
        ? await bcrypt.compare(password, user.password_hash)
        : password === user.password_hash;

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials. Access to CSU-ISS financial records is denied.' });
    }

    const sessionUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      position: user.position
    };

    const token = jwt.sign(sessionUser, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: sessionUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

app.post('/api/unlock', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const stored = result.rows[0]?.password_hash || '';

    const valid = stored.startsWith('$2')
      ? await bcrypt.compare(password, stored)
      : password === stored;

    if (!valid) return res.status(401).json({ error: 'Incorrect password.' });
    res.json({ unlocked: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify unlock password.' });
  }
});

// ============================================================================
// 2. USER ACCOUNT PROFILE (FR-008)
// ============================================================================
app.put('/api/users/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id) return res.status(403).json({ error: 'Cannot update another user profile.' });

    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2, password_hash = $3
       WHERE id = $4 RETURNING id, username, email, name, role, position`,
      [name, email, hashed, id]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account profile.' });
  }
});

// ============================================================================
// 3. TRANSACTIONS CRUD (FR-002 to FR-005 & FR-010)
// ============================================================================
app.get('/api/transactions', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        type,
        category,
        amount::FLOAT AS amount,
        description,
        recorded_by AS "recordedBy",
        is_deleted AS "isDeleted",
        retention_expired AS "retentionExpired"
      FROM transactions
      ORDER BY date DESC, created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

app.post('/api/transactions', verifyToken, requireWriteRole, async (req, res) => {
  try {
    const { id, date, type, category, amount, description } = req.body;
    const txId = id || `TXN-${type === 'Income' ? 'INC' : 'EXP'}-${Date.now().toString().slice(-5)}`;

    const result = await pool.query(
      `INSERT INTO transactions (id, date, type, category, amount, description, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, TO_CHAR(date, 'YYYY-MM-DD') AS date, type, category, amount::FLOAT AS amount,
                 description, recorded_by AS "recordedBy", is_deleted AS "isDeleted", retention_expired AS "retentionExpired"`,
      [txId, date, type, category, amount, description, req.user.name]
    );

    await recordAudit(
      `${req.user.name} (${req.user.role})`,
      'CREATE',
      txId,
      `Recorded ${type}: ₱${Number(amount).toFixed(2)} (${category})`
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
});

app.put('/api/transactions/:id', verifyToken, requireWriteRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, category, amount, description } = req.body;

    const result = await pool.query(
      `UPDATE transactions
       SET date = $1, category = $2, amount = $3, description = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND is_deleted = FALSE
       RETURNING id, TO_CHAR(date, 'YYYY-MM-DD') AS date, type, category, amount::FLOAT AS amount,
                 description, recorded_by AS "recordedBy", is_deleted AS "isDeleted", retention_expired AS "retentionExpired"`,
      [date, category, amount, description, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found.' });

    const updated = result.rows[0];
    await recordAudit(
      `${req.user.name} (${req.user.role})`,
      'EDIT',
      id,
      `Updated ${updated.type}: ₱${Number(amount).toFixed(2)} - ${description}`
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
});

// Soft Delete (FR-010)
app.patch('/api/transactions/:id/soft-delete', verifyToken, requireWriteRole, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE transactions SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING amount::FLOAT AS amount`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found.' });

    await recordAudit(
      `${req.user.name} (${req.user.role})`,
      'SOFT_DELETE',
      id,
      `Moved transaction to retention archive (₱${result.rows[0].amount.toFixed(2)})`
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive transaction.' });
  }
});

// Restore Soft-Deleted Record
app.patch('/api/transactions/:id/restore', verifyToken, requireWriteRole, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE transactions SET is_deleted = FALSE, deleted_at = NULL WHERE id = $1', [id]);

    await recordAudit(
      `${req.user.name} (${req.user.role})`,
      'RESTORE',
      id,
      'Restored soft-deleted transaction to active ledger'
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore transaction.' });
  }
});

// Permanent Delete (President Only, Expired Retention Only)
app.delete('/api/transactions/:id/permanent', verifyToken, requirePresident, async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query(
      'SELECT * FROM transactions WHERE id = $1 AND is_deleted = TRUE AND retention_expired = TRUE',
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(400).json({ error: 'Record must be archived with expired retention before permanent deletion.' });
    }

    await pool.query('DELETE FROM transactions WHERE id = $1', [id]);

    await recordAudit(
      `${req.user.name} (${req.user.role})`,
      'PERMANENT_DELETE',
      id,
      'Permanently purged expired record per Retention Policy'
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to permanently delete transaction.' });
  }
});

// ============================================================================
// 4. AUDIT TRAIL LOGS (FR-009)
// ============================================================================
app.get('/api/audit-logs', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        user_label AS "user",
        action,
        transaction_id AS "transactionId",
        details,
        TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') AS timestamp
      FROM audit_logs
      ORDER BY timestamp DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CSU-ISS FinTrack Backend running on http://localhost:${PORT}`);
});