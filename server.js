const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const app = express();

const server = http.createServer(app);

const wss = new WebSocket.Server({
    server
});


/* =========================
   STATIC FILES
========================= */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================
   ROOM PAGE
========================= */

app.get("/room/:roomId", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "room.html"
        )
    );

});


/* =========================
   ROOMS
========================= */

const rooms = new Map();


/* =========================
   WEBSOCKET CONNECTION
========================= */

wss.on("connection", socket => {

    console.log("WebSocket client connected.");


    socket.on("message", message => {

        let data;

        try {

            data = JSON.parse(message);

        } catch (error) {

            console.error(
                "Invalid WebSocket message:",
                error
            );

            return;

        }


        /* =========================
           JOIN ROOM
        ========================= */

        if (data.type === "join") {

            const roomId =
                data.room;

            const name =
                data.name ||
                "Guest";


            /*
             * Create room if it
             * doesn't exist.
             */

            if (!rooms.has(roomId)) {

                rooms.set(
                    roomId,
                    new Set()
                );

            }


            const room =
                rooms.get(roomId);


            /*
             * Store information
             * on this WebSocket.
             */

            socket.room =
                roomId;

            socket.userName =
                name;


            /*
             * Tell the new participant
             * about everyone already
             * inside the room.
             */

            for (const client of room) {

                if (
                    client.readyState ===
                    WebSocket.OPEN
                ) {

                    socket.send(
                        JSON.stringify({

                            type:
                                "existing-user",

                            name:
                                client.userName ||
                                "Guest"

                        })
                    );

                }

            }


            /*
             * Tell everyone already
             * inside the room that
             * a new participant joined.
             */

            for (const client of room) {

                if (
                    client.readyState ===
                    WebSocket.OPEN
                ) {

                    client.send(
                        JSON.stringify({

                            type:
                                "user-joined",

                            name:
                                name

                        })
                    );

                }

            }


            /*
             * Finally add the new
             * participant to the room.
             */

            room.add(socket);


            /*
             * Tell the participant
             * that joining succeeded.
             */

            socket.send(
                JSON.stringify({

                    type:
                        "room-joined",

                    participants:
                        room.size

                })
            );


            console.log(
                `${name} joined room ${roomId}`
            );


            return;
        }


        /* =========================
           CHAT
        ========================= */

        if (data.type === "chat") {

            const room =
                rooms.get(
                    socket.room
                );


            if (!room) {
                return;
            }


            const messageText =
                String(
                    data.message || ""
                ).trim();


            /*
             * Ignore empty messages.
             */

            if (!messageText) {
                return;
            }


            /*
             * Limit chat message size.
             */

            const chatMessage = {

                type:
                    "chat",

                name:
                    socket.userName ||
                    "Guest",

                message:
                    messageText.slice(
                        0,
                        500
                    )

            };


            /*
             * Send chat message
             * to everyone in room.
             */

            for (const client of room) {

                if (
                    client.readyState ===
                    WebSocket.OPEN
                ) {

                    client.send(
                        JSON.stringify(
                            chatMessage
                        )
                    );

                }

            }


            return;
        }


        /* =========================
           WEBRTC SIGNALING
        ========================= */

        if (
            data.type === "offer" ||
            data.type === "answer" ||
            data.type === "candidate"
        ) {

            const room =
                rooms.get(
                    socket.room
                );


            if (!room) {
                return;
            }


            /*
             * Forward WebRTC
             * signaling messages
             * to the other participant.
             */

            for (const client of room) {

                if (
                    client !== socket &&
                    client.readyState ===
                        WebSocket.OPEN
                ) {

                    client.send(
                        JSON.stringify(
                            data
                        )
                    );

                }

            }

        }

    });


    /* =========================
       DISCONNECT
    ========================= */

    socket.on("close", () => {

        console.log(
            "WebSocket client disconnected."
        );


        const roomId =
            socket.room;


        if (!roomId) {
            return;
        }


        const room =
            rooms.get(
                roomId
            );


        if (!room) {
            return;
        }


        /*
         * Remove participant
         * from room.
         */

        room.delete(socket);


        /*
         * Tell remaining
         * participant that
         * someone left.
         */

        for (const client of room) {

            if (
                client.readyState ===
                WebSocket.OPEN
            ) {

                client.send(
                    JSON.stringify({

                        type:
                            "user-left"

                    })
                );

            }

        }


        /*
         * Delete empty room.
         */

        if (room.size === 0) {

            rooms.delete(
                roomId
            );

            console.log(
                `Room ${roomId} deleted.`
            );

        }

    });

});


/* =========================
   SERVER
========================= */

/*
 * Render provides PORT
 * through an environment
 * variable.
 *
 * When running locally,
 * use port 3000.
 */

const PORT =
    process.env.PORT || 3000;


/*
 * Listen on 0.0.0.0 so the
 * server can receive public
 * connections when deployed.
 */

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `FreeMeet running on port ${PORT}`
        );

    }
);
