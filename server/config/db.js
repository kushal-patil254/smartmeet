const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testConnection() {

    try {

        const connection = await pool.getConnection();

        console.log("Database Connected Successfully");

        connection.release();

    } catch (error) {

        console.error(
            "Database Connection Failed:",
            error.message
        );

    }

}

testConnection();

module.exports = pool;