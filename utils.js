const fs = require("fs");
const util = require("util")

class Utils{


    baseFilePath(senderId) {
        return `./users/${senderId}`;
    }

    historyFilePath(senderId) {
        return `./users/${senderId}/history.json`;
    }

    userDataFilePath(senderId) {
        return `./users/${senderId}/userdata.json`;
    }

    createFolder(senderId){
        try {
            fs.mkdirSync(this.baseFilePath(senderId));
            console.log("Folder created for sender:", senderId);
        } catch (err) {
            console.error("Error creating folder:", err);
            // Handle the error appropriately
        }
    }

    readHistory(sender){
        let senderId = sender.split("@")[0];
        try{
            return JSON.parse(fs.readFileSync(this.historyFilePath(senderId), "utf8"));
        }
        catch (err) {
            try {
                let history = {
                    senderId: senderId,
                    firstMessage: true,
                    events: [],
                    tasks: [],
                }
                fs.writeFileSync(this.historyFilePath(senderId), `${JSON.stringify(history)}`);
                console.log("Message history file created for sender:", senderId);
                return history; // Initialize history to an empty object
            } catch (writeError) {
                console.error("Error creating message history file:", writeError);
                // Handle the error appropriately
                return -1;
            }
        }
    }

    saveHistory(sender, history){
        let senderId = sender.split("@")[0];
        try {
            fs.writeFileSync(this.historyFilePath(senderId), `${JSON.stringify(history)}`);
            //console.log("Message history file updated for sender:", senderId);
        } catch (err) {
            console.error("Error writing message history file:", err);
            // Handle the error appropriately
        }
    }


    readUserdata(sender){
        let senderId = sender.split("@")[0];
        try{
            return JSON.parse(fs.readFileSync(this.userDataFilePath(senderId), "utf8"));
        }
        catch (err) {
            try{
                let userdata = {
                    "status": "new",
                    "name": "",
                    "dni": "",
                    "email": "",
                    "event": {},
                    "task": {},
                    "pending_messages": []
                }
                fs.writeFileSync(this.userDataFilePath(senderId), `${JSON.stringify(userdata)}`);
                console.log("User data file created for sender:", senderId);
                return userdata; // Initialize userdata to an empty object

            } catch(writeError){
                console.error("Error creating user data file:", writeError);
                // Handle the error appropriately
                return -1;
            }
        }
    }

    saveUserdata(sender, userdata){
        let senderId = sender.split("@")[0];
        try {
            fs.writeFileSync(this.userDataFilePath(senderId), `${JSON.stringify(userdata)}`);
            console.log("User data file updated for sender:", senderId);
        } catch (err) {
            console.error("Error writing user data file:", err);
            // Handle the error appropriately
        }
    }

    updateUserData(sender, field, value){
        let userdata = this.readUserdata(sender);
        userdata[field] = value;
        this.saveUserdata(sender, userdata);

    }

    async getEmployeeByNumber(number, db) {
        try {
            const [results] = await db.execute(`SELECT * FROM empleados WHERE telefono = ?`, [number]);
            return results[0];
        } catch (error) {
            throw error;
        }
    }


    async getCompanyByEmployeeId(id, db) {
        try {
            const [results] = await db.execute(`
            SELECT * 
            FROM empresas 
            WHERE idempresa = (
                SELECT idempresa 
                FROM empleados_x_empresas 
                WHERE idempleado = ?
            )`, [id]);
            return results[0];
        } catch (error) {
            throw error;
        }
    }

    async getCoordinatorByCompanyId(id, db) {
        try {
            const [results] = await db.execute(`
            SELECT * 
            FROM empleados 
            WHERE idempleado = (
                SELECT idcoordinador 
                FROM empresas 
                WHERE idempresa = ?
            )`, [id]);
            return results[0];
        } catch (error) {
            throw error;
        }
    }


    async getEmployees(db) {
        try {
            const [results] = await db.execute(`SELECT * FROM empleados`);
            return results;
        } catch (error) {
            throw error;
        }
    }


    async getEmployeeById(id, db) {
        try {
            const [results] = await db.execute(`SELECT * FROM empleados WHERE idempleado = ?`, [id]);
            return results[0];
        } catch (error) {
            throw error;
        }
    }


    async getEmployeesByName(name, last_name, db) {
        try {
            let query = `SELECT * FROM empleados WHERE nombre = ?`;
            const values = [name];

            if (last_name && last_name !== "" && last_name !== null && last_name !== undefined) {
                query += ` AND apellido = ?`;
                values.push(last_name);
            }

            const [results] = await db.execute(query, values);
            return results;
        } catch (error) {
            throw error;
        }
    }


