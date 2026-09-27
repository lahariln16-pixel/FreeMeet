/* =========================
   ROOM INFORMATION
========================= */

const roomId =
    window.location.pathname
        .split("/")
        .pop();


const params =
    new URLSearchParams(
        window.location.search
    );


const userName =
    params.get("name") ||
    "Guest";


document.getElementById(
    "roomId"
).textContent = roomId;


document.getElementById(
    "localName"
).textContent = userName;


/* =========================
   ELEMENTS
========================= */

const localVideo =
    document.getElementById(
        "localVideo"
    );


const videoGrid =
    document.getElementById(
        "videoGrid"
    );


const micButton =
    document.getElementById(
        "micButton"
    );


const cameraButton =
    document.getElementById(
        "cameraButton"
    );


const screenButton =
    document.getElementById(
        "screenButton"
    );


const leaveButton =
    document.getElementById(
        "leaveButton"
    );


const copyRoom =
    document.getElementById(
        "copyRoom"
    );


const chatButton =
    document.getElementById(
        "chatButton"
    );


const closeChat =
    document.getElementById(
        "closeChat"
    );


const chatPanel =
    document.getElementById(
        "chatPanel"
    );


const chatMessages =
    document.getElementById(
        "chatMessages"
    );


const chatInput =
    document.getElementById(
        "chatInput"
    );


const sendChat =
    document.getElementById(
        "sendChat"
    );


/* =========================
   STATE
========================= */

let localStream = null;

let socket = null;

let micEnabled = true;

let cameraEnabled = true;

let peer = null;

let pendingCandidates = [];

let remoteUserName = "Guest";


/* =========================
   WEBRTC CONFIG
========================= */

const rtcConfig = {

    iceServers: [

        {
            urls:
                "stun:stun.l.google.com:19302"
        }

    ]

};


/* =========================
   CAMERA + MICROPHONE
========================= */

async function startMedia() {

    try {

        localStream =
            await navigator.mediaDevices
                .getUserMedia({
                    video: true,
                    audio: true
                });


        localVideo.srcObject =
            localStream;


        console.log(
            "Camera + microphone enabled."
        );


        return;

    } catch (error) {

        console.warn(
            "Camera unavailable. Trying microphone only.",
            error
        );

    }


    try {

        localStream =
            await navigator.mediaDevices
                .getUserMedia({
                    video: false,
                    audio: true
                });


        localVideo.srcObject = null;

        cameraEnabled = false;

        cameraButton.textContent =
            "🚫";


        console.log(
            "Microphone enabled. Camera unavailable."
        );


        return;

    } catch (error) {

        console.error(
            "Microphone also unavailable:",
            error
        );

        throw error;

    }

}


/* =========================
   WEBSOCKET
========================= */

function connectSocket() {

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";


    socket =
        new WebSocket(
            `${protocol}//${location.host}`
        );


    socket.onopen = () => {

        console.log(
            "Connected to FreeMeet server."
        );


        socket.send(
            JSON.stringify({

                type: "join",

                room: roomId,

                name: userName

            })
        );

    };


    socket.onmessage =
        async event => {

            const data =
                JSON.parse(event.data);


            /* =========================
               PARTICIPANT JOINED
            ========================= */

            if (
                data.type ===
                "user-joined"
            ) {

                remoteUserName =
                    data.name ||
                    "Guest";


                updateRemoteName(
                    remoteUserName
                );


                console.log(
                    "Second participant joined."
                );


                await createOffer();

            }


            /* =========================
               EXISTING USER
            ========================= */

            if (
                data.type ===
                "existing-user"
            ) {

                remoteUserName =
                    data.name ||
                    "Guest";


                updateRemoteName(
                    remoteUserName
                );

            }


            /* =========================
               OFFER
            ========================= */

            if (
                data.type === "offer"
            ) {

                console.log(
                    "Offer received."
                );


                await handleOffer(
                    data.offer
                );

            }


            /* =========================
               ANSWER
            ========================= */

            if (
                data.type === "answer"
            ) {

                console.log(
                    "Answer received."
                );


                await handleAnswer(
                    data.answer
                );

            }


            /* =========================
               ICE CANDIDATE
            ========================= */

            if (
                data.type ===
                "candidate"
            ) {

                await handleCandidate(
                    data.candidate
                );

            }


            /* =========================
               CHAT
            ========================= */

            if (
                data.type === "chat"
            ) {

                addChatMessage(
                    data.name,
                    data.message
                );

            }


            /* =========================
               USER LEFT
            ========================= */

            if (
                data.type ===
                "user-left"
            ) {

                console.log(
                    "Other participant left."
                );


                removeRemoteVideos();


                if (peer) {

                    peer.close();

                    peer = null;

                }

            }

        };


    socket.onclose = () => {

        console.log(
            "Disconnected from FreeMeet server."
        );

    };


    socket.onerror = error => {

        console.error(
            "WebSocket error:",
            error
        );

    };

}


