const fs = require("fs");
const vCardParser = require('vcard-parser');
const Utils = require("../utils");
const config = require("../config");

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
    employees;

    constructor() {
        this.description = "";
        this.deadline = "";
        this.employees = [];
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
        if (key.participant) {
            key.group = key.remoteJid;
            key.remoteJid = key.participant;
        }
        if (this.#getText(key, message).startsWith("!")) return;
        let senderId = key.remoteJid.split("@")[0];
        try {
            fs.mkdirSync(this.#utils.baseFilePath(senderId), {recursive: true});
            console.log("Message history directory created.");
        } catch (mkdirError) {
            console.error("Error creating message history directory:", mkdirError);
            // Handle the error appropriately
        }

        let history = this.#utils.readHistory(key.remoteJid);
        if (history.firstMessage) {
            this.handleFirstTimeMessage(key, history, message);
        } else {
            this.handlePreviousChatMessage(key, history, message);
        }
    }

    extractWaidFromVcard(vcard){
        let parsed = vCardParser.parse(vcard);
        let telField = parsed.tel.find(t => t.meta?.waid);
        if(telField){
            return telField.meta.waid[0];
        }else{
            return null;
        }
    }

    handleFirstTimeMessage(key, history, message) {

        history.firstMessage = false;
        this.#utils.saveHistory(key.remoteJid, history);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `¡Hola! Soy tu asistente virtual. Escribe ayuda para ver los comandos disponibles.`,
            },
        );
        //this.#utils.updateUserData(key.remoteJid, "status", "waiting_name");
    }


    handlePreviousChatMessage(key, history, message) {
        let userData = this.#utils.readUserdata(key.remoteJid);
        switch (userData["status"]) {
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
            case "meeting":
            case "meeting_description":
            case "meeting_date":
            case "meeting_time":
            case "meeting_participants":
                this.handleMeetingMessage(key, history, message);
                break;
            case "group_meeting":
            case "group_meeting_date":
                this.handleGroupMeetingMessage(key, history, message);
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

    getEmployeesFromMessage(key, message){
        let employees;
        if(message.contactsArrayMessage){
            // handle multiple contacts
            employees = message.contactsArrayMessage.contacts.map(contact => this.extractWaidFromVcard(contact.vcard));
            // if any of the contacts is null, return
            if(employees.some(e => e === null)){
                this.#sendMessage(
                    key.remoteJid,
                    {
                        text: `No se ha podido obtener uno de los contactos. Por favor intenta de nuevo.`,
                    },
                );
                return;
            }
        }
        if(message.contactMessage){
            // handle single contact
            employees = [this.extractWaidFromVcard(message.contactMessage.vcard)];
            if(employees[0] === null){
                this.#sendMessage(
                    key.remoteJid,
                    {
                        text: `No se ha podido obtener el contacto. Por favor intenta de nuevo.`,
                    },
                );
                return;
            }

        }
        if(message.conversation){
            // handle text
            if(this.#getText(key, message).toLowerCase().includes("yo")){
                employees = [key.remoteJid.split("@")[0]];
            }
            else{
                // error
                this.#sendMessage(
                    key.remoteJid,
                    {
                        text: `No entiendo a quien quieres asignar la tarea. Por favor intenta de nuevo.`,
                    },
                );
            }
        }
        return employees;
    }

    checkAndUpdateStatus(check, key, history, message) {
        let text = this.#getText(key, message);
        if (text.toLowerCase().includes(check.str)) {
            // set the status
            this.#utils.updateUserData(key.remoteJid, "status", check.status);
            return true;
        }
        return false;
    }

    checkEvents(key, history, message) {
        let text = this.#getText(key, message);
        if (this.#events.includes(text.toLowerCase())) {
            // set the status to "event"
            this.#utils.updateUserData(key.remoteJid, "status", "event");
            // call the event handler
            this.handleEventMessage(key, history, message);
            return true;
        }
        return false;
    }

    checkAll(checks, key, history, message) {
        let checked = false;
        checks.forEach(check => {
            if (this.checkAndUpdateStatus(check, key, history, message)) {
                checked = true;
                check.callback(key, history, message);
            }
        });
        return checked;
    }

    handleIdleMessage(key, history, message) {
        // Read the message and check if it's a command

        if (key.group) {
            // group checks
            let group_checks = [
                {str: "tarea bot", status: "task", callback: this.handleTaskMessage.bind(this)},
                {str: "reunion bot", status: "meeting", callback: this.handleMeetingMessage.bind(this)},
                {str: "reunión bot", status: "meeting", callback: this.handleMeetingMessage.bind(this)},
                {str: `@${config.botConfig.botNumber}`, status: "group_meeting", callback: this.handleGroupMeetingMessage.bind(this)}
            ]

            if (this.checkAll(group_checks, key, history, message)) return;
        } else {
            // private checks
            let private_checks = [
                {str: "tarea", status: "task", callback: this.handleTaskMessage.bind(this)},
                {str: "reunion", status: "meeting", callback: this.handleMeetingMessage.bind(this)},
                {str: "reunión", status: "meeting", callback: this.handleMeetingMessage.bind(this)},
            ]

            if (this.checkEvents(key, history, message)) return;
            if (this.checkAll(private_checks, key, history, message)) return;

            if (this.#getText(key, message).toLowerCase() === "ayuda") {
                this.#sendMessage(
                    key.remoteJid,
                    {
                        text: this.#help_message,
                    },
                );
                return;
            }
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
        switch (userData["status"]) {
            case "event":
                let event = new EventTemplate();
                event.tipo = this.#getText(key, message).toLowerCase();
                let response = `Por favor indique el origen del evento.`;
                if (event.tipo === "inc") {
                    response = `Por favor indique el origen de la inconformidad. (Queja Cliente, Auditoria, Interno)`;
                } else if (event.tipo === "mej") {
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
        if (origen.length < 3) return;

        // Verify that the origen is valid
        if (["queja cliente", "auditoria", "interno", "trabajo diario", "sugerencia externa", "al verlo en otro lugar"].includes(origen.toLowerCase())) {
            event.origen = origen;
            this.#utils.updateUserData(key.remoteJid, "status", "event_descripcion");
            let response = "Por favor indique la descripción del evento."
            if (event.tipo === "inc") {
                response = "Explicar lo más claro posible cual es el incumplimiento, con fechas y hora de ocurrencia, si ha tenido un costo, o significó una pérdida."
            }
            if (event.tipo === "mej") {
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
        if (descripcion.length < 3) return;

        event.descripcion = descripcion;
        this.#utils.updateUserData(key.remoteJid, "status", "event_causa");
        let response = "Por favor indique la causa del evento."
        if (event.tipo === "inc") {
            response = "Indicar la causa de la inconformidad. (Como sucedio, datos ampliatorios que ayuden)"
        }
        if (event.tipo === "mej") {
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
        if (causa.length < 3) return;
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
        if (documentacion.length < 3) return;
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
        if (key.group) {
            this.#sendMessage(
                key.group,
                {
                    text: `Para registrar una tarea, por favor envíe un mensaje privado al bot con el comando "tarea"`,
                },
            );
            this.#utils.updateUserData(key.remoteJid, "status", "idle");
            return;
        }

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
        if (description.length < 3) return;
        task.description = description;
        this.#utils.updateUserData(key.remoteJid, "status", "task_employee");
        this.#utils.updateUserData(key.remoteJid, "task", task);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Por favor seleccione los contacto a los que desea asignar la tarea usando el boton +. Cuando haya terminado, presione el boton de enviar.`,
            },
        );
    }

    handleTaskEmployeeMessage(key, history, message, task) {
        task.employees = this.getEmployeesFromMessage(key, message);
        this.#utils.updateUserData(key.remoteJid, "status", "task_deadline");
        this.#utils.updateUserData(key.remoteJid, "task", task);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Por favor indique la fecha de la tarea. Las opciones son: \n`
                    + `⚫ Hoy, Mañana, Pasado mañana, La próxima semana, La semana que viene, \n`
                    + `⚫ El próximo lunes/martes/etc, \n`
                    + `⚫ El lunes/martes/etc que viene`,

            },
        );
    }

    handleTaskDateMessage(key, history, message, task) {
        let deadline = this.#getText(key, message);
        if (deadline.length < 3) return;
        // TODO change 10:00:00 to start of the work day from company settings
        let workday_start = "10:00:00";
        let workday_end = "18:00:00";

        // cases "mañana", "pasado mañana", "la próxima semana", "la semana que viene", "el proximo lunes/martes/miercoles/jueves/viernes/sabado/domingo", "el lunes/martes/miercoles/jueves/viernes/sabado/domingo que viene"

        task.deadline = this.#utils.verifyDeadlineString(deadline);
        if (task.deadline === null) {
            this.#sendMessage(
                key.remoteJid,
                {
                    text: `La fecha de la tarea no es válida. Por favor indique la fecha de la tarea nuevamente.`,
                },
            );
            return;
        }

        if (deadline.toLowerCase() === "hoy") {
            task.deadline += " " + workday_end;
        } else {
            task.deadline += " " + workday_start;
        }
        // Validate datetime to be SQL format 2020-01-01 10:10:10
        let regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        if (!regex.test(task.deadline)) {
            this.#sendMessage(
                key.remoteJid,
                {
                    text: `El formato de la fecha y hora no es válido. Por favor indique la fecha y hora en el formato correcto.`,
                },
            );
            return;
        }

        // date in the past
        if (new Date(task.deadline) < new Date()) {
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
        for(let employee of task.employees){
            let to_save = new TaskTemplate();
            to_save.description = task.description;
            to_save.deadline = task.deadline;
            to_save.employee = employee;

            console.log("Saving task to history");
            history.tasks.push(to_save);
        }
        this.#utils.saveHistory(key.remoteJid, history);
    }

    handleMeetingMessage(key, history, message) {
        // read user data
        let userData = this.#utils.readUserdata(key.remoteJid);
        if (key.group) {
            this.#sendMessage(
                key.group,
                {
                    text: `Para registrar una reunion, por favor envíe un mensaje privado al bot con el comando "reunion"`,
                },
            );
            this.#utils.updateUserData(key.remoteJid, "status", "idle");
            return;
        }

        // check current status
        switch (userData["status"]) {
            case "meeting":
                let meeting = new TaskTemplate();
                let response = `Por favor indique un nombre para la reunión.`;
                this.#sendMessage(
                    key.remoteJid,
                    {
                        text: response,
                    },
                );
                this.#utils.updateUserData(key.remoteJid, "status", "meeting_description");
                this.#utils.updateUserData(key.remoteJid, "task", meeting);
                break;
            case "meeting_description":
                this.handleMeetingDescriptionMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["task"]);
                break;
            case "meeting_date":
                this.handleMeetingDateMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["task"]);
                break;
            case "meeting_time":
                this.handleMeetingTimeMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["task"]);
                break;
            case "meeting_participants":
                this.handleMeetingParticipantsMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["task"]);
                break;
            default:
                this.handleIdleMessage(key, history, message);
                break;
        }
    }

    handleMeetingDescriptionMessage(key, history, message, meeting) {
        let description = this.#getText(key, message);
        if (description.length < 3) return;
        meeting.description = `Reunion: ${description}`;
        this.#utils.updateUserData(key.remoteJid, "status", "meeting_date");
        this.#utils.updateUserData(key.remoteJid, "task", meeting);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Por favor indique la fecha de la reunión. Las opciones son: \n`
                    + `⚫ Hoy, Mañana, Pasado mañana, La próxima semana, La semana que viene, \n`
                    + `⚫ El próximo lunes/martes/etc, \n`
                    + `⚫ El lunes/martes/etc que viene`,

            },
        );
    }

    handleMeetingDateMessage(key, history, message, meeting) {
        let date = this.#getText(key, message);
        if (date.length < 3) return;
        let deadline = this.#utils.verifyDeadlineString(date);
        if (deadline === null) {
            this.#sendMessage(
                key.remoteJid,
                {
                    text: `La fecha de la reunión no es válida. Por favor indique la fecha de la reunión nuevamente.`,
                },
            );
            return;
        }

        meeting.deadline = deadline;
        this.#utils.updateUserData(key.remoteJid, "status", "meeting_time");
        this.#utils.updateUserData(key.remoteJid, "task", meeting);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Por favor indique la hora de la reunion (HH:MM)`,
            },
        );
    }

    handleMeetingTimeMessage(key, history, message, meeting) {
        let time = this.#getText(key, message);
        if (time.length < 3) return;

        // validate time
        let regex = /^\d{2}:\d{2}$/;
        if (!regex.test(time)) {
            this.#sendMessage(
                key.remoteJid,
                {
                    text: `El formato de la hora no es válido. Por favor indique la hora en el formato HH:MM, por ejemplo, 10:30.`,
            },
        );
            return;
        }

        meeting.deadline = `${meeting.deadline} ${time}:00`;

        this.#utils.updateUserData(key.remoteJid, "status", "meeting_participants");
        this.#utils.updateUserData(key.remoteJid, "task", meeting);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Por favor seleccione los contacto a los que desea asignar la tarea usando el boton +. Cuando haya terminado, presione el boton de enviar.`,
            },
        );
    }

    handleMeetingParticipantsMessage(key, history, message, meeting) {

        meeting.employees = this.getEmployeesFromMessage(key, message);
        meeting.employees.push(key.remoteJid.split("@")[0]);

        this.#utils.updateUserData(key.remoteJid, "status", "idle");
        this.#utils.updateUserData(key.remoteJid, "task", meeting);
        this.#sendMessage(
            key.remoteJid,
            {
                text: `Gracias. Hemos registrado la reunión. En breve nos pondremos en contacto contigo`,
            },
        );
        // Save the meeting to the history
        for(let employee of meeting.employees){
            let to_save = new TaskTemplate();
            to_save.description = meeting.description;
            to_save.deadline = meeting.deadline;
            to_save.employee = employee;

            history.tasks.push(to_save);
        }
        this.#utils.saveHistory(key.remoteJid, history);
    }

    handleGroupMeetingMessage(key, history, message) {
        // read user data
        let userData = this.#utils.readUserdata(key.remoteJid);
        let meeting = new TaskTemplate();
        let response = "";
        let members = false;

        // check current status
        switch (userData["status"]) {
            case "group_meeting":
                this.#getText(key, message).split("@").forEach((part, index) => {
                    part = part.trim();
                    if(part !== config.botConfig.botNumber && part !== ""){
                        console.log("Adding participant", part);
                        meeting.employees.push(part);
                    }
                });
                meeting.employees.push(key.remoteJid.split("@")[0]);

                response = `Por favor indique dia y hora para la reunión.`;
                this.#sendMessage(
                    key.group,
                    {
                        text: response,
                    },
                );
                this.#utils.updateUserData(key.remoteJid, "status", "group_meeting_date");
                this.#utils.updateUserData(key.remoteJid, "task", meeting);
                break;
            case "group_meeting_date":
                this.handleGroupMeetingDateMessage(key, history, message, this.#utils.readUserdata(key.remoteJid)["task"]);
                break;
            default:
                this.handleIdleMessage(key, history, message);
                break;
        }
    }

    handleGroupMeetingDateMessage(key, history, message, meeting) {
        let datetime = this.#getText(key, message);
        let time = datetime.split(" ")[1];
        let date = datetime.split(" ")[0];
        if (date.length < 3) return;
        if (time.length < 3) return;
        let deadline = this.#utils.verifyDeadlineString(date);
        if (deadline === null) {
            this.#sendMessage(
                key.group,
                {
                    text: `La fecha de la reunión no es válida. Por favor indique la fecha de la reunión nuevamente.`,
                },
            );
            return;
        }

        meeting.deadline = deadline;

        // validate time
        let regex = /^\d{2}:\d{2}$/;
        if (!regex.test(time)) {
            this.#sendMessage(
                key.group,
                {
                    text: `El formato de la hora no es válido. Por favor indique la hora en el formato HH:MM, por ejemplo, 10:30.`,
                },
            );
            return;
        }

        meeting.deadline = `${meeting.deadline} ${time}:00`;
        this.#utils.updateUserData(key.remoteJid, "status", "idle");
        this.#utils.updateUserData(key.remoteJid, "task", meeting);
        this.#sendMessage(
            key.group,
            {
                text: `Gracias. Hemos registrado la reunión. En breve nos pondremos en contacto contigo`,
            },
        );

        // Save the meeting to the history
        for(let employee of meeting.employees){
            let to_save = new TaskTemplate();
            to_save.description = "Reunion";
            to_save.deadline = meeting.deadline;
            to_save.employee = employee;
            history.tasks.push(to_save);
        }
        this.#utils.saveHistory(key.remoteJid, history);
    }
}

module.exports = NewMessage;
