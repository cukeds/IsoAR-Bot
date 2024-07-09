// Contains the default configuration for Bot & Plugins
// Any attribute not given in the configuration will take its default value

const botConfig = {
  authFolder: "auth",
  selfReply: false,
  logMessages: true,
};


let events = ["inc", "mej", "obs"];
let help_message = "Hola! Soy el bot de la empresa. Mis comandos son:\n\n";
help_message += "inc: Para reportar una inconformidad 🚨\n";
help_message += "mej: Para reportar una mejora 📈\n";
help_message += "obs: Para reportar una observación 🔎\n";
help_message += "tarea: Para registrar una tarea o actividad 📝\n";
const pluginsConfig = {
  newMessage: {
    events: events,
    help_message: help_message,
  }
};




module.exports = { botConfig, pluginsConfig };
