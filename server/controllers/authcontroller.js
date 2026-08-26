const db = require("../config/db");

// ==========================================
// REGISTER
// ==========================================

exports.register = async (req, res) => {

    try {

        const { fullname, email, password } = req.body;

        // Check required fields
        if (!fullname || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Check if email already exists
        const [existingUser] = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Insert user
        await db.query(
            "INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)",
            [fullname, email, password]
        );

        res.status(201).json({
            success: true,
            message: "User Registered Successfully"
        });

    } catch (error) {

        console.error("REGISTER DATABASE ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ==========================================
// LOGIN
// ==========================================

exports.login = async (req, res) => {

    try {

        const { email, password } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find user
        const [result] = await db.query(
            "SELECT * FROM users WHERE email = ? AND password = ?",
            [email, password]
        );

        if (result.length > 0) {

            res.json({
                success: true,
                message: "Login Successful"
            });

        } else {

            res.status(401).json({
                success: false,
                message: "Invalid Email or Password"
            });

        }

    } catch (error) {

        console.error("LOGIN DATABASE ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};