const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs'); // <--- IMPORTANTE: Necesario para copiar archivos
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const DESCUENTO_RECORDATORIO = '10%';
const MESES_RECORDATORIO = 9;
const INTERVALO_RECORDATORIO_MS = 12 * 60 * 60 * 1000; // Cada 12 horas

let recordatorioEnProceso = false;

// MIGRACIÓN AUTOMÁTICA: Contraseñas en texto plano -> bcrypt
function migrarPasswordsPlanas() {
    db.all("SELECT idUsuario, contrasena FROM usuario", async (err, rows) => {
        if (err) {
            console.error("Error leyendo usuarios para migración:", err);
            return;
        }

        let migradas = 0;
        for (const row of rows) {
            // Los hashes bcrypt siempre empiezan con "$2a$" o "$2b$" y tienen 60 caracteres
            const yaEsHash = row.contrasena && row.contrasena.startsWith('$2') && row.contrasena.length === 60;
            
            if (!yaEsHash) {
                try {
                    const hash = await bcrypt.hash(row.contrasena, 10);
                    await new Promise((resolve, reject) => {
                        db.run("UPDATE usuario SET contrasena = ? WHERE idUsuario = ?", [hash, row.idUsuario], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    migradas++;
                } catch (e) {
                    console.error(`Error migrando contraseña del usuario ${row.idUsuario}:`, e);
                }
            }
        }

        if (migradas > 0) {
            console.log(`[Migración] ${migradas} contraseña(s) migrada(s) de texto plano a bcrypt.`);
        } else {
            console.log('[Migración] Todas las contraseñas ya están hasheadas.');
        }
    });
}

// LÓGICA DE BASE DE DATOS (PLANTILLA vs PERSONAL)

// --- CÓDIGO ORIGINAL (COMENTADO PARA USO FUTURO) ---
// Si algún día quieres dejar de usar el sistema de plantillas, descomenta esta línea
// y borra el bloque "NUEVO CÓDIGO" de abajo.
// const databasePath = path.join(__dirname, 'bd', 'losgallegos.db');

// Iniciar Sesion
// MÓDULO LOGIN Y USUARIOS



// 8. Iniciar Sesión (con bcrypt)
ipcMain.handle('login-user', async (event, { usuario, password }) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));
        const sql = `SELECT * FROM usuario WHERE nombreUsuario = ?`;
        
        db.get(sql, [usuario], async (err, row) => {
            if (err) {
                console.error("Error en login:", err);
                reject(err);
            } else if (!row) {
                resolve({ success: false });
            } else {
                try {
                    // Comparar contraseña ingresada con el hash almacenado
                    const match = await bcrypt.compare(password, row.contrasena);
                    if (match) {
                        resolve({ success: true, user: row });
                    } else {
                        resolve({ success: false });
                    }
                } catch (bcryptErr) {
                    console.error("Error en bcrypt.compare:", bcryptErr);
                    resolve({ success: false });
                }
            }
        });
    });
});

// 9. Obtener Todos los Usuarios (Para el ABM)
ipcMain.handle('get-users', async () => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));
        const sql = `SELECT idUsuario, nombreUsuario, idRol FROM usuario ORDER BY idUsuario DESC`;
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

// 10. Guardar Usuario (Nuevo o Editar) — con bcrypt
ipcMain.handle('save-user', async (event, data) => {
    if (!db) throw new Error('Base de datos no conectada.');
    const { id, nombreCompleto, usuario, password, rol } = data;
    
    // Mapeo simple de roles según tu HTML
    let idRol = 2; // Default empleado
    if(rol === 'admin') idRol = 1;
    else if(rol === 'presidente') idRol = 3;
    else if(rol === 'encargado') idRol = 4;

    try {
        if (id) {
            // Editar
            if (password) {
                // Hashear la nueva contraseña antes de guardar
                const hash = await bcrypt.hash(password, 10);
                return new Promise((resolve, reject) => {
                    const sql = `UPDATE usuario SET nombreUsuario = ?, contrasena = ?, idRol = ? WHERE idUsuario = ?`;
                    db.run(sql, [usuario, hash, idRol, id], function(err) {
                        if (err) reject(err);
                        else resolve({ success: true });
                    });
                });
            } else {
                // Si NO envió contraseña, mantener la actual
                return new Promise((resolve, reject) => {
                    const sql = `UPDATE usuario SET nombreUsuario = ?, idRol = ? WHERE idUsuario = ?`;
                    db.run(sql, [usuario, idRol, id], function(err) {
                        if (err) reject(err);
                        else resolve({ success: true });
                    });
                });
            }
        } else {
            // Nuevo: hashear contraseña
            const hash = await bcrypt.hash(password, 10);
            return new Promise((resolve, reject) => {
                const sql = `INSERT INTO usuario (nombreUsuario, contrasena, idRol) VALUES (?, ?, ?)`;
                db.run(sql, [usuario, hash, idRol], function(err) {
                    if (err) reject(err);
                    else resolve({ success: true, id: this.lastID });
                });
            });
        }
    } catch (err) {
        console.error("Error hasheando contraseña:", err);
        throw err;
    }
});

// 11. Eliminar Usuario
ipcMain.handle('delete-user', async (event, id) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));
        const sql = `DELETE FROM usuario WHERE idUsuario = ?`;
        db.run(sql, [id], function(err) {
            if (err) reject(err);
            else resolve({ success: true });
        });
    });
});




//  MÓDULO DE STOCK (Gestión de Productos)

// 1. Obtener productos (con paginación server-side opcional)
ipcMain.handle('get-products', async (event, options = '') => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));
        const busqueda = (typeof options === 'string') ? options : (options.busqueda || '');
        const pagina = (typeof options === 'object' && options.pagina) ? options.pagina : 0;
        const limite = (typeof options === 'object' && options.limite) ? options.limite : 0;

        let sqlWhere = '';
        let params = [];

        if (busqueda) {
            sqlWhere = ' WHERE nombre LIKE ? OR marca LIKE ? OR tipo LIKE ?';
            const term = `%${busqueda}%`;
            params = [term, term, term];
        }

        if (pagina > 0 && limite > 0) {
            // Paginación server-side
            const sqlCount = `SELECT COUNT(*) as total FROM producto${sqlWhere}`;
            db.get(sqlCount, params, (err, countRow) => {
                if (err) return reject(err);
                const total = countRow.total;
                const offset = (pagina - 1) * limite;
                const sqlData = `SELECT * FROM producto${sqlWhere} ORDER BY idProducto DESC LIMIT ? OFFSET ?`;
                db.all(sqlData, [...params, limite, offset], (err2, rows) => {
                    if (err2) reject(err2);
                    else resolve({ rows, total });
                });
            });
        } else {
            // Sin paginación (compatibilidad con módulo servicios)
            const sqlData = `SELECT * FROM producto${sqlWhere} ORDER BY idProducto DESC`;
            db.all(sqlData, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }
    });
});

// 1B. Alertas de Stock (productos con stock bajo - para campana)
ipcMain.handle('get-stock-alerts', async () => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('BD no conectada'));
        db.all("SELECT idProducto, nombre, mililitros, cantidad, tipo, tipoEnvase, marca, stockMinimo FROM producto", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

// 1C. Obtener producto por ID (para click en alertas)
ipcMain.handle('get-product-by-id', async (event, id) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('BD no conectada'));
        db.get("SELECT * FROM producto WHERE idProducto = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
});

// 2. Guardar Producto (Nuevo o Editar)
ipcMain.handle('save-product', async (event, data) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));

        // IMPORTANTE:
        // El stock (mililitros) NO se modifica desde el ABM de productos.
        // Toda entrada/salida/ajuste se registra por comprobantes (facturas/servicios/ajustes),
        // dejando trazabilidad en stockOperativo + comprobanteStock.

        const { id, nombre, tipo, marca, unidad, precio, proveedor, tipoEnvase, stockMinimo } = data;
        const stockMin = (stockMinimo !== undefined && stockMinimo !== null && stockMinimo !== '') ? parseInt(stockMinimo, 10) : 0;

        if (id) {
            // EDITAR: solo metadata
            const sql = `UPDATE producto SET 
                nombre=?, tipo=?, marca=?, unidadMedida=?, precio=?, proveedor=?, tipoEnvase=?, stockMinimo=?
                WHERE idProducto=?`;

            db.run(sql, [nombre, tipo, marca, (unidad || 'ml'), precio, proveedor, tipoEnvase, stockMin, id], function(err) {
                if (err) reject(err);
                else resolve({ success: true });
            });
        } else {
            // NUEVO: stock inicial siempre 0 (se carga por factura)
            const sql = `INSERT INTO producto 
                (nombre, tipo, marca, cantidad, mililitros, unidadMedida, precio, proveedor, factura, tipoEnvase, stockMinimo) 
                VALUES (?,?,?,0,0,?,?,?,?,?,?)`;

            db.run(sql, [nombre, tipo, marca, (unidad || 'ml'), precio, proveedor, null, tipoEnvase, stockMin], function(err) {
                if (err) reject(err);
                else resolve({ success: true, id: this.lastID });
            });
        }
    });
});
// 3. Eliminar Producto (con validación de referencias)
ipcMain.handle('delete-product', async (event, id) => {
    if (!db) throw new Error('Base de datos no conectada.');

    const idProd = parseInt(id, 10);
    if (!idProd) return { success: false, error: 'ID de producto inválido.' };

    try {
        // Si el producto ya tiene movimientos asociados, NO se elimina para no romper auditoría / historial.
        const refs = await dbGet(`
            SELECT
                (SELECT COUNT(*) FROM itemFactura WHERE idProducto = ?)      AS cFactura,
                (SELECT COUNT(*) FROM servicioProducto WHERE idProducto = ?) AS cServicio,
                (SELECT COUNT(*) FROM comprobanteStock WHERE idProducto = ?) AS cComprobante,
                (SELECT COUNT(*) FROM stockOperativo WHERE idProducto = ?)   AS cOperativo
        `, [idProd, idProd, idProd, idProd]);

        const cFactura = (refs && refs.cFactura) ? parseInt(refs.cFactura, 10) : 0;
        const cServicio = (refs && refs.cServicio) ? parseInt(refs.cServicio, 10) : 0;
        const cComprobante = (refs && refs.cComprobante) ? parseInt(refs.cComprobante, 10) : 0;
        const cOperativo = (refs && refs.cOperativo) ? parseInt(refs.cOperativo, 10) : 0;

        const totalRefs = cFactura + cServicio + cComprobante + cOperativo;

        if (totalRefs > 0) {
            return {
                success: false,
                code: 'FOREIGN_KEY',
                message: 'No se puede eliminar porque el producto ya fue utilizado en facturas/servicios/ajustes. Si lo borramos, se pierde la trazabilidad de auditoría.',
                refs: { cFactura, cServicio, cComprobante, cOperativo }
            };
        }

        await dbRun('BEGIN TRANSACTION');

        // Limpieza defensiva (por si existiera algún registro operativo sin historial)
        await dbRun('DELETE FROM stockOperativo WHERE idProducto = ?', [idProd]);

        // Borrado final
        await dbRun('DELETE FROM producto WHERE idProducto = ?', [idProd]);

        await dbRun('COMMIT');
        return { success: true };

    } catch (err) {
        try { await dbRun('ROLLBACK'); } catch (e) {}

        console.error('[Producto] Error al eliminar:', err);
        if ((err && err.message || '').includes('SQLITE_CONSTRAINT')) {
            return { success: false, code: 'SQLITE_CONSTRAINT', error: err.message };
        }
        return { success: false, error: err.message || 'Error al eliminar el producto.' };
    }
});








// PROVEEDORES (CRUD EXPANDIDO)
ipcMain.handle('get-proveedores', async () => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));
        db.all("SELECT idProveedor, nombreProveedor, razonSocial, cuit, direccion, telefono FROM proveedor ORDER BY nombreProveedor ASC", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
});

ipcMain.handle('save-proveedor', async (event, data) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));
        // Soporte para objeto expandido o string simple (compatibilidad)
        if (typeof data === 'string') {
            db.run("INSERT OR IGNORE INTO proveedor (nombreProveedor) VALUES (?)", [data], function(err) {
                if (err) reject(err);
                else resolve({ success: true, id: this.lastID });
            });
        } else {
            const { id, nombre, razonSocial, cuit, direccion, telefono } = data;
            if (id) {
                // Editar
                db.run("UPDATE proveedor SET nombreProveedor=?, razonSocial=?, cuit=?, direccion=?, telefono=? WHERE idProveedor=?",
                    [nombre, razonSocial || null, cuit || null, direccion || null, telefono || null, id], function(err) {
                    if (err) reject(err);
                    else resolve({ success: true });
                });
            } else {
                // Nuevo
                db.run("INSERT INTO proveedor (nombreProveedor, razonSocial, cuit, direccion, telefono) VALUES (?,?,?,?,?)",
                    [nombre, razonSocial || null, cuit || null, direccion || null, telefono || null], function(err) {
                    if (err) reject(err);
                    else resolve({ success: true, id: this.lastID });
                });
            }
        }
    });
});

ipcMain.handle('delete-proveedor', async (event, id) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));
        db.run("DELETE FROM proveedor WHERE idProveedor = ?", [id], function(err) {
            if (err) reject(err);
            else resolve({ success: true });
        });
    });
});

// STOCK - COMPRAS POR FACTURA / AJUSTES AUDITABLES / AUDITORÍA

