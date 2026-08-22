const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Kush@12345",
    database: "smartmeet_db"
});

db.connect((err) => {
    if (err) {
    console.log("Database Connection Failed:", err.message);
}
 else {
        console.log("Database Connected Successfully");
    }
});

module.exports = db;