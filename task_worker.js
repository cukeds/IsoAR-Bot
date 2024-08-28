const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const {Readable} = require('stream')
const Utils = require('./utils');

class TaskWorker {
    #tasks;
    #utils;
    #wabot;
    #db;

    constructor(wabot, db) {
        this.#tasks = [];
        this.#utils = new Utils();
        this.#wabot = wabot;
        this.#db = db;
    }

    async init() {

        await this.#db.connect();
        while (true) {
            await this.readTasks();
            await this.processTasks();
            await this.processReminders();
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    async readTasks() {
        try {
            const users = await fs.readdir('users');
            for (const user of users) {
                const history = this.#utils.readHistory(user);
                // add sender to events
                history.tasks.forEach((task) => {
                    task.supervisor = history.senderId;
                    task.request_date = new Date().toISOString().split('T')[0];
                });
                this.#tasks.push(...history.tasks);
                history.tasks = [];
                this.#utils.saveHistory(user, history);
            }
        } catch (error) {
            console.error('Error reading tasks:', error);
        }
    }

    async processTasks() {
        try {
            if(this.#tasks.length === 0) return;
            console.log('Processing tasks', this.#tasks.length, this.#tasks);

            // Make a copy of the tasks array to avoid any mutation issues
            const tasksToProcess = [...this.#tasks];

            // Connect to the database

            for (const [index, task] of tasksToProcess.entries()) {
                console.log(`Processing task ${index + 1}/${tasksToProcess.length}:`, task);
                await this.#utils.addTask(task, this.#db);
                console.log(`Task ${index + 1} processed`);
            }

            // Close the database connection

            // Clear the original tasks array after processing
            this.#tasks = [];
            console.log('All tasks processed.');
        } catch (error) {
            console.error('Error processing tasks:', error);
        }
    }



    async processReminders() {

        if(!this.#wabot.isConnected()) return;
        try {
            // Get all pending tasks from the database
            const pendingTasks = await this.#utils.getPendingTasksWithinTimeframe(1, this.#db);

            // Get the current date
            // if the task is due today in an hour (fecha_limite FORMAT IS YYYY-MM-DD 00:00:00), send a reminder
            let checked = [];
            for (const task of pendingTasks) {
                let empleado = await this.#utils.getEmployeeById(task.idempleado, this.#db);
                const message = `Se le recuerda que tiene una tarea pendiente en 1 hs: ${task.descripcion}`;
                let company = await this.#utils.getCompanyByEmployeeId(empleado.idempleado, this.#db);
                await this.#wabot._sendMessage(empleado.telefono, message);
                await this.#utils.updateTaskReminderStatus(task.idtareas, this.#db);
                if(checked.includes(task.idtareas)) continue;
                //await this.#wabot.sendMessage(company.grupo_wpp, message);
                checked.push(task.idtareas);
            }
        } catch (error) {
            console.error('Error processing messages:', error);
        }
    }
}

module.exports = TaskWorker;