// 1) Registrar compra por factura (ENTRADA de stock + historial auditable)
ipcMain.handle('save-factura-compra', async (event, data) => {
    if (!db) throw new Error('Base de datos no conectada.');

    const { idProveedor, nroComprobante, fecha, observaciones, items, idUsuario } = data || {};

    if (!idUsuario) return { success: false, error: 'Usuario no autenticado.' };
    if (!nroComprobante || !Array.isArray(items) || items.length === 0) {
        return { success: false, error: 'Datos incompletos para registrar la factura.' };
    }

    try {
        await dbRun('BEGIN TRANSACTION');

        const totalFactura = items.reduce((acc, it) => {
            const cant = parseInt(it.cantidadEnvases, 10) || 0;
            const pu = parseFloat(it.precioUnitario) || 0;
            return acc + (cant * pu);
        }, 0);

        const resFactura = await dbRun(
            'INSERT INTO factura (idProveedor, nroComprobante, fecha, importe, observaciones) VALUES (?,?,?,?,?)',
            [idProveedor || null, nroComprobante, fecha || null, totalFactura, observaciones || null]
        );

        const idFactura = resFactura.lastID;
        const fechaMovimiento = fecha || obtenerFechaLocalISO();

        let proveedorNombre = null;
        if (idProveedor) {
            const prov = await dbGet('SELECT nombreProveedor FROM proveedor WHERE idProveedor = ?', [idProveedor]);
            proveedorNombre = prov ? prov.nombreProveedor : null;
        }

        for (const item of items) {
            const idProducto = parseInt(item.idProducto, 10);
            const cantidadEnvases = parseInt(item.cantidadEnvases, 10);
            const precioUnitario = parseFloat(item.precioUnitario);

            if (!idProducto || !cantidadEnvases || cantidadEnvases <= 0) {
                throw new Error('Ítem inválido: producto/cantidad.');
            }
            if (Number.isNaN(precioUnitario) || precioUnitario < 0) {
                throw new Error('Ítem inválido: precio unitario.');
            }

            const prod = await dbGet(
                'SELECT idProducto, nombre, mililitros, cantidad, tipo, tipoEnvase, proveedor FROM producto WHERE idProducto = ?',
                [idProducto]
            );
            if (!prod) throw new Error(`Producto no encontrado (ID ${idProducto}).`);

            const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');
            const capacidadL = esFiltro ? null : extraerCapacidadLitrosEnvase(prod.tipoEnvase);
            let litrosPorUnidad = null;
            let mlPorUnidad = null;
            let mlDelta = 0;
            let antes, despues;

            if (esFiltro) {
                // Filtros: se manejan por cantidad (unidades enteras)
                antes = prod.cantidad || 0;
                despues = antes + cantidadEnvases;
            } else if (capacidadL) {
                mlPorUnidad = capacidadL * 1000;
                mlDelta = cantidadEnvases * mlPorUnidad;
                antes = prod.mililitros || 0;
                despues = antes + mlDelta;
            } else {
                // Opción flexible: pedir litros por unidad en la línea de factura
                litrosPorUnidad = parseFloat(item.litrosPorUnidad);
                if (!litrosPorUnidad || Number.isNaN(litrosPorUnidad) || litrosPorUnidad <= 0) {
                    throw new Error(`El producto "${prod.nombre}" requiere "Litros por unidad" (Envase: Otro).`);
                }
                mlPorUnidad = Math.round(litrosPorUnidad * 1000);
                mlDelta = cantidadEnvases * mlPorUnidad;
                antes = prod.mililitros || 0;
                despues = antes + mlDelta;
            }

            const precioTotal = cantidadEnvases * precioUnitario;

            await dbRun(
                'INSERT INTO itemFactura (idFactura, idProducto, cantidad, precioUnitario, precioTotal) VALUES (?,?,?,?,?)',
                [idFactura, idProducto, cantidadEnvases, precioUnitario, precioTotal]
            );

            const proveedorFinal = proveedorNombre || prod.proveedor || null;

            if (esFiltro) {
                // Filtros: actualizar cantidad (unidades) + factura
                await dbRun(
                    'UPDATE producto SET cantidad = ?, precio = ?, proveedor = ?, factura = ? WHERE idProducto = ?',
                    [despues, precioUnitario, proveedorFinal, nroComprobante, idProducto]
                );
            } else {
                // Líquidos: actualizar mililitros + factura
                await dbRun(
                    'UPDATE producto SET mililitros = ?, precio = ?, proveedor = ?, factura = ? WHERE idProducto = ?',
                    [despues, precioUnitario, proveedorFinal, nroComprobante, idProducto]
                );
            }

            const cantidadAuditoria = esFiltro ? cantidadEnvases : mlDelta;

            const detalle = JSON.stringify({
                origen: 'FACTURA',
                idFactura,
                nroComprobante,
                idProveedor: idProveedor || null,
                proveedor: proveedorNombre || null,
                cantidadEnvases,
                precioUnitario,
                litrosPorUnidad,
                esFiltro
            });

            const mov = await dbRun(
                'INSERT INTO stockOperativo (tipoOperacion, cantidad, motivo, idProducto, idUsuario, detalle) VALUES (?,?,?,?,?,?)',
                ['ENTRADA', cantidadAuditoria, 'FACTURA', idProducto, idUsuario, detalle]
            );

            await dbRun(
                `INSERT INTO comprobanteStock 
                (fecha, tipoMovimiento, proceso, cantidad, datoAnterior, datoActual, idProducto, idUsuario, idMovimiento, idFactura)
                VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [fechaMovimiento, 'ENTRADA', 'FACTURA', cantidadAuditoria, antes, despues, idProducto, idUsuario, mov.lastID, idFactura]
            );
        }

        await dbRun('COMMIT');
        return { success: true, idFactura };

    } catch (err) {
        try { await dbRun('ROLLBACK'); } catch (e) {}

        console.error('[Factura] Error:', err);
        return { success: false, error: err.message || 'Error al registrar factura.' };
    }
});

// 2) Registrar ajuste de stock (AJUSTE + historial auditable) — SOLO ADMIN (idRol=1)
ipcMain.handle('save-ajuste-stock', async (event, data) => {
    if (!db) throw new Error('Base de datos no conectada.');

    const { idProducto, mlDelta, motivoEnum, detalleLibre, idUsuario, esFiltro } = data || {};

    if (!idUsuario) return { success: false, error: 'Usuario no autenticado.' };

    // Validar rol: solo admin (idRol = 1) puede registrar ajustes
    const usuario = await dbGet('SELECT idRol FROM usuario WHERE idUsuario = ?', [idUsuario]);
    if (!usuario || usuario.idRol !== 1) {
        return { success: false, error: 'No tiene permisos para registrar ajustes. Solo administradores.' };
    }

    const idProd = parseInt(idProducto, 10);
    const delta = parseInt(mlDelta, 10);

    if (!idProd || !delta || delta === 0) {
        return { success: false, error: 'Datos incompletos para registrar el ajuste.' };
    }

    const motivo = (motivoEnum || '').toString().trim();
    if (!motivo) return { success: false, error: 'Motivo requerido.' };

    try {
        await dbRun('BEGIN TRANSACTION');
        const fechaMovimiento = obtenerFechaLocalISO();

        const prod = await dbGet('SELECT nombre, mililitros, cantidad, tipo FROM producto WHERE idProducto = ?', [idProd]);
        if (!prod) throw new Error('Producto no encontrado.');

        const productoEsFiltro = esFiltro || (prod.tipo || '').toLowerCase().includes('filtro');
        let antes, despues;

        if (productoEsFiltro) {
            antes = prod.cantidad || 0;
            despues = antes + delta;
        } else {
            antes = prod.mililitros || 0;
            despues = antes + delta;
        }

        if (despues < 0) {
            throw new Error('El ajuste deja el stock en negativo.');
        }

        if (productoEsFiltro) {
            await dbRun('UPDATE producto SET cantidad = ? WHERE idProducto = ?', [despues, idProd]);
        } else {
            await dbRun('UPDATE producto SET mililitros = ? WHERE idProducto = ?', [despues, idProd]);
        }

        const detalle = JSON.stringify({
            origen: 'AJUSTE',
            motivo,
            detalle: (detalleLibre || '').toString().trim(),
            mlDelta: delta
        });

        const mov = await dbRun(
            'INSERT INTO stockOperativo (tipoOperacion, cantidad, motivo, idProducto, idUsuario, detalle) VALUES (?,?,?,?,?,?)',
            ['AJUSTE', delta, motivo, idProd, idUsuario, detalle]
        );

        await dbRun(
            `INSERT INTO comprobanteStock 
            (fecha, tipoMovimiento, proceso, cantidad, datoAnterior, datoActual, idProducto, idUsuario, idMovimiento)
            VALUES (?,?,?,?,?,?,?,?,?)`,
            [fechaMovimiento, 'AJUSTE', motivo, delta, antes, despues, idProd, idUsuario, mov.lastID]
        );

        await dbRun('COMMIT');
        return { success: true };

    } catch (err) {
        try { await dbRun('ROLLBACK'); } catch (e) {}
        console.error('[Ajuste] Error:', err);
        return { success: false, error: err.message || 'Error al registrar ajuste.' };
    }
});

// 3) Auditoría: listado de facturas (paginado + filtros)
ipcMain.handle('get-facturas', async (event, options = {}) => {
    if (!db) throw new Error('Base de datos no conectada.');

    const pagina = options && options.pagina ? parseInt(options.pagina, 10) : 0;
    const limite = options && options.limite ? parseInt(options.limite, 10) : 0;

    const where = [];
    const params = [];

    const fecha = options && options.fecha ? options.fecha : null;
    const idProveedor = options && options.idProveedor ? parseInt(options.idProveedor, 10) : null;
    const nro = options && options.nroComprobante ? options.nroComprobante.toString().trim() : null;

    if (fecha) { where.push('date(f.fecha) = date(?)'); params.push(fecha); }
    if (idProveedor) { where.push('f.idProveedor = ?'); params.push(idProveedor); }
    if (nro) { where.push('f.nroComprobante LIKE ?'); params.push(`%${nro}%`); }

    const sqlWhere = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    // Query principal (sin GROUP BY para facilitar paginación)
    const sqlBase = `
        FROM factura f
        LEFT JOIN proveedor p ON p.idProveedor = f.idProveedor
        ${sqlWhere}
    `;

    const sqlData = `
        SELECT 
            f.idFactura,
            f.fecha,
            f.nroComprobante,
            f.importe,
            f.observaciones,
            f.idProveedor,
            p.nombreProveedor AS proveedor,
            (SELECT COUNT(*) FROM itemFactura i WHERE i.idFactura = f.idFactura) AS cantidadItems
        ${sqlBase}
        ORDER BY date(f.fecha) DESC, f.idFactura DESC
    `;

    // Compatibilidad (sin paginar)
    if (!(pagina > 0 && limite > 0)) {
        return await dbAll(sqlData, params);
    }

    const rowTotal = await dbGet(`SELECT COUNT(*) AS total ${sqlBase}`, params);
    const total = rowTotal ? (rowTotal.total || 0) : 0;

    const offset = (pagina - 1) * limite;
    const rows = await dbAll(sqlData + ` LIMIT ? OFFSET ?`, [...params, limite, offset]);

    return { rows, total };
});


// 4) Auditoría: detalle de factura
ipcMain.handle('get-factura-detalle', async (event, idFactura) => {
    if (!db) throw new Error('Base de datos no conectada.');

    const sql = `
        SELECT 
            i.idItem,
            i.idProducto,
            pr.nombre,
            pr.marca,
            pr.tipo,
            pr.tipoEnvase,
            i.cantidad,
            i.precioUnitario,
            i.precioTotal
        FROM itemFactura i
        JOIN producto pr ON pr.idProducto = i.idProducto
        WHERE i.idFactura = ?
        ORDER BY i.idItem ASC
    `;

    return await dbAll(sql, [idFactura]);
});

// 5) Auditoría: movimientos unificados de stock (paginado + filtros)
ipcMain.handle('get-movimientos-stock', async (event, options = {}) => {
    if (!db) throw new Error('Base de datos no conectada.');

    const pagina = options && options.pagina ? parseInt(options.pagina, 10) : 0;
    const limite = options && options.limite ? parseInt(options.limite, 10) : 0;

    const idProducto = options && options.idProducto ? parseInt(options.idProducto, 10) : null;
    const tipoMovimiento = options && options.tipoMovimiento ? options.tipoMovimiento.toString().trim() : null;
    const idUsuario = options && options.idUsuario ? parseInt(options.idUsuario, 10) : null;

    const fecha = options && options.fecha ? options.fecha : null;
    const desde = options && options.desde ? options.desde : null;
    const hasta = options && options.hasta ? options.hasta : null;

    const where = [];
    const params = [];

    if (idProducto) { where.push('cs.idProducto = ?'); params.push(idProducto); }
    if (tipoMovimiento) { where.push('cs.tipoMovimiento = ?'); params.push(tipoMovimiento); }
    if (idUsuario) { where.push('cs.idUsuario = ?'); params.push(idUsuario); }

    // Fecha exacta (prioridad) o rango
    if (fecha) { where.push('date(cs.fecha) = date(?)'); params.push(fecha); }
    else {
        if (desde) { where.push('date(cs.fecha) >= date(?)'); params.push(desde); }
        if (hasta) { where.push('date(cs.fecha) <= date(?)'); params.push(hasta); }
    }

    const sqlWhere = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    const sqlData = `
        SELECT 
            cs.idComprobante,
            cs.fecha,
            cs.tipoMovimiento,
            cs.proceso,
            cs.cantidad,
            cs.datoAnterior,
            cs.datoActual,
            cs.idProducto,
            pr.nombre AS producto,
            pr.marca AS marcaProducto,
            pr.tipo AS tipoProducto,
            pr.tipoEnvase,
            cs.idUsuario,
            u.nombreUsuario AS usuario,
            cs.idMovimiento,
            cs.idFactura,
            f.nroComprobante AS nroFactura,
            prov.nombreProveedor AS proveedorFactura,
            cs.idServicio,
            s.patente AS patenteServicio,
            s.fecha AS fechaServicio,
            (SELECT so.detalle FROM stockOperativo so WHERE so.ROWID = cs.idMovimiento LIMIT 1) AS detalleMovimiento
        FROM comprobanteStock cs
        JOIN producto pr ON pr.idProducto = cs.idProducto
        JOIN usuario u ON u.idUsuario = cs.idUsuario
        LEFT JOIN factura f ON f.idFactura = cs.idFactura
        LEFT JOIN proveedor prov ON prov.idProveedor = f.idProveedor
        LEFT JOIN servicio s ON s.idServicio = cs.idServicio
        ${sqlWhere}
        ORDER BY cs.fecha DESC, cs.idComprobante DESC
    `;

    // Compatibilidad: si no piden paginación, devolvemos array limitado
    if (!(pagina > 0 && limite > 0)) {
        const lim = (options && options.limite) ? parseInt(options.limite, 10) : 500;
        return await dbAll(sqlData + ` LIMIT ${lim}`, params);
    }

    const rowTotal = await dbGet(`SELECT COUNT(*) AS total FROM comprobanteStock cs ${sqlWhere}`, params);
    const total = rowTotal ? (rowTotal.total || 0) : 0;

    const offset = (pagina - 1) * limite;
    const rows = await dbAll(sqlData + ' LIMIT ? OFFSET ?', [...params, limite, offset]);

    return { rows, total };
});


// LÓGICA DE BASE DE DATOS
// Producción : copia bd/losgallegos.db (extraResources) → %APPDATA%/.../bd/losgallegos.db
// Desarrollo : usa bd/losgallegos.db del proyecto directamente

let databasePath; // Se asigna dentro de inicializarBD(), DESPUÉS de app.whenReady()

async function inicializarBD() {
    const isPackaged = app.isPackaged;

    if (!isPackaged) {
        // DESARROLLO: BD local del proyecto
        databasePath = path.join(__dirname, 'bd', 'losgallegos.db');
        console.log('[BD] Modo desarrollo:', databasePath);
        return;
    }

    // PRODUCCIÓN
    // app.getPath('userData') => C:\Users\...\AppData\Roaming\Los Gallegos Lubricentro
    const carpetaDestino = path.join(app.getPath('userData'), 'bd');
    const dbDestino      = path.join(carpetaDestino, 'losgallegos.db');
    // extraResources copia el archivo a resources/bd/losgallegos.db dentro del instalado
    const dbOrigen       = path.join(process.resourcesPath, 'bd', 'losgallegos.db');

    databasePath = dbDestino;

    console.log('[BD] Modo producción');
    console.log('[BD] Origen  :', dbOrigen);
    console.log('[BD] Destino :', dbDestino);

    // Crear carpeta destino si no existe
    if (!fs.existsSync(carpetaDestino)) {
        fs.mkdirSync(carpetaDestino, { recursive: true });
    }

    // Copiar solo la primera vez (cuando todavía no existe la BD del usuario)
    if (!fs.existsSync(dbDestino)) {
        if (!fs.existsSync(dbOrigen)) {
            dialog.showErrorBox(
                'Los Gallegos - Error de Base de Datos',
                'No se encontró la base de datos en el instalador.\n\nRuta buscada:\n' + dbOrigen
            );
            return;
        }
        try {
            await fs.promises.copyFile(dbOrigen, dbDestino);
            console.log('[BD] BD copiada con éxito en:', dbDestino);
        } catch (err) {
            dialog.showErrorBox('Los Gallegos - Error al copiar BD', err.message);
        }
    } else {
        console.log('[BD] BD del usuario ya existe, usando la existente.');
    }
}


let db;


// HELPERS SQLITE (Promesas)
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function extraerCapacidadLitrosEnvase(tipoEnvase) {
    if (!tipoEnvase) return null;
    const texto = tipoEnvase.toString().toLowerCase();
    // Caja = 1 unidad equivalente a 1 litro en el sistema
    if (texto.includes('caja')) return 1;
    // Soporta: "Tambor (200 lts)", "Bidon (5 lts)", "Botella (1lt)", etc.
    const match = texto.match(/(\d+)\s*(?:l|lt|lts)/i);
    return match ? parseInt(match[1], 10) : null;
}

async function agregarColumnaSiNoExiste(tabla, columna, definicionSql) {
    const cols = await dbAll(`PRAGMA table_info(${tabla})`);
    const existe = cols.some(c => c.name === columna);
    if (!existe) {
        await dbRun(`ALTER TABLE ${tabla} ADD COLUMN ${definicionSql}`);
        console.log(`[Migración] ${tabla}: columna agregada -> ${columna}`);
    }
}

async function asegurarMigracionesAuditoria() {
    // Integridad referencial (por defecto SQLite puede venir OFF)
    await dbRun('PRAGMA foreign_keys = ON;');

    // Link relacional del movimiento al "origen"
    await agregarColumnaSiNoExiste('comprobanteStock', 'idFactura', 'idFactura INTEGER');
    await agregarColumnaSiNoExiste('comprobanteStock', 'idServicio', 'idServicio INTEGER');

    // Enriquecer movimientos para reportes
    await agregarColumnaSiNoExiste('stockOperativo', 'idProducto', 'idProducto INTEGER');
    await agregarColumnaSiNoExiste('stockOperativo', 'idUsuario', 'idUsuario INTEGER');
    await agregarColumnaSiNoExiste('stockOperativo', 'detalle', 'detalle TEXT');
}

// MIGRACIÓN v3.0: Nuevas tablas y columnas para el plan de desarrollo
async function asegurarMigracionesV30() {
    try {
        // Asegurar tabla config
        await dbRun("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)");

        const yaMigrado = await dbGet("SELECT value FROM config WHERE key = 'migracion_v30'");
        if (yaMigrado) {
            console.log('[Migración v3.0] Ya ejecutada.');
            // Asegurar columnas añadidas post-migración inicial
            await agregarColumnaSiNoExiste('presupuesto', 'patente', 'patente TEXT');
            return;
        }

        console.log('[Migración v3.0] Ejecutando migraciones...');

        // 0.1 - Tabla marca_vehiculo
        await dbRun(`CREATE TABLE IF NOT EXISTS marca_vehiculo (
            idMarca INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        )`);
        const marcasVehiculo = ['Fiat','Ford','Volkswagen','Renault','Peugeot','Chevrolet','Toyota','Honda','Nissan','Hyundai','Kia','BMW','Mercedes-Benz','Audi','Citroën','Jeep','Suzuki','Mitsubishi','Subaru','Mazda'];
        for (const m of marcasVehiculo) {
            await dbRun("INSERT OR IGNORE INTO marca_vehiculo (nombre) VALUES (?)", [m]);
        }

        // 0.2 - Tabla tipo_servicio
        await dbRun(`CREATE TABLE IF NOT EXISTS tipo_servicio (
            idTipoServicio INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            precioBase REAL DEFAULT 0
        )`);
        const tiposServicio = [
            { nombre: 'Cambio de aceite', precioBase: 0 },
            { nombre: 'Filtro de aire', precioBase: 0 },
            { nombre: 'Filtro de combustible', precioBase: 0 }
        ];
        for (const ts of tiposServicio) {
            await dbRun("INSERT OR IGNORE INTO tipo_servicio (nombre, precioBase) VALUES (?, ?)", [ts.nombre, ts.precioBase]);
        }

        // 0.3 - Tabla servicioDetallado
        await dbRun(`CREATE TABLE IF NOT EXISTS servicioDetallado (
            idServicioDetalle INTEGER PRIMARY KEY AUTOINCREMENT,
            idServicio INTEGER,
            idTipoServicio INTEGER,
            descripcionExtra TEXT,
            FOREIGN KEY (idServicio) REFERENCES servicio(idServicio),
            FOREIGN KEY (idTipoServicio) REFERENCES tipo_servicio(idTipoServicio)
        )`);

        // 0.4 - Columna stockMinimo en producto
        await agregarColumnaSiNoExiste('producto', 'stockMinimo', 'stockMinimo INTEGER DEFAULT 0');

        // 0.5 - Columna email en cliente
        await agregarColumnaSiNoExiste('cliente', 'email', 'email TEXT');

        // 0.6 - Expandir proveedor
        await agregarColumnaSiNoExiste('proveedor', 'razonSocial', 'razonSocial TEXT');
        await agregarColumnaSiNoExiste('proveedor', 'cuit', 'cuit TEXT');
        await agregarColumnaSiNoExiste('proveedor', 'direccion', 'direccion TEXT');
        await agregarColumnaSiNoExiste('proveedor', 'telefono', 'telefono TEXT');

        // 0.7 - Tabla presupuesto
        await dbRun(`CREATE TABLE IF NOT EXISTS presupuesto (
            idPresupuesto INTEGER PRIMARY KEY AUTOINCREMENT,
            idCliente INTEGER,
            patente TEXT,
            fecha TEXT DEFAULT (date('now')),
            total REAL DEFAULT 0,
            estado TEXT DEFAULT 'Pendiente',
            observaciones TEXT,
            FOREIGN KEY (idCliente) REFERENCES cliente(id)
        )`);
        await agregarColumnaSiNoExiste('presupuesto', 'patente', 'patente TEXT');

        // 0.8 - Tabla presupuestoItem
        await dbRun(`CREATE TABLE IF NOT EXISTS presupuestoItem (
            idItem INTEGER PRIMARY KEY AUTOINCREMENT,
            idPresupuesto INTEGER,
            idTipoServicio INTEGER,
            precio REAL DEFAULT 0,
            descripcion TEXT,
            FOREIGN KEY (idPresupuesto) REFERENCES presupuesto(idPresupuesto),
            FOREIGN KEY (idTipoServicio) REFERENCES tipo_servicio(idTipoServicio)
        )`);

        // Tabla marca_producto (para marcas de lubricantes configurables)
        await dbRun(`CREATE TABLE IF NOT EXISTS marca_producto (
            idMarcaProducto INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        )`);
        const marcasProducto = ['Mobil','Shell','YPF','Castrol','Valvoline','Motul','Total','Mannol','Liqui Moly','Petronas','Repsol','Gulf','Elf'];
        for (const mp of marcasProducto) {
            await dbRun("INSERT OR IGNORE INTO marca_producto (nombre) VALUES (?)", [mp]);
        }

        // Índices para nuevas tablas
        await dbRun('CREATE INDEX IF NOT EXISTS idx_presupuesto_cliente ON presupuesto(idCliente)');
        await dbRun('CREATE INDEX IF NOT EXISTS idx_presupuesto_estado ON presupuesto(estado)');
        await dbRun('CREATE INDEX IF NOT EXISTS idx_presupuestoItem_presup ON presupuestoItem(idPresupuesto)');
        await dbRun('CREATE INDEX IF NOT EXISTS idx_servicioDetallado_serv ON servicioDetallado(idServicio)');

        await dbRun("INSERT OR REPLACE INTO config (key, value) VALUES ('migracion_v30', ?)", [Date.now().toString()]);
        console.log('[Migración v3.0] Completada exitosamente.');

    } catch (err) {
        console.error('[Migración v3.0] Error:', err);
    }
}

// MIGRACIÓN DE DATOS: Renombrar productos + Agregar nuevos
// Se ejecuta solo una vez (usa tabla config para control)
async function migrarProductosV51() {
    try {
        // Asegurar que la tabla config existe
        await dbRun("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)");

        // Verificar si ya se ejecutó esta migración
        const yaMigrado = await dbGet("SELECT value FROM config WHERE key = 'migracion_productos_v51'");
        if (yaMigrado) {
            console.log('[Migración] Productos v5.1 ya migrados.');
            return;
        }

        console.log('[Migración] Ejecutando migración de productos v5.1...');

        // 1) Renombrar productos: "Aceite Motor X" → "Mannol X"
        await dbRun(`UPDATE producto SET nombre = REPLACE(nombre, 'Aceite Motor ', 'Mannol ') WHERE nombre LIKE 'Aceite Motor %'`);
        console.log('[Migración] Productos renombrados: "Aceite Motor" → "Mannol"');

        // 2) Agregar Filtros (no líquidos, tipoEnvase = Caja, mililitros = 0)
        const filtros = [
            { nombre: 'Filtro de Aceite', tipo: 'filtro', marca: 'Genérico', tipoEnvase: 'Caja (1 unidad)' },
            { nombre: 'Filtro de Aire', tipo: 'filtro', marca: 'Genérico', tipoEnvase: 'Caja (1 unidad)' },
            { nombre: 'Filtro de Combustible', tipo: 'filtro', marca: 'Genérico', tipoEnvase: 'Caja (1 unidad)' },
            { nombre: 'Filtro de Habitáculo', tipo: 'filtro', marca: 'Genérico', tipoEnvase: 'Caja (1 unidad)' }
        ];

        for (const f of filtros) {
            const existe = await dbGet("SELECT idProducto FROM producto WHERE nombre = ?", [f.nombre]);
            if (!existe) {
                await dbRun(
                    `INSERT INTO producto (nombre, tipo, marca, cantidad, mililitros, unidadMedida, precio, proveedor, factura, tipoEnvase) 
                     VALUES (?, ?, ?, 0, 0, 'unidad', 0, NULL, NULL, ?)`,
                    [f.nombre, f.tipo, f.marca, f.tipoEnvase]
                );
                console.log(`[Migración] Producto agregado: ${f.nombre}`);
            }
        }

        // 3) Agregar Líquidos Refrigerantes reales
        const refrigerantes = [
            { nombre: 'Refrigerante Prestone AF2100', tipo: 'liquido_refrigerante', marca: 'Prestone', tipoEnvase: 'Bidon (4 lts)' },
            { nombre: 'Refrigerante Shell Dexcool 50/50', tipo: 'liquido_refrigerante', marca: 'Shell', tipoEnvase: 'Bidon (4 lts)' },
            { nombre: 'Refrigerante Mobil Antifreeze', tipo: 'liquido_refrigerante', marca: 'Mobil', tipoEnvase: 'Bidon (5 lts)' },
            { nombre: 'Refrigerante Total Glacelf Auto Supra', tipo: 'liquido_refrigerante', marca: 'Total', tipoEnvase: 'Botella (1lt)' },
            { nombre: 'Refrigerante Mannol AG13 -40°C', tipo: 'liquido_refrigerante', marca: 'Mannol', tipoEnvase: 'Bidon (5 lts)' }
        ];

        for (const r of refrigerantes) {
            const existe = await dbGet("SELECT idProducto FROM producto WHERE nombre = ?", [r.nombre]);
            if (!existe) {
                await dbRun(
                    `INSERT INTO producto (nombre, tipo, marca, cantidad, mililitros, unidadMedida, precio, proveedor, factura, tipoEnvase) 
                     VALUES (?, ?, ?, 0, 0, 'ml', 0, NULL, NULL, ?)`,
                    [r.nombre, r.tipo, r.marca, r.tipoEnvase]
                );
                console.log(`[Migración] Producto agregado: ${r.nombre}`);
            }
        }

        // Marcar migración como ejecutada
        await dbRun("INSERT OR REPLACE INTO config (key, value) VALUES ('migracion_productos_v51', ?)", [Date.now().toString()]);
        console.log('[Migración] Productos v5.1 completada exitosamente.');

    } catch (err) {
        console.error('[Migración] Error en migración de productos v5.1:', err);
    }
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'recursos', 'logo-Los-Gallegos (2).ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'puente.js') 
        }
    });

    // --- LOGIN: En producción SIEMPRE mostrar login. En desarrollo se puede bypassear para agilizar pruebas ---
    const bypassEnv = (process.env.BYPASS_LOGIN || '').trim();
    const _isPackaged = app.isPackaged;
    const bypassLoginDev = (!_isPackaged) && (bypassEnv === '' || bypassEnv === '1' || bypassEnv.toLowerCase() == 'true');

    if (_isPackaged || !bypassLoginDev) {
        // Producción (o dev forzado): cargar login
        mainWindow.loadFile(path.join(__dirname, 'moduloLogin', 'login', 'login.html'));
    } else {
        // Desarrollo: cargar directo Dashboard
        mainWindow.loadFile(path.join(__dirname, 'moduloDashboard', 'dashboard.html'));
        // En dev sin login, inyectar usuario por defecto para que los módulos funcionen
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.executeJavaScript(
                `if (!localStorage.getItem('usuarioID')) { localStorage.setItem('usuarioID', '1'); }`
            );
        });
    }

    // mainWindow.webContents.openDevTools();
}

function connectDatabase() {
    db = new sqlite3.Database(databasePath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error('Error al conectar con la base de datos:', err.message);
        } else {
            console.log('Conectado a la base de datos SQLite:', databasePath);
            db.run("PRAGMA journal_mode = WAL;");
            db.run("PRAGMA foreign_keys = ON;");
            db.configure("busyTimeout", 10000);

            // Migraciones de auditoría (columnas nuevas) - seguras si ya existen
            asegurarMigracionesAuditoria()
                .then(() => {
                    console.log("[Migración] Auditoría lista.");
                    // Migración v3.0 (nuevas tablas y columnas)
                    return asegurarMigracionesV30();
                })
                .then(() => {
                    console.log("[Migración] v3.0 lista.");
                    // Migración de productos v5.1 (renombrar + agregar nuevos)
                    return migrarProductosV51();
                })
                .catch((e) => console.error("[Migración] Error:", e));

            const asegurarRolesBase = () => {
                db.run("INSERT OR IGNORE INTO Rol (idRol, nombreRol) VALUES (1, 'admin')");
                db.run("INSERT OR IGNORE INTO Rol (idRol, nombreRol) VALUES (2, 'empleado')");
                db.run("INSERT OR IGNORE INTO Rol (idRol, nombreRol) VALUES (3, 'presidente')");
                db.run("INSERT OR IGNORE INTO Rol (idRol, nombreRol) VALUES (4, 'encargado')");
            };

            asegurarRolesBase();

            // --- CÓDIGO NUEVO: CREAR ADMIN SI NO EXISTE (con bcrypt) ---
            db.get("SELECT count(*) as count FROM usuario", async (err, row) => {
                if (err) console.log("Error verificando usuarios:", err);
                else if (row.count === 0) {
                    console.log("Base de datos de usuarios vacía. Creando usuario ADMIN por defecto...");
                    try {
                        const hashAdmin = await bcrypt.hash('admin', 10);
                        db.run(`INSERT INTO usuario (nombreUsuario, contrasena, idRol) VALUES ('admin', ?, 1)`, [hashAdmin], (err) => {
                            if (err) console.error(err);
                            else console.log("Usuario 'admin' creado. Contraseña: 'admin' (hasheada con bcrypt)");
                        });
                    } catch (e) {
                        console.error("Error hasheando contraseña admin:", e);
                    }
                } else {
                    // Migrar contraseñas en texto plano a bcrypt
                    migrarPasswordsPlanas();
                }
            });

            // Crear/verificar índices para optimizar consultas
            crearIndices();

            // NOTA: El VACUUM se ejecuta con delay de 15s desde app.whenReady()
            // para no bloquear el inicio ni el login.
        }
    });
}

async function obtenerConfigSMTP() {
    const hostRow = await dbGet("SELECT value FROM config WHERE key = 'smtp_host'");
    const portRow = await dbGet("SELECT value FROM config WHERE key = 'smtp_port'");
    const userRow = await dbGet("SELECT value FROM config WHERE key = 'smtp_user'");
    const passRow = await dbGet("SELECT value FROM config WHERE key = 'smtp_pass'");

    return {
        host: hostRow ? hostRow.value : '',
        port: portRow ? parseInt(portRow.value, 10) : 587,
        user: userRow ? userRow.value : '',
        pass: passRow ? passRow.value : ''
    };
}

async function enviarCorreoSMTP({ destinatario, asunto, cuerpo }) {
    const smtp = await obtenerConfigSMTP();
    if (!smtp.host || !smtp.user || !smtp.pass) {
        throw new Error('Configure el servidor SMTP primero (Dashboard > Configuración Email).');
    }

    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.user, pass: smtp.pass }
    });

    await transporter.sendMail({
        from: smtp.user,
        to: destinatario,
        subject: asunto,
        html: cuerpo || ''
    });
}

async function asegurarTablaRecordatoriosEmail() {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS emailRecordatorioServicio (
            idRecordatorio INTEGER PRIMARY KEY AUTOINCREMENT,
            idCliente INTEGER NOT NULL,
            fechaServicio TEXT NOT NULL,
            fechaEnvio TEXT DEFAULT (datetime('now')),
            emailDestino TEXT,
            asunto TEXT,
            FOREIGN KEY (idCliente) REFERENCES cliente(id),
            UNIQUE(idCliente, fechaServicio)
        )
    `);
    await dbRun('CREATE INDEX IF NOT EXISTS idx_recordatorio_cliente ON emailRecordatorioServicio(idCliente)');
}

function formatearFechaCorta(fechaISO) {
    if (!fechaISO) return '';
    const base = String(fechaISO).split(' ')[0];
    const partes = base.split('-');
    if (partes.length !== 3) return base;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function obtenerFechaLocalISO() {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function escaparHtmlPdf(valor) {
    return (valor || '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatearMonedaPdf(valor) {
    const numero = Math.round(Number(valor || 0));
    return '$' + numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function sanitizarNombreArchivo(valor) {
    return (valor || 'cliente')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

let logoPresupuestoDataUriCache;
function obtenerLogoPresupuestoDataUri() {
    if (logoPresupuestoDataUriCache !== undefined) return logoPresupuestoDataUriCache;

    const candidatos = [
        path.join(__dirname, 'recursos', 'Logo Los Gallegos.png'),
        path.join(process.resourcesPath || '', 'recursos', 'Logo Los Gallegos.png')
    ];

    for (const ruta of candidatos) {
        try {
            if (ruta && fs.existsSync(ruta)) {
                const buffer = fs.readFileSync(ruta);
                logoPresupuestoDataUriCache = `data:image/png;base64,${buffer.toString('base64')}`;
                return logoPresupuestoDataUriCache;
            }
        } catch (e) {}
    }

    logoPresupuestoDataUriCache = null;
    return logoPresupuestoDataUriCache;
}

function construirHtmlPresupuestoPdf(presu, items) {
    const logoDataUri = obtenerLogoPresupuestoDataUri();
    const bloqueLogo = logoDataUri
        ? `<img src="${logoDataUri}" alt="Los Gallegos" class="logo-empresa">`
        : '';

    const filasItems = Array.isArray(items) && items.length > 0
        ? items.map(it => `
            <tr>
                <td>${escaparHtmlPdf(it.descripcion || '-')}</td>
                <td class="importe">${formatearMonedaPdf(it.precio || 0)}</td>
            </tr>
        `).join('')
        : `
            <tr>
                <td>Sin items.</td>
                <td class="importe">${formatearMonedaPdf(0)}</td>
            </tr>
        `;

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Presupuesto #${escaparHtmlPdf(presu.idPresupuesto)}</title>
            <style>
                @page {
                    size: A4;
                    margin: 18mm;
                }
                * {
                    box-sizing: border-box;
                }
                body {
                    margin: 0;
                    font-family: Arial, Helvetica, sans-serif;
                    color: #000;
                    background: #fff;
                    font-size: 12pt;
                    line-height: 1.4;
                }
                .encabezado {
                    margin-bottom: 18px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #000;
                }
                .encabezado-superior {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 14px;
                }
                .logo-empresa {
                    width: 120px;
                    height: auto;
                    object-fit: contain;
                }
                .empresa {
                    font-size: 20pt;
                    font-weight: 700;
                    margin: 0 0 6px 0;
                }
                .titulo {
                    font-size: 16pt;
                    font-weight: 700;
                    margin: 0;
                }
                .meta {
                    margin: 16px 0 18px 0;
                }
                .meta p {
                    margin: 4px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    border-bottom: 1px solid #000;
                    padding: 10px 8px;
                    vertical-align: top;
                    text-align: left;
                }
                th {
                    font-size: 11pt;
                    font-weight: 700;
                }
                .importe {
                    text-align: right;
                    white-space: nowrap;
                    width: 160px;
                }
                .total {
                    margin-top: 18px;
                    text-align: right;
                    font-size: 14pt;
                    font-weight: 700;
                }
                .obs {
                    margin-top: 12px;
                    padding: 10px 12px;
                    border: 1px solid #000;
                }
            </style>
        </head>
        <body>
            <div class="encabezado">
                <div class="encabezado-superior">
                    <p class="empresa">Los Gallegos Lubricentro</p>
                    ${bloqueLogo}
                </div>
                <p class="titulo">Detalle de Presupuesto #${escaparHtmlPdf(presu.idPresupuesto)}</p>
            </div>
            <div class="meta">
                <p><strong>Cliente:</strong> ${escaparHtmlPdf(presu.cliente || '-')}</p>
                <p><strong>Fecha:</strong> ${escaparHtmlPdf(formatearFechaCorta(presu.fecha) || '-')}</p>
                <p><strong>Estado:</strong> ${escaparHtmlPdf(presu.estado || '-')}</p>
                <p><strong>Patente:</strong> ${escaparHtmlPdf(presu.patente || '-')}</p>
            </div>
            ${presu.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${escaparHtmlPdf(presu.observaciones)}</div>` : ''}
            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="importe">Precio</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasItems}
                </tbody>
            </table>
            <div class="total">Total: ${formatearMonedaPdf(presu.total || 0)}</div>
        </body>
        </html>
    `;
}

async function generarPdfPresupuestoEnDescargas(presu, items) {
    const descargas = app.getPath('downloads');
    const tempDir = app.getPath('temp');
    const fechaArchivo = String(presu.fecha || '').split(' ')[0] || new Date().toISOString().slice(0, 10);
    const nombreCliente = sanitizarNombreArchivo(presu.cliente || 'cliente');
    const nombreArchivo = `Presupuesto-${presu.idPresupuesto || 'sin-id'}-${nombreCliente}-${fechaArchivo}.pdf`;
    const rutaDestino = path.join(descargas, nombreArchivo);
    const html = construirHtmlPresupuestoPdf(presu, items);
    const rutaHtmlTemporal = path.join(tempDir, `presupuesto-${presu.idPresupuesto || 'sin-id'}-${Date.now()}.html`);

    const pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            sandbox: false
        }
    });

    try {
        await fs.promises.writeFile(rutaHtmlTemporal, html, 'utf8');
        await pdfWindow.loadFile(rutaHtmlTemporal);
        await new Promise(resolve => setTimeout(resolve, 150));
        const pdfBuffer = await pdfWindow.webContents.printToPDF({
            landscape: false,
            printBackground: false,
            pageSize: 'A4',
            margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            },
            preferCSSPageSize: true
        });
        await fs.promises.writeFile(rutaDestino, pdfBuffer);
        return rutaDestino;
    } finally {
        try {
            await fs.promises.unlink(rutaHtmlTemporal);
        } catch (e) {}

        if (!pdfWindow.isDestroyed()) {
            pdfWindow.destroy();
        }
    }
}

ipcMain.handle('download-presupuesto-pdf', async (event, data) => {
    try {
        const presu = data && data.presupuesto ? data.presupuesto : null;
        const items = data && Array.isArray(data.items) ? data.items : [];
        if (!presu || !presu.idPresupuesto) {
            return { success: false, error: 'Presupuesto inválido.' };
        }

        const ruta = await generarPdfPresupuestoEnDescargas(presu, items);
        return { success: true, path: ruta };
    } catch (error) {
        console.error('[Presupuesto PDF] Error:', error);
        return { success: false, error: error.message || 'No se pudo generar el PDF.' };
    }
});

function construirHtmlFacturaPdf(factura, items) {
    const logoDataUri = obtenerLogoPresupuestoDataUri();
    const bloqueLogo = logoDataUri
        ? `<img src="${logoDataUri}" alt="Los Gallegos" class="logo-empresa">`
        : '';

    const filasItems = Array.isArray(items) && items.length > 0
        ? items.map(it => `
            <tr>
                <td>${escaparHtmlPdf(it.nombre || '-')}</td>
                <td>${escaparHtmlPdf(it.tipoEnvase || '-')}</td>
                <td class="importe">${escaparHtmlPdf(String(it.cantidad || 0))}</td>
                <td class="importe">${formatearMonedaPdf(it.precioUnitario || 0)}</td>
                <td class="importe">${formatearMonedaPdf(it.precioTotal || 0)}</td>
            </tr>
        `).join('')
        : `
            <tr>
                <td>Sin items.</td>
                <td>-</td>
                <td class="importe">0</td>
                <td class="importe">${formatearMonedaPdf(0)}</td>
                <td class="importe">${formatearMonedaPdf(0)}</td>
            </tr>
        `;

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Factura #${escaparHtmlPdf(factura.idFactura)}</title>
            <style>
                @page {
                    size: A4;
                    margin: 18mm;
                }
                * {
                    box-sizing: border-box;
                }
                body {
                    margin: 0;
                    font-family: Arial, Helvetica, sans-serif;
                    color: #000;
                    background: #fff;
                    font-size: 12pt;
                    line-height: 1.4;
                }
                .encabezado {
                    margin-bottom: 18px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #000;
                }
                .encabezado-superior {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 14px;
                }
                .logo-empresa {
                    width: 120px;
                    height: auto;
                    object-fit: contain;
                }
                .empresa {
                    font-size: 20pt;
                    font-weight: 700;
                    margin: 0 0 6px 0;
                }
                .titulo {
                    font-size: 16pt;
                    font-weight: 700;
                    margin: 0;
                }
                .meta {
                    margin: 16px 0 18px 0;
                }
                .meta p {
                    margin: 4px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    border-bottom: 1px solid #000;
                    padding: 10px 8px;
                    vertical-align: top;
                    text-align: left;
                }
                th {
                    font-size: 11pt;
                    font-weight: 700;
                }
                .importe {
                    text-align: right;
                    white-space: nowrap;
                }
                .total {
                    margin-top: 18px;
                    text-align: right;
                    font-size: 14pt;
                    font-weight: 700;
                }
                .obs {
                    margin-top: 12px;
                    padding: 10px 12px;
                    border: 1px solid #000;
                }
            </style>
        </head>
        <body>
            <div class="encabezado">
                <div class="encabezado-superior">
                    <p class="empresa">Los Gallegos Lubricentro</p>
                    ${bloqueLogo}
                </div>
                <p class="titulo">Detalle de Factura #${escaparHtmlPdf(factura.idFactura)}</p>
            </div>
            <div class="meta">
                <p><strong>Fecha:</strong> ${escaparHtmlPdf(formatearFechaCorta(factura.fecha) || '-')}</p>
                <p><strong>Proveedor:</strong> ${escaparHtmlPdf(factura.proveedor || '-')}</p>
                <p><strong>Nro. Comprobante:</strong> ${escaparHtmlPdf(factura.nroComprobante || '-')}</p>
            </div>
            ${factura.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${escaparHtmlPdf(factura.observaciones)}</div>` : ''}
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Envase</th>
                        <th class="importe">Cant.</th>
                        <th class="importe">Precio Unit.</th>
                        <th class="importe">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasItems}
                </tbody>
            </table>
            <div class="total">Total: ${formatearMonedaPdf(factura.importe || 0)}</div>
        </body>
        </html>
    `;
}

async function generarPdfFacturaEnDescargas(idFactura) {
    const factura = await dbGet(`
        SELECT
            f.idFactura,
            f.fecha,
            f.nroComprobante,
            f.importe,
            f.observaciones,
            p.nombreProveedor AS proveedor
        FROM factura f
        LEFT JOIN proveedor p ON p.idProveedor = f.idProveedor
        WHERE f.idFactura = ?
    `, [idFactura]);

    if (!factura) {
        throw new Error('Factura no encontrada.');
    }

    const items = await dbAll(`
        SELECT
            i.idItem,
            i.idProducto,
            pr.nombre,
            pr.tipoEnvase,
            i.cantidad,
            i.precioUnitario,
            i.precioTotal
        FROM itemFactura i
        LEFT JOIN producto pr ON pr.idProducto = i.idProducto
        WHERE i.idFactura = ?
        ORDER BY i.idItem ASC
    `, [idFactura]);

    const descargas = app.getPath('downloads');
    const tempDir = app.getPath('temp');
    const fechaArchivo = String(factura.fecha || '').split(' ')[0] || obtenerFechaLocalISO();
    const nroComp = sanitizarNombreArchivo(factura.nroComprobante || 'sin-comprobante');
    const nombreArchivo = `Factura-Stock-${factura.idFactura}-${nroComp}-${fechaArchivo}.pdf`;
    const rutaDestino = path.join(descargas, nombreArchivo);
    const html = construirHtmlFacturaPdf(factura, items);
    const rutaHtmlTemporal = path.join(tempDir, `factura-${factura.idFactura}-${Date.now()}.html`);

    const pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            sandbox: false
        }
    });

    try {
        await fs.promises.writeFile(rutaHtmlTemporal, html, 'utf8');
        await pdfWindow.loadFile(rutaHtmlTemporal);
        await new Promise(resolve => setTimeout(resolve, 150));
        const pdfBuffer = await pdfWindow.webContents.printToPDF({
            landscape: false,
            printBackground: false,
            pageSize: 'A4',
            margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            },
            preferCSSPageSize: true
        });
        await fs.promises.writeFile(rutaDestino, pdfBuffer);
        return rutaDestino;
    } finally {
        try {
            await fs.promises.unlink(rutaHtmlTemporal);
        } catch (e) {}

        if (!pdfWindow.isDestroyed()) {
            pdfWindow.destroy();
        }
    }
}

ipcMain.handle('download-factura-pdf', async (event, data) => {
    try {
        const idFactura = data && data.idFactura ? parseInt(data.idFactura, 10) : null;
        if (!idFactura) {
            return { success: false, error: 'Factura inválida.' };
        }

        const ruta = await generarPdfFacturaEnDescargas(idFactura);
        return { success: true, path: ruta };
    } catch (error) {
        console.error('[Factura PDF] Error:', error);
        return { success: false, error: error.message || 'No se pudo generar el PDF.' };
    }
});

function construirCuerpoRecordatorio(nombreCliente, fechaUltimoServicio) {
    const nombre = (nombreCliente && nombreCliente.trim()) ? nombreCliente.trim() : 'cliente';
    const fechaFmt = formatearFechaCorta(fechaUltimoServicio);

    return `
        <div style="font-family: Arial, sans-serif; color: #1d1d1d; line-height: 1.45;">
            <h2 style="margin: 0 0 12px;">Los Gallegos Lubricentro</h2>
            <p>Hola <strong>${nombre}</strong>,</p>
            <p>
                Te recordamos que ya pasaron ${MESES_RECORDATORIO} meses desde tu último service
                (${fechaFmt || 'fecha registrada'}).
            </p>
            <p>
                Te recomendamos programar tu próximo cambio de aceite para mantener tu vehículo en óptimas condiciones.
            </p>
            <p>
                Presentando este email en el taller, tenés un <strong>${DESCUENTO_RECORDATORIO} de descuento</strong>.
            </p>
            <p>Te esperamos.</p>
            <p style="margin-top: 16px;">Equipo de Los Gallegos</p>
        </div>
    `;
}

async function procesarRecordatoriosServicios(options = {}) {
    const forzarTodos = Boolean(options.forzarTodos);
    if (!db) return { success: false, error: 'BD no conectada.' };
    if (recordatorioEnProceso) {
        return { success: false, busy: true, error: 'Ya hay un proceso de recordatorios en ejecución.' };
    }
    recordatorioEnProceso = true;

    try {
        await asegurarTablaRecordatoriosEmail();

        const smtp = await obtenerConfigSMTP();
        if (!smtp.host || !smtp.user || !smtp.pass) {
            console.log('[Recordatorios] SMTP incompleto. Se omite envío automático por ahora.');
            return {
                success: false,
                candidatos: 0,
                enviados: 0,
                omitidos: 0,
                error: 'SMTP incompleto. Configure Host/Usuario/Contraseña en Dashboard.'
            };
        }

        const candidatos = forzarTodos
            ? await dbAll(`
                SELECT
                    c.id,
                    c.nombre,
                    c.email,
                    MAX(s.fecha) AS ultimaFechaServicio
                FROM cliente c
                LEFT JOIN servicio s
                  ON s.patente != 'VENTA PARTICULAR'
                 AND (
                        (c.dni IS NOT NULL AND CAST(s.dni_cliente AS TEXT) = CAST(c.dni AS TEXT))
                        OR s.patente IN (SELECT v.patente FROM vehiculo v WHERE v.idCliente = c.id)
                     )
                WHERE c.email IS NOT NULL AND TRIM(c.email) != ''
                GROUP BY c.id, c.nombre, c.email
            `)
            : await dbAll(`
                SELECT
                    c.id,
                    c.nombre,
                    c.email,
                    MAX(s.fecha) AS ultimaFechaServicio
                FROM cliente c
                LEFT JOIN servicio s
                  ON s.patente != 'VENTA PARTICULAR'
                 AND (
                        (c.dni IS NOT NULL AND CAST(s.dni_cliente AS TEXT) = CAST(c.dni AS TEXT))
                        OR s.patente IN (SELECT v.patente FROM vehiculo v WHERE v.idCliente = c.id)
                     )
                WHERE c.email IS NOT NULL AND TRIM(c.email) != ''
                GROUP BY c.id, c.nombre, c.email
                HAVING ultimaFechaServicio IS NOT NULL
                   AND date(ultimaFechaServicio) <= date('now', '-${MESES_RECORDATORIO} months')
            `);

        let enviados = 0;
        let omitidos = 0;
        for (const cli of candidatos) {
            const ultimaFecha = cli.ultimaFechaServicio;
            if (!forzarTodos) {
                const yaEnviado = await dbGet(
                    'SELECT idRecordatorio FROM emailRecordatorioServicio WHERE idCliente = ? AND fechaServicio = ?',
                    [cli.id, ultimaFecha]
                );

                if (yaEnviado) {
                    omitidos++;
                    continue;
                }
            }

            const asunto = 'Recordatorio de service - Los Gallegos';
            const cuerpo = construirCuerpoRecordatorio(cli.nombre, ultimaFecha);

            try {
                await enviarCorreoSMTP({
                    destinatario: cli.email,
                    asunto,
                    cuerpo
                });

                if (!forzarTodos && ultimaFecha) {
                    await dbRun(
                        `INSERT OR IGNORE INTO emailRecordatorioServicio (idCliente, fechaServicio, emailDestino, asunto)
                         VALUES (?, ?, ?, ?)`,
                        [cli.id, ultimaFecha, cli.email, asunto]
                    );
                }
                enviados++;
            } catch (mailErr) {
                console.error(`[Recordatorios] Error enviando a ${cli.email}:`, mailErr.message || mailErr);
            }
        }

        if (candidatos.length > 0 || enviados > 0) {
            console.log(`[Recordatorios] Proceso finalizado. Candidatos: ${candidatos.length}, Enviados: ${enviados}`);
        }
        return {
            success: true,
            candidatos: candidatos.length,
            enviados,
            omitidos,
            modoTesting: forzarTodos
        };
    } catch (err) {
        console.error('[Recordatorios] Error en proceso automático:', err);
        return { success: false, error: err.message || 'Error en proceso de recordatorios.' };
    } finally {
        recordatorioEnProceso = false;
    }
}

function iniciarRecordatoriosServicios() {
    // Primera corrida breve después del arranque para no competir con la apertura de la app.
    setTimeout(() => {
        procesarRecordatoriosServicios();
    }, 45000);

    // Corrida periódica automática.
    setInterval(() => {
        procesarRecordatoriosServicios();
    }, INTERVALO_RECORDATORIO_MS);
}

function crearIndices() {
    console.log('[Optimización] Verificando índices...');
    const indices = [
        'CREATE INDEX IF NOT EXISTS idx_cliente_nombre ON cliente(nombre)',
        'CREATE INDEX IF NOT EXISTS idx_cliente_dni ON cliente(dni)',
        'CREATE INDEX IF NOT EXISTS idx_vehiculo_cliente ON vehiculo(idCliente)',
        'CREATE INDEX IF NOT EXISTS idx_vehiculo_patente ON vehiculo(patente)',
        'CREATE INDEX IF NOT EXISTS idx_servicio_patente ON servicio(patente)',
        'CREATE INDEX IF NOT EXISTS idx_servicio_dni ON servicio(dni_cliente)',
        'CREATE INDEX IF NOT EXISTS idx_servicio_fecha ON servicio(fecha DESC)',
        'CREATE INDEX IF NOT EXISTS idx_producto_nombre ON producto(nombre)',
        'CREATE INDEX IF NOT EXISTS idx_producto_tipo ON producto(tipo)'
    ];
    
    indices.forEach(sql => {
        db.run(sql, (err) => {
            if (err) console.error('Error creando índice:', err);
        });
    });
    console.log('Índices verificados.');
}

function configurarMantenimiento() {
    // 1. Asegurar tabla de configuración
    const sqlConfigTable = `CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`;
    
    db.run(sqlConfigTable, (err) => {
        if (err) {
            console.error("Error creando tabla config:", err);
            return;
        }

        // 2. Verificar último mantenimiento
        db.get("SELECT value FROM config WHERE key = 'ultimo_vacuum'", (err, row) => {
            if (err) return;

            const ahora = Date.now();
            const sieteDias = 7 * 24 * 60 * 60 * 1000;
            const ultimoVacuum = row ? parseInt(row.value) : 0;

            // Si nunca se hizo o pasaron más de 7 días
            if (!row || (ahora - ultimoVacuum > sieteDias)) {
                console.log('[Mantenimiento] Ejecutando VACUUM para liberar espacio...');
                
                db.run('VACUUM', (errVac) => {
                    if (errVac) {
                        console.error("Error en VACUUM:", errVac);
                    } else {
                        console.log('[Mantenimiento] VACUUM completado. Base de datos optimizada.');
                        // Guardar fecha actual
                        db.run("INSERT OR REPLACE INTO config (key, value) VALUES ('ultimo_vacuum', ?)", [ahora]);
                    }
                });
            } else {
                console.log('[Mantenimiento] La base de datos ya estaba optimizada.');
            }
        });
    });
}

app.whenReady().then(async () => {
    await inicializarBD();
    connectDatabase();
    createWindow();
    iniciarSistemaBackup(); // Iniciar el sistema de backup automático
    iniciarRecordatoriosServicios(); // Recordatorios automáticos por email

    // VACUUM diferido: se ejecuta 15 segundos después del inicio,
    // cuando el usuario ya pasó el login.
    setTimeout(() => {
        configurarMantenimiento();
    }, 15000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

function iniciarSistemaBackup() {
    // Revisar cada 60 segundos
    setInterval(() => {
        const ahora = new Date();
        const hora = ahora.getHours();
        const minutos = ahora.getMinutes();


        // Configuración: 18:50
        if (hora === 18 && minutos === 50) {
            ejecutarCopiaSeguridad();
        }
    }, 60000);
}


// SISTEMA DE BACKUP AUTOMÁTICO
// Destino: %APPDATA%/Los Gallegos Backup BD
// Horario: Todos los días a las 18:50

function ejecutarCopiaSeguridad() {
    const rutaOrigen = databasePath;
    const carpetaDestino = path.join(app.getPath('appData'), 'Los Gallegos Backup BD');
    const rutaDestino = path.join(carpetaDestino, 'los_gallegos_bkp.db');

    console.log(`[Backup] Preparando copia a las ${new Date().toLocaleTimeString()}...`);
    console.log(`[Backup] Origen: ${rutaOrigen}`);
    console.log(`[Backup] Destino: ${carpetaDestino}`);

    // Verificar/crear carpeta destino
    if (!fs.existsSync(carpetaDestino)) {
        try {
            fs.mkdirSync(carpetaDestino, { recursive: true });
        } catch (err) {
            console.error('[Backup] Error creando carpeta:', err);
            return;
        }
    }

    // Forzar checkpoint (WAL -> .db) y copiar
    if (db) {
        db.run("PRAGMA wal_checkpoint(TRUNCATE);", (err) => {
            if (err) {
                console.error('[Backup] No se pudo consolidar la BD (Checkpoint):', err.message);
            } else {
                console.log('[Backup] Datos consolidados correctamente en el archivo principal.');
            }
            // Copiar aunque falle el checkpoint
            copiarArchivoFisico(rutaOrigen, rutaDestino);
        });
    } else {
        console.error('[Backup] La base de datos no está conectada. No se puede realizar backup.');
    }
}

// Función auxiliar para el copiado (copia .db + WAL + SHM)
function copiarArchivoFisico(origen, destino) {
    fs.copyFile(origen, destino, (err) => {
        if (err) {
            console.error('[Backup] Error al copiar .db:', err);
            return;
        }
        console.log('[Backup] Archivo .db copiado');

        // Copiar también WAL y SHM si existen (respaldo completo)
        const walOrigen = origen + '-wal';
        const shmOrigen = origen + '-shm';
        const walDestino = destino + '-wal';
        const shmDestino = destino + '-shm';

        if (fs.existsSync(walOrigen)) {
            fs.copyFile(walOrigen, walDestino, (errW) => {
                if (errW) console.error('[Backup] Error copiando -wal:', errW);
                else console.log('[Backup] Archivo -wal copiado');
            });
        }
        if (fs.existsSync(shmOrigen)) {
            fs.copyFile(shmOrigen, shmDestino, (errS) => {
                if (errS) console.error('[Backup] Error copiando -shm:', errS);
                else console.log('[Backup] Archivo -shm copiado');
            });
        }

        console.log('[Backup] Copia de seguridad completa exitosa en:', destino);
    });
}

// MARCA VEHÍCULO (CRUD)
ipcMain.handle('get-marcas-vehiculo', async () => {
    return dbAll("SELECT idMarca, nombre FROM marca_vehiculo ORDER BY nombre ASC");
});

ipcMain.handle('save-marca-vehiculo', async (event, nombre) => {
    if (!nombre || !nombre.trim()) return { success: false, error: 'Nombre requerido.' };
    return dbRun("INSERT OR IGNORE INTO marca_vehiculo (nombre) VALUES (?)", [nombre.trim()])
        .then(r => ({ success: true, id: r.lastID }));
});

// MARCA PRODUCTO / LUBRICANTE (CRUD)
ipcMain.handle('get-marcas-producto', async () => {
    return dbAll("SELECT idMarcaProducto, nombre FROM marca_producto ORDER BY nombre ASC");
});

ipcMain.handle('save-marca-producto', async (event, nombre) => {
    if (!nombre || !nombre.trim()) return { success: false, error: 'Nombre requerido.' };
    return dbRun("INSERT OR IGNORE INTO marca_producto (nombre) VALUES (?)", [nombre.trim()])
        .then(r => ({ success: true, id: r.lastID }));
});

// TIPO DE SERVICIO (CRUD)
ipcMain.handle('get-tipos-servicio', async () => {
    return dbAll("SELECT idTipoServicio, nombre, precioBase FROM tipo_servicio ORDER BY nombre ASC");
});

ipcMain.handle('save-tipo-servicio', async (event, data) => {
    const { id, nombre, precioBase } = data || {};
    if (!nombre || !nombre.trim()) return { success: false, error: 'Nombre requerido.' };
    if (id) {
        await dbRun("UPDATE tipo_servicio SET nombre=?, precioBase=? WHERE idTipoServicio=?", [nombre.trim(), precioBase || 0, id]);
        return { success: true };
    } else {
        const r = await dbRun("INSERT OR IGNORE INTO tipo_servicio (nombre, precioBase) VALUES (?, ?)", [nombre.trim(), precioBase || 0]);
        return { success: true, id: r.lastID };
    }
});

ipcMain.handle('delete-tipo-servicio', async (event, id) => {
    await dbRun("DELETE FROM tipo_servicio WHERE idTipoServicio = ?", [id]);
    return { success: true };
});

// DASHBOARD (Estadísticas y gráficos)
ipcMain.handle('get-dashboard-stats', async () => {
    if (!db) throw new Error('BD no conectada');

    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const fechaHoy = `${yyyy}-${mm}-${dd}`;

    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const fechaAyer = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;

    const serviciosHoy = await dbGet("SELECT COUNT(*) as total FROM servicio WHERE date(fecha) = date(?)", [fechaHoy]);
    const serviciosAyer = await dbGet("SELECT COUNT(*) as total FROM servicio WHERE date(fecha) = date(?)", [fechaAyer]);
    const ingresosHoy = await dbGet("SELECT COALESCE(SUM(precio),0) as total FROM servicio WHERE date(fecha) = date(?)", [fechaHoy]);
    const primerDiaMes = `${yyyy}-${mm}-01`;
    const ingresosMes = await dbGet("SELECT COALESCE(SUM(precio),0) as total FROM servicio WHERE date(fecha) >= date(?)", [primerDiaMes]);
    const totalClientes = await dbGet("SELECT COUNT(*) as total FROM cliente");
    const alertasStock = await dbGet("SELECT COUNT(*) as total FROM producto WHERE cantidad <= COALESCE(stockMinimo, 5000)");

    return {
        serviciosHoy: serviciosHoy ? serviciosHoy.total : 0,
        serviciosAyer: serviciosAyer ? serviciosAyer.total : 0,
        ingresosHoy: ingresosHoy ? ingresosHoy.total : 0,
        ingresosMes: ingresosMes ? ingresosMes.total : 0,
        clientesTotal: totalClientes ? totalClientes.total : 0,
        alertasStock: alertasStock ? alertasStock.total : 0
    };
});

ipcMain.handle('get-dashboard-charts', async () => {
    if (!db) throw new Error('BD no conectada');

    // Distribución de tipos de servicio del mes (gráfico torta)
    const hoy = new Date();
    const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    const tiposServicioMes = await dbAll(`
        SELECT s.descripcion as tipo, COUNT(*) as cantidad
        FROM servicio s
        WHERE date(s.fecha) >= date(?)
          AND s.patente != 'VENTA PARTICULAR'
        GROUP BY s.descripcion
        ORDER BY cantidad DESC
        LIMIT 10
    `, [primerDiaMes]);

    // Servicios por día últimos 30 días (histograma)
    const hace30 = new Date(hoy);
    hace30.setDate(hace30.getDate() - 30);
    const fechaHace30 = `${hace30.getFullYear()}-${String(hace30.getMonth() + 1).padStart(2, '0')}-${String(hace30.getDate()).padStart(2, '0')}`;
    const serviciosPorDia = await dbAll(`
        SELECT date(fecha) as dia, COUNT(*) as cantidad
        FROM servicio
        WHERE date(fecha) >= date(?) AND patente != 'VENTA PARTICULAR'
        GROUP BY date(fecha)
        ORDER BY dia ASC
    `, [fechaHace30]);

    // Top 5 productos más consumidos (salidas)
    const topProductos = await dbAll(`
        SELECT p.nombre, SUM(ABS(cs.cantidad)) as totalUsado
        FROM comprobanteStock cs
        JOIN producto p ON p.idProducto = cs.idProducto
        WHERE cs.tipoMovimiento = 'SALIDA'
        GROUP BY cs.idProducto
        ORDER BY totalUsado DESC
        LIMIT 5
    `);

    return {
        tiposServicioMes,
        serviciosPorDia,
        topProductos
    };
});

// PRESUPUESTOS (CRUD)
ipcMain.handle('get-presupuestos', async (event, options = {}) => {
    if (!db) throw new Error('BD no conectada');
    const pagina = options.pagina || 0;
    const limite = options.limite || 0;
    const estado = options.estado || '';

    let where = [];
    let params = [];
    if (estado) { where.push('p.estado = ?'); params.push(estado); }

    const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const sqlBase = `
        FROM presupuesto p
        LEFT JOIN cliente c ON p.idCliente = c.id
        ${sqlWhere}
    `;

    const sqlData = `
        SELECT p.idPresupuesto, p.idCliente, c.nombre as cliente, c.dni as clienteDni,
               p.patente, p.fecha, p.total, p.estado, p.observaciones,
               (SELECT COUNT(*) FROM presupuestoItem pi WHERE pi.idPresupuesto = p.idPresupuesto) as cantItems
        ${sqlBase}
        ORDER BY p.fecha DESC, p.idPresupuesto DESC
    `;

    if (pagina > 0 && limite > 0) {
        const cnt = await dbGet(`SELECT COUNT(*) as total ${sqlBase}`, params);
        const total = cnt ? cnt.total : 0;
        const offset = (pagina - 1) * limite;
        const rows = await dbAll(sqlData + ' LIMIT ? OFFSET ?', [...params, limite, offset]);
        return { rows, total };
    }
    return await dbAll(sqlData, params);
});

ipcMain.handle('save-presupuesto', async (event, data) => {
    if (!db) throw new Error('BD no conectada');
    const { idCliente, patente, observaciones, items } = data || {};
    if (!idCliente || !Array.isArray(items) || items.length === 0) {
        return { success: false, error: 'Datos incompletos.' };
    }

    try {
        // Verificar que el cliente existe
        const clienteRow = await dbGet('SELECT id FROM cliente WHERE id = ?', [idCliente]);
        if (!clienteRow) return { success: false, error: 'Cliente no encontrado.' };

        await dbRun('BEGIN TRANSACTION');
        const total = items.reduce((acc, it) => acc + (parseFloat(it.precio) || 0), 0);
        const hoy = new Date();
        const fechaStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

        const res = await dbRun(
            "INSERT INTO presupuesto (idCliente, patente, fecha, total, estado, observaciones) VALUES (?,?,?,?,?,?)",
            [idCliente, patente || null, fechaStr, total, 'Pendiente', observaciones || null]
        );
        const idPresupuesto = res.lastID;

        for (const it of items) {
            await dbRun(
                "INSERT INTO presupuestoItem (idPresupuesto, idTipoServicio, precio, descripcion) VALUES (?,?,?,?)",
                [idPresupuesto, it.idTipoServicio || null, parseFloat(it.precio) || 0, it.descripcion || null]
            );
        }

        await dbRun('COMMIT');
        return { success: true, idPresupuesto };
    } catch (err) {
        try { await dbRun('ROLLBACK'); } catch (e) {}
        console.error('[Presupuesto] Error:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('update-presupuesto-estado', async (event, data) => {
    if (!db) throw new Error('BD no conectada');
    const { idPresupuesto, estado } = data || {};
    if (!idPresupuesto || !estado) return { success: false, error: 'Datos incompletos.' };
    await dbRun("UPDATE presupuesto SET estado = ? WHERE idPresupuesto = ?", [estado, idPresupuesto]);
    return { success: true };
});

ipcMain.handle('get-presupuesto-detalle', async (event, idPresupuesto) => {
    if (!db) throw new Error('BD no conectada');
    return dbAll(`
        SELECT pi.idItem, pi.idTipoServicio, ts.nombre as tipoServicioNombre, pi.precio, pi.descripcion
        FROM presupuestoItem pi
        LEFT JOIN tipo_servicio ts ON ts.idTipoServicio = pi.idTipoServicio
        WHERE pi.idPresupuesto = ?
        ORDER BY pi.idItem ASC
    `, [idPresupuesto]);
});

ipcMain.handle('delete-presupuesto', async (event, id) => {
    if (!db) throw new Error('BD no conectada');
    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun("DELETE FROM presupuestoItem WHERE idPresupuesto = ?", [id]);
        await dbRun("DELETE FROM presupuesto WHERE idPresupuesto = ?", [id]);
        await dbRun('COMMIT');
        return { success: true };
    } catch (err) {
        try { await dbRun('ROLLBACK'); } catch (e) {}
        return { success: false, error: err.message };
    }
});

// SISTEMA DE EMAIL (Nodemailer)
ipcMain.handle('get-email-config', async () => {
    if (!db) throw new Error('BD no conectada');
    const host = await dbGet("SELECT value FROM config WHERE key = 'smtp_host'");
    const port = await dbGet("SELECT value FROM config WHERE key = 'smtp_port'");
    const user = await dbGet("SELECT value FROM config WHERE key = 'smtp_user'");
    const pass = await dbGet("SELECT value FROM config WHERE key = 'smtp_pass'");
    return {
        host: host ? host.value : '',
        port: port ? port.value : '587',
        user: user ? user.value : '',
        pass: pass ? pass.value : ''
    };
});

ipcMain.handle('save-email-config', async (event, data) => {
    if (!db) throw new Error('BD no conectada');
    const { host, port, user, pass } = data || {};
    await dbRun("INSERT OR REPLACE INTO config (key, value) VALUES ('smtp_host', ?)", [host || '']);
    await dbRun("INSERT OR REPLACE INTO config (key, value) VALUES ('smtp_port', ?)", [port || '587']);
    await dbRun("INSERT OR REPLACE INTO config (key, value) VALUES ('smtp_user', ?)", [user || '']);
    await dbRun("INSERT OR REPLACE INTO config (key, value) VALUES ('smtp_pass', ?)", [pass || '']);
    return { success: true };
});

ipcMain.handle('send-email', async (event, data) => {
    if (!db) throw new Error('BD no conectada');
    const payload = data || {};
    const destinatario = payload.destinatario || payload.to || '';
    const asunto = payload.asunto || payload.subject || '';
    const cuerpo = payload.cuerpo || payload.html || payload.text || '';
    if (!destinatario || !asunto) return { success: false, error: 'Destinatario y asunto requeridos.' };

    try {
        await enviarCorreoSMTP({ destinatario, asunto, cuerpo });

        return { success: true };
    } catch (err) {
        console.error('[Email] Error:', err);
        return { success: false, error: err.message || 'Error al enviar email.' };
    }
});

ipcMain.handle('run-service-reminders-now', async () => {
    // MODO PRODUCCIÓN (9 meses) - dejar comentado para referencia:
    // return await procesarRecordatoriosServicios();

    // MODO TESTING (activo): enviar a todos los clientes con email.
    return await procesarRecordatoriosServicios({ forzarTodos: true });
});

// VERIFICAR ROL DE USUARIO
ipcMain.handle('get-user-role', async (event, idUsuario) => {
    if (!db) throw new Error('BD no conectada');
    const row = await dbGet("SELECT idRol FROM usuario WHERE idUsuario = ?", [idUsuario]);
    return row ? row.idRol : null;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (db) {
            db.close((err) => {
                if (err) console.error('Error al cerrar la base de datos:', err.message);
                else console.log('Base de datos cerrada.');
                app.quit();
            });
        } else {
            app.quit();
        }
    }
});

// MANEJADORES IPC (FUNCIONES DEL SISTEMA)

// 1. Obtener Clientes (Lista Principal - con paginación server-side)
ipcMain.handle('get-clients', async (event, options = {}) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('La base de datos no está conectada.'));

        const pagina = options.pagina || 0;
        const limite = options.limite || 0;

        const sqlSelect = `
            SELECT
                c.id, c.nombre, c.telefono, c.dni, c.email,
                GROUP_CONCAT(DISTINCT v.patente) as patentes,
                MAX(CASE WHEN s.patente != 'VENTA PARTICULAR' THEN s.fecha ELSE NULL END) as ultimaVisita,
                (SELECT s2.descripcion FROM servicio s2
                 WHERE s2.patente IN (SELECT v2.patente FROM vehiculo v2 WHERE v2.idCliente = c.id)
                   AND s2.patente != 'VENTA PARTICULAR'
                 ORDER BY s2.fecha DESC, s2.idServicio DESC LIMIT 1) as ultimoServicio
            FROM cliente c
            LEFT JOIN vehiculo v ON c.id = v.idCliente
            LEFT JOIN servicio s ON v.patente = s.patente
            GROUP BY c.id, c.nombre, c.telefono, c.dni, c.email
            ORDER BY c.id DESC
        `;

        if (pagina > 0 && limite > 0) {
            db.get("SELECT COUNT(*) as total FROM cliente", [], (err, countRow) => {
                if (err) return reject(err);
                const total = countRow.total;
                const offset = (pagina - 1) * limite;
                const sqlPaginated = `${sqlSelect} LIMIT ? OFFSET ?`;
                db.all(sqlPaginated, [limite, offset], (err2, rows) => {
                    if (err2) reject(err2);
                    else resolve({ rows, total });
                });
            });
        } else {
            db.all(sqlSelect, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }
    });
});

// 2. Obtener Historial de Cliente (con paginación server-side)
ipcMain.handle('get-client-history', async (event, clientId, options = {}) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));
        const pagina = options.pagina || 0;
        const limite = options.limite || 0;

        const sqlFrom = `
            FROM servicio s
            JOIN cliente c ON s.dni_cliente = CAST(c.dni AS INTEGER)
            WHERE c.id = ?
        `;

        if (pagina > 0 && limite > 0) {
            db.get(`SELECT COUNT(*) as total ${sqlFrom}`, [clientId], (err, countRow) => {
                if (err) return reject(err);
                const total = countRow.total;
                const offset = (pagina - 1) * limite;
                const sql = `
                    SELECT c.nombre as dueno, s.patente as vehiculo,
                        s.descripcion as servicio, s.litrosAceite,
                        s.klmAct, s.klmProx, s.precio, s.fecha, s.idServicio,
                        (SELECT GROUP_CONCAT(p.nombre, ', ') FROM servicioProducto sp JOIN producto p ON p.idProducto = sp.idProducto WHERE sp.idServicio = s.idServicio) as productosUsados
                    ${sqlFrom}
                    ORDER BY s.fecha DESC, s.idServicio DESC
                    LIMIT ? OFFSET ?
                `;
                db.all(sql, [clientId, limite, offset], (err2, rows) => {
                    if (err2) reject(err2);
                    else resolve({ rows, total });
                });
            });
        } else {
            const sql = `
                SELECT c.nombre as dueno, s.patente as vehiculo,
                    s.descripcion as servicio, s.litrosAceite,
                    s.klmAct, s.klmProx, s.precio, s.fecha, s.idServicio,
                    (SELECT GROUP_CONCAT(p.nombre, ', ') FROM servicioProducto sp JOIN producto p ON p.idProducto = sp.idProducto WHERE sp.idServicio = s.idServicio) as productosUsados
                ${sqlFrom}
                ORDER BY s.fecha DESC, s.idServicio DESC
            `;
            db.all(sql, [clientId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }
    });
});

