require("dotenv").config()

const express = require("express"),
    app = express(),
    port = process.env.PORT || 80,
    SpotifyWebApi = require('spotify-web-api-node'),
    spotifyApi = new SpotifyWebApi({
        clientId: process.env.S_CLIENTID,
        clientSecret: process.env.S_CLIENTSECRET,
        redirectUri: process.env.S_REDIRECTURI
    }),
    ws = require("ws"),
    wserver = new ws.Server({ port: 8626 }),
    axios = require("axios").default

let sockets = []
const refreshTime = 2500

wserver.on("listening", () => {
    console.log("WebSocket server listening on port 8626")  
})

let playBackState = null
app.set("view engine", "pug")
app.use("/", express.static("./public"))

function updateNowPlayingAndQueue() {
    if (spotifyApi.getAccessToken() && sockets.length) {
        axios("https://api.spotify.com/v1/me/player/queue", {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + spotifyApi.getAccessToken()
            }
        }).then(rq => {
            console.log("Sending msg to : " + sockets.length)

            spotifyApi.getMyCurrentPlaybackState().then(rs => {
                rq.data.playback_state = rs.body
                playBackState = rs.body
                sockets.forEach(s => s.send(JSON.stringify({ type: "queueList", data: rq.data })))
                setTimeout(() => {
                    updateNowPlayingAndQueue()
                }, refreshTime)

            }).catch(console.error)

        }).catch(console.error)
    } else {
        setTimeout(() => {
            updateNowPlayingAndQueue()
        }, refreshTime)
    }
    // spotifyApi.getMyCurrentPlayingTrack().then((r) => {
    //     console.log("Actual song id vs cached id :", r.body.item.id, nowPlayingSong.body.item.id)
    //     if (r.body.item.id != nowPlayingSong.body.item.id) {
    //         nowPlayingSong = r
    //         sockets.forEach(socket => socket.send(JSON.stringify({type: "nptrack", data: r})))
    //     }
    //     setTimeout(() => {
    //         updateNowPlayingAndQueue()
    //     }, refreshTime)
    // }).catch(console.error)    
}

updateNowPlayingAndQueue()

wserver.on("connection", (socket) => {
    sockets.push(socket)

    if (spotifyApi.getAccessToken()) {
        spotifyApi.getMe().then(r => {
            sockets.forEach(s => s.send(JSON.stringify({ type: "user", data: r.body })))
        })
        // spotifyApi.getMyCurrentPlayingTrack().then((r) => {
        //         nowPlayingSong = r
        //         sockets.forEach(s => s.send(JSON.stringify({type: "nptrack", data: r})))
        //         setTimeout(() => {
        //             updateNowPlayingAndQueue()
        //         }, refreshTime);
        // }).catch(console.error)    
    }

    socket.on("message", (data) => {
        const messageRaw = Buffer.from(data)
        let msg;
        try {
            msg = JSON.parse(messageRaw)
        } catch (error) {
            return console.error(error)
        }
        if (msg.type) {
            if (msg.type == "searchQuery") {
                spotifyApi.searchTracks(msg.data, { limit: 15 }).then(r => {
                    socket.send(JSON.stringify({
                        type: "searchResponse",
                        data: r.body.tracks.items
                    }))
                }).catch(console.error)
            }
            if (msg.type == "addToQueue") {
                spotifyApi.getTrack(msg.data).then(track => {
                    spotifyApi.addToQueue(track.body.uri).then(() => {
                        socket.send(JSON.stringify({
                            type: "addedToQueue",
                            data: "Added to queue !"
                        }))
                    }).catch(() => {
                        socket.send(JSON.stringify({
                            type: "error",
                            data: "An error occured !"
                        }))
                    })
                })
            }
            if (msg.type == "skipTrack" ) {
                spotifyApi.skipToNext().then(() => {
                    socket.send(JSON.stringify({
                        type: "notify",
                        data: "Skipped !"
                    }))
                }).catch(error => {
                    console.error(error)
                    socket.send(JSON.stringify({
                        type: "error",
                        data: error
                    }))
                })
            }
            if (msg.type == "playPause" ) {
                if (playBackState.is_playing) {
                    spotifyApi.pause().then(() => {
                        socket.send(JSON.stringify({
                            type: "notify",
                            data: "Paused !"
                        }))
                    }).catch(error => {
                        console.error(error)
                        socket.send(JSON.stringify({
                            type: "error",
                            data: error
                        }))
                    })
                }
                else {
                    spotifyApi.play().then(() => {
                        socket.send(JSON.stringify({
                            type: "notify",
                            data: "Resumed !"
                        }))
                    }) .catch(error => {
                        console.error(error)
                        socket.send(JSON.stringify({
                            type: "error",
                            data: error
                        }))
                    })
                }
            }
        }
    })

    socket.on("close", () => {
        sockets = sockets.filter(x => x != socket)
    })
})

app.get("/login", (req, res) => {
    if (spotifyApi.getAccessToken()) return res.redirect("/")
    res.redirect(spotifyApi.createAuthorizeURL([
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-currently-playing",
        "app-remote-control",
    ]))
})

app.get("/", (req, res) => {
    if (!spotifyApi.getAccessToken()) return res.redirect("/login")
    res.render("index")
})

app.get("/callback", (req, res) => {
    spotifyApi.authorizationCodeGrant(req.query.code, (err, r) => {
        if (err) throw err
        spotifyApi.setAccessToken(r.body.access_token)
        spotifyApi.setRefreshToken(r.body.refresh_token)
        res.redirect("/")
    })
})

app.listen(port, () => {
    console.log(`Listening on port : ${port}`)
})