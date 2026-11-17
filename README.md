# Control y Monitoreo IoT

Frontend web de la práctica 4.1 y 4.2 para operar y consultar el vehículo IoT. Se conserva CONTROL y se agrega MONITOREO en el mismo proyecto. El navegador consume la API FastAPI mediante HTTPS y recibe eventos mediante WSS; nunca se conecta directamente a Amazon RDS.

## Enlaces

- Frontend IIS: https://controlwish.duckdns.org/
- Swagger: https://iotalis.duckdns.org/docs
- OpenAPI: https://iotalis.duckdns.org/openapi.json
- API base: https://iotalis.duckdns.org
- Vehículo de prueba: ID 5, Excavadora IoT
- WSS: `wss://iotalis.duckdns.org/ws/vehiculo/5`

## Qué incluye

- **CONTROL:** joystick, comandos cargados desde el catálogo real, DETENER prioritario y consulta/inicio/cancelación de DEMO.
- Los controles `ENCENDER_LED` y `ACTIVAR_SONIDO` alternan el estado solicitado en cada pulsación. Para que también conmuten las salidas físicas de manera independiente, el backend debe aceptar `estado_salida` y el ESP8266 debe ejecutar el firmware actualizado; subir solo el frontend no cambia el comportamiento de una API antigua.
- **MONITOREO:** estado más reciente y tabla con hasta diez movimientos individuales persistidos.
- Indicadores independientes para WSS del navegador, respuesta de la API y diagnóstico RDS. RDS muestra **Sin verificar** mientras no haya una ruta segura documentada para diagnosticarla.
- Diseño adaptable, navegación entre Control, Monitoreo y DEMO, favicon y créditos.

## Funcionamiento de Monitoreo

Al abrir Monitoreo se consultan `GET /vehiculos/5/estado` y `GET /vehiculos/5/historial`. La API devuelve el estado actual y hasta diez filas del historial, ordenadas de la más nueva a la más antigua. La tabla filtra el vehículo, evita filas repetidas por `id_historial` y no elimina registros del servidor.

La misma conexión WSS se comparte con Control. Un evento individual válido del vehículo actualiza el panel y desencadena una resincronización REST del historial. Los eventos de DEMO pueden reflejarse en el panel; sus pasos no se insertan en la tabla individual. Un evento WSS acredita que el backend publicó el evento, no que el motor físico se haya movido.

Los timestamps observados llegan sin zona horaria explícita. La interfaz conserva la fecha y hora que proporciona la API; no realiza una conversión local que pudiera cambiar su significado. El campo `conectado` del estado tampoco se interpreta como prueba de movimiento físico.

## Interruptores de Luz y Sonido

Los botones del catálogo `ENCENDER_LED` (ID 37, código 12) y `ACTIVAR_SONIDO` (ID 35, código 10) alternan el estado en cada pulsación. El frontend envía el mismo ID de catálogo y agrega `estado_salida: true` para encender o `false` para apagar. La API conserva el registro individual y publica ese estado y `accion_salida` en el evento WSS; el firmware cambia solo la salida indicada, sin apagar las demás. En el evento, `accion_salida` muestra `APAGAR_LED` o `DESACTIVAR_SONIDO` al segundo clic, sin crear IDs ni códigos nuevos en el catálogo. Los otros comandos conservan su comportamiento de máscara completa.

Esta función requiere actualizar en conjunto los cuatro archivos Python modificados y volver a cargar en la placa el archivo `vehiculocodigoarduino/vehiculocodigoarduino.ino`. El ZIP de frontend por sí solo no cambia el contrato del servidor ni el comportamiento del ESP8266. La interfaz refleja el estado solicitado/recibido del servidor; sin una confirmación de retorno de la placa, no lo presenta como una medición eléctrica de la salida.

## Arquitectura frontend (POO y módulos ES)

```text
assets/
├── css/styles.css
├── icons/favicon.svg
├── images/
└── js/
    ├── app/ControlApplication.js       Coordinación de vistas y comandos
    ├── api/HttpClient.js               Fetch, timeout y errores HTTP
    ├── api/VehicleApi.js               Operaciones REST del vehículo
    ├── control/                        Joystick, catálogo y DEMO
    ├── monitoring/                     Vista y sincronización de Monitoreo
    ├── websocket/VehicleSocket.js      Conexión WSS compartida y reconexión
    ├── ui/                             Vistas, estados y efectos
    ├── config.js                       API, WSS e ID de vehículo
    └── main.js                         Punto de entrada
```

`ControlApplication` coordina las clases. `VehicleApi` reutiliza `HttpClient`; `MonitorSynchronizer` coordina las consultas, eventos y resincronización; `MonitoringView` representa los datos con `textContent`. No se publican credenciales.

## Desarrollo local

El frontend es estático y no requiere entorno virtual. Desde PowerShell:

```powershell
cd D:\iotAlis\control-iot
py -m http.server 8000 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8000/`. El frontend local seguirá consultando la API HTTPS publicada.

## Comprobación manual sugerida

1. En DevTools → Network, abre Monitoreo y confirma las consultas GET de estado e historial.
2. Compara vehículo, fecha, hora y filas con las respuestas JSON; verifica que se presenten como máximo diez registros.
3. Con Postman o Thunder Client, mantén otra conexión a `wss://iotalis.duckdns.org/ws/vehiculo/5`. Desde Control solicita un movimiento y comprueba el evento recibido y la actualización del panel/tabla sin recargar.
4. Repite desde otra sesión si se requiere comprobar que Monitoreo refleja eventos externos.
5. Comprueba por separado la desconexión/reconexión WSS y la respuesta HTTPS de la API. RDS debe permanecer Sin verificar si no existe diagnóstico documentado.
6. Ejecuta una DEMO y verifica que sus pasos no aparezcan como movimientos individuales, salvo que el backend los persista expresamente conforme a su regla.

No se debe afirmar que un movimiento físico ocurrió solo por una respuesta HTTP o un evento WSS. Para pruebas con comandos, ten en cuenta que la API puede agregar registros reales al historial.

## Contratos

Los contratos conocidos y sus limitaciones se describen en [`API_CONTRACT.md`](./API_CONTRACT.md). No inventes rutas, campos, autenticación o marcas de tiempo. La API debe permitir CORS para el origen publicado; CORS no sustituye autenticación. No incluyas secretos, contraseñas, claves AWS ni tokens permanentes en el frontend.

## Publicación

La publicación actual de IIS está en https://controlwish.duckdns.org/ y la API permanece en https://iotalis.duckdns.org/docs. Para actualizar IIS, copia el contenido del ZIP de despliegue a `C:\inetpub\wwwroot\controlwish` y recarga el navegador con Ctrl+Shift+R.

La estructura también está preparada para GitHub Pages desde la raíz de la rama `main`. La URL esperada del repositorio `RingdLugo/control_iot_fronted` es https://ringdlugo.github.io/control_iot_fronted/. La consulta pública de Pages devolvió 404, así que todavía falta habilitar Pages en la configuración del repositorio (Settings → Pages → Deploy from a branch → `main` / `/ (root)`) y verificar su publicación; no se afirma que esa URL ya esté activa.

## Créditos

Desarrollado por **Ingrid Alison Porras Lugo** · 2026
