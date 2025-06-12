function encode(str){
    const p = btoa(str);
    return p.replace("+","-").replace("/","_");
}

function decode(str){
    const p = str.replace("-","+").replace("_","/");
    return atob(p);
}

export default {
    encode: encode,
    decode: decode
}
