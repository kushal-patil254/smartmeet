const express = require("express");
const router = express.Router();

const db = require("../config/db");


// ==========================================
// CREATE MEETING
// ==========================================

router.post("/create", async (req, res) => {

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


    try {

        const [result] = await db.query(
            sql,
            [
                meetingId,
                meetingName,
                meetingPassword,
                duration
            ]
        );


        console.log(
            "Meeting Created:",
            meetingId
        );


        return res.json({
            success: true,
            message: "Meeting Created Successfully",
            meetingId: meetingId
        });


    } catch (err) {

        console.error(
            "Create Meeting Error:",
            err
        );


        return res.json({
            success: false,
            message: err.message
        });

    }

});


// ==========================================
// JOIN MEETING
// ==========================================

router.post("/join", async (req, res) => {

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


    try {

        const [result] = await db.query(
            sql,
            [
                meetingId,
                meetingPassword
            ]
        );


        if (
            result.length === 0
        ) {

            return res.json({
                success: false,
                message:
                    "Invalid Meeting ID, Password, or Meeting has ended"
            });

        }


        return res.json({
            success: true,
            message: "Meeting Found",
            meeting: result[0]
        });


    } catch (err) {

        console.error(
            "Join Meeting Error:",
            err
        );


        return res.json({
            success: false,
            message: err.message
        });

    }

});


// ==========================================
// MEETING HISTORY
// ==========================================

router.get("/history", async (req, res) => {

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


    try {

        const [result] =
            await db.query(sql);


        return res.json({
            success: true,
            meetings: result
        });


    } catch (err) {

        console.error(
            "History Error:",
            err
        );


        return res.json({
            success: false,
            message: err.message
        });

    }

});


// ==========================================
// END MEETING
// ==========================================

router.put(
    "/end/:meetingId",
    async (req, res) => {

        const meetingId =
            req.params.meetingId;


        if (!meetingId) {

            return res.json({
                success: false,
                message:
                    "Meeting ID is required"
            });

        }


        const sql = `
            UPDATE meetings
            SET status = 'ended'
            WHERE meeting_id = ?
        `;


        try {

            const [result] =
                await db.query(
                    sql,
                    [meetingId]
                );


            if (
                result.affectedRows === 0
            ) {

                return res.json({
                    success: false,
                    message:
                        "Meeting not found"
                });

            }


            return res.json({
                success: true,
                message:
                    "Meeting ended successfully"
            });


        } catch (err) {

            console.error(
                "End Meeting Error:",
                err
            );


            return res.json({
                success: false,
                message: err.message
            });

        }

    }
);


// ==========================================
// DELETE MEETING
// ==========================================

router.delete(
    "/delete/:meetingId",
    async (req, res) => {

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


        try {

            const [result] =
                await db.query(
                    sql,
                    [meetingId]
                );


            if (
                result.affectedRows === 0
            ) {

                return res.json({
                    success: false,
                    message:
                        "Meeting not found"
                });

            }


            return res.json({
                success: true,
                message:
                    "Meeting deleted successfully"
            });


        } catch (err) {

            console.error(
                "Delete Meeting Error:",
                err
            );


            return res.json({
                success: false,
                message: err.message
            });

        }

    }
);


// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;