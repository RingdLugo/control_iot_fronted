# Control IoT · Wish Ride

Aplicación web para operar el vehículo IoT de la práctica. El frontend está publicado mediante HTTPS en IIS y consume la API FastAPI existente; **no incluye ni recrea el backend**. Esta etapa implementa únicamente CONTROL: joystick, botones para los comandos disponibles y selección/ejecución/cancelación de DEMO.

## Enlaces del proyecto

- **Frontend de control:** [https://controlwish.duckdns.org/](https://controlwish.duckdns.org/)
- **Documentación Swagger de la API:** [https://iotalis.duckdns.org/docs](https://iotalis.duckdns.org/docs)
- **OpenAPI JSON:** [https://iotalis.duckdns.org/openapi.json](https://iotalis.duckdns.org/openapi.json)
- **API base:** `https://iotalis.duckdns.org`
- **WebSocket del vehículo 5:** `wss://iotalis.duckdns.org/ws/vehiculo/5`

La aplicación usa el vehículo de prueba **ID 5 — Excavadora IoT**. El ID, los nombres y los códigos de los movimientos se obtienen del catálogo de la API; el navegador no se conecta directamente a Amazon RDS.

## Funcionamiento

```text
Navegador
  ├─ HTTPS + Fetch → API FastAPI en AWS → lógica del backend → Amazon RDS
  └─ WSS ← eventos publicados por la API

Cliente independiente (Postman/Thunder Client) ── WSS → mismos eventos del vehículo
```

1. Al abrir el frontend, consulta la ficha del vehículo, los comandos activos y las DEMO disponibles.
2. El joystick envía `AVANZAR`, `RETROCEDER`, `GIRAR_IZQUIERDA` o `GIRAR_DERECHA` según la dirección. Al soltarlo, solicita `DETENER`.
3. Los movimientos restantes del catálogo —por ejemplo, los de la pala, sonido, modo y LED— aparecen como botones. El joystick y todos los botones usan la misma lógica de envío.
4. Un movimiento individual se envía por `POST` a la API con el **ID de comando**. Por ejemplo, para el vehículo 5, `AVANZAR` tiene ID `14` y código `1`; el cuerpo es `{"comando_id":14,"origen":"WEB_CONTROL"}`. La API procesa la solicitud, actualiza el estado/historial según sus reglas y publica el evento WSS correspondiente.
5. La vista DEMO permite seleccionar secuencias existentes. La API ejecuta los pasos en el orden y con la duración/pausa definidos en el backend; el frontend no inventa una secuencia. Se puede cancelar cuando el backend ofrece esa operación.
6. Las respuestas HTTP y los eventos WSS se muestran como estados distintos: solicitado, aceptado por API y evento recibido. Ninguno confirma que se hayan movido motores; la conexión física del ESP8266/ESP32 aún no forma parte de esta práctica.

Las solicitudes de movimiento se serializan para evitar comandos concurrentes; `DETENER` tiene prioridad. Mientras una DEMO está activa, los controles incompatibles se bloquean. Los movimientos internos de DEMO se reportan por WSS y siguen la regla de historial implementada en el backend.

## Indicadores de conectividad

La barra superior presenta tres estados independientes:

- **WebSocket WSS:** estado de la sesión entre este navegador y el servidor WSS (`En línea`, conexión/reconexión o desconectado). No representa la conexión del vehículo físico.
- **Servidor AWS · API de 21 servicios:** comprobación periódica de `GET /`. “Disponible” confirma que respondió esa operación de salud, no que se hayan probado las 21 APIs.
- **Base de datos · Amazon RDS:** aparece como **Sin verificar**, porque la API no expone un diagnóstico seguro documentado para comprobar RDS. No se abre una conexión MySQL desde el navegador.

## Arquitectura del frontend (POO y módulos ES)

`main.js` es el punto de entrada. `ControlApplication` coordina las clases y su estado; cada módulo mantiene una responsabilidad concreta.

```text
js/
├── app/
│   └── ControlApplication.js   coordinación del control, comandos y DEMO
├── api/
│   ├── HttpClient.js           Fetch, timeout, abortos y respuestas HTTP/JSON
│   └── VehicleApi.js           operaciones REST del vehículo y DEMO
├── control/
│   ├── MovementCatalog.js      catálogo real, mapeo y creación de botones
│   ├── JoystickController.js   gestos táctiles, mouse y teclado
│   └── DemoView.js             lista y pasos de DEMO
├── websocket/
│   └── VehicleSocket.js        conexión WSS y reconexión
├── ui/
│   ├── ControlView.js          presentación del control y sus estados
│   ├── StatusView.js           indicadores de conexión
│   ├── BubbleEffects.js        burbujas de interacción
│   └── ErrorPresenter.js       mensajes de error
├── config.js                  URL, vehículo y tiempos de conexión
└── main.js                    inicio de la aplicación
```

`VehicleApi` utiliza `HttpClient`; `ControlApplication` compone las vistas, el catálogo y la sesión WebSocket. La interfaz no contiene credenciales, y los valores recibidos de la API se insertan como texto, no como HTML ejecutable.

## Tecnologías

- HTML5 semántico y CSS3 Mobile First.
- Bootstrap 5 y estilos personalizados.
- JavaScript ES6+ con módulos nativos, clases, Fetch/async-await y WebSocket nativo.
- API existente en Python/FastAPI, AWS y Amazon RDS.
- IIS con HTTPS para el frontend; HTTPS/WSS para la API.

## Ejecutar localmente

El frontend es estático y **no necesita un entorno virtual de Python**. Python se utiliza aquí solo para servir los archivos durante el desarrollo.

En PowerShell:

```powershell
cd D:\iotAlis\control-iot
py -m http.server 8000 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8000/`. Para detener el servidor, vuelve a PowerShell y presiona `Ctrl+C`. La API continúa siendo la remota de AWS (`https://iotalis.duckdns.org`); no se inicia un backend local con este comando.

## Comprobación manual

### Revisar el catálogo y la API

Abre en el navegador `https://iotalis.duckdns.org/comandos/vehiculo/5/detalle`. La respuesta debe incluir, entre otros, `AVANZAR` con ID `14`, `RETROCEDER` con ID `15` y `DETENER` con ID `22`.

En DevTools → **Red/Network**, filtra por Fetch/XHR y recarga `https://controlwish.duckdns.org/`. Deben aparecer las consultas GET para la ficha, comandos y DEMO. Al pulsar un movimiento, revisa el POST a `/vehiculos/5/movimiento`, su cuerpo y su respuesta HTTP.

### Verificar eventos WebSocket independientemente

1. En Postman o Thunder Client crea una solicitud WebSocket a `wss://iotalis.duckdns.org/ws/vehiculo/5` y déjala conectada.
2. Desde el frontend pulsa un movimiento y compara el evento recibido con el vehículo, `comando_id`, `codigo`, `origen` y la marca temporal que realmente proporcione el backend.
3. Para DEMO revisa el inicio, los movimientos ordenados y la finalización o cancelación si está disponible.

El evento confirma que el backend lo publicó; no confirma movimiento físico. La conexión WSS de Postman es independiente de la conexión que mantiene el frontend.

## Contratos y seguridad

Las rutas, métodos, cuerpos, catálogo y eventos conocidos se describen en [`API_CONTRACT.md`](./API_CONTRACT.md). También pueden revisarse en [Swagger](https://iotalis.duckdns.org/docs). No se deben agregar rutas o campos JSON que no estén en el contrato real.

La API usa HTTPS y WSS para evitar contenido mixto desde el sitio HTTPS. CORS debe permitir el origen donde se publique el frontend; CORS no es autenticación. No agregar contraseñas de AWS/RDS, tokens privilegiados ni credenciales a JavaScript o al repositorio. Amazon RDS solo se accede desde el backend.

## Publicación

El dominio actualmente utilizado para el frontend es [https://controlwish.duckdns.org/](https://controlwish.duckdns.org/) y el backend permanece en [https://iotalis.duckdns.org/docs](https://iotalis.duckdns.org/docs). El ZIP `controlwish-deploy.zip` contiene los archivos estáticos para actualizar el sitio en IIS. Si la entrega académica exige además una URL de GitHub Pages, debe publicarse el repositorio y agregarse aquí esa URL cuando esté disponible.

## Créditos

Desarrollado por **Ingrid Alison Porras Lugo** · 2026
