const localhost = "192.168.7.33";
let peerConnection;
let localStream;
const socket = io(`https://${localhost}:8000`);
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const logsDiv = document.getElementById('logs');
const startButton = document.getElementById('startButton');

function log(message) {
    console.log(message);
    logsDiv.innerHTML += `${new Date().toLocaleTimeString()}: ${message}<br>`;
}

startButton.addEventListener('click', startVideo);

async function startVideo() {
    log('Starting video...');
    startButton.disabled = true;
    await startLocal();
    await createOffer();
}

socket.on('connect', () => {
    log('Connected to signaling server');
});

socket.on('offer', async (offer) => {
    log('Received offer');
    log(`Offer SDP: ${offer.sdp.substr(0, 50)}...`);
    await setOffer(offer);
    await createAnswer();
});

socket.on('answer', async (answer) => {
    log('Received answer');
    log(`Answer SDP: ${answer.sdp.substr(0, 50)}...`);
    await setAnswer(answer);
});

socket.on('ice_candidate', async (candidate) => {
    log('Received ICE candidate');
    log(`ICE candidate: ${JSON.stringify(candidate)}`);
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        log('ICE candidate added to peer connection');
    }
});

async function startLocal() {
    try {
        log('Attempting to access local media devices');
        localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        let tracks = localStream.getVideoTracks()
        console.log("trackler burada" + tracks)
        localVideo.srcObject = localStream;
        log('Local stream started');
        log(`Local stream tracks: ${localStream.getTracks().map(t => t.kind).join(', ')}`);
    } catch (e) {
        log('Error accessing media devices: ' + e);
    }
}

function createPeerConnection() {
    log('Creating peer connection');
    const configuration = {
        iceServers: []
    };
    peerConnection = new RTCPeerConnection(configuration);
    log('Peer connection created');

    peerConnection.onicecandidate = e => {
        if (e.candidate) {
            log("New ICE candidate: " + JSON.stringify(e.candidate));
            socket.emit('ice_candidate', e.candidate);
        }
    };

    peerConnection.ontrack = e => {
        log(`Received remote track: ${e.track.kind}`);
        remoteVideo.srcObject = e.streams[0];
    };

    peerConnection.onconnectionstatechange = e => {
        log(`Peer connection state changed: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === 'connected') {
            log('Peers connected');
        }
    };

    peerConnection.onicegatheringstatechange = e => {
        log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    };

    peerConnection.onsignalingstatechange = e => {
        log(`Signaling state changed: ${peerConnection.signalingState}`);
    };

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
        log(`Local track added to peer connection: ${track.kind}`);
    });
}

async function createOffer() {
    log('Creating offer');
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    log(`Offer created: ${offer.sdp.substr(0, 50)}...`);
    await peerConnection.setLocalDescription(offer);
    log('Local description set');
    await waitForIceGathering(peerConnection);
    const fullOffer = peerConnection.localDescription;
    log(`Sending offer: ${fullOffer.sdp.substr(0, 50)}...`);
    socket.emit('offer', fullOffer);
}

async function setOffer(offer) {
    log('Setting received offer');
    if (!peerConnection) {
        createPeerConnection();
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    log('Remote description set');
}

async function createAnswer() {
    log('Creating answer');
    const answer = await peerConnection.createAnswer();
    log(`Answer created: ${answer.sdp.substr(0, 50)}...`);
    await peerConnection.setLocalDescription(answer);
    log('Local description set');
    await waitForIceGathering(peerConnection);
    const fullAnswer = peerConnection.localDescription;
    log(`Sending answer: ${fullAnswer.sdp.substr(0, 50)}...`);
    socket.emit('answer', fullAnswer);
}

async function setAnswer(answer) {
    log('Setting received answer');
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    log('Remote description set');
}

function waitForIceGathering(peerConnection) {
    log('Waiting for ICE gathering to complete');
    return new Promise(resolve => {
        if (peerConnection.iceGatheringState === 'complete') {
            log('ICE gathering already complete');
            resolve();
        } else {
            function checkState() {
                if (peerConnection.iceGatheringState === 'complete') {
                    log('ICE gathering completed');
                    peerConnection.removeEventListener('icegatheringstatechange', checkState);
                    resolve();
                }
            }
            peerConnection.addEventListener('icegatheringstatechange', checkState);
        }
    });
}