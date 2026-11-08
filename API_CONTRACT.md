# Contrato real de la API para Control IoT

Verificado el 8 de noviembre de 2026 contra `https://iotalis.duckdns.org/openapi.json` y con consultas GET. No se enviaron comandos de movimiento.

## Recursos

- Base HTTPS: `https://iotalis.duckdns.org`
- Swagger: `https://iotalis.duckdns.org/docs`
- OpenAPI: `https://iotalis.duckdns.org/openapi.json`
- WSS vehículo de prueba: `wss://iotalis.duckdns.org/ws/vehiculo/5`
- Vehículo: ID `5`, Excavadora IoT (ESP8266)

## Contratos para la aplicación

| Uso | Método y ruta | Entrada | Respuestas documentadas |
|---|---|---|---|
| Ficha del vehículo | `GET /vehiculos/{vehiculo_id}` | `vehiculo_id` en ruta | 200, 404, 422 |
| Comandos y máscaras | `GET /comandos/vehiculo/{vehiculo_id}/detalle` | `vehiculo_id` en ruta | 200, 422 |
| DEMO disponibles | `GET /demos/vehiculo/{vehiculo_id}` | `vehiculo_id` en ruta | 200, 422 |
| Movimientos de una DEMO, si se requiere mostrarlos | `GET /demos/{demo_id}/movimientos` | `demo_id` en ruta | 200, 422 |
| Ejecutar movimiento | `POST /vehiculos/{vehiculo_id}/movimiento` | JSON `{"comando_id": 14, "origen": "WEB_CONTROL"}` | 201, 400, 500, 422 |
| Iniciar DEMO | `POST /vehiculos/{vehiculo_id}/demo/iniciar` | JSON `{"demo_id": 2}` | 200, 400, 409, 422 |
| Cancelar DEMO | `POST /vehiculos/{vehiculo_id}/demo/detener` | Sin cuerpo | 200, 400, 422 |
| Respuesta de servicio | `GET /` | Sin parámetros | 200 |

El contrato OpenAPI no declara esquemas de autenticación ni encabezado `Authorization`. La consulta OPTIONS de prueba respondió `Access-Control-Allow-Origin: *`. CORS habilita acceso desde navegador, pero no autentica las solicitudes.

`GET /` devuelve un mensaje de FastAPI y enlaces a documentación/WebSocket. No ejecuta una comprobación de RDS. La API no expone actualmente una ruta documentada de readiness/diagnóstico de base de datos; el indicador RDS debe permanecer **Sin verificar**.

## Catálogo leído para vehículo 5

| ID comando | Código | Nombre | Activo | Máscara |
|---:|---:|---|---:|---:|
| 14 | 1 | AVANZAR | sí | 1 |
| 15 | 2 | RETROCEDER | sí | 2 |
| 16 | 3 | GIRAR_IZQUIERDA | sí | 64 |
| 17 | 4 | GIRAR_DERECHA | sí | 128 |
| 18 | 5 | SUBIR_PALA | sí | 16 |
| 19 | 6 | BAJAR_PALA | sí | 32 |
| 20 | 7 | PALA_IZQUIERDA | sí | 4 |
| 21 | 8 | PALA_DERECHA | sí | 8 |
| 22 | 9 | DETENER | sí | 0 |
| 35 | 10 | ACTIVAR_SONIDO | sí | 256 |
| 36 | 11 | ACTIVAR_MODO | sí | 512 |
| 37 | 12 | ENCENDER_LED | sí | 1024 |

El frontend envía el **ID** en `comando_id`; por ejemplo, AVANZAR es ID 14, código 1.

Al cargar la página se consulta `GET /vehiculos/5` para mostrar el nombre, el modelo y el microcontrolador reales. Al elegir una DEMO se consulta `GET /demos/{demo_id}/movimientos` para enseñar sus pasos y tiempos; la API sigue ejecutando la secuencia.

## Respuestas y eventos WSS observados en el código del servidor

Al conectar, el servidor envía `tipo: "conexion_establecida"`, `vehiculo_id`, marca temporal y `estado_inicial`. Para un comando aceptado, difunde `tipo: "movimiento_individual"` con `comando_id`, `codigo`, `origen`, `nombre` y `mascara`. El WebSocket del navegador recibe los mismos eventos que otros clientes suscritos al vehículo.

Una DEMO emite `demo_inicio` con el total de pasos; después `demo_movimiento` por cada paso con orden, duración y pausa; termina con `demo_fin`, o informa `demo_cancelada`/`demo_error`. El backend respeta la secuencia y temporización. Sus pasos no se agregan al historial individual.

La lectura GET de `GET /demos/2/movimientos` realizada el 8 de noviembre de 2026 devolvió siete pasos con `orden`, `comando`, `codigo`, `duracion_ms` y `pausa_ms`.

## Reglas relevantes para el cliente

- Cargar IDs, nombres, estado activo y máscaras desde el catálogo; no codificar una tabla alternativa como fuente de verdad.
- Evitar comandos individuales mientras haya DEMO activa; siempre permitir solicitar cancelación o DETENER con el ID 22.
- La cancelación detiene la DEMO en el servidor. DETENER es un movimiento individual distinto.
- El endpoint de movimiento escribe historial/estado y emite WSS. No prueba que el motor físico se haya movido.
- No hay protección equivalente en el servicio que impida todos los movimientos individuales durante DEMO; la interfaz debe serializar y bloquear acciones incompatibles.
- WSS del navegador indica conexión navegador-servidor, no presencia de ESP.
- El evento de movimiento no lleva un ID único de solicitud; el cliente muestra vehículo, comando, código, origen y `marca_temporal` cuando vienen en el evento.

## Limitación de versión

El enunciado refiere “21 APIs”; el OpenAPI actualmente publicado lista más operaciones REST (incluye administración y rutas adicionales). Esta práctica solo consumirá las rutas de Control de la tabla anterior. No se añadieron endpoints ni se consulta RDS desde el navegador.
