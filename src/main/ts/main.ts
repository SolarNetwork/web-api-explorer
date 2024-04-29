import "../scss/style.scss";
import { replaceData } from "./utils";

import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";

import SamplerApp from "./sampler.js";

hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);

// populate app version and then display it
replaceData(document.querySelector<HTMLElement>("#app-version")!, {
	"app-version": APP_VERSION,
}).classList.add("d-md-block");

function startApp() {
	const app = new SamplerApp(window.location.search);
	app.start();
	window.onbeforeunload = function () {
		app.stop();
	};
}

if (
	document.readyState === "complete" ||
	document.readyState === "interactive"
) {
	startApp();
} else {
	window.addEventListener("load", startApp);
}
