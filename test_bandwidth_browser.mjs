function dc_tester(dc, cb){
    const BUFSIZE = 16 * 1000;
    const LWSIZE = 20;
    const QUEUESIZE = 200;
    const LOW_WATERMARK = BUFSIZE * LWSIZE;
    const HIGH_WATERMARK= BUFSIZE * QUEUESIZE;
    const dummybuf = new ArrayBuffer(BUFSIZE);

    function fill(){
        while(dc.bufferedAmount < HIGH_WATERMARK){
            dc.send(dummybuf);
        }
        console.log("Fill done", dc.bufferedAmount);
    }

    function onLW(){
        console.log("On LW", dc.bufferedAmount);
        fill();
    }

    function onMsg(ev){
        cb(ev.data);
    }

    function onOpen(ev){
        // Send initial content
        fill();
        console.log("Initial content", dc.bufferedAmount);
    }

    dc.bufferedAmountLowThreshold = LOW_WATERMARK;
    dc.addEventListener("message", onMsg);
    dc.addEventListener("bufferedamountlow", onLW);
    dc.addEventListener("open", onOpen);


}


export default {
    dc_tester: dc_tester
};
