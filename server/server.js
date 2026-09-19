require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");

const app = express();
const server = http.createServer(app);

// ==========================================
// CORS
// ==========================================

app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "https://kushal-patil254.github.io"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ==========================================
// SOCKET.IO
// ==========================================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ==========================================
// ROUTES
// ==========================================

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);

// ==========================================
// PORT
// ==========================================

const PORT = process.env.PORT || 3000;

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {
    res.send("SmartMeet Server Running 🚀");
});

// ==========================================
// MEETING MEMORY
// ==========================================

const meetings = {};

// ==========================================
// SOCKET.IO CONNECTION
// ==========================================

io.on("connection", (socket) => {

    console.log("User Connected:", socket.id);

    // ======================================
    // JOIN REQUEST
    // ======================================

    socket.on("join-meeting", (data) => {

        if (!data || !data.meetingId) {
            return;
        }

        const meetingId =
            String(data.meetingId);

        const userName =
            typeof data.userName === "string"
                ? data.userName
                : "Guest";

        socket.userName = userName;
        socket.meetingId = meetingId;

        // ==================================
        // CREATE ROOM
        // ==================================

        if (!meetings[meetingId]) {

            meetings[meetingId] = {
                users: [],
                pendingRequests: []
            };
        }

        const meeting =
            meetings[meetingId];

        // ==================================
        // HOST
        // ==================================

        if (userName === "Host") {

            socket.join(meetingId);

            const alreadyExists =
                meeting.users.some(
                    user =>
                        user.socketId === socket.id
                );

            if (!alreadyExists) {

                meeting.users.push({
                    socketId: socket.id,
                    userName: "Host"
                });
            }

            console.log(
                `HOST joined meeting ${meetingId}`
            );

            io.to(meetingId).emit(
                "update-participants",
                meeting.users
            );

            // Send existing pending requests
            meeting.pendingRequests.forEach(
                request => {

                    socket.emit(
                        "join-request",
                        {
                            socketId:
                                request.socketId,

                            userName:
                                request.userName
                        }
                    );
                }
            );

            return;
        }

        // ==================================
        // PARTICIPANT
        // ==================================

        const alreadyJoined =
            meeting.users.some(
                user =>
                    user.socketId === socket.id
            );

        if (alreadyJoined) {
            return;
        }

        const alreadyPending =
            meeting.pendingRequests.some(
                request =>
                    request.socketId === socket.id
            );

        if (alreadyPending) {
            return;
        }

        meeting.pendingRequests.push({
            socketId: socket.id,
            userName: userName
        });

        console.log(
            `${userName} requested to join meeting ${meetingId}`
        );

        // Tell participant to wait
        socket.emit(
            "join-request-sent",
            {
                message:
                    "Join request sent. Please wait for Host approval."
            }
        );

        // Find Host
        const host =
            meeting.users.find(
                user =>
                    user.userName === "Host"
            );

        if (host) {

            io.to(host.socketId).emit(
                "join-request",
                {
                    socketId:
                        socket.id,

                    userName:
                        userName
                }
            );

        } else {

            console.log(
                `No Host currently connected for ${meetingId}`
            );

            socket.emit(
                "join-request-error",
                {
                    message:
                        "Host is not connected."
                }
            );
        }
    });

    // ======================================
    // HOST ACCEPTS PARTICIPANT
    // ======================================

    socket.on("approve-join", (data) => {

        if (!data || !data.targetSocketId) {
            return;
        }

        const meetingId =
            socket.meetingId;

        if (!meetingId) {
            return;
        }

        const meeting =
            meetings[meetingId];

        if (!meeting) {
            return;
        }

        // Only Host can approve
        if (socket.userName !== "Host") {
            return;
        }

        const requestIndex =
            meeting.pendingRequests.findIndex(
                request =>
                    request.socketId ===
                    data.targetSocketId
            );

        if (requestIndex === -1) {
            return;
        }

        const request =
            meeting.pendingRequests[
                requestIndex
            ];

        meeting.pendingRequests.splice(
            requestIndex,
            1
        );

        // Add participant
        meeting.users.push({
            socketId:
                request.socketId,

            userName:
                request.userName
        });

        // Make participant join room
        const participantSocket =
            io.sockets.sockets.get(
                request.socketId
            );

        if (participantSocket) {

            participantSocket.join(
                meetingId
            );

            participantSocket.meetingId =
                meetingId;

            participantSocket.userName =
                request.userName;
        }

        console.log(
            `HOST approved ${request.userName} for meeting ${meetingId}`
        );

        // Tell participant
        io.to(
            request.socketId
        ).emit(
            "join-approved",
            {
                meetingId:
                    meetingId,

                message:
                    "Host approved your request."
            }
        );

        // Tell Host
        socket.emit(
            "join-approved-host",
            {
                socketId:
                    request.socketId,

                userName:
                    request.userName
            }
        );

        // Tell existing participants
        socket.emit(
            "user-joined",
            {
                socketId:
                    request.socketId,

                userName:
                    request.userName
            }
        );

        // Update everyone
        io.to(meetingId).emit(
            "update-participants",
            meeting.users
        );
    });

    // ======================================
    // HOST REJECTS PARTICIPANT
    // ======================================

    socket.on("reject-join", (data) => {

        if (!data || !data.targetSocketId) {
            return;
        }

        const meetingId =
            socket.meetingId;

        if (!meetingId) {
            return;
        }

        const meeting =
            meetings[meetingId];

        if (!meeting) {
            return;
        }

        // Only Host
        if (socket.userName !== "Host") {
            return;
        }

        const requestIndex =
            meeting.pendingRequests.findIndex(
                request =>
                    request.socketId ===
                    data.targetSocketId
            );

        if (requestIndex === -1) {
            return;
        }

        const request =
            meeting.pendingRequests[
                requestIndex
            ];

        meeting.pendingRequests.splice(
            requestIndex,
            1
        );

        console.log(
            `HOST rejected ${request.userName}`
        );

        io.to(
            request.socketId
        ).emit(
            "join-rejected",
            {
                message:
                    "Host rejected your join request."
            }
        );
    });

    // ======================================
    // CHAT
    // ======================================

    socket.on("send-message", (data) => {

        if (
            !data ||
            !data.meetingId ||
            !data.message
        ) {
            return;
        }

        io.to(
            String(data.meetingId)
        ).emit(
            "receive-message",
            {
                userName:
                    socket.userName ||
                    data.userName ||
                    "Guest",

                message:
                    String(data.message)
            }
        );
    });

    // ======================================
    // WEBRTC OFFER
    // ======================================

    socket.on("webrtc-offer", (data) => {

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
    });

    // ======================================
    // WEBRTC ANSWER
    // ======================================

    socket.on("webrtc-answer", (data) => {

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
    });

    // ======================================
    // ICE CANDIDATE
    // ======================================

    socket.on(
        "webrtc-ice-candidate",
        (data) => {

            if (
                !data ||
                !data.targetSocketId ||
                !data.candidate
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

    socket.on("leave-meeting", () => {

        const meetingId =
            socket.meetingId;

        if (!meetingId) {
            return;
        }

        console.log(
            "LEAVE REQUEST:",
            socket.userName,
            meetingId
        );

        // Host ends meeting
        if (
            socket.userName === "Host"
        ) {

            socket.to(meetingId).emit(
                "meeting-ended",
                {
                    meetingId:
                        meetingId,

                    message:
                        "Host has ended the meeting."
                }
            );
        }

        removeUserFromMeeting(socket);
    });

    // ======================================
    // DISCONNECT
    // ======================================

    socket.on("disconnect", () => {

        console.log(
            "User Disconnected:",
            socket.id
        );

        removeUserFromMeeting(socket);
    });
});

// ==========================================
// REMOVE USER
// ==========================================

function removeUserFromMeeting(socket) {

    const meetingId =
        socket.meetingId;

    if (!meetingId) {
        return;
    }

    const meeting =
        meetings[meetingId];

    if (!meeting) {
        return;
    }

    // Remove joined user
    const userIndex =
        meeting.users.findIndex(
            user =>
                user.socketId ===
                socket.id
        );

    if (userIndex !== -1) {

        const user =
            meeting.users[userIndex];

        meeting.users.splice(
            userIndex,
            1
        );

        io.to(meetingId).emit(
            "user-left",
            {
                socketId:
                    socket.id,

                userName:
                    user.userName
            }
        );
    }

    // Remove pending request
    meeting.pendingRequests =
        meeting.pendingRequests.filter(
            request =>
                request.socketId !==
                socket.id
        );

    // Update participants
    io.to(meetingId).emit(
        "update-participants",
        meeting.users
    );

    // Delete empty meeting memory
    if (
        meeting.users.length === 0 &&
        meeting.pendingRequests.length === 0
    ) {

        delete meetings[meetingId];

        console.log(
            `Meeting room deleted: ${meetingId}`
        );
    }

    socket.leave(meetingId);

    socket.meetingId = null;
}

// ==========================================
// START SERVER
// ==========================================

server.listen(
    PORT,
    () => {

        console.log(
            `Server is running on port ${PORT}`
        );
    }
);