    async addTask(task, db) {
        let task_to_add = {
            descripcion: task.description,
            fecha_solicitud: task.request_date,
            fecha_limite: task.deadline,
            estado: "pendiente",
            idsupervisor: null,
            idempresa: null,
            idempleado: null
        };

        try {
            console.log('Adding task:', task);

            const supervisorEmployee = await this.getEmployeeByNumber(task.supervisor, db);
            task_to_add.idsupervisor = supervisorEmployee.idempleado;
            console.log('Supervisor ID fetched:', task_to_add.idsupervisor);

            const employee = await this.getEmployeeByNumber(task.employee, db);
            console.log('Employee fetched:', employee, task.employee);
            task_to_add.idempleado = employee.idempleado;
            console.log('Employee ID fetched:', task_to_add.idempleado);

            const query = `INSERT INTO tareas (idsupervisor, idempleado, descripcion, fecha_solicitud, fecha_limite, estado) 
                       VALUES (?, ?, ?, ?, ?, ?)`;
            const values = [
                task_to_add.idsupervisor,
                task_to_add.idempleado,
                task_to_add.descripcion,
                task_to_add.fecha_solicitud,
                task_to_add.fecha_limite,
                task_to_add.estado
            ];

            const [result] = await db.execute(query, values);
            console.log('Task successfully added to database:', result);

            console.log('Task successfully processed:', task);
        } catch (error) {
            console.error('Error in addTask:', error);
            throw error;
        }
    }

    async getCompanies(db) {
        try {
            const [results] = await db.execute(`SELECT * FROM empresas`);
            return results;
        } catch (error) {
            throw error;
        }
    }

    async getPendingTasksWithinTimeframe(hours, db) {

        try {
            const [results] = await db.execute(`
            SELECT * 
            FROM tareas 
            WHERE fecha_limite >= NOW() 
            AND fecha_limite < DATE_ADD(NOW(), INTERVAL ? HOUR)
            AND recordatorio_enviado = 0`, [hours]);
            return results;
        }
        catch (error) {
            throw error;
        }

    }

    async updateTaskReminderStatus(idtask, db) {
        try {
            const query = `UPDATE tareas SET recordatorio_enviado = 1 WHERE idtareas = ?`;
            const values = [idtask];

            const [result] = await db.execute(query, values);

            if (result.affectedRows > 0) {
                console.log(`Task reminder status updated for task ID ${task.idtareas}`);
            } else {
                console.warn(`Task with ID ${task.idtareas} not found or already updated.`);
            }
        } catch (error) {
            console.error('Error updating task reminder status:', error);
            throw error; // Rethrow the error to handle it further up the call stack
        }
    }


    verifyDeadlineString(deadline) {
        if(deadline.toLowerCase() === "hoy"){
            deadline = new Date().toISOString().split('T')[0];
        }
        if (deadline.toLowerCase() === "mañana") {
            let tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            deadline = tomorrow.toISOString().split('T')[0];
        }
        else if (deadline.toLowerCase() === "pasado mañana") {
            let tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 2);
            deadline = tomorrow.toISOString().split('T')[0];
        }
        else if (deadline.toLowerCase() === "la próxima semana" || deadline.toLowerCase() === "la semana que viene") {
            let nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            deadline = nextWeek.toISOString().split('T')[0];
        }
        else if (deadline.toLowerCase().startsWith("el proximo")) {
            let nextDay = new Date();
            let days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
            let day = deadline.split(" ")[1];
            let dayIndex = days.indexOf(day);
            let today = nextDay.getDay();
            let diff = dayIndex - today;
            if (diff < 0) diff += 7;
            nextDay.setDate(nextDay.getDate() + diff);
            deadline = nextDay.toISOString().split('T')[0];
        }
        else if (deadline.toLowerCase().startsWith("el")) {
            let nextDay = new Date();
            let days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
            let day = deadline.split(" ")[1];
            let dayIndex = days.indexOf(day);
            let today = nextDay.getDay();
            let diff = dayIndex - today;
            if (diff <= 0) diff += 7;
            nextDay.setDate(nextDay.getDate() + diff);
            deadline = nextDay.toISOString().split('T')[0];
        }
        // same as before but without the "el"
            else if(deadline.toLowerCase().startsWith("lunes") || deadline.toLowerCase().startsWith("martes") || deadline.toLowerCase().startsWith("miercoles") ||
            deadline.toLowerCase().startsWith("jueves") || deadline.toLowerCase().startsWith("viernes") || deadline.toLowerCase().startsWith("sabado") ||
            deadline.toLowerCase().startsWith("domingo")){
            let nextDay = new Date();
            let days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
            let day = deadline.split(" ")[0];
            let dayIndex = days.indexOf(day);
            let today = nextDay.getDay();
            let diff = dayIndex - today;
            if (diff < 0) diff += 7;
            nextDay.setDate(nextDay.getDate() + diff);
            deadline = nextDay.toISOString().split('T')[0];
        }
        else {
            let date = new Date(deadline);
            if (date.toString() === "Invalid Date") {
                deadline = null;
            }
            else {
                deadline = date.toISOString().split('T')[0];
            }
        }
        return deadline;
    }


}



module.exports = Utils;