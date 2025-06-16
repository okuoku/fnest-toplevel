import { Terminal } from '@xterm/xterm';
import { ImageAddon } from '@xterm/addon-image';
import { openpty } from "xterm-pty";

const xterm = new Terminal();
const { master, slave } = openpty();
const imageAddon = new ImageAddon({iipSupport: false});
xterm.loadAddon(master);
xterm.loadAddon(imageAddon);
