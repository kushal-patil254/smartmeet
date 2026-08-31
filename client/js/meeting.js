// ==========================================
// MOBILE LANDSCAPE MODE - MEETING PAGE ONLY
// ==========================================

async function enableMeetingLandscape() {

    // Mobile/Tablet only
    if (window.innerWidth > 800) {
        return;
    }

    try {

        // Android browsers/WebView that support screen orientation
        if (screen.orientation && screen.orientation.lock) {

            await screen.orientation.lock("landscape");

            console.log("SmartMeet: Landscape locked");

        }

    } catch (error) {

        console.log(
            "Landscape lock not supported by this browser:",
            error
        );

    }
}


// Try when meeting page loads
enableMeetingLandscape();


// Try again after user interaction
document.addEventListener(
    "click",
    function () {

        enableMeetingLandscape();

    },
    { once: true }
);



// ==========================================
// SMARTMEET - MEETING.JS
// Railway + GitHub Pages + Mobile Support
// ==========================================

const API_URL =
    "https://smartmeet-production.up.railway.app";

const SOCKET_URL =
    "https://smartmeet-production.up.railway.app";


// ==========================================
// SOCKET.IO
// ==========================================

const socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    timeout: 20000
});


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
        localStorage.getItem("meetingDuration"),
        10
    ) || 60;


// ==========================================
// USER
// ==========================================

let userName =
    localStorage.getItem("joinedUser");

if (!userName) {
    userName = "Guest";
}

const isHost =
    userName === "Host";


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
    document.getElementById(
        "userVideoContainer"
    );


// ==========================================
// CHECK MEETING
// ==========================================

if (!meetingId) {

    alert("Meeting information not found.");

    window.location.href =
        "dashboard.html";
}


// ==========================================
// SHOW MEETING INFO
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

let screenStream = null;

let screenSharing = false;


// ==========================================
// WEBRTC
// ==========================================

const peerConnections = {};

const pendingIceCandidates = {};

const remoteUserNames = {};


// ==========================================
// STUN SERVER
// ==========================================

const rtcConfig = {

    iceServers: [

        {
            urls:
                "stun:stun.l.google.com:19302"
        },

        {
            urls:
                "stun:stun1.l.google.com:19302"
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
                "Remote track received:",
                targetSocketId,
                event.track.kind
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
                "Peer state:",
                targetSocketId,
                peer.connectionState
            );


            if (
                peer.connectionState ===
                "failed"
            ) {

                console.log(
                    "Peer connection failed."
                );

            }


            if (
                peer.connectionState ===
                    "disconnected" ||
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
                "ICE pending error:",
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
    // MAIN REMOTE VIDEO
    // ======================================

    if (remoteVideo) {

        remoteVideo.srcObject =
            stream;

        remoteVideo.autoplay =
            true;

        remoteVideo.playsInline =
            true;

        remoteVideo.controls =
            false;

    }


    // ======================================
    // VIDEO CONTAINER
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

        video.muted =
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

        video.muted =
            true;


        const playPromise =
            video.play();


        if (
            playPromise &&
            typeof playPromise.catch ===
                "function"
        ) {

            playPromise.catch(
                error => {

                    console.log(
                        "Remote video autoplay:",
                        error
                    );

                }
            );

        }

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

        try {
            peer.close();
        }

        catch (error) {}

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
// START CAMERA + MIC
// ==========================================

async function startCamera() {

    // Already started
    if (localStream) {

        return true;

    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        alert(
            "Camera/Microphone is not supported by this browser."
        );

        return false;

    }


    try {

        console.log(
            "Requesting camera and microphone..."
        );


        localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {
                        facingMode: "user"
                    },

                    audio: true

                });


        console.log(
            "Camera/Microphone permission granted."
        );


        if (localVideo) {

            localVideo.srcObject =
                localStream;

            localVideo.autoplay =
                true;

            localVideo.playsInline =
                true;

            localVideo.muted =
                true;


            const playPromise =
                localVideo.play();


            if (
                playPromise &&
                typeof playPromise.catch ===
                    "function"
            ) {

                playPromise.catch(
                    error => {

                        console.log(
                            "Local video play:",
                            error
                        );

                    }
                );

            }

        }


        cameraOn =
            localStream
                .getVideoTracks()
                .some(
                    track =>
                        track.readyState ===
                        "live"
                );


        micOn =
            localStream
                .getAudioTracks()
                .some(
                    track =>
                        track.readyState ===
                        "live"
                );


        updateMediaButtons();


        // ==================================
        // ADD TRACKS TO EXISTING PEERS
        // ==================================

        Object.values(
            peerConnections
        ).forEach(
            peer => {

                localStream
                    .getTracks()
                    .forEach(
                        track => {

                            const senders =
                                peer.getSenders();


                            const sender =
                                senders.find(
                                    item =>
                                        item.track &&
                                        item.track.kind ===
                                            track.kind
                                );


                            if (sender) {

                                sender.replaceTrack(
                                    track
                                );

                            }

                            else {

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
            "Local media ready."
        );


        return true;

    }

    catch (error) {

        console.error(
            "Camera/Microphone Error:",
            error
        );


        localStream =
            null;

        cameraOn =
            false;

        micOn =
            false;


        updateMediaButtons();


        if (
            error.name ===
            "NotAllowedError"
        ) {

            alert(
                "Camera/Microphone permission denied. Please allow Camera and Microphone in browser settings and try again."
            );

        }

        else if (
            error.name ===
            "NotFoundError"
        ) {

            alert(
                "Camera or Microphone not found on this device."
            );

        }

        else {

            alert(
                "Unable to start Camera/Microphone: " +
                error.message
            );

        }


        return false;

    }

}


// ==========================================
// MEDIA BUTTON UI
// ==========================================

function updateMediaButtons() {

    if (cameraBtn) {

        cameraBtn.innerText =
            cameraOn
                ? "📷 Camera ON"
                : "🚫 Camera OFF";

    }


    if (micBtn) {

        micBtn.innerText =
            micOn
                ? "🎤 Mic ON"
                : "🔇 Mic OFF";

    }


    if (screenBtn) {

        screenBtn.innerText =
            screenSharing
                ? "🛑 Stop Share"
                : "🖥 Screen Share";

    }

}


// ==========================================
// CAMERA BUTTON
// ==========================================

if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        async function () {

            // First click = start camera
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

                await startCamera();

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


            updateMediaButtons();

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

            // First click = start media
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

                await startCamera();

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


            updateMediaButtons();

        }
    );

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


        // Join only after Socket.IO connection
        socket.emit(
            "join-meeting",
            {

                meetingId:
                    meetingId,

                userName:
                    userName

            }
        );

    }
);


// ==========================================
// SOCKET CONNECT ERROR
// ==========================================

socket.on(
    "connect_error",
    function (error) {

        console.error(
            "Socket connection error:",
            error
        );

    }
);


// ==========================================
// PARTICIPANTS
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


        try {

            // Existing user creates offer.
            // Camera is NOT forced automatically;
            // user can start it using Camera button.

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
                "Offer sent."
            );

        }

        catch (error) {

            console.error(
                "Offer error:",
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
                "Answer sent."
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
                "Answer error:",
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
                "ICE error:",
                error
            );

        }

    }
);
// ==========================================
// USER LEFT
// ==========================================

