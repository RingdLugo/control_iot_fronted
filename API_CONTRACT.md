# Contratos de API para Control y Monitoreo IoT

Base HTTPS: `https://iotalis.duckdns.org`  
Swagger: `https://iotalis.duckdns.org/docs`  
OpenAPI: `https://iotalis.duckdns.org/openapi.json`  
WSS del vehículo 5: `wss://iotalis.duckdns.org/ws/vehiculo/5`

Estos contratos se consultaron de forma de solo lectura el 12 de noviembre de 2026. El frontend no consulta MySQL/RDS directamente.

## Rutas REST utilizadas

| Propósito | Método y ruta | Parámetros | Respuestas OpenAPI conocidas |
|---|---|---|---|
| Health de API | `GET /` | Ninguno | 200 |
| Ficha de vehículo | `GET /vehiculos/{vehiculo_id}` | ID entero en ruta | 200, 404, 422 |
| Estado reportado | `GET /vehiculos/{vehiculo_id}/estado` | ID entero en ruta | 200, 404, 422 |
| Historial individual reciente | `GET /vehiculos/{vehiculo_id}/historial` | ID entero en ruta | 200, 422 |
| Catálogo de comandos | `GET /comandos/vehiculo/{vehiculo_id}/detalle` | ID entero en ruta | 200, 422 |
| DEMO disponibles | `GET /demos/vehiculo/{vehiculo_id}` | ID entero en ruta | 200, 422 |
| Pasos de DEMO | `GET /demos/{demo_id}/movimientos` | ID entero en ruta | 200, 422 |
| Enviar movimiento | `POST /vehiculos/{vehiculo_id}/movimiento` | `{"comando_id": 14, "origen": "WEB_CONTROL"}` | 201, 400, 500, 422 |
| Iniciar DEMO | `POST /vehiculos/{vehiculo_id}/demo/iniciar` | `{"demo_id": 2}` | 200, 400, 409, 422 |
| Cancelar DEMO | `POST /vehiculos/{vehiculo_id}/demo/detener` | Sin cuerpo | 200, 400, 422 |

`GET /vehiculos/{vehiculo_id}/estado` devuelve campos observados `id_vehiculo`, `vehiculo`, `id_comando`, `comando`, `codigo`, `conectado` y `fecha_actualizacion`.

`GET /vehiculos/{vehiculo_id}/historial` está descrito en Swagger como los diez movimientos individuales más recientes. Las filas observadas contienen `id_historial`, `id_vehiculo`, `comando`, `codigo`, `fecha_hora` y `origen`, ya ordenadas de la más nueva a la más antigua.

Las fechas recibidas no incluyen sufijo de zona horaria en los ejemplos comprobados. La interfaz conserva el valor original y no afirma una zona que el backend no documenta.

## WSS

El contrato del servidor previamente observado documenta `conexion_establecida` con `vehiculo_id`, marca temporal y `estado_inicial`; `movimiento_individual` con `comando_id`, `codigo`, `origen`, `nombre`, `mascara` y marca temporal; y eventos DEMO `demo_inicio`, `demo_movimiento`, `demo_fin`, `demo_cancelada` y `demo_error`. Los pasos DEMO no se agregan al historial individual.

El evento individual no incluye un identificador único de solicitud según el contrato revisado. El cliente filtra por vehículo y reconcilia la tabla mediante REST usando `id_historial`, evitando basar la persistencia únicamente en el evento.

WSS en línea significa que el navegador tiene sesión con el servidor WSS; no confirma presencia del ESP ni movimiento físico.

## Seguridad y límites

OpenAPI no declara esquema de autenticación. Una comprobación previa observó CORS `Access-Control-Allow-Origin: *`; CORS no es autenticación. `GET /` confirma que responde esa ruta, no que funcionen las 21 APIs ni que RDS esté disponible.

No se encontró una ruta OpenAPI de readiness/diagnóstico que verifique RDS de forma independiente. Por ello, el indicador RDS debe permanecer **Sin verificar**. No se colocan claves, credenciales ni secretos en el frontend.
