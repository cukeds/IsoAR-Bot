Funcionalidades del bot

Conexion a una BDD SQL
Conexion a drive
Conexion a WhatsApp (@whiskeysockets/baileys)

Lectura y parseo de los mensajes de whatsapp de acuerdo al archivo NewMessage.js

Ante un primer mensaje, se registra el empleado (a cambiar)

Ante una palabra clave de evento (definidas en config.js), se registra un evento, de la forma
{
tipo,
origen,
descripcion,
causa,
documentacion,
acciones_inmediatas,
}

El evento se guarda temporalmente en un archivo (a cambiar a SQL), el cual luego se lee y se guarda en Drive a traves del event_worker.js, que lee los archivos en busca de eventos sin guardar. (El plan seria cambiar para que los eventos se guarden directamente en SQL y luego se registre en un campo el link al drive del documento, o al menos una verificacion de que esta cargado



Ante la palabra clave Tarea, se registra una tarea de la forma
{    
description,
deadline,
employee,
}
La tarea se guarda en mysql, junto a la fecha y al empleado asignado. Para implementar los recordatorios habria que hacer una query a SQL que junte los empleados asignados a las tareas que esten por llegar a la fecha limite, y mandarles un mensaje. El proceso de guardar las tareas es similar al de eventos, solo que en vez de guardarse en drive, se guardan en SQL. Esta implementado en task_worker.sql

utils.js
Son funciones que utilizan las distintas partes del bot, ya sea para leer archivos o hacer consultas de sql.




El sistema de archivos actualmente genera una carpeta por usuario, y le genera 2 archivos
history.js:
{
"senderId": "5492983409001",
"firstMessage": true,
"events": [],
"tasks": []
}
Guarda la ID de wpp del usuario, si esta en el estado de "primer mensaje", que identifica a aquellos que nunca se comunicaron con el bot antes, y los eventos y tareas que esten esperando ser registradas a Drive o SQL

userdata.js:
{
"status": "new",
"name": "",
"dni": "",
"email": "",
"event": {},
"task": {},
"pending_messages": []
}

Guarda el estado del usuario, sus datos personales, y los mensajes que el bot tenga que mandarle. Este ultimo es por ejemplo cuando se generan varios documentos que se tienen que mandar al coordinador del sistema, se guardan aca los mensajes con los links al drive para que le lleguen al coordinador eventualmente.