# Wish Ride · Control IoT

Frontend estático para la etapa de CONTROL del proyecto IoT. Se publica en GitHub Pages y consume la API FastAPI existente en AWS. No implementa backend, monitoreo histórico ni administración.

La interfaz usa una identidad pastel, celestial y pop inspirada en el diseño editorial de álbumes K-pop, sin reutilizar logotipos ni recursos de artistas. Es Mobile First, admite mouse, teclado y pantalla táctil, y presenta las acciones cargadas del catálogo real.

La portada, el mando de dos sticks, las teclas de función y el selector de DEMO usan una paleta pastel coordinada; el favicon SVG original mantiene esa identidad en la pestaña. El pie conserva un marcador para colocar el nombre completo del alumno antes de publicar.

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

El stick de desplazamiento mapea avance, reversa e izquierda/derecha; el stick de brazo mapea subir, bajar e izquierda/derecha de pala. Los nombres visibles proceden del catálogo activo de la API. Las funciones no direccionales se representan como teclas debajo de los sticks. Cada cambio de dirección se envía una sola vez y se solicita `DETENER` al volver al centro o cancelar el gesto. Las solicitudes se serializan; `DETENER` toma prioridad. Una DEMO activa bloquea los demás movimientos y permite cancelar o detener. El backend ejecuta sus pasos y pausas.

## Verificación independiente de WSS

1. En Postman crea una solicitud **WebSocket** y conecta a `wss://iotalis.duckdns.org/ws/vehiculo/5`.
2. Mantén esa sesión abierta. Es independiente de la sesión WSS que abre la página; ambas reciben los eventos publicados para el vehículo 5.
3. Al conectar, espera `tipo: "conexion_establecida"`, `vehiculo_id` y `estado_inicial`. Luego envía un movimiento desde la página y compara el evento `movimiento_individual`: el contrato incluye `comando_id`, `codigo`, `origen`, `nombre`, `mascara` y `marca_temporal`.
4. Para una DEMO, observa `demo_inicio`, los eventos `demo_movimiento` con `orden`, `duracion_ms` y `pausa_ms`, y `demo_fin`, `demo_cancelada` o `demo_error`.

El backend no entrega un identificador único de solicitud; correlaciona los eventos con vehículo, comando, código, origen y marca temporal. Un evento confirma su publicación por el backend, no la ejecución física en los motores. No se enviaron movimientos ni se iniciaron DEMO durante esta implementación.

## CORS y seguridad para GitHub Pages

El endpoint AWS contestó OPTIONS con `Access-Control-Allow-Origin: *` el 8 de noviembre de 2026; el OpenAPI no declara autenticación. El repositorio todavía no tiene un remoto ni un origen Pages definido, así que el backend separado conserva la configuración actual. Antes de publicar, limita allí `CORS_ORIGINS` al origen exacto de Pages y restringe métodos a `GET`, `POST`, `OPTIONS` y encabezados a `Accept`, `Content-Type`, con credenciales desactivadas. CORS no autentica. El frontend solo se comunica con HTTPS/WSS, no guarda credenciales y trata texto de la API con `textContent`; no abre conexiones MySQL/RDS.
