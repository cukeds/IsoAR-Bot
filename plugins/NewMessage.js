const fs = require("fs");
const Utils = require("../utils");

class EventTemplate {
    tipo;
    origen;
    descripcion;
    causa;
    documentacion;
    acciones_inmediatas;

    constructor() {
        this.tipo = "";
        this.origen = "";
        this.descripcion = "";
        this.causa = "";
        this.documentacion = "";
        this.acciones_inmediatas = "";
    }
}

class TaskTemplate {
    description;
    deadline;
    employee;

    constructor() {
        this.description = "";
        this.deadline = "";
        this.employee = "";
    }
}

class NewMessage {
    #getText;
    #sendMessage;
    #events;
    #help_message;
    #utils;

    constructor(config) {
        this.#events = config.events || [];
        this.#help_message = config.help_message || "";
        this.#utils = new Utils();
    }

    // Inicializa el plugin con el socket, la función getText y la función sendMessage
    init(socket, getText, sendMessage) {
        this.#getText = getText;
        this.#sendMessage = sendMessage;
    }

    process(key, message) {
        if (this.#getText(key, message).startsWith("!")) return;
        let senderId = key.remoteJid.split("@")[0];
        try {
            fs.mkdirSync(this.#utils.baseFilePath(senderId), { recursive: true });
            console.log("Message history directory created.");
        } catch (mkdirError) {
            console.error("Error creating message history directory:", mkdirError);
            // Handle the error appropriately
        }

        let history = this.#utils.readHistory(key.remoteJid);
        if(history.firstMessage){
            this.handleFirstTimeMessage(key, history, message);
        }
        else{
            this.handlePreviousChatMessage(key, history, message);
        }
    }

    handleFirstTimeMessage(key, history, message) {

        history.firstMessage = false;
        this.#utils.saveHistory(key.remoteJid, history);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `¡Hola! Soy tu asistente virtual. Por favor indica tu nombre y apellido`,
            },

        );
        this.#utils.updateUserData(key.remoteJid, "status", "waiting_name");
    }


    handlePreviousChatMessage(key, history, message) {
        let userData = this.#utils.readUserdata(key.remoteJid);

        switch(userData["status"]) {
            case "waiting_name":
                this.handleNameMessage(key, history, message);
                break;
            case "waiting_dni":
                this.handleDniMessage(key, history, message);
                break;
            case "waiting_email":
                this.handleEmailMessage(key, history, message);
                break;
            case "idle":
                this.handleIdleMessage(key, history, message);
                break;
            case "task":
            case "task_description":
            case "task_deadline":
            case "task_employee":
                this.handleTaskMessage(key, history, message);
                break;
            case "event":
            case "event_origen":
            case "event_descripcion":
            case "event_causa":
            case "event_documentacion":
            case "event_acciones_inmediatas":
                this.handleEventMessage(key, history, message);
                break;
            default:
                this.handleDefaultMessage(key, history, message);
                break;
        }

    }


