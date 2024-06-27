const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const Bot = require("./Bot");
const EventWorker = require("./event_worker");
const TaskWorker = require("./task_worker");
const { botConfig, pluginsConfig } = require("./config");
const NewMessage = require("./plugins/NewMessage");
const { google } = require('googleapis');
const fs = require('fs');
const DB = require("./db");

const plugins = {
    "new_message": new NewMessage(pluginsConfig.newMessage),
};

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

// Function to start event worker
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

// Function to start task worker
async function startTaskWorker(bot) {
    const taskWorker = new TaskWorker(bot, db);

    try {
        await taskWorker.init();
    } catch (error) {
        console.error('Error in TaskWorker:', error);
        throw error; // Rethrow the error for the main thread to catch
    }
}

// Main application logic
async function main() {
    // Initialize Bot instance with plugins and configuration
    const botInstance = new Bot(plugins, botConfig);

    try {
        // Connect and run bot instance
        await botInstance.connect();
        await botInstance.run();

        // Start event and task workers
        await Promise.all([
            startEventWorker(botInstance),
            startTaskWorker(botInstance)
        ]);

        console.log("EventWorker and TaskWorker have started. You can do other things now.");
    } catch (error) {
        console.error('Error in main application:', error);
    }
}

// Check if this file is the main module (not required by another script)
if (isMainThread) {
    main().catch(error => {
        console.error('Unhandled error in main application:', error);
        process.exit(1); // Exit with non-zero code indicating failure
    });
} else {
    // If this file is required as a module, it's in a worker thread
    console.warn('This file should not be required as a module in worker threads.');
}
