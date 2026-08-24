const express = require("express");
const router = express.Router();

const authController = require("../controllers/authcontroller");

router.get("/", (req, res) => {
    res.send("Auth Route Working");
});

router.post("/register", authController.register);
router.post("/login", authController.login);

module.exports = router;