socket.on(
    "user-left",
    function (data) {

        if (
            !data ||
            !data.socketId
        ) {

            return;

        }


        removeRemoteUser(
            data.socketId
        );

    }
);


// ==========================================
// MEETING ENDED
// ==========================================

let meetingEndedHandled =
    false;


socket.on(
    "meeting-ended",
    function (data) {

        if (
            meetingEndedHandled
        ) {

            return;

        }


        meetingEndedHandled =
            true;


        console.log(
            "Meeting ended:",
            data
        );


        if (timerInterval) {

            clearInterval(
                timerInterval
            );

        }


        stopAllMedia();


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


        try {

            socket.disconnect();

        }

        catch (error) {}


        localStorage.removeItem(
            "meetingStarted"
        );


        localStorage.removeItem(
            "joinedUser"
        );


        alert(
            data?.message ||
            "Host has ended the meeting."
        );


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


    if (!socket.connected) {

        alert(
            "Chat server is not connected."
        );

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
            (data.userName || "Guest") +
            ": ";


        div.appendChild(
            strong
        );


        div.appendChild(
            document.createTextNode(
                data.message || ""
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

                const text =
                    String(meetingId);


                if (
                    navigator.clipboard &&
                    window.isSecureContext
                ) {

                    await navigator.clipboard
                        .writeText(text);

                }

                else {

                    const temp =
                        document.createElement(
                            "input"
                        );

                    temp.value =
                        text;

                    document.body.appendChild(
                        temp
                    );

                    temp.select();

                    document.execCommand(
                        "copy"
                    );

                    temp.remove();

                }


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

let timerInterval =
    null;


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
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");


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

            // Stop screen sharing
            if (screenSharing) {

                stopScreenShare();

                return;

            }


            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getDisplayMedia
            ) {

                alert(
                    "Screen sharing is not supported by this mobile browser. Please use a supported desktop browser."
                );

                return;

            }


            try {

                screenStream =
                    await navigator.mediaDevices
                        .getDisplayMedia({

                            video: true,

                            audio: false

                        });


                const screenTrack =
                    screenStream
                        .getVideoTracks()[0];


                if (!screenTrack) {

                    return;

                }


                screenSharing =
                    true;


                updateMediaButtons();


                // ==================================
                // SHOW SCREEN LOCALLY
                // ==================================

                if (localVideo) {

                    localVideo.srcObject =
                        screenStream;

                }


                // ==================================
                // SEND SCREEN TRACK TO PEERS
                // ==================================

                Object.values(
                    peerConnections
                ).forEach(
                    async peer => {

                        const sender =
                            peer.getSenders()
                                .find(
                                    item =>
                                        item.track &&
                                        item.track.kind ===
                                            "video"
                                );


                        if (sender) {

                            try {

                                await sender
                                    .replaceTrack(
                                        screenTrack
                                    );

                            }

                            catch (error) {

                                console.error(
                                    "Screen replace error:",
                                    error
                                );

                            }

                        }

                    }
                );


                screenTrack.onended =
                    function () {

                        stopScreenShare();

                    };


            }

            catch (error) {

                console.log(
                    "Screen share error:",
                    error
                );


                screenSharing =
                    false;


                updateMediaButtons();

            }

        }
    );

}


// ==========================================
// STOP SCREEN SHARE
// ==========================================

async function stopScreenShare() {

    if (!screenSharing) {

        return;

    }


    screenSharing =
        false;


    if (screenStream) {

        screenStream
            .getTracks()
            .forEach(
                track => {

                    try {
                        track.stop();
                    }

                    catch (error) {}

                }
            );

        screenStream =
            null;

    }


    // ======================================
    // RESTORE CAMERA
    // ======================================

    if (localStream) {

        const cameraTrack =
            localStream
                .getVideoTracks()[0];


        if (cameraTrack) {

            cameraTrack.enabled =
                cameraOn;


            if (localVideo) {

                localVideo.srcObject =
                    localStream;

            }


            Object.values(
                peerConnections
            ).forEach(
                async peer => {

                    const sender =
                        peer.getSenders()
                            .find(
                                item =>
                                    item.track &&
                                    item.track.kind ===
                                        "video"
                            );


                    if (sender) {

                        try {

                            await sender
                                .replaceTrack(
                                    cameraTrack
                                );

                        }

                        catch (error) {

                            console.error(
                                "Camera restore error:",
                                error
                            );

                        }

                    }

                }
            );

        }

    }


    updateMediaButtons();

}
// ==========================================
// LEAVE BUTTON
// ==========================================

if (leaveBtn) {

    leaveBtn.addEventListener(
        "click",
        function () {

            const message =
                isHost
                    ? "Are you sure you want to end this meeting?"
                    : "Are you sure you want to leave the meeting?";


            const confirmLeave =
                confirm(message);


            if (!confirmLeave) {

                return;

            }


            leaveMeeting();

        }
    );

}


// ==========================================
// STOP ALL MEDIA
// ==========================================

function stopAllMedia() {

    if (screenStream) {

        screenStream
            .getTracks()
            .forEach(
                track => {

                    try {
                        track.stop();
                    }

                    catch (error) {}

                }
            );

        screenStream =
            null;

    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    try {
                        track.stop();
                    }

                    catch (error) {}

                }
            );

        localStream =
            null;

    }


    cameraOn =
        false;

    micOn =
        false;

    screenSharing =
        false;


    updateMediaButtons();

}