/* =========================
   CREATE PEER
========================= */

function createPeer() {

    if (peer) {

        peer.close();

    }


    peer =
        new RTCPeerConnection(
            rtcConfig
        );


    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                peer.addTrack(
                    track,
                    localStream
                );

            });

    }


    peer.onicecandidate =
        event => {

            if (
                event.candidate &&
                socket &&
                socket.readyState ===
                    WebSocket.OPEN
            ) {

                socket.send(
                    JSON.stringify({

                        type:
                            "candidate",

                        candidate:
                            event.candidate

                    })
                );

            }

        };


    peer.ontrack =
        event => {

            console.log(
                "Remote track received."
            );


            const stream =
                event.streams[0];


            showRemoteVideo(
                stream
            );

        };


    peer.onconnectionstatechange =
        () => {

            console.log(
                "WebRTC connection:",
                peer.connectionState
            );

        };


    return peer;

}


/* =========================
   CREATE OFFER
========================= */

async function createOffer() {

    if (!socket) return;


    console.log(
        "Creating offer..."
    );


    createPeer();


    const offer =
        await peer.createOffer();


    await peer.setLocalDescription(
        offer
    );


    socket.send(
        JSON.stringify({

            type: "offer",

            offer

        })
    );


    console.log(
        "Offer sent."
    );

}


/* =========================
   HANDLE OFFER
========================= */

async function handleOffer(
    offer
) {

    console.log(
        "Handling received offer..."
    );


    createPeer();


    await peer.setRemoteDescription(
        new RTCSessionDescription(
            offer
        )
    );


    await flushPendingCandidates();


    const answer =
        await peer.createAnswer();


    await peer.setLocalDescription(
        answer
    );


    socket.send(
        JSON.stringify({

            type: "answer",

            answer

        })
    );


    console.log(
        "Answer sent."
    );

}


/* =========================
   HANDLE ANSWER
========================= */

async function handleAnswer(
    answer
) {

    if (!peer) {

        console.warn(
            "Received answer but peer does not exist."
        );

        return;

    }


    await peer.setRemoteDescription(
        new RTCSessionDescription(
            answer
        )
    );


    await flushPendingCandidates();


    console.log(
        "Remote answer applied."
    );

}


/* =========================
   ICE
========================= */

async function handleCandidate(
    candidate
) {

    if (!peer) {

        pendingCandidates.push(
            candidate
        );

        return;

    }


    if (!peer.remoteDescription) {

        pendingCandidates.push(
            candidate
        );

        return;

    }


    try {

        await peer.addIceCandidate(
            new RTCIceCandidate(
                candidate
            )
        );

    } catch (error) {

        console.error(
            "ICE error:",
            error
        );

    }

}


async function flushPendingCandidates() {

    if (!peer) return;

    if (!peer.remoteDescription) {
        return;
    }


    while (
        pendingCandidates.length > 0
    ) {

        const candidate =
            pendingCandidates.shift();


        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    candidate
                )
            );

        } catch (error) {

            console.error(
                "Queued ICE error:",
                error
            );

        }

    }

}


/* =========================
   REMOTE VIDEO
========================= */

function showRemoteVideo(
    stream
) {

    let video =
        document.getElementById(
            "remoteVideo"
        );


    if (!video) {

        const card =
            document.createElement(
                "div"
            );


        card.className =
            "video-card";


        video =
            document.createElement(
                "video"
            );


        video.id =
            "remoteVideo";


        video.autoplay = true;

        video.playsInline = true;


        card.appendChild(
            video
        );


        const name =
            document.createElement(
                "div"
            );


        name.id =
            "remoteName";


        name.className =
            "name";


        name.textContent =
            remoteUserName;


        card.appendChild(
            name
        );


        videoGrid.appendChild(
            card
        );

    }


    video.srcObject =
        stream;


    video.play()
        .catch(error => {

            console.warn(
                "Remote video autoplay blocked:",
                error
            );

        });

}


function updateRemoteName(
    name
) {

    const element =
        document.getElementById(
            "remoteName"
        );


    if (element) {

        element.textContent =
            name;

    }

}


/* =========================
   REMOVE REMOTE VIDEO
========================= */

function removeRemoteVideos() {

    const remote =
        document.getElementById(
            "remoteVideo"
        );


    if (remote) {

        remote.srcObject = null;

        remote.parentElement.remove();

    }

}


