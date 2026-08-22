const db = require("../config/db");

exports.register = (req, res) => {

    const { fullname, email, password } = req.body;

    const sql = "INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)";

    db.query(sql, [fullname, email, password], (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "User Registered Successfully"
        });

    });

};

exports.login = (req, res) => {

    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email=? AND password=?";

    db.query(sql, [email, password], (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        if (result.length > 0) {
            res.json({
                success: true,
                message: "Login Successful"
            });
        } else {
            res.json({
                success: false,
                message: "Invalid Email or Password"
            });
        }

    });

};