// ==========================================
// LEAVE MEETING
// ==========================================

function leaveMeeting() {

    if (
        timerInterval
    ) {

        clearInterval(
            timerInterval
        );

    }


    stopAllMedia();


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


    // ======================================
    // TELL SOCKET SERVER
    // ======================================

    if (
        socket.connected
    ) {

        socket.emit(
            "leave-meeting"
        );

    }


    // ======================================
    // HOST END DATABASE MEETING
    // ======================================

    if (isHost) {

        fetch(
            API_URL +
            "/api/meetings/end/" +
            encodeURIComponent(
                meetingId
            ),
            {

                method:
                    "PUT"

            }
        )
        .then(
            response =>
                response.json()
        )
        .then(
            data => {

                console.log(
                    "Meeting ended:",
                    data
                );

            }
        )
        .catch(
            error => {

                console.error(
                    "End meeting error:",
                    error
                );

            }
        );

    }


    finishLeaving();

}


// ==========================================
// TIMER END
// ==========================================

function endMeeting() {

    if (isHost) {

        fetch(
            API_URL +
            "/api/meetings/end/" +
            encodeURIComponent(
                meetingId
            ),
            {

                method:
                    "PUT"

            }
        )
        .then(
            response =>
                response.json()
        )
        .catch(
            error => {

                console.error(
                    "Timer end error:",
                    error
                );

            }
        )
        .finally(
            function () {

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

    stopAllMedia();


    try {

        socket.disconnect();

    }

    catch (error) {}


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
// PAGE CLOSE / BACK
// ==========================================

window.addEventListener(
    "beforeunload",
    function () {

        if (
            socket.connected
        ) {

            socket.emit(
                "leave-meeting"
            );

        }

    }
);


console.log(
    "SmartMeet meeting.js loaded successfully."
);