// 3. BUSCADOR PREDICTIVO (Servicios y Clientes - con paginación server-side)
ipcMain.handle('search-clients', async (event, query, options = {}) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('BD no conectada'));

        const termino = `%${query}%`;
        const pagina = options.pagina || 0;
        const limite = options.limite || 0;

        // Normaliza la columna nombre quitando tildes para comparación insensible a acentos
        const nombreNorm = `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.nombre,'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u'),'Á','a'),'É','e'),'Í','i'),'Ó','o'),'Ú','u'),'ü','u'),'Ü','u'))`;

        const sqlFrom = `
            FROM cliente c
            LEFT JOIN vehiculo v ON c.id = v.idCliente
            LEFT JOIN servicio s ON v.patente = s.patente
            WHERE ${nombreNorm} LIKE ? OR CAST(c.dni AS TEXT) LIKE ? OR REPLACE(v.patente, ' ', '') LIKE REPLACE(?, ' ', '')
        `;

        if (pagina > 0 && limite > 0) {
            db.get(`SELECT COUNT(DISTINCT c.id) as total ${sqlFrom}`, [termino, termino, termino], (err, countRow) => {
                if (err) return reject(err);
                const total = countRow.total;
                const offset = (pagina - 1) * limite;
                const sql = `
                    SELECT c.id, c.nombre, c.telefono, c.dni, c.email,
                        GROUP_CONCAT(DISTINCT v.patente) as patentes,
                        MAX(s.fecha) as ultimaVisita,
                        (SELECT s2.descripcion FROM servicio s2
                         WHERE s2.patente IN (SELECT v2.patente FROM vehiculo v2 WHERE v2.idCliente = c.id)
                           AND s2.patente != 'VENTA PARTICULAR'
                         ORDER BY s2.fecha DESC, s2.idServicio DESC LIMIT 1) as ultimoServicio
                    ${sqlFrom}
                    GROUP BY c.id
                    ORDER BY c.id DESC
                    LIMIT ? OFFSET ?
                `;
                db.all(sql, [termino, termino, termino, limite, offset], (err2, rows) => {
                    if (err2) reject(err2);
                    else resolve({ rows, total });
                });
            });
        } else {
            const sql = `
                SELECT c.id, c.nombre, c.telefono, c.dni, c.email,
                    GROUP_CONCAT(DISTINCT v.patente) as patentes,
                    MAX(s.fecha) as ultimaVisita,
                    (SELECT s2.descripcion FROM servicio s2
                     WHERE s2.patente IN (SELECT v2.patente FROM vehiculo v2 WHERE v2.idCliente = c.id)
                       AND s2.patente != 'VENTA PARTICULAR'
                     ORDER BY s2.fecha DESC, s2.idServicio DESC LIMIT 1) as ultimoServicio
                ${sqlFrom}
                GROUP BY c.id
                ORDER BY c.id DESC
            `;
            db.all(sql, [termino, termino, termino], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }
    });
});

