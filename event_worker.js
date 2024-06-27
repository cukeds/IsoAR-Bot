const fs = require('fs').promises;
const path = require('path');
const mammoth = require('mammoth');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const {Readable} = require('stream')
const Utils = require('./utils');

class EventWorker {
    #drive;
    #events;
    #eventTemplateId = '1xcBmZ_LaJaH-PRTseFL-IwRobZn0mY-v'; // TODO <- Move to .env
    #parentFolderId = '1yephZGXn5ZvNgoMiMaTB32BOU8jOGOvQ';  // TODO <- Move to .env
    #defaultFolder = 'templates';                           // TODO <- Move to .env
    #parentFolder = '1bHvVagLLbTMokm5UvKSvl1I-7h-jM562';    // TODO <- Move to .env
    #utils;
    #wabot;
    #db;

    constructor(drive, wabot, db) {
        this.#drive = drive;
        this.#events = [];
        this.#utils = new Utils();
        this.#wabot = wabot;
        this.#db = db;
    }

    async init() {
        // create company folder if it doesn't exist
        try {
            const companies = await this.#utils.getCompanies(this.#db);
            for (const company of companies) {
                //this.createCompany(company.nombre);
                console.log(company.nombre);
            }
        }
        catch(err){
            console.error('Error initializing companies:', err);
        }

        // Create users folder if it doesn't exist for every employee
        try {
            const employees = await this.#utils.getEmployees(this.#db);
            for (const employee of employees) {
                const user = employee.telefono;
                this.#utils.createFolder(user);
                this.#utils.readHistory(user);
                this.#utils.readUserdata(user);
            }
        }catch(err){
            console.error('Error initializing users:', err);
        }


        while (true) {
            await this.readEvents();
            await this.processEvents();
            await this.processMessages();
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    async readDocument(fileId) {
        try {
            const res = await this.#drive.files.get({fileId, alt: 'media'}, {responseType: 'arraybuffer'});
            const content = Buffer.from(res.data);
            const zip = new PizZip(content);
            const doc = new Docxtemplater(zip, {paragraphLoop: true, linebreaks: true});
            return doc;
        } catch (err) {
            console.error('Error reading document:', err);
        }
    }

    async writeDocument(doc, fileName, folderId) {
        try {
            const buffer = doc.getZip().generate({type: 'nodebuffer'});

            const fileMetadata = {
                'name': fileName,
                'parents': [folderId]
            };
            const media = {
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                body: Readable.from(buffer)
            };

            const res = await this.#drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });

            console.log(`Document written with ID: ${res.data.id}`);
            return res.data.id;
        } catch (err) {
            console.error('Error writing document:', err);
        }
    }

    async uploadFile(file, folderName) {
        const filePath = path.join('companies', folderName, file);
        const fileContents = await fs.readFile(filePath);
        let readable = Readable.from(fileContents);
        const fileMetadata = {
            name: file,
            parents: [this.#parentFolder]
        };
        const media = {
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            body: readable
        };
        this.#drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        }).then((res) => {
            console.log('File uploaded:', res.data.id);
        }).catch((err) => {
            console.error('Error uploading file:', err);
        })
    }


    async readEvents() {
        try {
            const users = await fs.readdir('users');
            for (const user of users) {
                const history = this.#utils.readHistory(user);
                // add sender to events
                history.events.forEach((event) => {
                    event.user = history.senderId;
                });
                this.#events.push(...history.events);
                history.events = [];
                this.#utils.saveHistory(user, history);
            }
        } catch (error) {
            console.error('Error reading events:', error);
        }
    }

    async processEvents() {
        try {
            for (const event of this.#events) {
                const doc = await this.readDocument(this.#eventTemplateId);
                const replacements = {
                    i: event.tipo === "inc" ? "X" : "",
                    o: event.tipo === "obs" ? "X" : "",
                    m: event.tipo === "mej" ? "X" : "",
                    fecha: new Date().toLocaleDateString('es-AR', {timeZone: 'America/Argentina/Buenos_Aires'}),
                    hs: new Date().toLocaleTimeString('es-AR', {
                        timeZone: 'America/Argentina/Buenos_Aires',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    origen: event.origen,
                    descripcion: event.descripcion,
                    se_conoce_la_causa: event.causa,
                    hay_documentacion_asociada: event.documentacion,
                    acciones_inmediatas: event.acciones_inmediatas,
                };
                doc.setData(replacements);
                doc.render();
                let id = await this.writeDocument(doc, `output${Date.now()}`, this.#parentFolderId);
                let userdata = this.#utils.readUserdata(event.user);
                userdata.pending_messages.push(`Puedes encontrar el archivo en el siguiente link: https://drive.google.com/file/d/${id}/view \n\nRecuerda que puedes reportar una inconformidad, mejora u observación en cualquier momento.`);
                this.#utils.updateUserData(event.user, "pending_messages", userdata.pending_messages);
                let employee;
                await this.#utils.getEmployeeByNumber(event.user, this.#db).then((res) => {
                    employee = res;
                });
                let company;
                await this.#utils.getCompanyByEmployeeId(employee.idempleado, this.#db).then((res) => {
                    company = res;
                });
                let coordinator;
                await this.#utils.getCoordinatorByCompanyId(company.idempresa, this.#db).then((res) => {
                    coordinator = res;
                });
                if (coordinator.telefono !== employee.telefono){
                    userdata = this.#utils.readUserdata(coordinator.telefono);
                    userdata.pending_messages.push(`Se ha reportado un evento en la empresa ${company.nombre} por el empleado ${employee.nombre} ${employee.apellido}. Puedes encontrar el archivo en el siguiente link: https://drive.google.com/file/d/${id}/view \n`);
                    this.#utils.updateUserData(coordinator.telefono, "pending_messages", userdata.pending_messages);
                }
            }
            this.#events = [];
        } catch (error) {
            console.error('Error processing events:', error);
        }
    }

    async processMessages() {
        console.log(this.#wabot.isConnected())
        if(!this.#wabot.isConnected()) return;
        try {
            const users = await fs.readdir('users');
            for (const user of users) {
                let userdata = this.#utils.readUserdata(user);
                if (userdata.pending_messages.length > 0) {
                    for (const message of userdata.pending_messages) {

                        await this.#wabot._sendMessage(user, message);
                    }
                    userdata.pending_messages = [];
                    this.#utils.updateUserData(user, "pending_messages", userdata.pending_messages);
                }
            }
        } catch (error) {
            console.error('Error processing messages:', error);
        }
    }

    async createDriveFolder(name){
        const fileMetaData = {
            name: name,
            mimeType: "application/vnd.google-apps.folder",
        };
        const res = await this.#drive.files
            .create({
                fields: "id",
                resource: fileMetaData,
            })
            .catch((err) => console.log(err));
        console.log(res.data);

        const folderId = res.data.id;
        if (!folderId) return;
        const res2 = await this.#drive.permissions
            .create({
                resource: {
                    type: "user",
                    role: "owner",
                    emailAddress: "jignaciodegiovanni@gmail.com",  // Please set your email address of Google account.
                },
                fileId: folderId,
                fields: "id",
                transferOwnership: true,
                moveToNewOwnersRoot: true,
            })
            .catch((err) => console.log(err));
        console.log(res2.data);
    };


    createCompany(nombre) {
        // replace {LA_EMPRESA} from file names and content to the company name
        const folderName = nombre.toLowerCase().replace(/ /g, '_');

        // create company folder if it doesn't exist with fs
        fs.mkdir(path.join('companies', folderName), {recursive: true})

        // copy templates to company folder
        fs.readdir(this.#defaultFolder).then(files => {
            files.forEach(file => {
                fs.copyFile(path.join(this.#defaultFolder, file), path.join('companies', folderName, file));
            });
        }).catch(err => {
            console.error('Error reading default folder:', err);
        });

        // replace {LA_EMPRESA} from file names and content to the company name
        fs.readdir(path.join('companies', folderName)).then(files => {
            files.forEach(file => {
                fs.readFile(path.join('companies', folderName, file), 'utf8').then(data => {
                    data = data.replace(/{LA_EMPRESA}/g, nombre);
                    file.replace(/{LA_EMPRESA}/g, nombre);
                    fs.writeFile(path.join('companies', folderName, file), data, 'utf8', (err) => {
                        if (err) {
                            console.error('Error writing file:', err);
                        }
                    });
                }).catch(err => {
                    console.error('Error reading file:', err);
                });
            });
        }).catch(err => {
            console.error('Error reading company folder:', err);
        });

        // create company folder in drive if it doesn't exist
        this.createDriveFolder(nombre);
        // add files to company folder in drive
        fs.readdir(this.#defaultFolder).then(files => {
            files.forEach(file => {
                this.uploadFile(file, folderName);
            });
        }).catch(err => {
            console.error('Error reading default folder:', err);
        });
    }



}

module.exports = EventWorker;


