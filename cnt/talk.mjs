import base64uri from "../base64uri.mjs";

let ses = false;

function striphistory(){
    /* Do not record history with hash */
    const clean = window.location.origin
        + window.location.pathname
        + window.location.search;
    window.history.replaceState(null, "", clean);
}

function myinput(){
    const log = document.location;
    const str = location.hash;
    striphistory();
    try{
        if(str == ""){
            return {};
        }else{
            console.log("input", str);
            const s = base64uri.decode(str.substring(1));
            return JSON.parse(s);
        }
    }catch(e){
        console.warn("Invalid hash");
        return {};
    }
}

function getval(name){
    const prefix = "nestDev." + ses + ".";
    const str = window.localStorage.getItem(prefix + name);
    console.log("Getval",ses,name,str);
    if(str){
        const obj = JSON.parse(str);
        return obj;
    }else{
        return false;
    }
}

function getInbox(){
    return {
        in: getval("in"),
        inbox: getval("inbox")
    };
}
function clearInbox(){
    const prefix = "nestDev." + ses + ".";
    window.localStorage.setItem(prefix + "inbox", "null");
}

function setOutBox(obj){
    const prefix = "nestDev." + ses + ".";
    let outcnt = getval("out");
    if(! outcnt){
        outcnt = 1;
    }else{
        outcnt++;
    }

    /* Set `outbox`, then `out` */
    const str_outbox = JSON.stringify({cnt: outcnt, data: obj});
    const str_out = JSON.stringify(outcnt);
    window.localStorage.setItem(prefix + "outbox", str_outbox);
    window.localStorage.setItem(prefix + "out", str_out);
}

function action(func, data){
    const prefix = "nestDev." + ses + ".";
    const cb = getval("cb") + "/cnt/talk.html";
    const myurl = window.location.protocol + "//" + 
        window.location.host + window.location.pathname;

    if(func == "close"){
        window.close();
    }else{
        const req = {
            cb: myurl,
            f: func,
            d: data,
            ses: ses
        };

        const target_data = base64uri.encode(JSON.stringify(req));

        window.location.replace(cb + "#" + target_data);
    }
}

function checkNewMessage(){
    const cur = getInbox();
    console.log("Check New Message", cur);
    if(cur.in != 0 && cur.inbox != null && cur.in == cur.inbox.cnt){
        clearInbox();
        action(cur.inbox.func, cur.inbox.data);
    }
}

async function onStorage(e){
    console.log("onStorage",e);
    checkNewMessage();
}

async function onLoad(e){
    const session_data = myinput();
    const session = session_data.ses;
    if(session_data.err){
        console.log("Error??", err);
        throw err;
    }
    console.log("Start session", session);
    ses = session;

    if(session_data.r){
        console.log("Resp.", session_data);
        setOutBox(session_data.r);
    }

    checkNewMessage();
    addEventListener("storage", onStorage);
}

addEventListener("load", onLoad);

