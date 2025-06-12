import * as jose from "jose";
import tester from "./test_bandwidth_browser.mjs";

const setdevicekeyEl = document.getElementById("setdevicekey");
const runlinkEl = document.getElementById("runlink");
const infoareaEl = document.getElementById("infoarea");
const dataareaEl = document.getElementById("dataarea");

const devicekeyEl = document.getElementById("devicekey");
const BASEURL = window.location.protocol + "//" +
        window.location.host + window.location.pathname.replace("/index.html","/");

const sessions = {};
const waiters = {};
let devicekey = false; // FIXME: Allow multiple keys

/* Detect default hash */
if(window.location.hash.startsWith("#dk=")){
    devicekeyEl.value = window.location.hash.replace("#dk=","");
}

/* WebRTC states */
const ICE_SERVERS = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
const RTCconnections = {};

async function newRTC(ses, initial_res){
    const peer = new RTCPeerConnection(ICE_SERVERS);
    const ident = initial_res.ident;
    const uri = sessions[ses].uri;

    let remote_offer = initial_res.d;
    let remote_candidates = initial_res.c;
    let remote_offer_done = false;
    let remote_ice_done = initial_res.f;
    let local_candidates_queue = [];
    let local_ice_done = false;

    peer.onicegatheringstatechange = async function(e){
        if(peer.iceGatheringState == "complete"){
        }
    }

    peer.oniceconnectionstatechange = function(){
        if (peer.iceConnectionState === "connected" || 
            peer.iceConnectionState === "completed") {
            /* We're done */
            local_ice_done = true;
        }
    }

    peer.onicecandidate = function(e){
        console.log("On ice candidate", e);
        if(e.candidate){
            const cd = e.candidate;
            local_candidates_queue.push({c: cd.candidate, m: cd.sdpMid});
        }
    }

    peer.ondatachannel = function(c){
        let prevtime = 0;
        let prevsize = 0;
        console.log("On dataChannel", c);
        tester.dc_tester(c.channel, function(data){
            console.log("Data", data);
            const res = JSON.parse(data);
            const nowtime = res.curtime - prevtime;
            const nowsize = res.sent - prevsize;

            const mibparsec = nowsize / nowtime * 1000 / 1024 / 1024;
            infoareaEl.innerText = `Device: ${uri}`;
            dataareaEl.innerText = `${mibparsec} MiB/sec`;
            prevtime = res.curtime;
            prevsize = res.sent;
        });
    }

    for(;;){
        if(remote_offer){
            if(! remote_offer_done){
                const desc = {
                    type: "offer",
                    sdp: remote_offer
                };
                await peer.setRemoteDescription(new RTCSessionDescription(desc));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                console.log("Sending answer", peer.localDescription);
                await runrequest(ses, "con", {
                    req: "peer-ice",
                    s: peer.localDescription.sdp,
                    ident: ident
                });

                remote_offer_done = true;
            }

            for(const idx in remote_candidates){
                const candidate = remote_candidates[idx].c;
                const mid = remote_candidates[idx].m;
                console.log("Add candidate", idx, candidate, mid);
                const c = new RTCIceCandidate({candidate: candidate, 
                                              sdpMid: mid});
                peer.addIceCandidate(c);
            }
            remote_candidates = [];
        }

        if(local_ice_done){
            await runrequest(ses, "con", {
                req: "complete",
                ident: ident
            });
            await closesession(ses);
            break;
        }

        if(remote_ice_done){
            // Wait a bit to make sure the connection settle
            await new Promise(x => setTimeout(x, 500));
        }else{
            const queue = local_candidates_queue;
            local_candidates_queue = [];
            let next = await runrequest(ses, "con", {
                req: "poll-sdp",
                ident: ident,
                c: queue
            });

            remote_offer = next.d;
            remote_candidates = next.c;
            remote_ice_done = next.f;
        }
    }
}


async function endsession(){
    // FIXME: Request close through localStorage messaging
}

function post(ses, cnt, data){
    const prefix = "nestDev." + ses + ".";
    data.cnt = cnt;
    console.log("Post", data);
    window.localStorage.setItem(prefix + "inbox", JSON.stringify(data));
    window.localStorage.setItem(prefix + "in", JSON.stringify(cnt));
}

function consumeoutbox(ses){
    const prefix = "nestDev." + ses + ".";
    window.localStorage.setItem(prefix + "outbox", "null");
}

function getoutbox(ses){
    const prefix = "nestDev." + ses + ".";
    const outstr = window.localStorage.getItem(prefix + "out");
    const outboxstr = window.localStorage.getItem(prefix + "outbox");
    let out = false;
    let outbox = false;
    if(outstr){
        out = JSON.parse(outstr);
    }
    if(outboxstr){
        outbox = JSON.parse(outboxstr);
    }
    console.log("out",out,outbox);
    if(out && out != 0){
        if(outbox && outbox != null){
            if(outbox.cnt == out){
                console.log("outbox", outbox);
                return outbox;
            }
        }
    }
    return false;
}