// 3B. BUSCADOR DE VEHÍCULOS (Para Módulo Servicios - SIN AGRUPAR)
ipcMain.handle('search-vehicles', async (event, query) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('BD no conectada'));

        const termino = `%${query}%`;

        const sql = `
            SELECT
                c.id,
                c.nombre,
                c.dni,
                v.patente,
                v.marca,
                v.modelo,
                v.año,
                us.klmProx
            FROM
                cliente c
            LEFT JOIN
                vehiculo v ON c.id = v.idCliente
            LEFT JOIN (
                SELECT patente, klmProx,
                    ROW_NUMBER() OVER (PARTITION BY patente ORDER BY fecha DESC, idServicio DESC) as rn
                FROM servicio
                WHERE klmProx IS NOT NULL
                  AND TRIM(CAST(klmProx AS TEXT)) != ''
                  AND (descripcion IS NULL OR LOWER(descripcion) NOT LIKE 'venta particular%')
            ) us ON us.patente = v.patente AND us.rn = 1
            WHERE 
                c.nombre LIKE ? OR 
                CAST(c.dni AS TEXT) LIKE ? OR 
                REPLACE(v.patente, ' ', '') LIKE REPLACE(?, ' ', '')
            ORDER BY c.nombre ASC, v.patente ASC
        `;

        db.all(sql, [termino, termino, termino], (err, rows) => {
            if (err) {
                console.error('Error búsqueda vehículos:', err);
                reject(err);
            } else {
                resolve(rows); 
            }
        });
    });
});

