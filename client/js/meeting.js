// ==========================================
// SMARTMEET - MEETING.JS
// ==========================================

const socket = io("https://smartmeet-production.up.railway.app");

// ==========================================
// MEETING DATA
// ==========================================

const meetingId =
    localStorage.getItem("hostMeetingId");

const meetingName =
    localStorage.getItem("hostMeetingName") ||
    "SmartMeet Meeting";

const meetingPassword =
    localStorage.getItem("hostMeetingPassword") ||
    "";

const meetingDuration =
    parseInt(
        localStorage.getItem("meetingDuration")
    ) || 60;


// ==========================================
// USER
// ==========================================

let userName =
    localStorage.getItem("joinedUser");

if (!userName) {
    userName = "Guest";
}

const isHost = userName === "Host";


// ==========================================
// HTML ELEMENTS
// ==========================================

const meetingTitle =
    document.getElementById("meetingTitle");

const meetingIdElement =
    document.getElementById("meetingId");

const timerElement =
    document.getElementById("timer");

const participantsElement =
    document.getElementById("participants");

const localVideo =
    document.getElementById("localVideo");

const remoteVideo =
    document.getElementById("remoteVideo");

const cameraBtn =
    document.getElementById("cameraBtn");

const micBtn =
    document.getElementById("micBtn");

const screenBtn =
    document.getElementById("screenBtn");

const copyBtn =
    document.getElementById("copyBtn");

const leaveBtn =
    document.getElementById("leaveBtn");

const chatBox =
    document.getElementById("chatBox");

const sendBtn =
    document.getElementById("sendBtn");

const messages =
    document.getElementById("messages");

const userVideoContainer =
    document.getElementById("userVideoContainer");


// ==========================================
// CHECK MEETING
// ==========================================

if (!meetingId) {

    alert("Meeting information not found.");

    window.location.href =
        "dashboard.html";
}


// ==========================================
// SHOW MEETING INFORMATION
// ==========================================

if (meetingTitle) {

    meetingTitle.innerText =
        meetingName;

}

if (meetingIdElement) {

    meetingIdElement.innerText =
        meetingId;

}


// ==========================================
// LOCAL MEDIA
// ==========================================

let localStream = null;

let cameraOn = false;

let micOn = false;


// ==========================================
// WEBRTC
// ==========================================

const peerConnections = {};

const pendingIceCandidates = {};

const remoteUserNames = {};

const rtcConfig = {

    iceServers: [

        {
            urls:
                "stun:stun.l.google.com:19302"
        }

    ]

};


// ==========================================
// CREATE PEER CONNECTION
// ==========================================

function createPeerConnection(
    targetSocketId,
    targetUserName
) {

    if (
        peerConnections[targetSocketId]
    ) {

        return peerConnections[
            targetSocketId
        ];

    }


    console.log(
        "Creating PeerConnection:",
        targetSocketId
    );


    remoteUserNames[
        targetSocketId
    ] =
        targetUserName || "Guest";


    const peer =
        new RTCPeerConnection(
            rtcConfig
        );


    peerConnections[
        targetSocketId
    ] =
        peer;


    pendingIceCandidates[
        targetSocketId
    ] =
        pendingIceCandidates[
            targetSocketId
        ] || [];


    // ======================================
    // ADD LOCAL TRACKS
    // ======================================

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    peer.addTrack(
                        track,
                        localStream
                    );

                }
            );

    }


    // ======================================
    // REMOTE TRACK
    // ======================================

    peer.ontrack =
        function (event) {

            console.log(
                "Remote video received from:",
                targetSocketId
            );


            if (
                !event.streams ||
                !event.streams[0]
            ) {

                return;

            }


            const stream =
                event.streams[0];


            showRemoteVideo(
                targetSocketId,
                remoteUserNames[
                    targetSocketId
                ],
                stream
            );

        };


    // ======================================
    // ICE CANDIDATE
    // ======================================

    peer.onicecandidate =
        function (event) {

            if (
                event.candidate
            ) {

                socket.emit(
                    "webrtc-ice-candidate",
                    {

                        targetSocketId:
                            targetSocketId,

                        candidate:
                            event.candidate

                    }
                );

            }

        };


    // ======================================
    // CONNECTION STATE
    // ======================================

    peer.onconnectionstatechange =
        function () {

            console.log(
                "Connection state:",
                targetSocketId,
                peer.connectionState
            );


            if (
                peer.connectionState ===
                "failed"
            ) {

                console.log(
                    "WebRTC connection failed:",
                    targetSocketId
                );

            }


            if (
                peer.connectionState ===
                "closed"
            ) {

                removeRemoteUser(
                    targetSocketId
                );

            }

        };


    return peer;

}