/* =========================
   MICROPHONE
========================= */

micButton.onclick = () => {

    if (!localStream) return;


    micEnabled =
        !micEnabled;


    localStream
        .getAudioTracks()
        .forEach(track => {

            track.enabled =
                micEnabled;

        });


    micButton.textContent =
        micEnabled
            ? "🎤"
            : "🔇";

};


/* =========================
   CAMERA
========================= */

cameraButton.onclick = () => {

    if (!localStream) return;


    const videoTracks =
        localStream.getVideoTracks();


    if (
        videoTracks.length === 0
    ) {

        console.log(
            "No camera available."
        );

        return;

    }


    cameraEnabled =
        !cameraEnabled;


    videoTracks.forEach(
        track => {

            track.enabled =
                cameraEnabled;

        }
    );


    cameraButton.textContent =
        cameraEnabled
            ? "📹"
            : "🚫";

};


/* =========================
   SCREEN SHARE
========================= */

screenButton.onclick =
    async () => {

        try {

            const screen =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({
                        video: true
                    });


            const screenTrack =
                screen.getVideoTracks()[0];


            localVideo.srcObject =
                screen;


            /*
             * Replace the WebRTC
             * camera track with the
             * screen track.
             */

            if (peer) {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            s =>
                                s.track &&
                                s.track.kind ===
                                    "video"
                        );


                if (sender) {

                    await sender.replaceTrack(
                        screenTrack
                    );

                }

            }


            screenTrack.onended =
                async () => {

                    localVideo.srcObject =
                        localStream;


                    if (peer) {

                        const cameraTrack =
                            localStream
                                ?.getVideoTracks()[0];


                        if (
                            cameraTrack
                        ) {

                            const sender =
                                peer
                                    .getSenders()
                                    .find(
                                        s =>
                                            s.track &&
                                            s.track.kind ===
                                                "video"
                                    );


                            if (sender) {

                                await sender.replaceTrack(
                                    cameraTrack
                                );

                            }

                        }

                    }

                };

        } catch (error) {

            console.error(
                "Screen share:",
                error
            );

        }

    };


/* =========================
   COPY ROOM
========================= */

copyRoom.onclick =
    async () => {

        try {

            await navigator
                .clipboard
                .writeText(
                    window.location.href
                );


            copyRoom.textContent =
                "Copied!";


            setTimeout(() => {

                copyRoom.textContent =
                    "Copy";

            }, 1500);

        } catch (error) {

            console.error(
                "Copy failed:",
                error
            );

        }

    };


/* =========================
   CHAT OPEN / CLOSE
========================= */

chatButton.onclick = () => {

    chatPanel.classList.toggle(
        "open"
    );


    if (
        chatPanel.classList.contains(
            "open"
        )
    ) {

        chatInput.focus();

    }

};


closeChat.onclick = () => {

    chatPanel.classList.remove(
        "open"
    );

};


/* =========================
   SEND CHAT
========================= */

function sendChatMessage() {

    if (
        !socket ||
        socket.readyState !==
            WebSocket.OPEN
    ) {

        return;

    }


    const message =
        chatInput.value.trim();


    if (!message) return;


    socket.send(
        JSON.stringify({

            type: "chat",

            message

        })
    );


    chatInput.value = "";

}


sendChat.onclick =
    sendChatMessage;


chatInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {

            sendChatMessage();

        }

    }
);


/* =========================
   DISPLAY CHAT MESSAGE
========================= */

function addChatMessage(
    name,
    message
) {

    const container =
        document.createElement(
            "div"
        );


    container.className =
        "chat-message";


    const sender =
        document.createElement(
            "div"
        );


    sender.className =
        "sender";


    sender.textContent =
        name;


    const text =
        document.createElement(
            "div"
        );


    text.className =
        "text";


    text.textContent =
        message;


    container.appendChild(
        sender
    );


    container.appendChild(
        text
    );


    chatMessages.appendChild(
        container
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


/* =========================
   LEAVE
========================= */

leaveButton.onclick = () => {

    if (localStream) {

        localStream
            .getTracks()
            .forEach(track =>
                track.stop()
            );

    }


    if (peer) {

        peer.close();

        peer = null;

    }


    if (socket) {

        socket.close();

    }


    window.location.href = "/";

};


/* =========================
   START
========================= */

async function start() {

    try {

        await startMedia();

        connectSocket();

    } catch (error) {

        console.error(
            "Unable to access microphone:",
            error
        );


        alert(
            "Please allow microphone access."
        );

    }

}


start();