// 4. ELIMINAR Cliente (Cascada Manual)
ipcMain.handle('delete-client', async (event, idCliente) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));

        // Cascada completa: servicioProducto → servicio → vehiculo → cliente
        db.run('BEGIN TRANSACTION', (errBegin) => {
            if (errBegin) return reject(errBegin);

            // 0. Borrar servicioProducto vinculados por patente
            db.run(`DELETE FROM servicioProducto WHERE idServicio IN (SELECT idServicio FROM servicio WHERE patente IN (SELECT patente FROM vehiculo WHERE idCliente = ?))`, [idCliente], (err0) => {
                if (err0) { db.run('ROLLBACK'); return reject(err0); }

            // 0b. Borrar servicioProducto vinculados por DNI
            db.run(`DELETE FROM servicioProducto WHERE idServicio IN (SELECT idServicio FROM servicio WHERE dni_cliente = (SELECT CAST(dni AS INTEGER) FROM cliente WHERE id = ?))`, [idCliente], (err0b) => {
                if (err0b) { db.run('ROLLBACK'); return reject(err0b); }

            // A. Borrar Servicios por patente (vínculo vehículo)
            db.run(`DELETE FROM servicio WHERE patente IN (SELECT patente FROM vehiculo WHERE idCliente = ?)`, [idCliente], (errA) => {
                if (errA) { db.run('ROLLBACK'); return reject(errA); }

            // A2. Borrar Servicios por DNI (cubre servicios huérfanos sin vehículo vinculado)
            db.run(`DELETE FROM servicio WHERE dni_cliente = (SELECT CAST(dni AS INTEGER) FROM cliente WHERE id = ?)`, [idCliente], (errA2) => {
                if (errA2) { db.run('ROLLBACK'); return reject(errA2); }

                // A3. Borrar ítems de presupuestos del cliente
                db.run(`DELETE FROM presupuestoItem WHERE idPresupuesto IN (SELECT idPresupuesto FROM presupuesto WHERE idCliente = ?)`, [idCliente], (errA3) => {
                    if (errA3) { db.run('ROLLBACK'); return reject(errA3); }

                // A4. Borrar presupuestos del cliente
                db.run(`DELETE FROM presupuesto WHERE idCliente = ?`, [idCliente], (errA4) => {
                    if (errA4) { db.run('ROLLBACK'); return reject(errA4); }

            // B. Borrar Vehículos
            db.run(`DELETE FROM vehiculo WHERE idCliente = ?`, [idCliente], (errB) => {
                if (errB) { db.run('ROLLBACK'); return reject(errB); }

                // C. Borrar Cliente
                db.run(`DELETE FROM cliente WHERE id = ?`, [idCliente], function(errC) {
                    if (errC) { db.run('ROLLBACK'); return reject(errC); }

                    db.run('COMMIT', (errCommit) => {
                        if (errCommit) { db.run('ROLLBACK'); return reject(errCommit); }
                        console.log(`Cliente ID ${idCliente} eliminado (cascada completa).`);
                        resolve({ success: true });
                    });
                });
            });
            }); // cierre A4
            }); // cierre A3
            }); // cierre A2
            }); // cierre A
            }); // cierre 0b
            }); // cierre 0
        });
    });
});

