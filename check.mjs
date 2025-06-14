import {DockPanel, BoxPanel, Widget} from "@lumino/widgets";

const rootEl = document.getElementById("root");

function onLoad(e){
    const dock = new DockPanel();
    BoxPanel.setStretch(dock, 1);

    const main = new BoxPanel({direction: "left-to-right", spacing: 0});
    main.addWidget(dock);
    Widget.attach(main, rootEl);

    window.addEventListener("resize", () => {
        main.update();
    });
}

addEventListener("load", onLoad);
