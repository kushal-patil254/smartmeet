alert("MEETING JS LOADED");

// ==========================================
// SMARTMEET - MEETING.JS
// Railway + GitHub Pages + Android Native Screen Share
// ==========================================

const API_URL =
    "https://smartmeet-production.up.railway.app";

const SOCKET_URL =
    "https://smartmeet-production.up.railway.app";

if (typeof io === "undefined") {
    alert("SmartMeet Error: Socket.IO did not load.");
    throw new Error("Socket.IO is not loaded in WebView");
}

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

const urlParams =
    new URLSearchParams(window.location.search);

const handoffMeetingId =
    urlParams.get("meetingId");

const handoffUser =
    urlParams.get("user");

// Chrome handoff
if (
    urlParams.get("screenShare") === "1" &&
    handoffMeetingId
) {

    localStorage.setItem(
        "hostMeetingId",
        handoffMeetingId
    );

    if (handoffUser) {

        localStorage.setItem(
            "joinedUser",
            JSON.stringify({
                name: handoffUser
            })
        );
    }
}

const meetingId =
    handoffMeetingId ||
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

let storedUser = localStorage.getItem("joinedUser");

let userName = "Guest";

if (storedUser) {
    try {
        const parsedUser = JSON.parse(storedUser);

        if (parsedUser && parsedUser.name) {
            userName = String(parsedUser.name);
        } else {
            userName = String(storedUser);
        }
    } catch (error) {
        userName = String(storedUser);
    }
}

userName = userName.trim() || "Guest";

const isHost = userName === "Host";

let joinApproved = isHost;

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

    alert(
        "Meeting information not found."
    );

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
// ANDROID NATIVE SCREEN SHARE
// ==========================================

let androidScreenCanvas = null;

let androidScreenContext = null;

let androidScreenStream = null;

let androidScreenTrack = null;

let androidScreenImage = null;

let androidFrameBusy = false;

let androidLastFrameTime = 0;

