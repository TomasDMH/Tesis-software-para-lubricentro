# Tesis – Sistema de Gestión para Lubricentro "Los Gallegos" 🚗

Aplicación de escritorio orientada a la administración integral de clientes, vehículos, servicios, presupuestos y control de stock con trazabilidad auditable. Este proyecto corresponde al **Trabajo Final de Tesis** y fue desarrollado con **Electron.js**.

---

## Guía de inicio rápido

### Requisitos previos
* **Node.js** (se recomienda v14 o superior)
* **Git** instalado para gestionar versiones

### Instalación
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/tingraffi/tesis-gestion-lubricentro.git
   ```

2. Instalar las dependencias del proyecto:
   ```bash
   npm install
   ```

### Ejecución
* Modo desarrollo (con recarga automática):
  ```bash
  npm run dev
  ```

* Modo producción:
  ```bash
  npm start
  ```

---

## Stack tecnológico
* **Entorno de ejecución:** Node.js
* **Framework principal:** Electron.js
* **Base de datos:** SQLite3 (con modo WAL habilitado)
* **Frontend:** HTML5, CSS3 y JavaScript Vanilla (sin frameworks externos)
* **Seguridad:** Hasheo de contraseñas con `bcryptjs`
* **Complementos:** Chart.js (gráficos) y Nodemailer (envío de correos SMTP)

---

## Funcionalidades principales
* **Gestión de clientes y vehículos:** ABM completo con búsqueda predictiva por DNI o patente.
* **Módulo de servicios:** Registro de servicios con descuento automático de stock y soporte para ventas particulares.
* **Control de stock auditable:** Administración de insumos por mililitros/unidades, facturas de compra y auditoría de movimientos.
* **Presupuestos:** Generación y seguimiento de estados (Pendiente, Aprobado, Rechazado).
* **Dashboard:** Visualización de KPIs en tiempo real y gráficos estadísticos.
* **Roles de usuario:** Manejo de permisos diferenciados (Admin, Empleado, Presidente, Encargado).

---

## Protocolo de seguridad y base de datos

El proyecto incorpora un sistema de sanitización automática para resguardar información sensible antes de subir cambios a GitHub:

1. **Limpieza SMTP:** elimina credenciales de correo almacenadas en la base de datos.
2. **Anonimización:** procesa la base de datos `bd/losgallegos.db` para anonimizar PII (Información de Identificación Personal).
3. **Hooks de Git:** el proyecto incluye scripts en `.githooks/` que ejecutan estas acciones automáticamente antes de cada `commit` y `push`.

Comando manual de sanitización:
```bash
npm run sanitize:prepush
```

---

## Estructura del proyecto
```plaintext
├── bd/                  # Base de datos SQLite principal
├── moduloDashboard/     # KPIs y configuración de email
├── moduloLogin/         # Autenticación y ABM de usuarios
├── moduloServicios/     # Gestión de clientes, servicios y presupuestos
├── moduloStock/         # Inventario, compras y auditoría
├── recursos/            # Assets visuales y logotipos
├── principal.js         # Punto de entrada (Main Process)
└── puente.js            # API Bridge (ContextBridge)
```

---

## Autores
* Espinosa, Lautaro Valentín
* Graffi, Mario Martín
* Muñoz, Tomás Daniel

Este proyecto se encuentra regido por las pautas técnicas detalladas en `DOCUMENTACION.md` y por las guías para IA incluidas en `AGENTS.md`.
