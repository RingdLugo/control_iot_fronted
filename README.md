# Wish Ride · Control IoT

Frontend estático para la etapa de CONTROL del proyecto IoT. Se publica en GitHub Pages y consume la API FastAPI existente en AWS. No implementa backend, monitoreo histórico ni administración.

La interfaz usa una identidad pastel, celestial y pop inspirada en el diseño editorial de álbumes K-pop, sin reutilizar logotipos ni recursos de artistas. Es Mobile First, admite mouse, teclado y pantalla táctil, y presenta las acciones cargadas del catálogo real.

La portada, el joystick, los botones y el selector de DEMO usan una paleta pastel coordinada; el favicon SVG original mantiene esa identidad en la pestaña. El pie conserva un marcador para colocar el nombre completo del alumno antes de publicar.

## Estructura

```text
control-iot/
├── API_CONTRACT.md
├── assets/favicon.svg
├── css/styles.css
├── index.html
└── js/
    ├── api/                 cliente REST, comandos, DEMO y disponibilidad
    ├── control/             joystick, movimientos y DEMO
    ├── ui/                  estado visual y errores
    ├── websocket/           conexión WSS y recepción de eventos
    ├── config.js            URLs e identificador del vehículo
    └── main.js              composición de módulos
```

## Ejecutar localmente

Abre esta carpeta en Visual Studio Code y sírvela por HTTP con Live Server o `python -m http.server 8000`; después visita `http://localhost:8000`. Los módulos nativos deben cargarse desde un servidor, no desde `file://`.

## Integración

Las URLs y el vehículo de prueba se configuran en `js/config.js`. Los contratos verificados, cuerpos y rutas reales se describen en [`API_CONTRACT.md`](./API_CONTRACT.md). RDS no tiene diagnóstico público documentado, por lo que se informa como “Sin verificar”. No colocar secretos o credenciales en este sitio público.

La estructura usa rutas relativas (`./assets`, `./css`, `./js`) y `.nojekyll`, compatibles con el despliegue del repositorio en una subruta de GitHub Pages. El favicon SVG propio ya está vinculado desde HTML. Sustituir el marcador de créditos en el pie por el nombre completo del alumno.

## Git y publicación

Inicializar Git en esta carpeta y conectar el repositorio individual del alumno. En GitHub, habilitar Pages desde la rama `main`, carpeta raíz `/`. El despliegue corresponde únicamente al frontend.

El navegador reporta estados WSS y HTTP de forma independiente. Una respuesta de `GET /` confirma que la ruta raíz de FastAPI contestó en ese momento; no valida las 21 operaciones ni RDS. La apertura del socket no confirma que el vehículo físico esté conectado ni que se haya ejecutado un movimiento.

El joystick envía cada cambio de dirección disponible y solicita `DETENER` al volver al centro o cancelar el gesto. Las solicitudes de movimiento se serializan; `DETENER` toma prioridad. Una DEMO activa bloquea los demás movimientos y permite cancelar o detener. El backend ejecuta los pasos y sus pausas.
