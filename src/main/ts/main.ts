import "../scss/style.scss";
import { replaceData } from "./utils";

import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";

import SamplerApp from "./sampler.js";

hljs.registerLanguage("javascript", javascript);
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