// 5. Utilidad: Forzar Foco (Fix para Modales)
ipcMain.handle('force-focus', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});

// 6. GUARDAR / EDITAR Cliente
ipcMain.handle('save-client', async (event, data) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));

        const { id, nombre, apellido, telefono, dni, vehiculos, email } = data;
        const vehiculosLista = Array.isArray(vehiculos) ? vehiculos : [];

        const patenteInvalida = vehiculosLista.find(v => {
            const patente = (v && v.patente ? v.patente.toString() : '').trim().toUpperCase().replace(/\s+/g, '');
            return !(/[A-Z]/.test(patente) && /\d/.test(patente));
        });

        if (patenteInvalida) {
            return resolve({ success: false, error: 'La patente debe contener letras y números.' });
        }
        
        // Construir nombre completo: si ambos existen, combinarlos; si no, usar lo que haya
        let nombreCompleto = null;
        if (nombre || apellido) {
            if (apellido && nombre) {
                nombreCompleto = `${apellido}, ${nombre}`;
            } else if (apellido) {
                nombreCompleto = apellido;
            } else if (nombre) {
                nombreCompleto = nombre;
            }
        }
        
        // Convertir strings vacíos a null (para permitir NULL en BD)
        const nombreFinal = nombreCompleto && nombreCompleto.trim() ? nombreCompleto.trim() : null;
        const dniFinal = dni && dni.trim() ? dni.trim() : null;
        const telefonoFinal = telefono && telefono.trim() ? telefono.trim() : null;
        const emailFinal = email && email.trim() ? email.trim() : null;

    db.serialize(() => {
            db.run('BEGIN TRANSACTION', (errBegin) => {
                if (errBegin) {
                    return reject(errBegin);
                }

                // A. UPDATE (Si tiene ID)
                if (id) {
                    // Primero obtener el DNI viejo para cascadear el cambio a servicios
                    db.get(`SELECT dni FROM cliente WHERE id = ?`, [id], (errGet, rowViejo) => {
                        if (errGet) {
                            return db.run('ROLLBACK', () => reject(errGet));
                        }
                        const dniViejo = rowViejo ? rowViejo.dni : null;

                        const sqlUpdate = `UPDATE cliente SET nombre = ?, dni = ?, telefono = ?, email = ? WHERE id = ?`;
                        db.run(sqlUpdate, [nombreFinal, dniFinal, telefonoFinal, emailFinal, id], (errUpd) => {
                            if (errUpd) {
                                return db.run('ROLLBACK', () => reject(errUpd));
                            }

                            // Si el DNI cambió, actualizar todos los servicios vinculados
                            const cascadeDNI = (callback) => {
                                if (dniViejo && dniFinal && String(dniViejo) !== String(dniFinal)) {
                                    db.run(
                                        `UPDATE servicio SET dni_cliente = CAST(? AS INTEGER) WHERE dni_cliente = CAST(? AS INTEGER)`,
                                        [dniFinal, dniViejo],
                                        (errCascade) => {
                                            if (errCascade) console.error('Error cascadeando DNI a servicios:', errCascade);
                                            else console.log(`DNI actualizado en servicios: ${dniViejo} -> ${dniFinal}`);
                                            callback();
                                        }
                                    );
                                } else {
                                    callback();
                                }
                            };

                            cascadeDNI(() => {
                                // Borrar y re-insertar vehículos
                                db.run(`DELETE FROM vehiculo WHERE idCliente = ?`, [id], (errDel) => {
                                    if (errDel) {
                                        return db.run('ROLLBACK', () => reject(errDel));
                                    }
                                    insertarVehiculos(id, vehiculosLista, resolve, reject);
                                });
                            });
                        });
                    });

                } else {
                    // B. INSERT (Nuevo)
                    const sqlInsert = `INSERT INTO cliente (nombre, dni, telefono, email) VALUES (?, ?, ?, ?)`;
                    db.run(sqlInsert, [nombreFinal, dniFinal, telefonoFinal, emailFinal], function(errIns) {
                        if (errIns) {
                            return db.run('ROLLBACK', () => reject(errIns));
                        }
                        const newId = this.lastID;
                        insertarVehiculos(newId, vehiculosLista, resolve, reject);
                    });
                }
            });
        });
    });
});

