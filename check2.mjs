import {h, render} from "preact";
import { FluentProvider, Button, webLightTheme } from "@fluentui/react-components";
import { DismissSquareRegular } from '@fluentui/react-icons';
let app = h(FluentProvider, {theme: webLightTheme}, 
            [h(Button, null, [h(DismissSquareRegular,null, []),"Hello!"])]);

let rootEl = document.getElementById("root");

render(app, rootEl);