// ==========================================
// ADD PENDING ICE
// ==========================================

async function addPendingIce(
    socketId
) {

    const peer =
        peerConnections[
            socketId
        ];

    if (!peer) {
        return;
    }


    if (
        !peer.remoteDescription ||
        !peer.remoteDescription.type
    ) {

        return;

    }


    const candidates =
        pendingIceCandidates[
            socketId
        ] || [];


    while (
        candidates.length > 0
    ) {

        const candidate =
            candidates.shift();


        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );

        }

        catch (error) {

            console.error(
                "Pending ICE Error:",
                error
            );

        }

    }

}


// ==========================================
// SHOW REMOTE VIDEO
// ==========================================

function showRemoteVideo(
    socketId,
    name,
    stream
) {

    // ======================================
    // OLD REMOTE VIDEO
    // ======================================

    if (remoteVideo) {

        remoteVideo.srcObject =
            stream;

        remoteVideo.autoplay =
            true;

        remoteVideo.playsInline =
            true;

    }


    // ======================================
    // USER VIDEO CONTAINER
    // ======================================

    if (
        !userVideoContainer
    ) {

        return;

    }


    let card =
        document.getElementById(
            "user-" + socketId
        );


    if (!card) {

        card =
            document.createElement(
                "div"
            );


        card.className =
            "user-video-card";


        card.id =
            "user-" + socketId;


        const video =
            document.createElement(
                "video"
            );


        video.autoplay =
            true;

        video.playsInline =
            true;

        video.className =
            "remote-user-video";


        const nameDiv =
            document.createElement(
                "div"
            );


        nameDiv.className =
            "user-name";


        nameDiv.innerText =
            name || "Guest";


        card.appendChild(
            video
        );


        card.appendChild(
            nameDiv
        );


        userVideoContainer.appendChild(
            card
        );

    }


    const video =
        card.querySelector(
            "video"
        );


    if (video) {

        video.srcObject =
            stream;

        video.autoplay =
            true;

        video.playsInline =
            true;

    }

}


// ==========================================
// REMOVE REMOTE USER
// ==========================================

function removeRemoteUser(
    socketId
) {

    const peer =
        peerConnections[
            socketId
        ];


    if (peer) {

        peer.close();

        delete peerConnections[
            socketId
        ];

    }


    delete pendingIceCandidates[
        socketId
    ];


    delete remoteUserNames[
        socketId
    ];


    const card =
        document.getElementById(
            "user-" + socketId
        );


    if (card) {

        card.remove();

    }


    if (remoteVideo) {

        remoteVideo.srcObject =
            null;

    }

}


// ==========================================
// START CAMERA
// ==========================================

async function startCamera() {

    if (localStream) {

        return;

    }


    try {

        localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: true,

                    audio: true

                });


        if (localVideo) {

            localVideo.srcObject =
                localStream;

            localVideo.autoplay =
                true;

            localVideo.playsInline =
                true;

            localVideo.muted =
                true;

        }


        cameraOn =
            true;

        micOn =
            true;


        if (cameraBtn) {

            cameraBtn.innerText =
                "📷 Camera ON";

        }


        if (micBtn) {

            micBtn.innerText =
                "🎤 Mic ON";

        }


        // ==================================
        // ADD TRACKS TO EXISTING CONNECTIONS
        // ==================================

        Object.values(
            peerConnections
        ).forEach(
            peer => {

                const senders =
                    peer.getSenders();


                localStream
                    .getTracks()
                    .forEach(
                        track => {

                            const alreadyAdded =
                                senders.some(
                                    sender =>
                                        sender.track &&
                                        sender.track.kind ===
                                        track.kind
                                );


                            if (
                                !alreadyAdded
                            ) {

                                peer.addTrack(
                                    track,
                                    localStream
                                );

                            }

                        }
                    );

            }
        );


        console.log(
            "Camera started"
        );

    }

    catch (error) {

        console.error(
            "Camera Error:",
            error
        );


        cameraOn =
            false;

        micOn =
            false;


        if (cameraBtn) {

            cameraBtn.innerText =
                "📷 Camera OFF";

        }


        if (micBtn) {

            micBtn.innerText =
                "🔇 Mic OFF";

        }


        alert(
            "Camera/Microphone permission मिळाली नाही."
        );

    }

}


// ==========================================
// CAMERA BUTTON
// ==========================================

