# Wish Ride · Control IoT

Frontend estático para la etapa de CONTROL del proyecto IoT. Se publica en GitHub Pages y consume la API FastAPI existente en AWS. No implementa backend, monitoreo histórico ni administración.

La interfaz usa una identidad pastel, celestial y pop inspirada en el diseño editorial de álbumes K-pop, sin reutilizar logotipos ni recursos de artistas. Es Mobile First, admite mouse, teclado y pantalla táctil, y presenta las acciones cargadas del catálogo real.

La interfaz sigue la referencia del mando: un joystick principal, el catálogo de movimientos adicionales, DETENER prioritario y el selector de DEMO en la misma pantalla. Conserva una paleta pastel pop; no inventa movimientos 90°/360° cuando no existen en el catálogo del vehículo. El favicon SVG original mantiene la identidad visual y el pie conserva un marcador para el nombre completo del alumno.

En escritorio incluye navegación lateral para saltar entre Control, DEMO y conexión; en móvil, esas mismas anclas están en un menú compacto. La cruceta coloca DETENER al centro y los cuatro botones usan los IDs del catálogo consultado a la API.

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

El joystick único y los botones `AVANZAR`, `RETROCEDER`, `GIRAR_IZQUIERDA` y `GIRAR_DERECHA` comparten la misma lógica de comandos. El resto de los movimientos disponibles (incluidos los de pala) aparecen como botones accesibles y sus nombres e IDs proceden del catálogo activo de la API. Cada cambio del joystick se envía una sola vez y al soltar se solicita `DETENER`. Las solicitudes se serializan; `DETENER` toma prioridad. Una DEMO activa bloquea los demás movimientos y permite cancelar o detener. El backend ejecuta sus pasos y pausas.

## Comprobar un botón de movimiento

1. Abre el proyecto con Live Server o ejecuta `python -m http.server 8000` en esta carpeta. Abre `http://localhost:8000`.
2. En DevTools abre **Network/Red**, activa **Preserve log/Conservar registro** y filtra por **Fetch/XHR**.
3. Pulsa `AVANZAR`. Debe aparecer `POST https://iotalis.duckdns.org/vehiculos/5/movimiento`, con JSON `{"comando_id":14,"origen":"WEB_CONTROL"}`. El estado «Aceptado por API» solo aparece tras una respuesta HTTP exitosa.
4. Para confirmar el catálogo leído al abrir la página, revisa `GET /comandos/vehiculo/5/detalle`; el ID de cada botón proviene de esa respuesta.
5. En la pestaña **Network/Red**, filtra por **WS** y abre `/ws/vehiculo/5`. Si el socket se mantiene abierto, el servidor debe enviar `conexion_establecida` y publicar `movimiento_individual` después del POST.

Una comprobación local desde Edge interceptó `AVANZAR` antes de AWS y confirmó que la interfaz construye el POST con el ID 14 y origen `WEB_CONTROL`; ese ensayo no llegó a escribir en la base. La última conexión real WSS observada se cerró con `1006` antes del evento inicial, por lo que el éxito HTTP y los eventos WSS deben verificarse como etapas distintas. La API accede a RDS; el navegador no abre una conexión MySQL directa.

En una comprobación desde Edge el 8 de noviembre de 2026, WSS abrió y cerró con código anormal `1006` antes de recibir el evento inicial. Mientras el backend/proxy no mantenga la sesión, la interfaz muestra «Reconectando» y no puede confirmar eventos WSS.

## Verificación independiente de WSS

1. En Postman crea una solicitud **WebSocket** y conecta a `wss://iotalis.duckdns.org/ws/vehiculo/5`.
2. Mantén esa sesión abierta. Es independiente de la sesión WSS que abre la página; ambas reciben los eventos publicados para el vehículo 5.
3. Al conectar, espera `tipo: "conexion_establecida"`, `vehiculo_id` y `estado_inicial`. Luego envía un movimiento desde la página y compara el evento `movimiento_individual`: el contrato incluye `comando_id`, `codigo`, `origen`, `nombre`, `mascara` y `marca_temporal`.
4. Para una DEMO, observa `demo_inicio`, los eventos `demo_movimiento` con `orden`, `duracion_ms` y `pausa_ms`, y `demo_fin`, `demo_cancelada` o `demo_error`.

El backend no entrega un identificador único de solicitud; correlaciona los eventos con vehículo, comando, código, origen y marca temporal. Un evento confirma su publicación por el backend, no la ejecución física en los motores. No se enviaron movimientos ni se iniciaron DEMO durante esta implementación.

## CORS y seguridad para GitHub Pages

El endpoint AWS contestó OPTIONS con `Access-Control-Allow-Origin: *` el 8 de noviembre de 2026; el OpenAPI no declara autenticación. El repositorio todavía no tiene un remoto ni un origen Pages definido, así que el backend separado conserva la configuración actual. Antes de publicar, limita allí `CORS_ORIGINS` al origen exacto de Pages y restringe métodos a `GET`, `POST`, `OPTIONS` y encabezados a `Accept`, `Content-Type`, con credenciales desactivadas. CORS no autentica. El frontend solo se comunica con HTTPS/WSS, no guarda credenciales y trata texto de la API con `textContent`; no abre conexiones MySQL/RDS.
