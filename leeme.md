# Tesis – Sistema de Gestión **Los Gallegos**

Aplicación de escritorio desarrollada con **Electron** para la gestión de **clientes, servicios y stock**.
Este proyecto forma parte del **trabajo final de tesis**.

---

## Guía de Inicio Rápido (Para el Equipo)

Sigue estos pasos la primera vez que descargues el proyecto en tu computadora.

---

## Requisitos previos

* Tener **Node.js** instalado
* Tener **Git** instalado

---

## Instalación de dependencias

Abrí una terminal en la carpeta del proyecto y ejecutá:

```bash
npm install
```

---

## Base de Datos (¡Importante!)

El proyecto maneja un único archivo de base de datos dentro de la carpeta `bd/`:

* **losgallegos.db** - Base de datos principal del sistema.

Todo el trabajo y las pruebas se realizan directamente sobre `losgallegos.db`.

---

## ▶ Ejecución de la aplicación

Para trabajar, utilizá siempre el modo desarrollo, que permite:

* Ver cambios en tiempo real
* Reiniciar automáticamente la ventana al modificar archivos del backend (`principal.js`)

```bash
npm run dev
```

**Nota sobre el Login:** Actualmente, el inicio de sesión (`login.html`) puede estar desactivado por defecto en `principal.js` para cargar directamente la pantalla de Clientes y agilizar el desarrollo. Si necesitas activar el login, descomenta la línea correspondiente en la función `createWindow()`.

---

## Protocolo para subir cambios a GitHub

Antes de hacer un commit o subir cambios, respetar las siguientes reglas:

### Limpieza

* Verificar que el código funcione correctamente
* No dejar errores en la consola

### Node Modules

* No subir la carpeta `node_modules` (ya está ignorada)

### Versionado

Si estás trabajando en una versión específica, indicarlo claramente en el commit:

```
versionX.X – Descripción de lo realizado
```

---

No subir nunca archivos locales de SQLite Browser (`*.sqbpro`).

---

## Trabajo con Inteligencia Artificial (AGENTS.md)

El proyecto incluye un archivo especial llamado `AGENTS.md` en la raíz. Este archivo contiene el contexto técnico, reglas de negocio y guías de estilo del proyecto.

* **Uso:** Si vas a pedir ayuda a una IA (ChatGPT, Claude, etc.), adjunta o copia el contenido de `AGENTS.md` en tu prompt.
* **Beneficio:** La IA entenderá al instante cómo funciona la base de datos, los estilos visuales y la estructura del código sin que tengas que explicarlo de cero.

---

## Estructura del Proyecto

(Respetar la organización al crear nuevos archivos)

```
/tesis
├── AGENTS.md                # Contexto y reglas para IA
├── bd/                      # Base de datos SQLite
├── css/                     # Estilos globales
├── moduloLogin/             # Gestión de acceso y usuarios
│   ├── login/
│   │   ├── login.html
│   │   └── login.js
│   └── abmUsuarios/
│       ├── abmUsuarios.html
│       └── abmUsuarios.js
├── moduloServicios/
│   ├── clientes/            # Gestión de clientes
│   │   ├── index.html
│   │   └── clientes.js
│   └── servicios/           # Gestión de servicios
│       ├── servicios.html
│       └── servicios.js
├── moduloStock/
│   ├── stock.html
│   └── stock.js
├── recursos/                # Imágenes, logos e íconos
├── principal.js             # Backend principal (Electron) - Entry Point
├── puente.js                # ContextBridge (Front ↔ Back)
└── package.json             # Dependencias y scripts
```

---

## Tecnologías utilizadas

* **Electron** – Framework de escritorio
* **SQLite3** – Base de datos local
* **HTML5 / CSS3 / JavaScript** – Frontend (Vanilla)
* **Node.js** – Backend
* **Nodemon** – Reinicio automático en desarrollo

---

## Nota Final

Este proyecto está pensado para trabajo colaborativo. Respetar esta guía evita conflictos entre versiones y pérdida de datos.