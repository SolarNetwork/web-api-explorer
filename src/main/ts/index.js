import "bootstrap/dist/css/bootstrap.min.css";
import "./vendor/prettify.css";
import "./vendor/desert.css";
import "./vendor/prettify.js";
import "./sampler.css";
import "./favicon.png";

import { library, dom } from "@fortawesome/fontawesome-svg-core";
import { faCaretDown, faCaretRight, faCircleInfo, faCopy } from "@fortawesome/free-solid-svg-icons";

import startApp from "./sampler.js";

library.add(faCaretDown, faCaretRight, faCircleInfo, faCopy);
dom.watch();

if (!window.isLoaded) {
  window.addEventListener(
    "load",
    function () {
      startApp();
    },
    false
  );
} else {
  startApp();
}