if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        async function () {

            if (!localStream) {

                await startCamera();

                return;

            }


            const tracks =
                localStream
                    .getVideoTracks();


            if (
                tracks.length === 0
            ) {

                return;

            }


            cameraOn =
                !cameraOn;


            tracks.forEach(
                track => {

                    track.enabled =
                        cameraOn;

                }
            );


            cameraBtn.innerText =
                cameraOn
                    ? "📷 Camera ON"
                    : "🚫 Camera OFF";

        }
    );

}


// ==========================================
// MIC BUTTON
// ==========================================

if (micBtn) {

    micBtn.addEventListener(
        "click",
        async function () {

            if (!localStream) {

                await startCamera();

                return;

            }


            const tracks =
                localStream
                    .getAudioTracks();


            if (
                tracks.length === 0
            ) {

                return;

            }


            micOn =
                !micOn;


            tracks.forEach(
                track => {

                    track.enabled =
                        micOn;

                }
            );


            micBtn.innerText =
                micOn
                    ? "🎤 Mic ON"
                    : "🔇 Mic OFF";

        }
    );

}


// ==========================================
// JOIN MEETING
// ==========================================

socket.emit(
    "join-meeting",
    {

        meetingId:
            meetingId,

        userName:
            userName

    }
);


// ==========================================
// PARTICIPANT UPDATE
// ==========================================

socket.on(
    "update-participants",
    function (users) {

        if (
            !participantsElement
        ) {

            return;

        }


        participantsElement.innerHTML =
            "";


        if (
            !Array.isArray(users) ||
            users.length === 0
        ) {

            participantsElement.innerHTML =
                "<p>No participants</p>";

            return;

        }


        users.forEach(
            function (user) {

                const p =
                    document.createElement(
                        "p"
                    );


                let name =
                    user.userName ||
                    "Guest";


                if (
                    name === "Host"
                ) {

                    name =
                        "👑 Host";

                }


                p.innerText =
                    "🟢 " + name;


                participantsElement
                    .appendChild(
                        p
                    );

            }
        );

    }
);


// ==========================================
// USER JOINED
// ==========================================

socket.on(
    "user-joined",
    async function (data) {

        console.log(
            "User joined:",
            data
        );


        if (
            !data ||
            !data.socketId
        ) {

            return;

        }


        // Wait until camera is available
        if (!localStream) {

            console.log(
                "Waiting for local camera..."
            );

            await startCamera();

        }


        try {

            const peer =
                createPeerConnection(
                    data.socketId,
                    data.userName
                );


            const offer =
                await peer.createOffer();


            await peer.setLocalDescription(
                offer
            );


            socket.emit(
                "webrtc-offer",
                {

                    targetSocketId:
                        data.socketId,

                    offer:
                        offer

                }
            );


            console.log(
                "Offer sent to:",
                data.socketId
            );

        }

        catch (error) {

            console.error(
                "Offer Error:",
                error
            );

        }

    }
);


// ==========================================
// RECEIVE OFFER
// ==========================================

socket.on(
    "webrtc-offer",
    async function (data) {

        console.log(
            "Offer received:",
            data
        );


        if (
            !data ||
            !data.fromSocketId
        ) {

            return;

        }


        try {

            if (!localStream) {

                await startCamera();

            }


            const peer =
                createPeerConnection(
                    data.fromSocketId,
                    data.userName
                );


            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    data.offer
                )
            );


            await addPendingIce(
                data.fromSocketId
            );


            const answer =
                await peer.createAnswer();


            await peer.setLocalDescription(
                answer
            );


            socket.emit(
                "webrtc-answer",
                {

                    targetSocketId:
                        data.fromSocketId,

                    answer:
                        answer

                }
            );


            console.log(
                "Answer sent to:",
                data.fromSocketId
            );

        }

        catch (error) {

            console.error(
                "Offer handling error:",
                error
            );

        }

    }
);


// ==========================================
// RECEIVE ANSWER
// ==========================================

socket.on(
    "webrtc-answer",
    async function (data) {

        console.log(
            "Answer received:",
            data
        );


        if (
            !data ||
            !data.fromSocketId
        ) {

            return;

        }


        try {

            const peer =
                peerConnections[
                    data.fromSocketId
                ];


            if (!peer) {

                console.log(
                    "Peer not found for answer"
                );

                return;

            }


            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    data.answer
                )
            );


            await addPendingIce(
                data.fromSocketId
            );

        }

        catch (error) {

            console.error(
                "Answer Error:",
                error
            );

        }

    }
);


