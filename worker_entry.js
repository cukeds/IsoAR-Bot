const { workerData } = require('worker_threads');
const EventWorker = require("./event_worker");
const TaskWorker = require("./task_worker");
const { google } = require('googleapis');
const fs = require("fs");
const DB = require("./db");

const drive_key = 'drive_creds.json';
const serviceAccount = JSON.parse(fs.readFileSync(drive_key));
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    SCOPES
);

const db = new DB({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'isoar'
});

async function startEventWorker(bot) {
    const drive = google.drive({ version: 'v3', auth });
    const eventWorker = new EventWorker(drive, bot, db);

    try {
        await eventWorker.init();
    } catch (error) {
        console.error('Error in EventWorker:', error);
        throw error; // Rethrow the error for the main thread to catch
    }
}

async function startTaskWorker(bot) {
    const taskWorker = new TaskWorker(bot, db);

    try {
        await taskWorker.init();
    } catch (error) {
        console.error('Error in TaskWorker:', error);
        throw error; // Rethrow the error for the main thread to catch
    }
}

// Access bot instance from workerData directly
const botInstance = workerData.bot;

if (workerData.type === 'event') {
    startEventWorker(botInstance).catch(error => {
        console.error('Error starting EventWorker:', error);
    });
} else if (workerData.type === 'task') {
    startTaskWorker(botInstance).catch(error => {
        console.error('Error starting TaskWorker:', error);
    });
}
