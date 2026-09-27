const video = document.getElementById("previewVideo");
const cameraMessage = document.getElementById("cameraMessage");

const micButton = document.getElementById("toggleMic");
const cameraButton = document.getElementById("toggleCamera");

const newMeetingButton = document.getElementById("newMeeting");
const joinMeetingButton = document.getElementById("joinMeeting");
const meetingCodeInput = document.getElementById("meetingCode");
const userNameInput = document.getElementById("userName");

let localStream = null;
let micEnabled = true;
let cameraEnabled = true;


// ------------------------------------
// CAMERA PREVIEW
// ------------------------------------

async function startPreview() {

    try {

        localStream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

        video.srcObject = localStream;

        cameraMessage.style.display = "none";

    } catch (error) {

        console.error(
            "Camera/microphone error:",
            error
        );

        cameraMessage.textContent =
            "Camera/microphone permission required";
    }
}


// ------------------------------------
// MICROPHONE
// ------------------------------------

micButton.addEventListener("click", () => {

    if (!localStream) return;

    micEnabled = !micEnabled;

    localStream
        .getAudioTracks()
        .forEach(track => {
            track.enabled = micEnabled;
        });

    micButton.textContent =
        micEnabled ? "🎤" : "🔇";
});


// ------------------------------------
// CAMERA
// ------------------------------------

cameraButton.addEventListener("click", () => {

    if (!localStream) return;

    cameraEnabled = !cameraEnabled;

    localStream
        .getVideoTracks()
        .forEach(track => {
            track.enabled = cameraEnabled;
        });

    cameraButton.textContent =
        cameraEnabled ? "📹" : "🚫";
});


// ------------------------------------
// CREATE ROOM CODE
// ------------------------------------

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {

        code += characters[
            Math.floor(
                Math.random() * characters.length
            )
        ];

    }

    return code;
}
function getUserName() {
    const name = userNameInput.value.trim();

    if (!name) {
        userNameInput.focus();
        return null;
    }

    return name;
}


// ------------------------------------
// NEW MEETING
// ------------------------------------

newMeetingButton.addEventListener("click", () => {
    const name = getUserName();

    if (!name) return;

    const roomCode = generateRoomCode();

    window.location.href =
        `/room/${roomCode}?name=${encodeURIComponent(name)}`;
});


// ------------------------------------
// JOIN MEETING
// ------------------------------------

function joinMeeting() {

    let code =
        meetingCodeInput.value.trim();

    if (!code) {

        meetingCodeInput.focus();

        return;
    }

    code =
        code
            .replace(/[^a-zA-Z0-9-_]/g, "")
            .toUpperCase();
const name = getUserName();

if (!name) return;

    if (!code) return;

  window.location.href =
    `/room/${code}?name=${encodeURIComponent(name)}`;
}


joinMeetingButton.addEventListener(
    "click",
    joinMeeting
);


meetingCodeInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            joinMeeting();
        }

    }
);


// ------------------------------------
// CLOCK
// ------------------------------------

function updateClock() {

    const now =
        new Date();

    document.getElementById(
        "clock"
    ).textContent =
        now.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
}

setInterval(
    updateClock,
    1000
);

updateClock();


// ------------------------------------
// START
// ------------------------------------

startPreview();
