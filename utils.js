const fs = require("fs");

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
            console.log("Message history file updated for sender:", senderId);
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

    getEmployeeByNumber(number, db){
        return new Promise((resolve, reject) => {
            db.query(`SELECT * FROM empleados WHERE telefono = ${number}`, (err, result) => {
                if(err) reject(err);
                resolve(result[0]);
            });
        });
    }

    getCompanyByEmployeeId(id, db){
        return new Promise((resolve, reject) => {
            db.query(`SELECT * FROM empresas WHERE idempresa = (SELECT idempresa FROM empleados_x_empresas WHERE idempleado = ${id})`, (err, result) => {
                if(err) reject(err);
                resolve(result[0]);
            });
        });
    }

    getCoordinatorByCompanyId(id, db){
        return new Promise((resolve, reject) => {
            db.query(`SELECT * FROM empleados WHERE idempleado = (SELECT idcoordinador FROM empresas WHERE idempresa = ${id})`, (err, result) => {
                if(err) reject(err);
                resolve(result[0]);
            });
        });
    }

    getEmployees(db){
        return new Promise((resolve, reject) => {
            db.query(`SELECT * FROM empleados`, (err, result) => {
                if(err) reject(err);
                resolve(result);
            });
        });
    }

    async addTask(task, db) {
        let task_to_add = {
            descripcion: task.description,
            fecha_solicitud: task.request_date,
            fecha_limite: task.deadline,
            estado: "pendiente",
            idsupervisor: null, // Initialize to null or undefined
            idempresa: null,    // Initialize to null or undefined
            idempleado: null    // Initialize to null or undefined
        };

        try {
            const supervisorEmployee = await this.getEmployeeByNumber(task.supervisor, db);
            task_to_add.idsupervisor = supervisorEmployee.idempleado;

            const employee = await this.getEmployeeByNumber(task.employee, db);
            task_to_add.idempleado = employee.idempleado;

            return new Promise((resolve, reject) => {
                const query = `INSERT INTO tareas (idsupervisor, idempleado, descripcion, fecha_solicitud, fecha_limite, estado) 
                           VALUES (?, ?, ?, ?, ?, ?)`;
                const values = [task_to_add.idsupervisor, task_to_add.idempleado, task_to_add.descripcion,
                    task_to_add.fecha_solicitud, task_to_add.fecha_limite, task_to_add.estado];

                db.query(query, values, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        } catch (error) {
            throw error; // Rethrow the error to handle it further up the call stack
        }
    }

    getCompanies(db) {
        return new Promise((resolve, reject) => {
            db.query(`SELECT * FROM empresas`, (err, result) => {
                if(err) reject(err);
                resolve(result);
            });
        });
    }


}



module.exports = Utils;