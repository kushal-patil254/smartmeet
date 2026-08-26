require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");


// ==========================================
// EXPRESS APP
// ==========================================

const app = express();

const server =
    http.createServer(app);


// ==========================================
// CORS
// ==========================================

app.use(
    cors({
        origin: "*",
        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);


// ==========================================
// BODY PARSER
// ==========================================

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);


// ==========================================
// SOCKET.IO
// ==========================================

const io =
    new Server(server, {

        cors: {
            origin: "*",
            methods: [
                "GET",
                "POST"
            ]
        }

    });


// ==========================================
// API ROUTES
// ==========================================

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/meetings",
    meetingRoutes
);


// ==========================================
// PORT
// ==========================================

const PORT =
    process.env.PORT || 3000;


// ==========================================
// HOME / HEALTH CHECK
// ==========================================

app.get(
    "/",
    (req, res) => {

        res.status(200).send(
            "SmartMeet Server Running 🚀"
        );

    }
);


// ==========================================
// TEST API
// ==========================================

app.get(
    "/api/test",
    (req, res) => {

        res.json({

            success: true,

            message:
                "SmartMeet API is working!"

        });

    }
);


// ==========================================
// MEETINGS MEMORY
// ==========================================

const meetings = {};


// ==========================================
// SOCKET.IO CONNECTION
// ==========================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "User Connected:",
            socket.id
        );


        // ======================================
        // JOIN MEETING
        // ======================================

        socket.on(
            "join-meeting",
            (data) => {

                if (
                    !data ||
                    !data.meetingId
                ) {

                    return;

                }


                const meetingId =
                    String(
                        data.meetingId
                    );


                const userName =
                    data.userName ||
                    "Guest";


                socket.userName =
                    userName;


                socket.meetingId =
                    meetingId;


                socket.join(
                    meetingId
                );


                // Create meeting room

                if (
                    !meetings[meetingId]
                ) {

                    meetings[meetingId] =
                        [];

                }


                // Check duplicate socket

                const alreadyExists =
                    meetings[
                        meetingId
                    ].some(
                        user =>
                            user.socketId ===
                            socket.id
                    );


                if (
                    !alreadyExists
                ) {

                    meetings[
                        meetingId
                    ].push({

                        socketId:
                            socket.id,

                        userName:
                            userName

                    });

                }


                console.log(
                    `${userName} joined meeting ${meetingId}`
                );


                // Update participants

                io.to(
                    meetingId
                ).emit(
                    "update-participants",
                    meetings[
                        meetingId
                    ]
                );


                // Tell existing users

                socket
                    .to(meetingId)
                    .emit(
                        "user-joined",
                        {

                            socketId:
                                socket.id,

                            userName:
                                userName

                        }
                    );

            }
        );


        // ======================================
        // CHAT
        // ======================================

        socket.on(
            "send-message",
            (data) => {

                if (
                    !data ||
                    !data.meetingId
                ) {

                    return;

                }


                io.to(
                    String(
                        data.meetingId
                    )
                ).emit(
                    "receive-message",
                    {

                        userName:
                            data.userName ||
                            "Guest",

                        message:
                            data.message ||
                            ""

                    }
                );

            }
        );


        // ======================================
        // WEBRTC OFFER
        // ======================================

        socket.on(
            "webrtc-offer",
            (data) => {

                if (
                    !data ||
                    !data.targetSocketId
                ) {

                    return;

                }


                io.to(
                    data.targetSocketId
                ).emit(
                    "webrtc-offer",
                    {

                        offer:
                            data.offer,

                        fromSocketId:
                            socket.id,

                        userName:
                            socket.userName ||
                            "Guest"

                    }
                );

            }
        );


        // ======================================
        // WEBRTC ANSWER
        // ======================================

        socket.on(
            "webrtc-answer",
            (data) => {

                if (
                    !data ||
                    !data.targetSocketId
                ) {

                    return;

                }


                io.to(
                    data.targetSocketId
                ).emit(
                    "webrtc-answer",
                    {

                        answer:
                            data.answer,

                        fromSocketId:
                            socket.id

                    }
                );

            }
        );


        // ======================================
        // ICE CANDIDATE
        // ======================================

        socket.on(
            "webrtc-ice-candidate",
            (data) => {

                if (
                    !data ||
                    !data.targetSocketId
                ) {

                    return;

                }


                io.to(
                    data.targetSocketId
                ).emit(
                    "webrtc-ice-candidate",
                    {

                        candidate:
                            data.candidate,

                        fromSocketId:
                            socket.id

                    }
                );

            }
        );


        // ======================================
        // LEAVE MEETING
        // ======================================

        socket.on(
            "leave-meeting",
            () => {

                const meetingId =
                    socket.meetingId;


                console.log(
                    "LEAVE REQUEST:",
                    socket.userName,
                    meetingId
                );


                if (
                    !meetingId
                ) {

                    return;

                }


                // HOST LEAVES

                if (
                    socket.userName ===
                    "Host"
                ) {

                    console.log(
                        `HOST IS ENDING MEETING: ${meetingId}`
                    );


                    socket
                        .to(meetingId)
                        .emit(
                            "meeting-ended",
                            {

                                meetingId:
                                    meetingId,

                                message:
                                    "Host has ended the meeting."

                            }
                        );

                }


                removeUserFromMeeting(
                    socket
                );

            }
        );


        // ======================================
        // DISCONNECT
        // ======================================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "User Disconnected:",
                    socket.id
                );


                const meetingId =
                    socket.meetingId;


                // HOST DISCONNECTED

                if (
                    meetingId &&
                    socket.userName ===
                    "Host"
                ) {

                    console.log(
                        `Host disconnected. Ending meeting ${meetingId}`
                    );


                    socket
                        .to(meetingId)
                        .emit(
                            "meeting-ended",
                            {

                                meetingId:
                                    meetingId,

                                message:
                                    "Host has left the meeting."

                            }
                        );

                }


                removeUserFromMeeting(
                    socket
                );

            }
        );

    }
);


// ==========================================
// REMOVE USER
// ==========================================

function removeUserFromMeeting(
    socket
) {

    const meetingId =
        socket.meetingId;


    if (
        !meetingId
    ) {

        return;

    }


    if (
        !meetings[meetingId]
    ) {

        return;

    }


    const index =
        meetings[
            meetingId
        ].findIndex(
            user =>
                user.socketId ===
                socket.id
        );


    if (
        index === -1
    ) {

        return;

    }


    const userName =
        meetings[
            meetingId
        ][index]
        .userName;


    // Remove user

    meetings[
        meetingId
    ].splice(
        index,
        1
    );


    console.log(
        `${userName} left meeting ${meetingId}`
    );


    // Tell remaining users

    io.to(
        meetingId
    ).emit(
        "user-left",
        {

            socketId:
                socket.id,

            userName:
                userName

        }
    );


    // Update participants

    io.to(
        meetingId
    ).emit(
        "update-participants",
        meetings[
            meetingId
        ]
    );


    // Delete empty room

    if (
        meetings[
            meetingId
        ].length === 0
    ) {

        delete meetings[
            meetingId
        ];


        console.log(
            `Meeting room ${meetingId} deleted`
        );

    }


    try {

        socket.leave(
            meetingId
        );

    }

    catch (error) {

        console.log(
            "Socket leave error:",
            error
        );

    }


    socket.meetingId =
        null;

}


// ==========================================
// START SERVER
// ==========================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `SmartMeet Server running on port ${PORT}`
        );

        console.log(
            `Environment PORT: ${process.env.PORT || "Not Set"}`
        );

    }
);