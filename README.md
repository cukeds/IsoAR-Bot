### Funcionalidades del Bot

#### Conexiones e Integraciones
- **Base de Datos SQL**: El bot puede conectarse a una base de datos SQL para almacenar y recuperar información.
- **Google Drive**: El bot puede integrarse con Google Drive para guardar y acceder a documentos.
- **WhatsApp**: Usando la librería `@whiskeysockets/baileys`, el bot puede conectarse a WhatsApp para enviar y recibir mensajes.

#### Procesamiento de Mensajes de WhatsApp
- **Lectura y Parseo**: Los mensajes de WhatsApp se leen y procesan según la lógica definida en `NewMessage.js`.

#### Registro de Empleados
- **Primer Mensaje**: Cuando un empleado envía un primer mensaje, se registra en el sistema (este comportamiento está pendiente de modificaciones).

#### Gestión de Eventos
- **Palabras Clave**: Al detectar una palabra clave de evento (definidas en `config.js`), se registra un evento con la siguiente estructura:
  ```json
  {
    "tipo": "",
    "origen": "",
    "descripcion": "",
    "causa": "",
    "documentacion": "",
    "acciones_inmediatas": ""
  }
  ```
- **Almacenamiento de Eventos**: Inicialmente, los eventos se guardan temporalmente en un archivo (esto está planificado para cambiar a SQL). Luego, se leen y se suben a Google Drive a través de `event_worker.js`. En el futuro, los eventos se guardarán directamente en SQL y se registrará el enlace al documento en Drive.

#### Gestión de Tareas
- **Registro de Tareas**: Al detectar la palabra clave "Tarea", se registra una tarea con la siguiente estructura:
  ```json
  {
    "description": "",
    "deadline": "",
    "employee": ""
  }
  ```
- **Almacenamiento de Tareas**: Las tareas se guardan en MySQL, junto con la fecha y el empleado asignado. Para los recordatorios, se realizará una consulta a SQL para identificar las tareas próximas a su fecha límite y enviar mensajes de notificación a los empleados correspondientes. Este proceso está implementado en `task_worker.sql`.

#### Funciones Utilitarias
- **Utils.js**: Contiene funciones de utilidad que son utilizadas por diversas partes del bot, ya sea para leer archivos o realizar consultas SQL.

#### Sistema de Archivos
- **Estructura de Carpetas**: El sistema de archivos genera una carpeta por usuario, conteniendo dos archivos:
  - **history.js**:
    ```json
    {
      "senderId": "5492983409001",
      "firstMessage": true,
      "events": [],
      "tasks": []
    }
    ```
    Almacena la ID de WhatsApp del usuario, si es el primer mensaje (identificando a aquellos que nunca se han comunicado con el bot antes), y los eventos y tareas pendientes de registro en Drive o SQL.
  - **userdata.js**:
    ```json
    {
      "status": "new",
      "name": "",
      "dni": "",
      "email": "",
      "event": {},
      "task": {},
      "pending_messages": []
    }
    ```
    Almacena el estado del usuario, sus datos personales, y los mensajes pendientes que el bot debe enviar. Esto es útil, por ejemplo, cuando se generan varios documentos que deben ser enviados al coordinador del sistema; se guardan aquí los mensajes con los enlaces a Drive para que eventualmente le lleguen al coordinador.

### Planes Futuros
- Migrar el almacenamiento temporal de eventos desde archivos a una base de datos SQL.
- Implementar un sistema de verificación para asegurarse de que los documentos estén correctamente cargados en Google Drive antes de registrar el evento.
- Mejorar la gestión de recordatorios de tareas mediante consultas SQL y notificaciones automáticas vía WhatsApp.