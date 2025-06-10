/* Service worker and its installation manager */
/* Borrowed ideas from coi-serviceworker https://github.com/gzuidhof/coi-serviceworker */

const FNEST_SW_VERSION = 1;

/* Service worker logic */
function run_sw(){
    let ident = crypto.randomUUID();
    function evt_install(ev){ self.skipWaiting(); }
    function evt_activate(ev){
        /* Claim myself now */
        ev.waitUntil(self.clients.claim());
    }

    async function evt_message(ev){
        if(ev.data){
            if(ev.data.type == "deregister"){
                /* Deregister requested */
                let reg = self.registration;
                await reg.unregister();
                /* Reload all pages */
                let cs = await self.clients.matchAll();
                cs.forEach(e => e.navigate(e.url));
            }
        }
    }

    async function do_proxy(req){
        try {
            const res = await fetch(req);
            if(res.status === 0){
                return res;
            }

            /* Adjust headers FIXME: Move to remote */
            const nex = new Headers(res.headers);
            nex.set("Cross-Origin-Embedder-Policy", "require-corp");
            nex.set("Cross-Origin-Resource-Policy", "cross-origin");
            nex.set("Cross-Origin-Opener-Policy", "same-origin");

            return new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                headers: nex
            });
        } catch(e){
            console.error(e);
        }
    }

    function evt_fetch(ev){
        const req = ev.request;
        if(req.cache === "only-if-cached" && req.mode == "same-origin"){
            /* Passthrough */
            return;
        }
        ev.respondWith(do_proxy(req));
    }

    self.addEventListener("install", evt_install);
    self.addEventListener("activate", evt_activate);
    self.addEventListener("message", evt_message);
    self.addEventListener("fetch", evt_fetch);

    console.log("SW Context", ident);
}

function checkenv(){
    if(!window.isSecureContext){
        console.log("Not in secure context!");
        return false;
    }
    if(!navigator.serviceWorker){
        console.log("sw is not available!");
        return false;
    }
    return true;
}

async function run_mgr(){
    if(checkenv()){
        const n = navigator;
        const sw = n.serviceWorker;

        window.sessionStorage.removeItem("FNEST_SW_RELOADING");

        if(sw.controller){
            // sw.controller.postMessage({type: "deregister"});
        }

        try {
            const reg = await sw.register(window.document.currentScript.src);
            reg.addEventListener("updatefound", (() => {
                console.log("Reloading...");
                window.sessionStorage.setItem("FNEST_SW_RELOADING", "update");
                window.location.reload();
            }));
            if(reg.active && !sw.controller){
                console.log("Reloading to load page...");
                window.sessionStorage.setItem("FNEST_SW_RELOADING", "loadpage");
                window.location.reload();
            }

        } catch(e){
            console.error("Failed to register SW", e);
        }
    }

    console.log("COI status", window.crossOriginIsolated);
}

/* Entry point */
if(typeof window === "undefined"){
    run_sw();
}else{
    run_mgr();
}