function wait(ses, cnt){
    return new Promise((res, rej) => {
        // Try earlycut
        const curbox = getoutbox(ses);
        if(curbox){
            consumeoutbox(ses);
            res(curbox);
        }else{
            // Register a waiter
            if(waiters[ses]){
                throw "something wrong";
            }
            waiters[ses] = {res: res, rej: rej, ses: ses, cnt: cnt};
            console.log("waiting...", waiters[ses]);
        }
    });
}

function onStorage(){
    const todelete = [];
    console.log("OnStorage");
    // Run all waiters
    for(const ses in waiters){
        const curbox = getoutbox(ses);
        if(curbox){
            if(waiters[ses] && curbox.cnt == waiters[ses].cnt){
                consumeoutbox(ses);
                todelete.push(waiters[ses]);
                waiters[ses].res(curbox);
            }else{
                /* Should not happen(multiple waiters on same ses) */
                console.log("Invalid waiter", sessions[ses], waiters[ses]);
                todelete.push(waiters[ses]);
                waiters[ses].rej(false);
            }
        }
    }

    console.log("Storage done", todelete);
    // Remove waiter if it did not queued new waiter
    for(const idx in todelete){
        const p = todelete[idx];
        const w = waiters[p.ses];
        if(w){
            if(w.cnt == p.cnt){
                delete waiters[p.ses];
            }
        }
    }
}

async function encryptpayload(ses, input){
    if(sessions[ses].enckey){

        const enc = await new 
           jose.CompactEncrypt(new TextEncoder().encode(JSON.stringify(input)))
        .setProtectedHeader({alg: "RSA-OAEP", enc: "A128CBC-HS256"})
        .encrypt(sessions[ses].enckey);

        console.log("Encrypt",ses, input, enc);
        return enc;
    }else{
        console.log("Plaintext", ses, input);
        return input;
    }
}


async function closesession(ses){
    const prefix = "nestDev." + ses + ".";
    console.log("Close session",ses);
    const mycnt = sessions[ses].cnt + 1;
    sessions[ses].cnt = mycnt;
    post(ses, mycnt, {func: "close"});
    delete sessions[ses];
}

async function runrequest(ses, func, input){
    const prefix = "nestDev." + ses + ".";
    console.log("Runrequest",ses,func,input);
    const mycnt = sessions[ses].cnt + 1;
    sessions[ses].cnt = mycnt;
    const epayload = await encryptpayload(ses, input);
    post(ses, mycnt, {data: epayload, func: func});
    const res = await wait(ses, mycnt);
    //const vopts = {algorithms: "ES*"}; // FIXME: Limit algs
    const data = res.data;

    /* Verify response */
    console.log("Decoding", sessions[ses].signkey, data);
    const {payload, protectedHeader} = await jose.compactVerify(data, sessions[ses].signkey)
    const vtxt = new TextDecoder().decode(payload);
    const msg = JSON.parse(vtxt);
    console.log("msg", msg);
    return msg;
}

async function setDeviceKey(e){
    const devicekeytemp = devicekeyEl.value;
    /* Remove whitespaces */
    const devicekeystr = devicekeytemp.replace("\n","").replace("\t","").replace(" ","");
    const dex = new TextDecoder("utf8");
    const deckeystr = dex.decode(jose.base64url.decode(devicekeystr));
    devicekey = JSON.parse(deckeystr);
    console.log("BaseURL", BASEURL);

    window.location.hash = "#dk=" + devicekeystr;

    // FIXME: Register session
    const signkey = await jose.importJWK(devicekey.k, "ES256");
    const uri = devicekey.u;
    const ses = "000"; // FIXME: crypto.randomUUID();
    const prefix = "nestDev." + ses + ".";
    const sd = { ses: ses };
    const wndf = "noopener,noreferrer";
    const session_data = jose.base64url.encode(JSON.stringify(sd));
    const sesdata = {
        ses: ses,
        signkey: signkey,
        enckey: false,
        uri: uri,
        cnt: 0
    };
    window.localStorage.setItem(prefix + "out", "0");
    window.localStorage.setItem(prefix + "outbox", "false");
    window.localStorage.setItem(prefix + "cb", JSON.stringify(uri));
    post(ses, 0, {}); // Init inbox
    runlinkEl.setAttribute("href", BASEURL + "cnt/talk.html#" + session_data);
    runlinkEl.setAttribute("_session", ses);
    sessions[ses] = sesdata;
    setdevicekeyEl.disabled = true;
    
}

async function onLinkClick(e){
    const ses = runlinkEl.getAttribute("_session");
    const ek = await runrequest(ses, "ksy0", false);
    const enckey = await jose.importJWK(ek, "RSA-OAEP");
    sessions[ses].enckey = enckey;

    /* Create RTC session */
    const desc = await runrequest(ses, "con", {req: "new-connection"});
    console.log("Got initial desc", desc);
    await newRTC(ses, desc);
}

async function onLoad(e){
    setdevicekeyEl.addEventListener("click", setDeviceKey);
    runlinkEl.addEventListener("click", onLinkClick);
}

addEventListener("load", onLoad);
addEventListener("storage", onStorage);
