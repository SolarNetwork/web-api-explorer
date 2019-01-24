import "bootstrap/dist/css/bootstrap.min.css";
import "./vendor/prettify.css";
import "./vendor/desert.css";
import "./vendor/prettify.js";
import "./sampler.css";

import { library, dom } from "@fortawesome/fontawesome-svg-core";
import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";

import startApp from "./sampler.js";

library.add(faCaretDown, faCaretRight);
dom.watch();

if (!window.isLoaded) {
  window.addEventListener(
    "load",
    function() {
      startApp();
    },
    false
  );
} else {
  startApp();
}
