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
            for (const task of this.#tasks) {
                await this.#utils.addTask(task, this.#db);
            }
            this.#tasks = [];
        } catch (error) {
            console.error('Error processing tasks:', error);
        }
    }

    async processReminders() {
        console.log(this.#wabot.isConnected())
        if(!this.#wabot.isConnected()) return;
        try {
            // TODO: Implement reminder processing

        } catch (error) {
            console.error('Error processing messages:', error);
        }
    }
}

module.exports = TaskWorker;