// Auxiliar para insertar vehículos (con manejo de errores real)
function insertarVehiculos(idCliente, vehiculos, resolve, reject) {
    const lista = Array.isArray(vehiculos) ? vehiculos : [];

    // Si no hay vehículos, igual cerrar la transacción
    if (lista.length === 0) {
        return db.run('COMMIT', (errCommit) => {
            if (errCommit) return db.run('ROLLBACK', () => reject(errCommit));
            resolve({ success: true });
        });
    }

    const sqlVehiculo = `INSERT INTO vehiculo (patente, marca, modelo, año, idCliente) VALUES (?, ?, ?, ?, ?)`;

    const insertarSiguiente = (i) => {
        if (i >= lista.length) {
            return db.run('COMMIT', (errCommit) => {
                if (errCommit) return db.run('ROLLBACK', () => reject(errCommit));
                resolve({ success: true });
            });
        }

        const v = lista[i] || {};
        db.run(sqlVehiculo, [v.patente, v.marca, v.modelo, v.anio, idCliente], (err) => {
            if (err) {
                console.error('Error al guardar vehículo:', err.message);
                return db.run('ROLLBACK', () => reject(err));
            }
            insertarSiguiente(i + 1);
        });
    };

    insertarSiguiente(0);
}

// 7. Obtener Vehículos de un Cliente (Para Edición)
ipcMain.handle('get-client-vehicles', async (event, idCliente) => {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Base de datos no conectada.'));
        const sql = `SELECT marca, modelo, patente, año FROM vehiculo WHERE idCliente = ?`;
        db.all(sql, [idCliente], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

// MÓDULO SERVICIOS (Guardar servicios y registrar SALIDAS auditables)

// 8. Guardar Servicio (y registrar trazabilidad en stockOperativo + comprobanteStock)
ipcMain.handle('save-service', async (event, data) => {
    if (!db) throw new Error('Base de datos no conectada.');

    const { patente, dniCliente, descripcion, fecha, precio, litrosAceite, klmAct, klmProx, insumos, idUsuario, idPresupuestoOrigen } = data || {};

    if (!idUsuario) {
        return { success: false, error: 'Usuario no autenticado.' };
    }

    // Asegurar tabla servicio (incluye litrosAceite)
    const sqlCreateTable = `
        CREATE TABLE IF NOT EXISTS servicio (
            idServicio INTEGER PRIMARY KEY AUTOINCREMENT,
            patente TEXT,
            klmAct INTEGER,
            descripcion TEXT,
            klmProx INTEGER,
            fecha DATE,
            precio REAL,
            litrosAceite TEXT,
            dni_cliente INTEGER
        )`;

    try {
        await dbRun(sqlCreateTable);
        await dbRun('BEGIN TRANSACTION');

        const precioRedondeado = Math.round((Number(precio) || 0) / 100) * 100;
        const fechaMovimiento = fecha || obtenerFechaLocalISO();

        // 1) Insertar el servicio
        const resSvc = await dbRun(
            `INSERT INTO servicio (patente, klmAct, descripcion, klmProx, fecha, precio, litrosAceite, dni_cliente) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [patente, klmAct || null, descripcion, klmProx || null, fecha, precioRedondeado, litrosAceite || null, dniCliente]
        );

        const servicioId = resSvc.lastID;

        const listaInsumos = Array.isArray(insumos) ? insumos : [];
        if (listaInsumos.length === 0) {
            if (idPresupuestoOrigen) {
                await dbRun('DELETE FROM presupuestoItem WHERE idPresupuesto = ?', [idPresupuestoOrigen]);
                await dbRun('DELETE FROM presupuesto WHERE idPresupuesto = ?', [idPresupuestoOrigen]);
            }
            await dbRun('COMMIT');
            return { success: true, servicioId };
        }

        // 2) Verificar stock para todos los insumos antes de tocar nada
        for (const ins of listaInsumos) {
            const row = await dbGet('SELECT mililitros, cantidad, nombre, tipo FROM producto WHERE idProducto = ?', [ins.idProducto]);
            if (!row) throw new Error(`Producto no encontrado (ID ${ins.idProducto}).`);

            const esFiltroIns = (row.tipo || '').toLowerCase().includes('filtro');
            const uso = Math.round(parseFloat(ins.mililitros) || 0);
            if (uso <= 0) throw new Error('Cantidad de insumo inválida.');

            const stockDisponible = esFiltroIns ? (row.cantidad || 0) : (row.mililitros || 0);
            if (uso > stockDisponible) {
                await dbRun('ROLLBACK');
                return { success: false, stockExcedido: true, producto: row.nombre };
            }
        }

        // 3) Descontar stock + registrar auditoría por cada insumo
        for (const ins of listaInsumos) {
            const row = await dbGet('SELECT mililitros, cantidad, tipo FROM producto WHERE idProducto = ?', [ins.idProducto]);

            const esFiltroIns = (row.tipo || '').toLowerCase().includes('filtro');
            const uso = Math.round(parseFloat(ins.mililitros) || 0);
            let antes, despues;

            if (esFiltroIns) {
                antes = row ? (row.cantidad || 0) : 0;
                despues = antes - uso;
                await dbRun('UPDATE producto SET cantidad = ? WHERE idProducto = ?', [despues, ins.idProducto]);
            } else {
                antes = row ? (row.mililitros || 0) : 0;
                despues = antes - uso;
                // Fuente de verdad: mililitros (Integer)
                await dbRun('UPDATE producto SET mililitros = ? WHERE idProducto = ?', [despues, ins.idProducto]);
            }

            // Guardar insumo usado en el servicio (en ml)
            await dbRun(
                'INSERT INTO servicioProducto (idServicio, idProducto, cantidad) VALUES (?, ?, ?)',
                [servicioId, ins.idProducto, uso]
            );

            // Movimiento operativo + comprobante auditable
            const detalle = JSON.stringify({
                origen: 'SERVICIO',
                idServicio: servicioId,
                patente,
                descripcion
            });

            const mov = await dbRun(
                'INSERT INTO stockOperativo (tipoOperacion, cantidad, motivo, idProducto, idUsuario, detalle) VALUES (?,?,?,?,?,?)',
                ['SALIDA', -uso, 'SERVICIO', ins.idProducto, idUsuario, detalle]
            );

            await dbRun(
                `INSERT INTO comprobanteStock
                 (fecha, tipoMovimiento, proceso, cantidad, datoAnterior, datoActual, idProducto, idUsuario, idMovimiento, idServicio)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [fechaMovimiento, 'SALIDA', 'SERVICIO', -uso, antes, despues, ins.idProducto, idUsuario, mov.lastID, servicioId]
            );
        }

        if (idPresupuestoOrigen) {
            await dbRun('DELETE FROM presupuestoItem WHERE idPresupuesto = ?', [idPresupuestoOrigen]);
            await dbRun('DELETE FROM presupuesto WHERE idPresupuesto = ?', [idPresupuestoOrigen]);
        }

        await dbRun('COMMIT');
        return { success: true, servicioId };

    } catch (err) {
        try { await dbRun('ROLLBACK'); } catch (e) {}
        console.error('[Servicio] Error:', err);
        return { success: false, error: err.message || 'Error al registrar servicio.' };
    }
});


// 9. Registrar Venta Particular (SALIDA de stock SIN vehículo - auditable)
ipcMain.handle('save-venta-particular', async (event, data) => {
    if (!db) throw new Error('Base de datos no conectada.');

    const { items, detalle, fecha, idUsuario, precioTotal, patente, dniCliente } = data || {};

    if (!idUsuario) return { success: false, error: 'Usuario no autenticado.' };
    if (!items || !items.length) return { success: false, error: 'No hay productos seleccionados.' };
    if (!patente || !dniCliente) return { success: false, error: 'Seleccione un cliente/vehículo válido.' };

    try {
        await dbRun('BEGIN TRANSACTION');
        const precioTotalRedondeado = Math.round((Number(precioTotal) || 0) / 100) * 100;
        const fechaMovimiento = fecha || obtenerFechaLocalISO();

        // Validar stock para todos los productos antes de procesar
        let litrosTotales = 0;
        for (const item of items) {
            const idProd = parseInt(item.idProducto, 10);
            const cantidadNum = parseFloat(item.cantidad);

            if (!idProd || !cantidadNum || Number.isNaN(cantidadNum) || cantidadNum <= 0) {
                await dbRun('ROLLBACK');
                return { success: false, error: 'Datos de producto incompletos.' };
            }

            const prod = await dbGet('SELECT nombre, mililitros, cantidad, tipo FROM producto WHERE idProducto = ?', [idProd]);
            if (!prod) {
                await dbRun('ROLLBACK');
                return { success: false, error: `Producto no encontrado.` };
            }

            const esFiltro = item.esFiltro || (prod.tipo || '').toLowerCase().includes('filtro');
            if (esFiltro) {
                const uso = Math.round(cantidadNum);
                if (uso > (prod.cantidad || 0)) {
                    await dbRun('ROLLBACK');
                    return { success: false, stockExcedido: true, producto: prod.nombre };
                }
            } else {
                const uso = Math.round(cantidadNum * 1000);
                if (uso > (prod.mililitros || 0)) {
                    await dbRun('ROLLBACK');
                    return { success: false, stockExcedido: true, producto: prod.nombre };
                }
                litrosTotales += cantidadNum;
            }
        }

        // Insertar servicio especial
        const descripcion = (detalle && detalle.toString().trim()) ? `Venta Particular - ${detalle.toString().trim()}` : 'Venta Particular';

        const resSvc = await dbRun(
            `INSERT INTO servicio (patente, klmAct, descripcion, klmProx, fecha, precio, litrosAceite, dni_cliente) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [patente, null, descripcion, null, fecha || null, precioTotalRedondeado, litrosTotales || null, dniCliente]
        );
        const servicioId = resSvc.lastID;

        // Procesar cada producto
        for (const item of items) {
            const idProd = parseInt(item.idProducto, 10);
            const cantidadNum = parseFloat(item.cantidad);

            const prod = await dbGet('SELECT nombre, mililitros, cantidad, tipo FROM producto WHERE idProducto = ?', [idProd]);
            const esFiltro = item.esFiltro || (prod.tipo || '').toLowerCase().includes('filtro');

            let antes, despues, uso;
            if (esFiltro) {
                uso = Math.round(cantidadNum);
                antes = prod.cantidad || 0;
                despues = antes - uso;
            } else {
                uso = Math.round(cantidadNum * 1000);
                antes = prod.mililitros || 0;
                despues = antes - uso;
            }

            await dbRun(
                'INSERT INTO servicioProducto (idServicio, idProducto, cantidad) VALUES (?, ?, ?)',
                [servicioId, idProd, uso]
            );

            if (esFiltro) {
                await dbRun('UPDATE producto SET cantidad = ? WHERE idProducto = ?', [despues, idProd]);
            } else {
                await dbRun('UPDATE producto SET mililitros = ? WHERE idProducto = ?', [despues, idProd]);
            }

            const detalleJson = JSON.stringify({
                origen: 'VENTA PARTICULAR',
                idServicio: servicioId,
                idProducto: idProd,
                cantidad: cantidadNum,
                esFiltro: esFiltro,
                detalle: (detalle || '').toString().trim()
            });

            const mov = await dbRun(
                'INSERT INTO stockOperativo (tipoOperacion, cantidad, motivo, idProducto, idUsuario, detalle) VALUES (?,?,?,?,?,?)',
                ['SALIDA', -uso, 'VENTA PARTICULAR', idProd, idUsuario, detalleJson]
            );

            await dbRun(
                `INSERT INTO comprobanteStock
                 (fecha, tipoMovimiento, proceso, cantidad, datoAnterior, datoActual, idProducto, idUsuario, idMovimiento, idServicio)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [fechaMovimiento, 'SALIDA', 'VENTA PARTICULAR', -uso, antes, despues, idProd, idUsuario, mov.lastID, servicioId]
            );
        }

        await dbRun('COMMIT');
        return { success: true, servicioId };

    } catch (err) {
        try { await dbRun('ROLLBACK'); } catch (e) {}
        console.error('[Venta Particular] Error:', err);
        return { success: false, error: err.message || 'Error al registrar venta.' };
    }
});


