const express = require("express");
const router = express.Router();

const db = require("../config/db");


// ==========================================
// CREATE MEETING
// ==========================================

router.post("/create", (req, res) => {

    const {
        meetingId,
        meetingName,
        meetingPassword,
        duration
    } = req.body;

    if (
        !meetingId ||
        !meetingName ||
        !meetingPassword ||
        !duration
    ) {

        return res.json({
            success: false,
            message: "All meeting details are required"
        });

    }


    const sql = `
        INSERT INTO meetings
        (
            meeting_id,
            meeting_name,
            meeting_password,
            duration,
            status
        )
        VALUES (?, ?, ?, ?, 'active')
    `;


    db.query(
        sql,
        [
            meetingId,
            meetingName,
            meetingPassword,
            duration
        ],
        (err, result) => {

            if (err) {

                console.error(
                    "Create Meeting Error:",
                    err
                );

                return res.json({
                    success: false,
                    message: err.message
                });

            }


            res.json({
                success: true,
                message: "Meeting Created Successfully"
            });

        }
    );

});


// ==========================================
// JOIN MEETING
// ==========================================

router.post("/join", (req, res) => {

    const {
        meetingId,
        meetingPassword
    } = req.body;


    if (
        !meetingId ||
        !meetingPassword
    ) {

        return res.json({
            success: false,
            message:
                "Meeting ID and Password are required"
        });

    }


    const sql = `
        SELECT *
        FROM meetings
        WHERE meeting_id = ?
        AND meeting_password = ?
        AND status = 'active'
    `;


    db.query(
        sql,
        [
            meetingId,
            meetingPassword
        ],
        (err, result) => {

            if (err) {

                console.error(
                    "Join Meeting Error:",
                    err
                );

                return res.json({
                    success: false,
                    message: "Database error"
                });

            }


            if (
                result.length === 0
            ) {

                return res.json({
                    success: false,
                    message:
                        "Invalid Meeting ID, Password, or Meeting has ended"
                });

            }


            res.json({
                success: true,
                message: "Meeting Found",
                meeting: result[0]
            });

        }
    );

});


// ==========================================
// MEETING HISTORY
// ==========================================

router.get("/history", (req, res) => {

    const sql = `
        SELECT
            meeting_id,
            meeting_name,
            duration,
            status,
            created_at
        FROM meetings
        ORDER BY created_at DESC
    `;


    db.query(
        sql,
        (err, result) => {

            if (err) {

                console.error(
                    "History Error:",
                    err
                );

                return res.json({
                    success: false,
                    message: err.message
                });

            }


            res.json({
                success: true,
                meetings: result
            });

        }
    );

});


// ==========================================
// END MEETING
// ==========================================

router.put("/end/:meetingId", (req, res) => {

    const meetingId =
        req.params.meetingId;


    if (!meetingId) {

        return res.json({
            success: false,
            message: "Meeting ID is required"
        });

    }


    const sql = `
        UPDATE meetings
        SET status = 'ended'
        WHERE meeting_id = ?
    `;


    db.query(
        sql,
        [meetingId],
        (err, result) => {

            if (err) {

                console.error(
                    "End Meeting Error:",
                    err
                );

                return res.json({
                    success: false,
                    message: "Database error"
                });

            }


            if (
                result.affectedRows === 0
            ) {

                return res.json({
                    success: false,
                    message:
                        "Meeting not found"
                });

            }


            res.json({
                success: true,
                message:
                    "Meeting ended successfully"
            });

        }
    );

});


// ==========================================
// DELETE MEETING
// ==========================================

router.delete(
    "/delete/:meetingId",
    (req, res) => {

        const meetingId =
            req.params.meetingId;


        if (!meetingId) {

            return res.json({
                success: false,
                message:
                    "Meeting ID is required"
            });

        }


        const sql =
            "DELETE FROM meetings WHERE meeting_id = ?";


        db.query(
            sql,
            [meetingId],
            (err, result) => {

                if (err) {

                    console.error(
                        "Delete Meeting Error:",
                        err
                    );

                    return res.json({
                        success: false,
                        message:
                            err.message
                    });

                }


                if (
                    result.affectedRows === 0
                ) {

                    return res.json({
                        success: false,
                        message:
                            "Meeting not found"
                    });

                }


                res.json({
                    success: true,
                    message:
                        "Meeting deleted successfully"
                });

            }
        );

    }
);


// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;