const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(process.cwd(), 'bd', 'losgallegos.db');
const SMTP_TARGETS = {
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: ''
};

function openDb(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) reject(err);
            else {
                db.configure('busyTimeout', 10000);
                resolve(db);
            }
        });
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve(this.changes || 0);
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

async function tableExists(db, tableName) {
    const row = await get(
        db,
        "SELECT name FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(?) LIMIT 1",
        [tableName]
    );
    return Boolean(row);
}

async function sanitizeSmtp(db) {
    if (!(await tableExists(db, 'config'))) {
        console.log('[SMTP-SANITIZE] Omitido: no existe tabla config.');
        return;
    }

    let totalChanges = 0;
    totalChanges += await run(db, "INSERT OR REPLACE INTO config (key, value) VALUES ('smtp_host', ?)", [SMTP_TARGETS.smtp_host]);
    totalChanges += await run(db, "INSERT OR REPLACE INTO config (key, value) VALUES ('smtp_port', ?)", [SMTP_TARGETS.smtp_port]);
    totalChanges += await run(db, "INSERT OR REPLACE INTO config (key, value) VALUES ('smtp_user', ?)", [SMTP_TARGETS.smtp_user]);
    totalChanges += await run(db, "INSERT OR REPLACE INTO config (key, value) VALUES ('smtp_pass', ?)", [SMTP_TARGETS.smtp_pass]);

    if (totalChanges > 0) {
        console.log('[SMTP-SANITIZE] Configuración SMTP limpiada en bd/losgallegos.db');
    } else {
        console.log('[SMTP-SANITIZE] Sin cambios: configuración SMTP ya estaba limpia.');
    }
}

async function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.log('[SMTP-SANITIZE] Omitido: no existe bd/losgallegos.db');
        return;
    }

    const db = await openDb(DB_PATH);
    try {
        await sanitizeSmtp(db);
    } finally {
        db.close();
    }
}

main().catch((error) => {
    console.error('[SMTP-SANITIZE] Error:', error.message);
    process.exit(1);
});
