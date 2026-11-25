# 🚗 Control y Monitoreo IoT · Wish Ride (Frontend Web v2.0)

> **Frontend Web Oficial (Versión 2)** para el control remoto interactivo, monitoreo en tiempo real, gestión de compradores y administración integral de la flota de vehículos IoT (físicos con ESP8266 y simuladores virtuales).

[![Versión](https://img.shields.io/badge/Versi%C3%B3n-2.0.0%20(Branch%20v2)-brightgreen)](https://github.com/RingdLugo/control_iot_fronted/tree/version-2-de-fronted)
[![API Backend](https://img.shields.io/badge/API-FastAPI%20%7C%20HTTPS-blue)](https://iotalis.duckdns.org/docs)
[![Protocolo RealTime](https://img.shields.io/badge/RealTime-WebSocket%20(WSS)-blueviolet)](https://iotalis.duckdns.org)
[![Base de Datos](https://img.shields.io/badge/Database-Amazon%20RDS%20(MySQL)-orange)](https://aws.amazon.com/rds/)
[![Auth](https://img.shields.io/badge/Auth-JWT%20%7C%20Google%20OAuth-red)](https://developers.google.com/identity)
[![Arquitectura](https://img.shields.io/badge/Frontend-Vanilla%20ES6%20Modules%20%7C%20POO-purple)](#-arquitectura-del-software-poo-y-m%C3%B3dulos-es)
[![Autora](https://img.shields.io/badge/Autora-Ingrid%20Alison%20Porras%20Lugo-pink)](#-cr%C3%A9ditos-y-autor%C3%ADa)

---

## 📌 Enlaces del Proyecto

| Servicio | Entorno | Enlace |
|---|---|---|
| **Frontend en Producción (IIS)** | Web | [https://controlwish.duckdns.org/](https://controlwish.duckdns.org/) |
| **Repositorio GitHub** | Código fuente | [https://github.com/RingdLugo/control_iot_fronted](https://github.com/RingdLugo/control_iot_fronted) |
| **Rama Activa (v2)** | Rama de desarrollo | `version-2-de-fronted` |
| **Despliegue GitHub Pages** | Web estática | [https://ringdlugo.github.io/control_iot_fronted/](https://ringdlugo.github.io/control_iot_fronted/) |
| **Swagger UI / Documentación API** | Backend FastAPI | [https://iotalis.duckdns.org/docs](https://iotalis.duckdns.org/docs) |
| **API Base HTTPS** | Servidor Cloud | `https://iotalis.duckdns.org` |
| **Canal WebSocket Privado (Cuenta)** | Tiempo real | `wss://iotalis.duckdns.org/ws/cuenta/vehiculo/{id}` |
| **Canal WebSocket Público (Invitado)** | Tiempo real | `wss://iotalis.duckdns.org/ws/public/vehiculo/{id}` |

---

## 🚀 Novedades de la Versión 2.0

La **Versión 2** transforma el frontend de una consola de práctica básica a una plataforma completa de gestión y operación IoT con soporte comercial y multirrol:

### 1. 🔑 Autenticación Multirrol y Google Identity (OAuth 2.0)
- **Inicio de sesión tradicional:** Acceso con credenciales (correo y contraseña) mediante JWT emitido por la API (`/auth/token`).
- **Inicio de sesión con Google (Google Identity Services):** Integración con Google OAuth 2.0 (`/auth/google`). Detección automática del Client ID publicado (`/auth/google/config`), renderizado del botón oficial de Google en los paneles de Usuario y Administrador, y validación criptográfica de tokens en backend.
- **Persistencia de sesión aislada:** Tokens guardados de forma segura en `sessionStorage` (sin cookies de rastreo y con ciclo de vida por pestaña).
- **Restauración reactiva:** Manejo con control de concurrencia (`authRevision`) para evitar condiciones de carrera al recargar la página.

### 2. ⏱️ Modo Invitado Renovado: Reserva de Unidades de Exhibición
- **Catálogo de exhibición público:** Consulta dinámica de modelos con unidades disponibles para demostración (`GET /guest/catalogo`).
- **Reserva temporal limitada:** Solicitud de sesión temporal (ej. 10 minutos) con la API (`POST /guest/sesiones`).
- **Token de invitado (`X-Guest-Token`):** Autorización exclusiva para la unidad reservada y sus comandos permitidos.
- **Temporizador en vivo:** Indicador flotante en la barra superior con cuenta regresiva en minutos y segundos (`Salir de prueba · mm:ss`).
- **Finalización voluntaria o automática:** Cierre de sesión y liberación inmediata de la unidad al terminar el tiempo (`DELETE /guest/sesiones/actual`).

### 3. ⚙️ Panel de Administración y Dashboard de Negocio (AWS RDS)
- **Dashboard de Métricas en Vivo:** Consulta en tiempo real de métricas verificadas desde Amazon RDS (`GET /admin/dashboard`):
  - Modelos comerciales activos.
  - Inventario total de unidades y unidades asignadas a compradores.
  - Unidades disponibles para pruebas públicas.
  - Clientes registrados activos y DEMOs en el sistema.
  - Sesiones WebSocket activas del navegador y conexiones reportadas del dispositivo físico ESP8266.
- **Gestión Integral de Recursos (CRUD Dinámico con Paginación y Filtros):**
  - **Modelos:** Alta, baja lógica y edición de marca, código, nombre, microcontrolador y estado.
  - **Unidades:** Alta de vehículos físicos y simulados, asignación a modelos y activación como unidad de exhibición pública (`disponible_demo`).
  - **Clientes / Compradores:** Registro integral que crea la cuenta de usuario, asigna el modelo y aprovisiona automáticamente su carrito virtual.
  - **Usuarios:** Consulta de usuarios, conmutación de estado (`ACTIVO` / `BLOQUEADO`) y **cambio dinámico de roles** (`USUARIO`, `ADMINISTRADOR`) con invalidación inmediata de sesiones previas.
  - **Asignaciones:** Vinculación de vehículos a usuarios y cierre formal de asignaciones.
  - **DEMOs y Pasos:** Creación y mantenimiento de rutinas globales y edición de pasos individuales (`/admin/demos/{id}/pasos`).
  - **Sesiones de Invitado:** Monitorización de sesiones temporales, visualización de tokens generados, activación manual y revocación.
  - **Auditoría:** Trazabilidad completa de operaciones y eventos en la base de datos.

### 4. 🧪 Carritos Simulados (Virtuales) y DEMO Studio para Compradores
- **Detección inteligente de hardware:** Reconoce si la unidad asignada es un microcontrolador físico (`ESP8266`) o un vehículo `SIMULADO`.
- **Configurador de Movimientos Virtuales:** Permite al usuario crear comandos personalizados con nombre, ángulo de giro (grados) y duración en milisegundos.
- **Asignación personalizada de Joysticks:** Mapeo de direcciones personalizadas para el joystick de avance y el joystick de pala.
- **Diseñador y Editor de DEMOs privadas:**
  - Creación de secuencias propias para el vehículo simulado.
  - Editor interactivo de pasos con límites controlados (hasta 20 pasos y máximo 60 segundos de duración total).
  - Cálculo automático de duración acumulada y pausas entre movimientos.

### 5. 🕹️ Mando con Doble Joystick y Control Concurrente Seguro
- **Doble Joystick Analógico:** Joystick de Avance y Giro + Joystick de Pala y Acciones. Soporta eventos táctiles en pantallas móviles/tabletas, ratón y teclas del teclado (`WASD` y `Flechas`).
- **Parada Prioritaria (DETENER):** Botón central de emergencia que cancela inmediatamente cualquier petición en vuelo mediante `AbortController` y envía el comando de detención sin demoras.
- **Interruptores de Estado de Luz y Sonido:** Envío del parámetro `estado_salida: true/false` para alternar actuadores de forma independiente en el hardware.

### 6. 📊 Monitoreo y Telemetría en Tiempo Real
- **Tarjeta de Último Estado:** Reporte inmediato del comando actual, código y marca temporal.
- **Historial de Movimientos Persistidos:** Tabla con los últimos 10 movimientos individuales registrados en Amazon RDS.
- **Sincronizador Automático (`MonitorSynchronizer`):** Reconciliación en segundo plano; ante un evento WebSocket, la tabla se resincroniza vía REST filtrando por `id_historial` para evitar duplicidades.
- **Tira de Diagnóstico Tripartito:**
  1. Conexión WebSocket (WSS) cliente-servidor.
  2. Estado de salud de la API REST (`/health`).
  3. Diagnóstico de persistencia en Amazon RDS.

---

## 👥 Matriz de Roles y Niveles de Acceso

| Rol / Perfil | Método de Acceso | Vistas Permitidas | Capacidades |
|---|---|---|---|
| **Invitado (Exhibición)** | Sin registro · Reserva de modelo (`X-Guest-Token`) | Control | Control temporal limitado (10 min) de la unidad de exhibición reservada. Sin acceso a historiales ni administración. |
| **Usuario (Comprador)** | Correo + Contraseña o Google OAuth | Control, Monitoreo, DEMO Studio, Mis Vehículos | Selección de sus unidades autorizadas, telemetría en vivo, configuración de carritos simulados y editor de DEMOs privadas. |
| **Administrador** | Correo + Contraseña o Google OAuth (Rol `ADMINISTRADOR`) | Administración, Control, Monitoreo, DEMO Studio | Acceso a métricas de negocio en RDS, CRUD completo sobre las 9 áreas del sistema y control global de la flota. |

---

## 🏗️ Arquitectura del Sistema

```mermaid
flowchart LR
    subgraph Cliente["Frontend Web (Navegador)"]
        UI["Control IoT v2\n(Vanilla JS · POO · CSS3)"]
        GSI["Google Identity\nServices"]
    end

    subgraph Backend["Cloud Backend (FastAPI)"]
        AUTH["Servicio de Autenticación\n(JWT / Google OAuth)"]
        API["REST API\n(HTTPS :443)"]
        WS["WebSocket Broker\n(WSS :443)"]
    end

    subgraph Persistencia["Infraestructura AWS"]
        RDS[("Amazon RDS\nMySQL 8.0")]
    end

    subgraph Hardware["Unidades IoT"]
        ESP["ESP8266 NodeMCU\n(Hardware Físico)"]
        SIM["Carrito Simulado\n(Unidad Virtual)"]
    end

    UI <--> GSI
    UI -- "HTTPS (Fetch / JSON)" --> API
    UI -- "Tokens / Login" --> AUTH
    UI <--> "WSS (Eventos tiempo real)" <--> WS
    API <--> RDS
    AUTH <--> RDS
    WS <--> "WiFi" <--> ESP
    WS -. "Eventos simulados" .-> SIM
```

> [!IMPORTANT]
> **Seguridad y Aislamiento:** El navegador web **nunca** realiza conexiones directas a Amazon RDS. Todas las transacciones, validaciones de permisos y consultas se canalizan a través de los procedimientos almacenados y endpoints seguros de la API FastAPI.

---

## 📂 Arquitectura del Software (POO y Módulos ES)

El proyecto utiliza JavaScript modular nativo (ES6 Modules) organizado bajo el paradigma de **Programación Orientada a Objetos**, sin dependencias de frameworks pesados:

```text
control-iot/
├── .nojekyll                            # Compatibilidad con GitHub Pages
├── index.html                           # Estructura semántica, vistas y paneles de acceso
├── README.md                            # Documentación integral de la versión 2
├── API_CONTRACT.md                      # Especificación técnica de contratos de API
└── assets/
    ├── css/
    │   ├── styles.css                   # Estilos del mando, joysticks, vistas y tema visual
    │   └── admin.css                    # Estilos del panel de administración, tablas, filtros y modales
    ├── icons/
    │   └── favicon.svg                  # Isotipo oficial en SVG
    ├── images/
    │   ├── favicon.svg
    │   └── logo.svg                     # Logotipo de Wish Ride
    └── js/
        ├── main.js                      # Punto de entrada y arranque de la aplicación
        ├── config.js                    # Configuración global, URLs base y timeouts
        ├── admin/
        │   ├── AdminApi.js              # Cliente API para autenticación, Google, invitados y CRUD admin
        │   ├── AdministrationController.js # Lógica de negocio, temporizador de invitados y eventos admin
        │   └── AdministrationView.js    # Renderizado reactivo del DOM para el panel administrativo
        ├── api/
        │   ├── HttpClient.js            # Cliente HTTP con control de timeout, abort y normalización de errores
        │   └── VehicleApi.js            # Operaciones REST específicas de vehículos, comandos y demos
        ├── app/
        │   └── ControlApplication.js    # Orquestador principal, navegación de vistas y eventos de mando
        ├── control/
        │   ├── JoystickController.js    # Física, interacción táctil/ratón/teclado para los joysticks
        │   ├── MovementCatalog.js       # Mapeo y categorización de comandos del catálogo
        │   └── DemoView.js              # Controlador visual para la ejecución de DEMOs
        ├── monitoring/
        │   ├── DateTimeFormatter.js     # Formateo seguro de marcas de tiempo
        │   ├── MonitoringView.js        # Renderizado de la ficha de estado e historial de movimientos
        │   └── MonitorSynchronizer.js   # Sincronizador reactivo entre eventos WebSocket y consultas REST
        ├── ui/
        │   ├── BubbleEffects.js         # Efectos visuales de partículas flotantes
        │   ├── ControlView.js           # Renderizado del panel de mandos, feedback visual y botones
        │   ├── ErrorPresenter.js        # Normalizador de mensajes de error orientados al usuario
        │   └── StatusView.js            # Renderizado de los indicadores de conectividad (WSS/API/RDS)
        └── websocket/
            └── VehicleSocket.js         # Cliente WebSocket con reconexión automática y emisión de eventos
```

---

## 💻 Guía de Ejecución en Entorno Local

Al no requerir compilación previa ni entornos pesados (Node.js/npm), el desarrollo y prueba local es inmediato:

### Prerrequisitos
- Navegador web moderno (Chrome, Edge, Firefox, Safari).
- Python 3 instalado en el sistema.

### Pasos para iniciar

1. Abre una terminal de **PowerShell** en la carpeta del proyecto:
   ```powershell
   cd D:\iotAlis\control-iot
   ```

2. Inicia un servidor web estático:
   ```powershell
   python -m http.server 8000 --bind 127.0.0.1
   ```

3. Abre en tu navegador:
   ```text
   http://127.0.0.1:8000/
   ```

> [!TIP]
> La aplicación local se comunicará directamente con los servicios en la nube publicados en `https://iotalis.duckdns.org`, por lo que podrás probar login, control, monitoreo y administración sin configurar bases de datos locales.

---

## 🚀 Despliegue en Producción

### 1. Servidor Web IIS (Internet Information Services)
1. Compilar o empaquetar los archivos estáticos (`index.html` y la carpeta `assets/`).
2. Copiar los archivos en el directorio del sitio IIS:
   ```text
   C:\inetpub\wwwroot\controlwish
   ```
3. Verificar la configuración de tipos MIME (`.json` $\rightarrow$ `application/json`, `.svg` $\rightarrow$ `image/svg+xml`).
4. Probar el dominio publicado: [https://controlwish.duckdns.org/](https://controlwish.duckdns.org/)

### 2. GitHub Pages
1. Confirmar y subir los cambios a la rama correspondiente:
   ```powershell
   git add .
   git commit -m "docs: actualiza README con las novedades de la versión 2"
   git push origin version-2-de-fronted
   ```
2. Si se publica desde la rama `version-2-de-fronted` o `main`:
   - Ir al repositorio en GitHub $\rightarrow$ **Settings** $\rightarrow$ **Pages**.
   - En **Source**, seleccionar `Deploy from a branch` $\rightarrow$ Seleccionar la rama y la carpeta `/ (root)`.
   - El archivo `.nojekyll` asegura que todos los recursos estáticos se sirvan sin restricciones de procesamiento.

---

## 🛡️ Concurrencia y Buenas Prácticas

- **Cancelación Inmediata con `AbortController`:** Al enviar un comando o pulsar **DETENER**, cualquier petición HTTP anterior en tránsito se cancela de forma inmediata para evitar que comandos obsoletos se ejecuten a destiempo.
- **Honestidad en la Telemetría:** La aplicación diferencia explícitamente entre:
  - *Sesión WebSocket activa:* Conexión lógica establecida entre el navegador y el servidor.
  - *Evento recibido:* Confirmación de que el broker procesó la instrucción.
  - *Movimiento físico:* Solo certificable mediante telemetría de confirmación devuelta por el microcontrolador.
- **Gestión de Sesión Limpia:** Las sesiones de usuario y de invitado se gestionan mediante tokens de vida corta almacenados exclusivamente en `sessionStorage`, eliminándose automáticamente al cerrar la pestaña.

---

## 👩‍💻 Créditos y Autoría

- **Proyecto:** Plataforma Web de Control y Monitoreo IoT (Wish Ride)
- **Desarrolladora:** **Ingrid Alison Porras Lugo**
- **Institución / Año:** 2026
