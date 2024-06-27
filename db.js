const mysql = require('mysql');

class DB {
    constructor(config) {
        this.connection = mysql.createConnection(config);
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.connection.connect((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    query(sql, values = []) {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, values, (err, results, fields) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ results, fields });
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.connection.end((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    isConnectionOpen() {
        return this.connection.state === 'authenticated';
    }
}

module.exports = DB;