const ANDROID_FRAME_INTERVAL = 100;

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
    // ICE
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

        } catch (error) {

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

    if (!userVideoContainer) {
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

        video.autoplay = true;
        video.playsInline = true;
        video.controls = false;
        video.muted = false;

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

        card.appendChild(video);
        card.appendChild(nameDiv);

        userVideoContainer.appendChild(
            card
        );
    }

    const video =
        card.querySelector(
            "video"
        );

    if (!video) {
        return;
    }

    video.srcObject =
        stream;

    video.autoplay = true;
    video.playsInline = true;
    video.muted = false;

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

    if (localStream) {
        return true;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        alert(
            "Camera/Microphone is not supported."
        );

        return false;
    }

    let videoStream = null;
    let audioStream = null;

    try {

        // CAMERA
        videoStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: "user"
                },

                audio: false
            });

        // MICROPHONE
        try {

            audioStream =
                await navigator.mediaDevices.getUserMedia({

                    video: false,

                    audio: true
                });

        } catch (audioError) {

            console.error(
                "Microphone error:",
                audioError
            );

            videoStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            alert(
                "Microphone could not start: " +
                audioError.message
            );

            return false;
        }

        // COMBINE CAMERA + MIC
        localStream =
            new MediaStream([

                ...videoStream
                    .getVideoTracks(),

                ...audioStream
                    .getAudioTracks()

            ]);

        // SHOW LOCAL VIDEO
        if (localVideo) {

            localVideo.srcObject =
                localStream;

            localVideo.autoplay =
                true;

            localVideo.playsInline =
                true;

            localVideo.muted =
                true;

            try {

                await localVideo.play();

            } catch (error) {

                console.log(
                    "Local video play:",
                    error
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

        // ADD MEDIA TO EXISTING PEERS
        Object.values(
            peerConnections
        ).forEach(
            peer => {

                localStream
                    .getTracks()
                    .forEach(
                        track => {

                            const sender =
                                peer
                                    .getSenders()
                                    .find(
                                        item =>
                                            item.track &&
                                            item.track.kind ===
                                            track.kind
                                    );

                            if (sender) {

                                sender
                                    .replaceTrack(
                                        track
                                    );

                            } else {

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
            "Camera + Microphone ready."
        );

        return true;

    } catch (error) {

        console.error(
            "Camera/Microphone Error:",
            error
        );

        if (videoStream) {

            videoStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }

        if (audioStream) {

            audioStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }

        localStream = null;

        cameraOn = false;

        micOn = false;

        updateMediaButtons();

        alert(
            "Unable to start camera/microphone: " +
            error.message
        );

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
// ANDROID SCREEN FRAME
// ==========================================

window.__smartMeetNativeScreenFrame = function(base64) {

        if (
            !screenSharing ||
            !androidScreenCanvas ||
            !androidScreenContext
        ) {

            return;
        }

        const now =
            Date.now();

        if (
            now -
            androidLastFrameTime <
            ANDROID_FRAME_INTERVAL
        ) {

            return;
        }

        if (androidFrameBusy) {
            return;
        }

        androidFrameBusy =
            true;

        androidLastFrameTime =
            now;

        const image =
            new Image();

        androidScreenImage =
            image;

        image.onload =
            function () {

                try {

                    if (
                        !androidScreenCanvas ||
                        !androidScreenContext
                    ) {

                        return;
                    }

                    if (
                        androidScreenCanvas.width !==
                        image.naturalWidth
                    ) {

                        androidScreenCanvas.width =
                            image.naturalWidth;
                    }

                    if (
                        androidScreenCanvas.height !==
                        image.naturalHeight
                    ) {

                        androidScreenCanvas.height =
                            image.naturalHeight;
                    }

                    androidScreenContext.drawImage(
                        image,
                        0,
                        0,
                        androidScreenCanvas.width,
                        androidScreenCanvas.height
                    );

                } catch (error) {

                    console.error(
                        "Android frame draw error:",
                        error
                    );

                } finally {

                    androidFrameBusy =
                        false;

                    androidScreenImage =
                        null;
                }
            };

        image.onerror =
            function () {

                androidFrameBusy =
                    false;

                androidScreenImage =
                    null;
            };

        image.src =
            "data:image/jpeg;base64," +
            base64;
    };

// ==========================================
// ANDROID SCREEN SHARE STARTED
// ==========================================

window.onAndroidScreenShareStarted =
    async function () {

        console.log(
            "Android native screen capture started."
        );

        try {

            if (
                androidScreenStream
            ) {

                return;
            }

            // ==================================
            // CREATE CANVAS
            // ==================================

            androidScreenCanvas =
                document.createElement(
                    "canvas"
                );

            androidScreenCanvas.width =
                1280;

            androidScreenCanvas.height =
                720;

            androidScreenCanvas.style.display =
                "none";

            document.body.appendChild(
                androidScreenCanvas
            );

            androidScreenContext =
                androidScreenCanvas.getContext(
                    "2d"
                );

            if (
                !androidScreenContext
            ) {

                throw new Error(
                    "Canvas is not available."
                );
            }

            // ==================================
            // CANVAS → MEDIA STREAM
            // ==================================

            if (
                typeof androidScreenCanvas
                    .captureStream !==
                "function"
            ) {

                throw new Error(
                    "Canvas screen sharing is not supported by this WebView."
                );
            }

            androidScreenStream =
                androidScreenCanvas
                    .captureStream(10);

            androidScreenTrack =
                androidScreenStream
                    .getVideoTracks()[0];

            if (
                !androidScreenTrack
            ) {

                throw new Error(
                    "Unable to create screen video track."
                );
            }

            // ==================================
            // SCREEN SHARE ACTIVE
            // ==================================

            screenStream =
                androidScreenStream;

            screenSharing =
                true;

            updateMediaButtons();

            // ==================================
            // SHOW SCREEN LOCALLY
            // ==================================

            if (localVideo) {

                localVideo.srcObject =
                    androidScreenStream;

                localVideo.autoplay =
                    true;

                localVideo.playsInline =
                    true;

                localVideo.muted =
                    true;

                try {

                    await localVideo.play();

                } catch (error) {

                    console.log(
                        "Android screen local play:",
                        error
                    );
                }
            }

            // ==================================
            // REPLACE VIDEO TRACK
            // ==================================

            Object.values(
                peerConnections
            ).forEach(
                async peer => {

                    const sender =
                        peer
                            .getSenders()
                            .find(
                                item =>
                                    item.track &&
                                    item.track.kind ===
                                    "video"
                            );

                    if (sender) {

                        try {

                            await sender.replaceTrack(
                                androidScreenTrack
                            );

                        } catch (error) {

                            console.error(
                                "Android screen replace error:",
                                error
                            );
                        }
                    }
                }
            );

            console.log(
                "Android screen track connected to WebRTC."
            );

        } catch (error) {

            console.error(
                "Android screen share setup error:",
                error
            );

            screenSharing =
                false;

            updateMediaButtons();

            alert(
                "Android Screen Share error: " +
                error.message
            );

            if (
                typeof AndroidBridge !==
                "undefined"
            ) {

                try {

                    AndroidBridge.stopScreenShare();

                } catch (e) {}
            }
        }
    };
    // ==========================================
// ANDROID SCREEN SHARE ERROR
// ==========================================

window.onAndroidScreenShareError =
    function (message) {

        console.error(
            "Android screen share error:",
            message
        );

        screenSharing =
            false;

        updateMediaButtons();

        alert(
            "Screen Share error: " +
            (message || "Unknown error")
        );
    };

// ==========================================
// ANDROID SCREEN SHARE STOPPED
// ==========================================

window.__smartMeetNativeScreenStopped = async function() {

        console.log(
            "Android native screen share stopped."
        );

        await restoreCameraAfterScreenShare();
    };

// ==========================================
// RESTORE CAMERA
// ==========================================

async function restoreCameraAfterScreenShare() {

    screenSharing =
        false;

    // ==================================
    // STOP ANDROID STREAM
    // ==================================

    if (
        androidScreenStream
    ) {

        androidScreenStream
            .getTracks()
            .forEach(
                track => {

                    try {
                        track.stop();
                    }

                    catch (error) {}
                }
            );
    }

    androidScreenStream =
        null;

    androidScreenTrack =
        null;

    // ==================================
    // REMOVE CANVAS
    // ==================================

    if (
        androidScreenCanvas
    ) {

        try {
            androidScreenCanvas.remove();
        }

        catch (error) {}
    }

    androidScreenCanvas =
        null;

    androidScreenContext =
        null;

    androidScreenImage =
        null;

    androidFrameBusy =
        false;

    androidLastFrameTime =
        0;

    // ==================================
    // RESTORE CAMERA
    // ==================================

    if (
        localStream
    ) {

        const cameraTrack =
            localStream
                .getVideoTracks()[0];

        if (cameraTrack) {

            cameraTrack.enabled =
                cameraOn;

            if (localVideo) {

                localVideo.srcObject =
                    localStream;

                localVideo.autoplay =
                    true;

                localVideo.playsInline =
                    true;

                localVideo.muted =
                    true;

                try {

                    await localVideo.play();

                } catch (error) {

                    console.log(
                        "Camera restore play:",
                        error
                    );
                }
            }

            Object.values(
                peerConnections
            ).forEach(
                async peer => {

                    const sender =
                        peer
                            .getSenders()
                            .find(
                                item =>
                                    item.track &&
                                    item.track.kind ===
                                    "video"
                            );

                    if (sender) {

                        try {

                            await sender.replaceTrack(
                                cameraTrack
                            );

                        } catch (error) {

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

    screenStream =
        null;

    updateMediaButtons();
}

// ==========================================
// DESKTOP SCREEN SHARE STOP
// ==========================================

function stopScreenShare() {

    // ==================================
    // ANDROID
    // ==================================

    if (
        /Android/i.test(
            navigator.userAgent
        ) &&
        typeof AndroidBridge !==
            "undefined"
    ) {

        try {

            AndroidBridge.stopScreenShare();

        } catch (error) {

            console.error(
                "Android stop screen error:",
                error
            );

            restoreCameraAfterScreenShare();
        }

        return;
    }

    // ==================================
    // DESKTOP
    // ==================================

    if (
        screenStream
    ) {

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
    }

    screenStream =
        null;

    screenSharing =
        false;

    // ==================================
    // RESTORE CAMERA
    // ==================================

    if (
        localStream
    ) {

        const cameraTrack =
            localStream
                .getVideoTracks()[0];

        if (cameraTrack) {

            if (localVideo) {

                localVideo.srcObject =
                    localStream;
            }

            Object.values(
                peerConnections
            ).forEach(
                async peer => {

                    const sender =
                        peer
                            .getSenders()
                            .find(
                                item =>
                                    item.track &&
                                    item.track.kind ===
                                    "video"
                            );

                    if (sender) {

                        try {

                            await sender.replaceTrack(
                                cameraTrack
                            );

                        } catch (error) {

                            console.error(
                                "Desktop camera restore error:",
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
// SCREEN SHARE BUTTON
// ==========================================

if (screenBtn) {

    screenBtn.addEventListener(
        "click",
        async function () {

            console.log(
                "SCREEN SHARE BUTTON CLICKED"
            );

            // ==================================
            // STOP CURRENT SHARE
            // ==================================

            if (screenSharing) {

                stopScreenShare();

                return;
            }

            // ==================================
            // ANDROID NATIVE SCREEN SHARE
            // ==================================

            if (
                /Android/i.test(
                    navigator.userAgent
                ) &&
                typeof AndroidBridge !==
                    "undefined"
            ) {

                try {

                    AndroidBridge.startScreenShare();

                } catch (error) {

                    console.error(
                        "Native screen share error:",
                        error
                    );

                    alert(
                        "Screen Share error: " +
                        error.message
                    );
                }

                return;
            }

            // ==================================
            // DESKTOP SCREEN SHARE
            // ==================================

            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getDisplayMedia
            ) {

                alert(
                    "This browser does not support screen sharing."
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
                // LOCAL SCREEN
                // ==================================

                if (localVideo) {

                    localVideo.srcObject =
                        screenStream;
                }

                // ==================================
                // SEND SCREEN TO PEERS
                // ==================================

                Object.values(
                    peerConnections
                ).forEach(
                    async peer => {

                        const sender =
                            peer
                                .getSenders()
                                .find(
                                    item =>
                                        item.track &&
                                        item.track.kind ===
                                        "video"
                                );

                        if (sender) {

                            try {

                                await sender.replaceTrack(
                                    screenTrack
                                );

                            } catch (error) {

                                console.error(
                                    "Screen replace error:",
                                    error
                                );
                            }
                        }
                    }
                );

                // ==================================
                // SYSTEM STOP
                // ==================================

                screenTrack.onended =
                    function () {

                        stopScreenShare();
                    };

            } catch (error) {

                console.error(
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
// SOCKET CONNECT
// ==========================================

socket.on("connect", function () {

    console.log(
        "Connected to SmartMeet:",
        socket.id
    );

    socket.emit("join-meeting", {
        meetingId: meetingId,
        userName: userName
    });
});

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
// JOIN REQUEST SENT
// ==========================================

socket.on("join-request-sent", function (data) {

    joinApproved = false;

    alert(
        data?.message ||
        "Join request sent. Please wait for Host approval."
    );

    console.log(
        "Waiting for Host approval..."
    );
});


// ==========================================
// HOST RECEIVES JOIN REQUEST
// ==========================================

socket.on("join-request", function (data) {

    if (!isHost) {
        return;
    }

    const requesterName =
        data?.userName || "Guest";

    const requesterSocketId =
        data?.socketId;

    if (!requesterSocketId) {
        return;
    }

    const accepted =
        window.confirm(
            requesterName +
            " wants to join the meeting.\n\n" +
            "Press OK to Accept\n" +
            "Press Cancel to Reject"
        );

    if (accepted) {

        socket.emit(
            "approve-join",
            {
                targetSocketId:
                    requesterSocketId
            }
        );

    } else {

        socket.emit(
            "reject-join",
            {
                targetSocketId:
                    requesterSocketId
            }
        );
    }
});

// ==========================================
// PARTICIPANT APPROVED
// ==========================================

socket.on("join-approved", async function (data) {

    console.log(
        "JOIN APPROVED:",
        data
    );

    joinApproved = true;

    alert(
        data?.message ||
        "Host approved your request."
    );

    // Start camera/mic first
    try {

        await startCamera();

        console.log(
            "Participant camera/mic ready."
        );

        // Tell server that participant is ready
        socket.emit(
            "participant-ready"
        );

    } catch (error) {

        console.error(
            "Camera start error:",
            error
        );
    }

    console.log(
        "Participant is now inside meeting."
    );
});


// ==========================================
// HOST SIDE APPROVAL CONFIRMATION
// ==========================================

socket.on(
    "join-approved-host",
    function (data) {

        console.log(
            "Participant approved:",
            data?.userName
        );
    }
);

// ==========================================
// PARTICIPANT REJECTED
// ==========================================

socket.on("join-rejected", function (data) {

    joinApproved = false;

    alert(
        data?.message ||
        "Host rejected your join request."
    );

    console.log(
        "Join request rejected."
    );
});
// ==========================================
// JOIN REQUEST ERROR
// ==========================================

socket.on(
    "join-request-error",
    function (data) {

        joinApproved = false;

        alert(
            data?.message ||
            "Unable to join meeting."
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

socket.on("user-joined", async function (data) {

    console.log("User joined:", data);

    if (!data || !data.socketId) {
        return;
    }

    try {

        const peer = createPeerConnection(
            data.socketId,
            data.userName
        );

        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
            targetSocketId: data.socketId,
            offer: offer
        });

        console.log(
            "WebRTC offer sent to:",
            data.socketId
        );

    } catch (error) {

        console.error(
            "WebRTC offer error:",
            error
        );
    }
});
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

        } catch (error) {

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

        } catch (error) {

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

        } catch (error) {

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

        } catch (error) {}

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
// ==========================================
// CHAT PANEL TOGGLE
// ==========================================

const chatBtn =
    document.getElementById("chatBtn");

const sidePanel =
    document.querySelector(".side-panel");

if (chatBtn && sidePanel) {

    chatBtn.addEventListener(
        "click",
        function () {

            sidePanel.classList.toggle(
                "chat-open"
            );

        }
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

                } else {

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

            } catch (error) {

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
// STOP ALL MEDIA
// ==========================================

function stopAllMedia() {

    // Android screen share
    if (
        /Android/i.test(
            navigator.userAgent
        ) &&
        typeof AndroidBridge !==
            "undefined" &&
        screenSharing
    ) {

        try {

            AndroidBridge.stopScreenShare();

        } catch (error) {}
    }

    // Native canvas stream
    if (
        androidScreenStream
    ) {

        androidScreenStream
            .getTracks()
            .forEach(
                track => {

                    try {
                        track.stop();
                    }

                    catch (error) {}
                }
            );
    }

    androidScreenStream =
        null;

    androidScreenTrack =
        null;

    if (
        androidScreenCanvas
    ) {

        try {
            androidScreenCanvas.remove();
        }

        catch (error) {}
    }

    androidScreenCanvas =
        null;

    androidScreenContext =
        null;

    androidScreenImage =
        null;

    androidFrameBusy =
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

    } else {

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

    } catch (error) {}

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