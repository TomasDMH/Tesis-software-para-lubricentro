# Documentación del Sistema Los Gallegos

**Última actualización:** Marzo 2026  
**Estado:** En desarrollo activo  
**Organización:** Lubricentro / Taller Mecánico "Los Gallegos"  
**Idioma:** Español (Argentina)  
**Tipo de proyecto:** Trabajo Final de Tesis

---

## Índice

1. [Descripción General](#1-descripción-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Dependencias](#4-dependencias)
5. [Configuración y Arranque](#5-configuración-y-arranque)
6. [Base de Datos](#6-base-de-datos)
7. [Autenticación y Seguridad](#7-autenticación-y-seguridad)
8. [Roles y Permisos](#8-roles-y-permisos)
9. [API Backend — Canales IPC](#9-api-backend--canales-ipc)
10. [API Expuesta al Frontend (puente.js)](#10-api-expuesta-al-frontend-puentejs)
11. [Frontend — Módulos](#11-frontend--módulos)
12. [Vistas HTML y Navegación](#12-vistas-html-y-navegación)
13. [Reglas de Negocio Críticas](#13-reglas-de-negocio-críticas)
14. [Observaciones y Pendientes](#14-observaciones-y-pendientes)

---

## 1. Descripción General

**Los Gallegos** es una aplicación de escritorio para la gestión integral de un Lubricentro/Taller, construida con Electron.js. Permite gestionar:

- **Clientes y Vehículos**: Alta, baja, modificación y búsqueda predictiva.
- **Servicios**: Carga de servicios con descuento automático de stock, buscador por nombre/DNI/patente.
- **Presupuestos**: Creación, aprobación/rechazo, detalle de ítems por tipo de servicio.
- **Stock (Insumos/Lubricantes)**: ABM de productos, compras por factura, ajustes auditables, historial completo de movimientos.
- **Dashboard**: KPIs en tiempo real, gráficos con Chart.js, configuración de email SMTP.
- **Usuarios**: ABM con roles (Admin, Empleado, Presidente, Encargado).

---

## 2. Stack Tecnológico

| Capa | Tecnología | Detalle |
|------|-----------|---------|
| **Runtime** | Node.js | v14 o superior |
| **Framework** | Electron.js | Aplicación de escritorio multiplataforma |
| **Base de Datos** | SQLite3 | `sqlite3` verbose, modo WAL, base local |
| **Frontend** | HTML5 + CSS3 + JS Vanilla | Manipulación directa del DOM |
| **Hashing** | `bcryptjs` | Contraseñas de usuarios |
| **Gráficos** | Chart.js 4.x | Dashboard (pie, bar charts) |
| **Email** | Nodemailer | Envío de recordatorios vía SMTP |
| **Comunicación** | IPC (ipcMain/ipcRenderer) | Con `contextIsolation: true` vía `puente.js` |

**Prohibiciones estrictas:** Frameworks frontend (React, Vue, Angular, jQuery, Bootstrap), `alert()`/`confirm()` nativos, ORMs.

---

## 3. Estructura del Proyecto

```
/tesis (version5.5)
├── AGENTS.md                        # Contexto técnico para IA
├── DOCUMENTACION.md                 # Este archivo
├── package.json                     # Dependencias y scripts npm
├── principal.js                     # Backend (Electron Main Process) — ~2300 líneas
├── puente.js                        # API Bridge (ContextBridge) — 40 métodos
├── generar-instalador.bat           # Script para generar instalador Windows
│
├── bd/                              # Base de datos SQLite
│   └── losgallegos.db               # Base principal (se sube sanitizada)
│
├── scripts/
│   ├── clear-smtp-config.js         # Limpia credenciales SMTP en config
│   ├── sanitize-public-db.js        # Anonimiza PII y normaliza usuarios
│   └── install-git-hooks.js         # Configura core.hooksPath=.githooks
│
├── .githooks/
│   ├── pre-commit                   # Ejecuta sanitización y agrega la BD
│   └── pre-push                     # Revalida sanitización antes de push
│
├── css/
│   └── estilos.css                  # Hoja de estilos única global
│
├── moduloDashboard/
│   ├── dashboard.html               # Pantalla principal post-login
│   └── dashboard.js                 # KPIs, gráficos Chart.js, config email (283 líneas)
│
├── moduloLogin/
│   ├── login/
│   │   ├── login.html               # Formulario de inicio de sesión
│   │   └── login.js                 # Lógica de login con "Recordarme" (110 líneas)
│   └── abmUsuarios/
│       ├── abmUsuarios.html         # ABM de usuarios del sistema
│       └── abmUsuarios.js           # CRUD usuarios, asignación de roles (337 líneas)
│
├── moduloServicios/
│   ├── clientes/
│   │   ├── index.html               # Gestión de Clientes y Vehículos
│   │   └── clientes.js              # ABM clientes + vehículos dinámicos + historial (674 líneas)
│   ├── servicios/
│   │   ├── servicios.html           # Carga de Servicios
│   │   └── servicios.js             # Buscador predictivo, selección insumos, venta particular (1107 líneas)
│   └── presupuestos/
│       ├── presupuestos.html        # Gestión de Presupuestos
│       └── presupuestos.js          # CRUD presupuestos, tipos de servicio (951 líneas)
│
├── moduloStock/
│   ├── stock.html                   # Stock con 4 tabs internas
│   └── stock.js                     # ABM productos, facturas, ajustes, auditoría (1987 líneas)
│
└── recursos/                        # Imágenes, logos e íconos
```

---

## 4. Dependencias

### Producción

| Paquete | Versión | Uso |
|---------|---------|-----|
| `sqlite3` | ^5.0.2 | Driver SQLite3 (verbose) |
| `bcryptjs` | ^3.0.3 | Hash de contraseñas |
| `chart.js` | ^4.5.1 | Gráficos en Dashboard |
| `nodemailer` | ^8.0.1 | Envío de emails SMTP |

### Desarrollo

| Paquete | Versión | Uso |
|---------|---------|-----|
| `electron` | ^38.3.0 | Framework de escritorio |
| `electron-builder` | ^25.1.8 | Generación de instalador |
| `nodemon` | ^3.1.10 | Reinicio automático en desarrollo |

---

## 5. Configuración y Arranque

### Comandos

```bash
npm install         # Instalar dependencias
npm run dev         # Modo desarrollo (nodemon + hot reload)
npm start           # Modo producción (electron .)
npm run build       # Generar instalador Windows (.exe)
npm run sanitize:smtp       # Limpia SMTP en bd/losgallegos.db
npm run sanitize:public-db  # Anonimiza datos en bd/losgallegos.db
npm run sanitize:prepush    # Ejecuta ambas sanitizaciones
```

### Flujo de Arranque

1. **Producción** (`app.isPackaged === true`): Carga `login.html` → tras login exitoso → redirige según rol.
2. **Desarrollo** (bypass login activo): Carga `dashboard.html` directamente.
3. El bypass se controla con la variable de entorno `BYPASS_LOGIN` (vacío, `1` o `true` = bypass activo).

### Redirección post-login según rol

| Rol | Destino |
|-----|---------|
| Admin (1) / Presidente (3) | `dashboard.html` |
| Empleado (2) / Encargado (4) | `clientes/index.html` |

### Inicialización de Base de Datos

- **Desarrollo:** Usa `bd/losgallegos.db` directamente del proyecto.
- **Producción:** Copia a `%APPDATA%/Los Gallegos Lubricentro/bd/losgallegos.db` desde `process.resourcesPath` en el primer arranque.

---

## 6. Base de Datos

### Configuración de Conexión

- **Modo WAL:** `PRAGMA journal_mode = WAL;` (siempre activo)
- **Foreign Keys:** `PRAGMA foreign_keys = ON;`
- **Busy Timeout:** 10.000ms
- **Backup automático:** Diario a las 18:50 en `%APPDATA%/Los Gallegos Backup BD/`
- **VACUUM:** Semanal, diferido 15s tras arranque

### Tablas (18 tablas)

#### Usuarios y Autenticación

| Tabla | Columnas Clave | Propósito |
|-------|----------------|-----------|
| `usuario` | idUsuario, nombreUsuario, contrasena, idRol | Usuarios del sistema |
| `config` | key (PK), value | Configuración general (SMTP, migraciones, último VACUUM) |

#### Clientes y Vehículos

| Tabla | Columnas Clave | Propósito |
|-------|----------------|-----------|
| `cliente` | id, nombre, dni, telefono, email | Clientes del taller |
| `vehiculo` | patente, marca, modelo, año, idCliente (FK) | Vehículos vinculados a clientes |

#### Servicios y Presupuestos

| Tabla | Columnas Clave | Propósito |
|-------|----------------|-----------|
| `servicio` | idServicio, patente, klmAct, descripcion, klmProx, fecha, precio, litrosAceite, dni_cliente | Servicios realizados |
| `servicioProducto` | idServicio (FK), idProducto (FK), cantidad | Insumos usados por servicio |
| `servicioDetallado` | idServicioDetalle, idServicio (FK), idTipoServicio (FK), descripcionExtra | Detalle expandido |
| `tipo_servicio` | idTipoServicio, nombre (UNIQUE), precioBase | Catálogo de tipos de servicio |
| `presupuesto` | idPresupuesto, idCliente (FK), patente, fecha, total, estado, observaciones | Presupuestos |
| `presupuestoItem` | idItem, idPresupuesto (FK), idTipoServicio (FK), precio, descripcion | Líneas de presupuesto |

#### Stock y Proveedores

| Tabla | Columnas Clave | Propósito |
|-------|----------------|-----------|
| `producto` | idProducto, nombre, tipo, marca, cantidad, mililitros, unidadMedida, precio, proveedor, factura, tipoEnvase, stockMinimo | Inventario de insumos |
| `proveedor` | idProveedor, nombreProveedor, razonSocial, cuit, direccion, telefono | Proveedores |
| `factura` | idFactura, idProveedor (FK), nroComprobante, fecha, importe, observaciones | Facturas de compra |
| `itemFactura` | idItem, idFactura (FK), idProducto (FK), cantidad, precioUnitario, precioTotal | Líneas de factura |
| `stockOperativo` | tipoOperacion, cantidad, motivo, idProducto, idUsuario, detalle | Movimientos operativos |
| `comprobanteStock` | idComprobante, fecha, tipoMovimiento, proceso, cantidad, datoAnterior, datoActual, idProducto, idUsuario, idMovimiento, idFactura, idServicio | Auditoría de movimientos |

#### Catálogos

| Tabla | Columnas Clave | Propósito |
|-------|----------------|-----------|
| `marca_vehiculo` | idMarca, nombre (UNIQUE) | Marcas de vehículos |
| `marca_producto` | idMarcaProducto, nombre (UNIQUE) | Marcas de lubricantes/insumos |

### Sanitización previa a subir

- `npm run sanitize:smtp` limpia claves SMTP en la tabla `config`.
- `npm run sanitize:public-db` anonimiza clientes/vehículos/servicios y normaliza credenciales de usuarios.
- Hooks Git (`.githooks/pre-commit` y `.githooks/pre-push`) ejecutan esta sanitización automáticamente.
- Si un hook modifica `bd/losgallegos.db`, se debe commitear ese cambio antes del push.

### Migraciones Automáticas

Se ejecutan en secuencia al conectar:
1. `asegurarMigracionesAuditoria()` — Columnas de auditoría
2. `asegurarMigracionesV30()` — Tablas y columnas v3.0
3. `migrarProductosV51()` — Renombrar + agregar productos v5.1
4. `migrarPasswordsPlanas()` — Hashear contraseñas en texto plano → bcrypt

---

## 7. Autenticación y Seguridad

### Flujo de Login

1. Usuario ingresa **usuario** + **contraseña** en `login.html`.
2. `ipcMain.handle('login-user')` valida credenciales con `bcryptjs`.
3. Verifica credenciales y devuelve `{ success, user }`.
4. Frontend guarda `idUsuario`, `nombreUsuario`, `idRol` en `localStorage`.
5. Redirige a `dashboard.html`.

### Seguridad

- **Context Isolation:** `contextIsolation: true` en Electron.
- **ContextBridge:** `puente.js` expone únicamente los métodos necesarios via `window.electronAPI`.
- **SQL Injection:** Todas las queries usan placeholders (`?`).
- **Contraseñas:** Hash con `bcryptjs` (salt rounds: 10). Migración automática de texto plano.
- **Rutas:** Siempre `path.join(__dirname, ...)` para compatibilidad multiplataforma.

### Usuario Admin por Defecto

Si la tabla `usuario` está vacía al arrancar, se crea automáticamente:
- **Usuario:** `admin`
- **Contraseña:** `admin` (hasheada con bcrypt)
- **Rol:** 1 (Admin)

---

## 8. Roles y Permisos

| idRol | Nombre | Alcance |
|-------|--------|---------|
| 1 | **Admin** | Acceso total. Puede hacer ajustes de stock, ABM usuarios, Dashboard, etc. |
| 2 | **Empleado** | Operaciones básicas. No ve ABM Usuarios ni Dashboard. |
| 3 | **Presidente** | Acceso de visualización privilegiado. Ve Dashboard pero no ABM. |
| 4 | **Encargado** | Acceso intermedio con permisos operativos. No ve ABM ni Dashboard. |

**Restricciones visuales (pre-render):**
- El tab **"ABM"** (Usuarios) se oculta automáticamente si `idRol !== 1`.
- El tab **"Dashboard"** se oculta automáticamente si `idRol !== 1` y `idRol !== 3`.
- El Dashboard redirige a Clientes si un usuario no autorizado intenta acceder directamente.
- Cada página HTML incluye un `<script>` pre-render que inyecta CSS para ocultar los tabs según el rol almacenado en `localStorage`.

---

## 9. API Backend — Canales IPC

### Login / Usuarios (5 canales)

| Canal | Propósito |
|-------|-----------|
| `login-user` | Autentica usuario con bcrypt |
| `get-users` | Lista todos los usuarios para el ABM |
| `save-user` | Crea o edita usuario (hashea contraseña) |
| `delete-user` | Elimina usuario por ID |
| `get-user-role` | Devuelve el idRol de un usuario |

### Clientes (7 canales)

| Canal | Propósito |
|-------|-----------|
| `get-clients` | Lista clientes con paginación server-side, patentes e historial |
| `save-client` | Crea o edita cliente + vehículos en transacción |
| `search-clients` | Buscador predictivo por nombre, DNI o patente |
| `search-vehicles` | Buscador de vehículos para módulo Servicios |
| `delete-client` | Eliminación en cascada (servicioProducto → servicio → vehículo → cliente) |
| `get-client-history` | Historial de servicios de un cliente con paginación |
| `get-client-vehicles` | Devuelve los vehículos de un cliente para edición |

### Servicios (2 canales)

| Canal | Propósito |
|-------|-----------|
| `save-service` | Guarda servicio + descuenta stock con auditoría completa |
| `save-venta-particular` | Registra venta sin vehículo (patente = "VENTA PARTICULAR") |

### Stock / Productos (5 canales)

| Canal | Propósito |
|-------|-----------|
| `get-products` | Lista productos con búsqueda y paginación |
| `get-stock-alerts` | Productos con stock para alertas |
| `get-product-by-id` | Obtiene producto por ID |
| `save-product` | Crea o edita producto (stock no se modifica desde ABM) |
| `delete-product` | Elimina producto con validación de referencias |

### Stock — Compras / Ajustes / Auditoría (5 canales)

| Canal | Propósito |
|-------|-----------|
| `save-factura-compra` | Registra compra por factura (ENTRADA de stock) |
| `save-ajuste-stock` | Ajuste manual (solo Admin), con auditoría |
| `get-facturas` | Lista facturas con paginación y filtros |
| `get-factura-detalle` | Detalle de ítems de una factura |
| `get-movimientos-stock` | Movimientos unificados con filtros y paginación |

### Proveedores (3 canales)

| Canal | Propósito |
|-------|-----------|
| `get-proveedores` | Lista proveedores |
| `save-proveedor` | Crea o edita proveedor |
| `delete-proveedor` | Elimina proveedor por ID |

### Catálogos (6 canales)

| Canal | Propósito |
|-------|-----------|
| `get-marcas-vehiculo` | Lista marcas de vehículos |
| `save-marca-vehiculo` | Agrega marca de vehículo |
| `get-marcas-producto` | Lista marcas de producto |
| `save-marca-producto` | Agrega marca de producto |
| `get-tipos-servicio` | Lista tipos de servicio con precioBase |
| `save-tipo-servicio` / `delete-tipo-servicio` | CRUD de tipos de servicio |

### Dashboard (2 canales)

| Canal | Propósito |
|-------|-----------|
| `get-dashboard-stats` | KPIs: servicios hoy/ayer, ingresos hoy/mes, clientes total, alertas stock |
| `get-dashboard-charts` | Datos para gráficos: tipos servicio, servicios/día, top 5 productos |

### Presupuestos (5 canales)

| Canal | Propósito |
|-------|-----------|
| `get-presupuestos` | Lista presupuestos con paginación y filtro por estado |
| `save-presupuesto` | Crea presupuesto con ítems en transacción |
| `update-presupuesto-estado` | Cambia estado (Pendiente/Aprobado/Rechazado) |
| `get-presupuesto-detalle` | Detalle de ítems de un presupuesto |
| `delete-presupuesto` | Elimina presupuesto + ítems en transacción |

### Email (3 canales)

| Canal | Propósito |
|-------|-----------|
| `get-email-config` | Lee configuración SMTP desde tabla `config` |
| `save-email-config` | Guarda configuración SMTP |
| `send-email` | Envía email vía SMTP configurado |

**Total: 40 canales IPC** con mapeo 1:1 a los métodos de `window.electronAPI`.

---

## 10. API Expuesta al Frontend (puente.js)

Todos los métodos se exponen vía `contextBridge.exposeInMainWorld('electronAPI', { ... })`:

```
// Clientes
getClients(options), saveClient(data), getClientHistory(id, options),
searchClients(query, options), searchVehicles(query), deleteClient(id),
forceWindowFocus(), getClientVehicles(id)

// Login / Usuarios
login(credenciales), getUsers(), saveUser(data), deleteUser(id), getUserRole(id)

// Stock
getProducts(options), getStockAlerts(), getProductById(id),
saveProduct(data), deleteProduct(id)

// Stock Auditable
saveFacturaCompra(data), saveAjusteStock(data), getFacturas(options),
getFacturaDetalle(idFactura), getMovimientosStock(options)

// Proveedores
getProveedores(), saveProveedor(data), deleteProveedor(id)

// Catálogos
getMarcasVehiculo(), saveMarcaVehiculo(nombre)
getMarcasProducto(), saveMarcaProducto(nombre)
getTiposServicio(), saveTipoServicio(data), deleteTipoServicio(id)

// Servicios
saveService(data), saveVentaParticular(data)

// Dashboard
getDashboardStats(), getDashboardCharts()

// Presupuestos
getPresupuestos(options), savePresupuesto(data),
updatePresupuestoEstado(idPresupuesto, estado),
getPresupuestoDetalle(id), deletePresupuesto(id)

// Email
getEmailConfig(), saveEmailConfig(data), sendEmail(data)
```

---

## 11. Frontend — Módulos

| Módulo | Archivo JS | Líneas | Descripción |
|--------|-----------|--------|-------------|
| **Login** | `moduloLogin/login/login.js` | 110 | Formulario login, "Recordarme", toggle visibilidad contraseña |
| **ABM Usuarios** | `moduloLogin/abmUsuarios/abmUsuarios.js` | 337 | CRUD de usuarios, asignación de roles |
| **Dashboard** | `moduloDashboard/dashboard.js` | 283 | KPIs, gráficos Chart.js (pie + bar), top 5 productos, config email SMTP |
| **Clientes** | `moduloServicios/clientes/clientes.js` | 674 | ABM clientes + tabla dinámica de vehículos + historial paginado |
| **Servicios** | `moduloServicios/servicios/servicios.js` | 1107 | Carga de servicios, buscador predictivo, selección de insumos, venta particular |
| **Presupuestos** | `moduloServicios/presupuestos/presupuestos.js` | 951 | CRUD presupuestos, ABM tipos de servicio, cálculo litros/unidades |
| **Stock** | `moduloStock/stock.js` | 1987 | ABM productos, factura de compra, ajustes auditables, auditoría de movimientos (4 tabs internas) |

### Convenciones de todos los módulos:
- Usan `mostrarModal()` (basada en Promesas) en lugar de `alert()`/`confirm()`.
- Manipulación directa del DOM (`document.getElementById`, `createElement`).
- Comunicación con backend exclusivamente vía `window.electronAPI`.

---

## 12. Vistas HTML y Navegación

### Barra de navegación global

Presente en todas las páginas post-login como `<nav class="pestanas-navegacion">`:

| Tab | Archivo HTML | Descripción |
|-----|-------------|-------------|
| Dashboard | `moduloDashboard/dashboard.html` | KPIs, gráficos, configuración email |
| Gestión de Clientes | `moduloServicios/clientes/index.html` | ABM clientes y vehículos, historial |
| Servicios | `moduloServicios/servicios/servicios.html` | Carga de servicios y ventas particulares |
| Stock | `moduloStock/stock.html` | Productos, compras, ajustes, auditoría |
| Presupuestos | `moduloServicios/presupuestos/presupuestos.html` | Gestión de presupuestos |
| ABM | `moduloLogin/abmUsuarios/abmUsuarios.html` | Gestión de usuarios (solo Admin) |

### Flujo de navegación

```
Login (login.html)
  ├─► [Admin / Presidente] Dashboard (dashboard.html)
  │       ├─► Gestión de Clientes (index.html)
  │       ├─► Servicios (servicios.html)
  │       ├─► Stock (stock.html)
  │       ├─► Presupuestos (presupuestos.html)
  │       └─► ABM Usuarios (abmUsuarios.html)  [solo idRol === 1]
  │
  └─► [Empleado / Encargado] Gestión de Clientes (index.html)
          ├─► Servicios (servicios.html)
          ├─► Stock (stock.html)
          └─► Presupuestos (presupuestos.html)
```

**7 páginas HTML** en total, interconectadas por la barra de tabs (tabs visibles según rol).

---

## 13. Reglas de Negocio Críticas

### Clientes y Vehículos

- **Formulario Híbrido:** El panel izquierdo sirve tanto para Alta como para Edición.
- Al hacer clic en una tarjeta de cliente, se cargan sus datos y vehículos en el formulario.
- **Eliminación en cascada:** Cliente → `servicioProducto` → `servicio` → `vehiculo` → `cliente`.
- **Formato de nombre:** "Apellido, Nombre" (se procesa automáticamente).

### Servicios y Stock

- **Buscador Predictivo:** Busca por Nombre, DNI o Patente.
- **Unidades de medida:**
  - En BD: Se guarda en **Mililitros** (Integer).
  - En visualización: Se muestra en **Litros** (`cantidad / 1000`).
- **Alerta visual:** Si stock < `stockMinimo`, texto en ROJO (`#e20613`).
- Los filtros (ej: filtros de aceite) se manejan por unidades, no mililitros.

### Stock Auditable

- Toda operación de stock genera registros en `stockOperativo` y `comprobanteStock`.
- **Compra por factura** (ENTRADA): calcula mililitros según `tipoEnvase`.
- **Ajuste manual** (solo Admin): requiere motivo, genera auditoría completa.
- **Eliminación de producto:** Rechazada si tiene referencias en `itemFactura`, `servicioProducto`, `comprobanteStock` o `stockOperativo`.

### Presupuestos

- Estados: Pendiente → Aprobado / Rechazado.
- Vinculados a cliente por `idCliente` (FK a tabla `cliente`).
- Cada ítem referencia un `tipo_servicio` con `precioBase`.

### Gestión de Base de Datos (Trabajo en Equipo)

- Se usa una única base `bd/losgallegos.db` para desarrollo y build.
- Antes de subir, correr sanitización (`npm run sanitize:prepush`) o dejar que actúen los hooks.
- No subir archivos auxiliares de SQLite (`*.sqbpro`, `*.db-wal`, `*.db-shm`).

---

## 14. Observaciones y Pendientes

### Estado actual de módulos

| Módulo | Estado |
|--------|--------|
| ✅ Dashboard (KPIs, gráficos, email) | Funcional |
| ✅ Clientes y Vehículos | Funcional |
| ✅ Servicios (carga + venta particular) | Funcional |
| ✅ Stock (ABM, compras, ajustes, auditoría) | Funcional |
| ✅ Presupuestos | Funcional |
| ✅ Login / Usuarios / Roles | Funcional |
| ✅ Email (Nodemailer) | Funcional |

### Observaciones técnicas

1. **`principal.js`** contiene toda la lógica backend (~2300 líneas): IPC handlers, conexión DB, migraciones, y lógica de negocio. No hay separación en controllers/services.

2. **Backup automático** diario a las 18:50 (copia `.db` + `.wal` + `.shm`).

3. **VACUUM semanal** controlado por la tabla `config` (clave: `ultimo_vacuum`).

4. **Migraciones** son idempotentes y se ejecutan en cada arranque sin riesgo.

5. **CSS único global** (`estilos.css`) — Paleta: dorado (`#fab062`), verde petróleo (`#01242c`), rojo (`#e20613`), inputs crema (`#fffbe6`).

8. **`.btn-mini`** definido globalmente en `estilos.css` con variantes `.peligro` (rojo) y `.secundario` (fondo oscuro con borde dorado). Hover invierte colores.

9. **Proveedores UX:** La lista de proveedores en el modal de edición muestra datos adicionales (razón social, CUIT, dirección, teléfono) debajo de cada nombre. Al agregar un proveedor nuevo, se abre automáticamente el modal de edición con ese proveedor seleccionado para completar sus datos.

6. **Chart.js** se carga desde `node_modules` directamente en `dashboard.html`.

7. **Instalador Windows** configurable via `electron-builder` con NSIS (ver `package.json` → sección `build`).

### Paleta de colores estricta

| Elemento | Color |
|----------|-------|
| Bordes y textos destacados | Dorado `#fab062`, `#f8cc3d` |
| Fondos principales | Verde Petróleo `#01242c` |
| Acentos y alertas | Rojo `#a60530`, `#e20613` |
| Inputs | Fondo `#fff` / `#fffbe6`, texto `#000` / `#3a3a3a`, borde dorado |

---

**Autores:** Espinosa, Lautaro Valentín — Graffi, Mario Martín — Muñoz, Tomás Daniel  
**Documento:** DOCUMENTACION.md (Documentación Técnica del Sistema Los Gallegos)
