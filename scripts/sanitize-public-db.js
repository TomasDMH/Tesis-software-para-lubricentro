const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(process.cwd(), 'bd', 'losgallegos.db');

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
            else resolve({ changes: this.changes || 0, lastID: this.lastID || null });
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function getTableName(db, tableName) {
    const rows = await all(
        db,
        "SELECT name FROM sqlite_master WHERE type='table' AND lower(name) = lower(?) LIMIT 1",
        [tableName]
    );
    return rows.length > 0 ? rows[0].name : null;
}

async function sanitizeConfig(db) {
    const tableConfig = await getTableName(db, 'config');
    if (!tableConfig) return;

    await run(db, `INSERT OR REPLACE INTO "${tableConfig}" (key, value) VALUES ('smtp_host', '')`);
    await run(db, `INSERT OR REPLACE INTO "${tableConfig}" (key, value) VALUES ('smtp_port', '587')`);
    await run(db, `INSERT OR REPLACE INTO "${tableConfig}" (key, value) VALUES ('smtp_user', '')`);
    await run(db, `INSERT OR REPLACE INTO "${tableConfig}" (key, value) VALUES ('smtp_pass', '')`);
}

async function sanitizeClientesYServicios(db) {
    const tableCliente = await getTableName(db, 'cliente');
    if (tableCliente) {
        const clientes = await all(db, `SELECT id, dni FROM "${tableCliente}" ORDER BY id ASC`);
        const dniMap = new Map();

        for (const c of clientes) {
            const nuevoDni = String(30000000 + Number(c.id || 0));
            const viejoDni = c.dni == null ? '' : String(c.dni);

            await run(
                db,
                `UPDATE "${tableCliente}" SET nombre = ?, dni = ?, telefono = ?, email = ? WHERE id = ?`,
                [`Cliente ${c.id}`, nuevoDni, '', '', c.id]
            );

            if (viejoDni) dniMap.set(viejoDni, nuevoDni);
        }

        const tableServicio = await getTableName(db, 'servicio');
        if (tableServicio) {
            for (const [viejo, nuevo] of dniMap.entries()) {
                await run(
                    db,
                    `UPDATE "${tableServicio}" SET dni_cliente = CAST(? AS INTEGER) WHERE CAST(dni_cliente AS TEXT) = ?`,
                    [nuevo, viejo]
                );
            }

            const servicios = await all(db, `SELECT rowid FROM "${tableServicio}" ORDER BY rowid ASC`);
            for (const s of servicios) {
                const n = String(s.rowid).padStart(3, '0');
                const patente = `SV${n[0]}${n[1]}${n[2]}SV`;
                await run(db, `UPDATE "${tableServicio}" SET patente = ?, descripcion = ? WHERE rowid = ?`, [
                    patente,
                    'Servicio de demostracion',
                    s.rowid
                ]);
            }
        }

        const tableVehiculo = await getTableName(db, 'vehiculo');
        if (tableVehiculo) {
            const vehiculos = await all(db, `SELECT rowid, idCliente FROM "${tableVehiculo}" ORDER BY rowid ASC`);
            for (const v of vehiculos) {
                const n = String(v.rowid).padStart(3, '0');
                const patente = `AA${n[0]}${n[1]}${n[2]}AA`;
                await run(
                    db,
                    `UPDATE "${tableVehiculo}" SET patente = ?, marca = ?, modelo = ?, "año" = ? WHERE rowid = ?`,
                    [patente, 'MarcaDemo', `Modelo ${v.idCliente || v.rowid}`, 2020, v.rowid]
                );
            }
        }
    }
}

async function sanitizeUsuarios(db) {
    const tableUsuario = await getTableName(db, 'usuario');
    if (!tableUsuario) return;

    const usuarios = await all(db, `SELECT idUsuario, idRol FROM "${tableUsuario}" ORDER BY idUsuario ASC`);
    if (usuarios.length === 0) return;

    const hashAdmin = await bcrypt.hash('admin', 10);
    const hashDemo = await bcrypt.hash('demo1234', 10);
    let adminAsignado = false;

    for (const u of usuarios) {
        const esAdmin = !adminAsignado && Number(u.idRol) === 1;
        if (esAdmin) adminAsignado = true;

        await run(
            db,
            `UPDATE "${tableUsuario}" SET nombreUsuario = ?, contrasena = ? WHERE idUsuario = ?`,
            [esAdmin ? 'admin' : `usuario${u.idUsuario}`, esAdmin ? hashAdmin : hashDemo, u.idUsuario]
        );
    }
}

async function sanitizeDb(dbPath) {
    const db = await openDb(dbPath);
    try {
        await run(db, 'PRAGMA foreign_keys = OFF;');
        await run(db, 'BEGIN TRANSACTION;');

        await sanitizeConfig(db);
        await sanitizeClientesYServicios(db);
        await sanitizeUsuarios(db);

        await run(db, 'COMMIT;');
        await run(db, 'PRAGMA foreign_keys = ON;');
        console.log('[SANITIZE-PUBLIC] OK: bd/losgallegos.db');
    } catch (err) {
        try {
            await run(db, 'ROLLBACK;');
        } catch (e) {}
        throw err;
    } finally {
        db.close();
    }
}

async function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.log('[SANITIZE-PUBLIC] Omitido: no existe bd/losgallegos.db');
        return;
    }
    await sanitizeDb(DB_PATH);
}

main().catch((error) => {
    console.error('[SANITIZE-PUBLIC] Error:', error.message);
    process.exit(1);
});
