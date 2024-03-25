const ws = new WebSocket("ws://" + window.location.hostname + ":8626")
let inputCooldown = null
let lastInput = 0

function addToQueue(trackid) {
    document.querySelectorAll(".addToQueueButton button").forEach(btn => {
        btn.setAttribute("disabled", "")
    })
    ws.send(JSON.stringify({
        type: "addToQueue",
        data: trackid
    }))
}

function millisToMinutesAndSeconds(millis) {
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);
    return (
        seconds == 60 ?
            (minutes + 1) + ":00" :
            minutes + ":" + (seconds < 10 ? "0" : "") + seconds
    );
}

ws.onopen = () => {
    ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type) {
            if (msg.type == "user") {
                document.querySelector(".accountImage").src = msg.data.images[0].url
                document.querySelector(".accountName").innerHTML = msg.data.display_name
            }
            if (msg.type == "addedToQueue") {
                console.log("Added to queue !")
                document.querySelectorAll(".addToQueueButton button").forEach(btn => {
                    btn.removeAttribute("disabled")
                })
                Toastify({
                    text: "Added to Queue !",
                    duration: 2500,
                    gravity: "top", position: "right",
                    style: {
                        background: "var(--success)"
                    }
                }).showToast()

            }
            if (msg.type == "error") {
                Toastify({
                    text: "An error occured !",
                    duration: 2500,
                    gravity: "top", position: "right",
                    style: {
                        background: "var(--danger)"
                    }
                }).showToast()
            }
            if (msg.type == "notify") {
                Toastify({
                    text: msg.data,
                    duration: 2500,
                    gravity: "top", position: "right",
                    style: {
                        background: "var(--success)"
                    }
                }).showToast()
            }
            if (msg.type == "queueList") {
                console.log("QUEUE LIST MSG SENT !!")
                document.querySelector(".queueList").innerHTML = ""
                document.querySelector(".trackTitle").innerHTML = msg.data.currently_playing.name
                document.querySelector(".trackArtist").innerHTML = msg.data.currently_playing.artists[0].name
                document.querySelector(".trackImage").setAttribute("src", msg.data.currently_playing.album.images[0]?.url)
                if (msg.data.playback_state.is_playing) {
                    document.querySelector(".playButton i").classList.remove("fa-play")    
                    document.querySelector(".playButton i").classList.add("fa-pause")
                }
                else {
                    document.querySelector(".playButton i").classList.remove("fa-pause")
                    document.querySelector(".playButton i").classList.add("fa-play")    
                }
                document.querySelector(".progressBarFill").style.width = `${(msg.data.playback_state.progress_ms/msg.data.currently_playing.duration_ms)*100}%`
                msg.data.queue.forEach(track => {
                    const li = document.createElement("li")
                    li.classList.add("queueTrack")
                    const leftPart = document.createElement("div")
                    leftPart.classList.add("leftPart")
                    const rightPart = document.createElement("div")
                    rightPart.classList.add("rightPart")
                    const img = document.createElement("img")
                    img.classList.add("queueTrackImage")
                    img.src = track.album.images[0].url
                    const trackInfos = document.createElement("div")
                    trackInfos.classList.add("queueTrackInfos")
                    const pTitle = document.createElement("p")
                    pTitle.classList.add("queueTrackTitle")
                    pTitle.innerText = track.name
                    const pArtist = document.createElement("p")
                    pArtist.classList.add("queueTrackArtist")
                    pArtist.innerText = track.artists[0].name
                    const pTime = document.createElement("p")
                    pTime.classList.add("queueTrackTime")
                    pTime.innerText = millisToMinutesAndSeconds(track.duration_ms)
                    leftPart.appendChild(img)
                    trackInfos.appendChild(pTitle)
                    trackInfos.appendChild(pArtist)
                    leftPart.appendChild(trackInfos)
                    rightPart.appendChild(pTime)
                    li.appendChild(leftPart)
                    li.appendChild(rightPart)
                    document.querySelector(".queueList").appendChild(li)
                })
            }
            if (msg.type == "searchResponse") {
                document.querySelector(".searchResults").innerHTML = ""
                msg.data.forEach(track => {
                    const li = document.createElement("li")
                    li.classList.add("searchTrack")
                    const leftPart = document.createElement("div")
                    leftPart.classList.add("leftPart")
                    const rightPart = document.createElement("div")
                    rightPart.classList.add("rightPart")
                    const img = document.createElement("img")
                    img.classList.add("searchTrackImage")
                    img.src = track.album.images[0].url
                    const trackInfos = document.createElement("div")
                    trackInfos.classList.add("searchTrackInfos")
                    const pTitle = document.createElement("p")
                    pTitle.classList.add("searchTrackTitle")
                    pTitle.innerText = track.name
                    const pArtist = document.createElement("p")
                    pArtist.classList.add("searchTrackArtist")
                    pArtist.innerText = track.artists[0].name
                    const pTime = document.createElement("p")
                    pTime.classList.add("searchTrackTime")
                    pTime.innerText = millisToMinutesAndSeconds(track.duration_ms)
                    const addToQueue = document.createElement("div")
                    addToQueue.classList.add("addToQueueButton")
                    addToQueue.innerHTML = `<button onclick="addToQueue('${track.id}')">+</button>`
                    leftPart.appendChild(img)
                    trackInfos.appendChild(pTitle)
                    trackInfos.appendChild(pArtist)
                    leftPart.appendChild(trackInfos)
                    rightPart.appendChild(pTime)
                    rightPart.appendChild(addToQueue)
                    li.appendChild(leftPart)
                    li.appendChild(rightPart)
                    document.querySelector(".searchResults").appendChild(li)
                })
            }
        }
    }

    document.querySelector("#searchQuery").onkeydown = (e) => {
        if (e.code.toLowerCase().includes("enter")) {
            const searchQuery = document.querySelector("#searchQuery").value
            if (searchQuery.trim() != "") {
                ws.send(JSON.stringify({
                    type: "searchQuery",
                    data: searchQuery
                }))
            }
        }

    }

    document.querySelector(".playButton").onclick = () => {
        ws.send(JSON.stringify({type: "playPause"}))
    }
    document.querySelector(".nextButton").onclick = () => {
        ws.send(JSON.stringify({type: "skipTrack"}))
    }
}