    handleNameMessage(key, history, message) {
        // Guarda el nombre en userdata, actualiza el estado y envía mensaje de confirmación
        let name = this.#getText(key, message);
        this.#utils.updateUserData(key.remoteJid, "name", name);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Gracias ${name}. Por favor indica tu DNI`,
            },
        );
        this.#utils.updateUserData(key.remoteJid, "status", "waiting_dni")
    }

    handleDniMessage(key, history, message) {
        // Guarda el DNI en userdata, actualiza el estado y envía mensaje de confirmación

        let dni = this.#getText(key, message);
        this.#utils.updateUserData(key.remoteJid, "dni", dni);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Gracias. Por favor indica tu email`,
            },
        );

        this.#utils.updateUserData(key.remoteJid, "status", "waiting_email")
    }

    handleEmailMessage(key, history, message) {
        // Guarda el email en userdata, actualiza el estado y envía mensaje de confirmación

        let email = this.#getText(key, message);
        this.#utils.updateUserData(key.remoteJid, "email", email);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Gracias. Hemos registrado tus datos. En breve nos pondremos en contacto contigo`,
            },
        );

        this.#utils.updateUserData(key.remoteJid, "status", "idle")
    }

    handleDefaultMessage(key, history, message) {
        this.#sendMessage(
            key.remoteJid,
            {
                text: `No entiendo tu mensaje. Por favor intenta de nuevo`,
            },
        );
    }

    handleIdleMessage(key, history, message) {
        // Read the message and check if it's a command
        let text = this.#getText(key, message);

        if (this.#events.includes(text.toLowerCase())) {
            // set the status to "event"
            this.#utils.updateUserData(key.remoteJid, "status", "event");
            // call the event handler
            this.handleEventMessage(key, history, message);
            return;
        }

        if (text.toLowerCase() === "tarea") {
                    // set the status to "task"
            this.#utils.updateUserData(key.remoteJid, "status", "task");
            // call the task handler
            this.handleTaskMessage(key, history, message);
            return;
        }


        if (text.toLowerCase() === "ayuda") {
            this.#sendMessage(
                key.remoteJid,
                {
                    text: this.#help_message,
                },
            );
            return;
        }

        this.#sendMessage(
            key.remoteJid,
            {
                text: `Lo lamento, no entiendo tu mensaje. Por favor intenta de nuevo. Si necesitas ayuda escribe "ayuda"`,
            },
        );
    }

    handleEventMessage(key, history, message) {
        // check current status
        let userData = this.#utils.readUserdata(key.remoteJid);
        switch(userData["status"]) {
            case "event":
                let event = new EventTemplate();
                event.tipo = this.#getText(key, message).toLowerCase();
                let response = `Por favor indique el origen del evento.`;
                if(event.tipo === "inc"){
                    response = `Por favor indique el origen de la inconformidad. (Queja Cliente, Auditoria, Interno)`;
                }
                else if(event.tipo === "mej"){
                    response = `Por favor indique el origen de la mejora. (Trabajo Diario, Sugerencia Externa, Al verlo en otro lugar)`;
                }
                this.#sendMessage(
                    key.remoteJid,
                    {
                        text: response,
                    },
                );
                this.#utils.updateUserData(key.remoteJid, "status", "event_origen");
                this.#utils.updateUserData(key.remoteJid, "event", event);
                break;
            case "event_origen":
                this.handleOrigenMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["event"]);
                break;
            case "event_descripcion":
                this.handleDescripcionMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["event"]);
                break;
            case "event_causa":
                this.handleCausaMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["event"]);
                break;
            case "event_documentacion":
                this.handleDocumentacionMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["event"]);
                break;
            case "event_acciones_inmediatas":
                this.handleAccionesInmediatasMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["event"]);
                break;
            default:
                this.handleIdleMessage(key, history, message);
                break;
        }
    }

    handleOrigenMessage(key, history, message, event) {
        let origen = this.#getText(key, message);
        // Verify that the origen is valid
        if (["queja cliente", "auditoria", "interno", "trabajo diario", "sugerencia externa", "al verlo en otro lugar"].includes(origen.toLowerCase())) {
            event.origen = origen;
            this.#utils.updateUserData(key.remoteJid, "status", "event_descripcion");
            let response = "Por favor indique la descripción del evento."
            if(event.tipo === "inc"){
                response = "Explicar lo más claro posible cual es el incumplimiento, con fechas y hora de ocurrencia, si ha tenido un costo, o significó una pérdida."
            }
            if(event.tipo === "mej"){
                response = "Explicar detalles de la mejora, aplicaciones, si es posible estimación de costo y tiempo y que mejorará."
            }
            this.#sendMessage(
                key.remoteJid,
                {
                    text: response,
                },
            );
            this.#utils.updateUserData(key.remoteJid, "event", event);
        } else {
            this.#sendMessage(
                key.remoteJid,
                {
                    text: `El origen del evento no es válido. Por favor indique el origen correctamente.`,
                },
            );
        }
    }

    handleDescripcionMessage(key, history, message, event) {
        let descripcion = this.#getText(key, message);
        event.descripcion = descripcion;
        this.#utils.updateUserData(key.remoteJid, "status", "event_causa");
        let response = "Por favor indique la causa del evento."
        if(event.tipo === "inc"){
            response = "Indicar la causa de la inconformidad. (Como sucedio, datos ampliatorios que ayuden)"
        }
        if(event.tipo === "mej"){
            response = "Indicar la causa raíz de la mejora.  (Como se le ocurrió, datos ampliatorios que ayuden)"
        }
        this.#sendMessage(
            key.remoteJid,
            {
                text: response,
            },
        );
        this.#utils.updateUserData(key.remoteJid, "event", event);
    }

    handleCausaMessage(key, history, message, event) {
        let causa = this.#getText(key, message);
        event.causa = causa;
        this.#utils.updateUserData(key.remoteJid, "status", "event_documentacion");
        this.#utils.updateUserData(key.remoteJid, "event", event);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Por favor indique la documentación del evento.`,
            },
        );
    }

    handleDocumentacionMessage(key, history, message, event) {
        let documentacion = this.#getText(key, message);
        event.documentacion = documentacion;
        this.#utils.updateUserData(key.remoteJid, "status", "event_acciones_inmediatas");
        this.#utils.updateUserData(key.remoteJid, "event", event);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Por favor indique las acciones inmediatas del evento.`,
            },
        );
    }

    handleAccionesInmediatasMessage(key, history, message, event) {
        let acciones_inmediatas = this.#getText(key, message);
        event.acciones_inmediatas = acciones_inmediatas;
        this.#utils.updateUserData(key.remoteJid, "status", "idle");
        this.#utils.updateUserData(key.remoteJid, "event", event);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Gracias. Hemos registrado el evento. En breve nos pondremos en contacto contigo`,
            },
        );
        // Save the event to the history
        history.events.push(event);
        this.#utils.saveHistory(key.remoteJid, history);
    }

    handleTaskMessage(key, history, message) {
        // read user data
        let userData = this.#utils.readUserdata(key.remoteJid);
        // check current status
        switch (userData["status"]) {
            case "task":
                let task = new TaskTemplate();
                let response = `Por favor indique la descripción de la tarea.`;
                this.#sendMessage(
                    key.remoteJid,
                    {
                        text: response,
                    },
                );
                this.#utils.updateUserData(key.remoteJid, "status", "task_description");
                this.#utils.updateUserData(key.remoteJid, "task", task);
                break;
            case "task_description":
                this.handleTaskDescriptionMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["task"]);
                break;
            case "task_deadline":
                this.handleTaskDateMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["task"]);
                break;
            case "task_employee":
                this.handleTaskEmployeeMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["task"]);
                break;
            default:
                this.handleIdleMessage(key, history, message);
                break;
        }
    }

    handleTaskDescriptionMessage(key, history, message, task) {
        let description = this.#getText(key, message);
        task.description = description;
        this.#utils.updateUserData(key.remoteJid, "status", "task_employee");
        this.#utils.updateUserData(key.remoteJid, "task", task);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Por favor indique el empleado asignado a la tarea.`,
            },
        );
    }

    handleTaskEmployeeMessage(key, history, message, task) {
        let employee = this.#getText(key, message);
        task.employee = employee;
        this.#utils.updateUserData(key.remoteJid, "status", "task_deadline");
        this.#utils.updateUserData(key.remoteJid, "task", task);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Por favor indique la fecha y hora de la tarea. Formato: 2020-01-01 10:10:10`,
            },
        );
    }

    handleTaskDateMessage(key, history, message, task) {
        let deadline = this.#getText(key, message);
        task.deadline = deadline;
        // Validate datetime to be SQL format 2020-01-01 10:10:10
        let regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        if (!regex.test(deadline)) {
            this.#sendMessage(
                key.remoteJid,
                {
                    text: `El formato de la fecha y hora no es válido. Por favor indique la fecha y hora en el formato correcto.`,
                },
            );
            return;
        }

        // date in the past
        if (new Date(deadline) < new Date()) {
            this.#sendMessage(
                key.remoteJid,
                {
                    text: `La fecha y hora de la tarea no puede ser en el pasado. Por favor indique la fecha y hora en el futuro.`,
                },
            );
            return;
        }


        this.#utils.updateUserData(key.remoteJid, "status", "idle");
        this.#utils.updateUserData(key.remoteJid, "task", task);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Gracias. Hemos registrado la tarea. En breve nos pondremos en contacto contigo`,
            },
        );
        // Save the task to the history
        history.tasks.push(task);
        this.#utils.saveHistory(key.remoteJid, history);
    }



}

module.exports = NewMessage;