// ==========================================
// RECEIVE ICE
// ==========================================

socket.on(
    "webrtc-ice-candidate",
    async function (data) {

        if (
            !data ||
            !data.fromSocketId ||
            !data.candidate
        ) {

            return;

        }


        const socketId =
            data.fromSocketId;


        const peer =
            peerConnections[
                socketId
            ];


        if (!peer) {

            return;

        }


        // Remote description not ready
        if (
            !peer.remoteDescription ||
            !peer.remoteDescription.type
        ) {

            if (
                !pendingIceCandidates[
                    socketId
                ]
            ) {

                pendingIceCandidates[
                    socketId
                ] = [];

            }


            pendingIceCandidates[
                socketId
            ].push(
                data.candidate
            );


            return;

        }


        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    data.candidate
                )
            );

        }

        catch (error) {

            console.error(
                "ICE Error:",
                error
            );

        }

    }
);

// ==========================================
// MEETING ENDED BY HOST
// ==========================================

socket.on(
    "meeting-ended",
    function (data) {

        console.log(
            "Meeting ended:",
            data
        );

        alert(
            data?.message ||
            "Host has ended the meeting."
        );

        // Stop timer
        clearInterval(
            timerInterval
        );

        // Stop camera and microphone
        if (localStream) {

            localStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );

            localStream = null;
        }

        // Close WebRTC connections
        Object.values(
            peerConnections
        ).forEach(
            peer => {

                try {
                    peer.close();
                }

                catch (error) {}
            }
        );

        // Clear meeting data
        localStorage.removeItem(
            "meetingStarted"
        );

        localStorage.removeItem(
            "joinedUser"
        );

        // Disconnect socket
        try {

            socket.disconnect();

        }

        catch (error) {}

        // Go to dashboard
        window.location.href =
            "dashboard.html";

    }
);

// ==========================================
// USER LEFT
// ====================
socket.on(
    "user-left",
    function (data) {

        if (
            !data ||
            !data.socketId
        ) {

            return;

        }


        console.log(
            "User left:",
            data.userName
        );


        removeRemoteUser(
            data.socketId
        );

    }
);

// ==========================================
// HOST ENDED MEETING
// ==========================================

socket.on(
    "meeting-ended",
    function (data) {

        console.log(
            "Meeting ended by host:",
            data
        );

        // Stop timer
        if (timerInterval) {

            clearInterval(
                timerInterval
            );

        }

        // Stop camera and microphone
        if (localStream) {

            localStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );

            localStream = null;
        }

        // Close peer connections
        Object.values(
            peerConnections
        ).forEach(
            peer => {

                try {
                    peer.close();
                }
                catch (error) {
                    console.log(error);
                }

            }
        );

        // Disconnect socket
        try {

            socket.disconnect();

        }
        catch (error) {

            console.log(error);

        }

        // Clear local meeting data
        localStorage.removeItem(
            "meetingStarted"
        );

        localStorage.removeItem(
            "joinedUser"
        );

        // Tell user
        alert(
            "Host has ended the meeting."
        );

        // Go dashboard
        window.location.href =
            "dashboard.html";

    }
);

// ==========================================
// CHAT SEND
// ==========================================

function sendMessage() {

    if (!chatBox) {

        return;

    }


    const message =
        chatBox.value.trim();


    if (!message) {

        return;

    }


    socket.emit(
        "send-message",
        {

            meetingId:
                meetingId,

            userName:
                userName,

            message:
                message

        }
    );


    chatBox.value =
        "";

}


if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        sendMessage
    );

}


if (chatBox) {

    chatBox.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );

}


// ==========================================
// RECEIVE CHAT
// ==========================================

socket.on(
    "receive-message",
    function (data) {

        if (!messages) {

            return;

        }


        const div =
            document.createElement(
                "div"
            );


        div.style.padding =
            "8px";

        div.style.marginBottom =
            "6px";

        div.style.background =
            "#f1f5f9";

        div.style.borderRadius =
            "8px";


        const strong =
            document.createElement(
                "strong"
            );


        strong.innerText =
            data.userName +
            ": ";


        div.appendChild(
            strong
        );


        div.appendChild(
            document.createTextNode(
                data.message
            )
        );


        messages.appendChild(
            div
        );


        messages.scrollTop =
            messages.scrollHeight;

    }
);


// ==========================================
// COPY MEETING ID
// ==========================================

