// The shop's wording lives in lib/i18n.source.js (window.I18N = {...}).
// The React shop imports it as lib/i18n.json; the static dashboard loads public/js/i18n.js.
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../lib/i18n.source.js", import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const json = JSON.stringify(sandbox.window.I18N, null, 1);
writeFileSync(new URL("../lib/i18n.json", import.meta.url), json);
writeFileSync(new URL("../public/js/i18n.js", import.meta.url), "window.I18N = " + json + ";\n");
console.log("i18n synced:", Object.keys(sandbox.window.I18N.en).length, "keys");