if (copyBtn) {

    copyBtn.addEventListener(
        "click",
        async function () {

            try {

                await navigator.clipboard
                    .writeText(
                        String(meetingId)
                    );


                alert(
                    "Meeting ID copied!"
                );

            }

            catch (error) {

                alert(
                    "Unable to copy Meeting ID."
                );

            }

        }
    );

}

// ==========================================
// TIMER
// ==========================================

let remainingSeconds =
    meetingDuration * 60;


let timerInterval;


function updateTimer() {

    if (!timerElement) {

        return;

    }


    const hours =
        Math.floor(
            remainingSeconds / 3600
        );


    const minutes =
        Math.floor(
            (remainingSeconds % 3600) / 60
        );


    const seconds =
        remainingSeconds % 60;


    timerElement.innerText =

        String(hours)
            .padStart(2, "0")
        + ":" +

        String(minutes)
            .padStart(2, "0")
        + ":" +

        String(seconds)
            .padStart(2, "0");


    if (
        remainingSeconds <= 0
    ) {

        clearInterval(
            timerInterval
        );


        endMeeting();

        return;

    }


    remainingSeconds--;

}


updateTimer();


timerInterval =
    setInterval(
        updateTimer,
        1000
    );


// ==========================================
// SCREEN SHARE
// ==========================================

if (screenBtn) {

    screenBtn.addEventListener(
        "click",
        async function () {

            try {

                const screenStream =
                    await navigator.mediaDevices
                        .getDisplayMedia({

                            video: true

                        });


                const screenTrack =
                    screenStream
                        .getVideoTracks()[0];


                if (localVideo) {

                    localVideo.srcObject =
                        screenStream;

                }


                screenTrack.onended =
                    function () {

                        if (
                            localStream &&
                            localVideo
                        ) {

                            localVideo.srcObject =
                                localStream;

                        }

                    };

            }

            catch (error) {

                console.log(
                    "Screen share cancelled"
                );

            }

        }
    );

}


// ==========================================
// LEAVE BUTTON
// ==========================================

if (leaveBtn) {

    leaveBtn.addEventListener(
        "click",
        function () {

            const confirmLeave =
                confirm(
                    isHost
                        ? "Are you sure you want to end this meeting?"
                        : "Are you sure you want to leave the meeting?"
                );


            if (!confirmLeave) {

                return;

            }


            leaveMeeting();

        }
    );

}


// ==========================================
// LEAVE MEETING
// ==========================================

function leaveMeeting() {

    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }


    // Stop camera and microphone
    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => track.stop());

        localStream = null;
    }


    // Close WebRTC connections
    Object.values(peerConnections)
        .forEach(peer => {

            try {
                peer.close();
            } catch (error) {
                console.log(error);
            }

        });


    // Tell Socket.IO
    if (socket.connected) {

        socket.emit("leave-meeting");

    }


    // ==========================================
    // HOST
    // ==========================================

    if (isHost) {

        // End meeting in database
        fetch(
            "https://smartmeet-production.up.railway.app/api/meetings/end/" +
            encodeURIComponent(meetingId),
            {
                method: "PUT"
            }
        )
        .then(response => response.json())
        .then(data => {
            console.log("Meeting End:", data);
        })
        .catch(error => {
            console.error("End Meeting Error:", error);
        });

    }


    // ==========================================
    // GO TO DASHBOARD IMMEDIATELY
    // ==========================================

    finishLeaving();
}


// ==========================================
// TIMER END
// ==========================================

function endMeeting() {

    if (isHost) {

        fetch(
            "http://localhost:3000/api/meetings/end/" +
            encodeURIComponent(
                meetingId
            ),
            {

                method:
                    "PUT"

            }
        )
        .then(
            () => {

                finishLeaving();

            }
        )
        .catch(
            () => {

                finishLeaving();

            }
        );

    }

    else {

        finishLeaving();

    }

}


// ==========================================
// FINISH LEAVING
// ==========================================

function finishLeaving() {

    try {

        socket.disconnect();

    }

    catch (error) {

        console.log(error);

    }


    localStorage.removeItem(
        "meetingStarted"
    );


    localStorage.removeItem(
        "joinedUser"
    );


    window.location.href =
        "dashboard.html";

}


// ==========================================
// SOCKET CONNECT
// ==========================================

socket.on(
    "connect",
    function () {

        console.log(
            "Connected to SmartMeet:",
            socket.id
        );

    }
);


// ==========================================
// SOCKET ERROR
// ==========================================

socket.on(
    "connect_error",
    function (error) {

        console.error(
            "Socket Connection Error:",
            error
        );

    }
);


