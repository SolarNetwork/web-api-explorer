/* eslint-env es6, browser, commonjs */
/* global PR */
"use strict";

import $ from "jquery";
import { Configuration, urlQuery } from "solarnetwork-api-core";
import Hex from "crypto-js/enc-hex";

import Credentials from "./credentials";
import Explorer from "./explorer";

var app;

/**
 * SolarNetwork web API sampler app.
 *
 * @class
 * @param {Object} [options] optional configuration options
 */
var samplerApp = function(options) {
  const self = { version: "1.1.0" };
  const config = Object.assign(
    {
      maxHistoryItemDisplayLength: 100
    },
    options
  );

  function start() {
    // TODO
    return self;
  }

  function stop() {
    // TODO
    return self;
  }

  function getTokenId() {
    return select("input[name=token]").property("value");
  }

  function setupForUseAuth() {
    var form = this.form,
      val = form.elements["path"].value,
      credForm = document.getElementById("credentials"),
      el = $(this);
    if (el.val() === "0") {
      val = val.replace(/\/sec\//, "/pub/");
      $(credForm.elements["token"]).attr("disabled", "disabled");
      $(credForm.elements["secret"]).attr("disabled", "disabled");
      $("#auth-result").hide();
    } else {
      val = val.replace(/\/pub\//, "/sec/");
      $(credForm.elements["token"]).removeAttr("disabled");
      $(credForm.elements["secret"]).removeAttr("disabled");
      $("#auth-result").show();
    }
    form.elements["path"].value = val;
  }

  function setupForMethod() {
    var val = $(this).val();
    if (val === "POST" || val === "PUT" || val === "PATCH") {
      $("#upload").show();
    } else {
      $("#upload").hide();
    }
  }

  /**
   * Add a history item to the history menu.
   *
   * @param {Explorer} explore
   */
  function addHistoryItem(explore) {
    var histSelect = $("#history"),
      histEl = histSelect.get(0),
      histItem,
      displayPath,
      i,
      path = explore.servicePath;

    // don't add duplicate items
    for (i = 0; i < histEl.childElementCount; i += 1) {
      histItem = histEl.children.item(i);
      if (histItem.value === path) {
        return;
      }
    }

    displayPath = path;
    if (displayPath.length > config.maxHistoryItemDisplayLength) {
      displayPath = displayPath.substr(0, config.maxHistoryItemDisplayLength) + "\u2026";
    }
    histItem = new Option(displayPath, path);
    histItem.dataset["authType"] = explore.authType;
    histItem.dataset["method"] = explore.method;
    histItem.dataset["output"] = explore.output;
    if (explore.upload) {
      histItem.dataset["upload"] = explore.upload;
    }
    histEl.add(histItem, 1);
    while (histEl.children.length > 51) {
      histEl.remove(51);
    }
  }

  function handleHistory(item) {
    var formEl = item.form,
      form = $(formEl),
      path = item.value,
      histItem = item.options[item.selectedIndex],
      authType = histItem.dataset["authType"],
      method = histItem.dataset["method"],
      output = histItem.dataset["output"],
      upload = histItem.dataset["upload"];
    if (histItem.value.length < 1) {
      return;
    }
    form.find("input[name=useAuth]").removeAttr("checked");
    form.find("input[name=useAuth][value=" + authType + "]").trigger("click");
    formEl.elements["path"].value = path;
    form.find("input[name=method]").removeAttr("checked");
    form.find("input[name=method][value=" + method + "]").trigger("click");
    form.find("input[name=output]").removeAttr("checked");
    form.find("input[name=output][value=" + output + "]").trigger("click");
    formEl.elements["upload"].value = upload || "";
  }

  function formatXml(xml) {
    var formatted = "";
    var reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, "$1\r\n$2$3");
    var pad = 0;
    $.each(xml.split("\r\n"), function(index, node) {
      var indent = 0;
      if (node.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (node.match(/^<\/\w/)) {
        if (pad != 0) {
          pad -= 1;
        }
      } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }

      var padding = "";
      for (var i = 0; i < pad; i++) {
        padding += "  ";
      }

      formatted += padding + node + "\r\n";
      pad += indent;
    });

    return formatted;
  }

  function textForDisplay(xhr, output) {
    var result = "";
    if (xhr.status >= 400 && xhr.status < 422) {
      result = "Unauthorized.";
    } else if (xhr.responseText) {
      if (output === "json") {
        try {
          result = JSON.stringify(JSON.parse(xhr.responseText), null, 2);
        } catch (e) {
          result = xhr.responseText;
        }
      } else if (output === "xml") {
        result = formatXml(xhr.responseText);
      } else {
        result = xhr.responseText;
      }
    }
    return result;
  }

  function showResult(msg) {
    var el = $("#result");
    el.text(msg).removeClass("prettyprinted");
    PR.prettyPrint(el.get(0));
  }

  function handleShortcut(select) {
    var form = select.form,
      jForm = $(form),
      val = select.value,
      optEl,
      method,
      upload;
    if (jForm.find("input[name=useAuth]:checked").val() === "0") {
      val = val.replace(/\/sec\//, "/pub/");
    }
    form.elements["path"].value = val;
    optEl = $(select.options[select.selectedIndex]);
    method = optEl.data("method") || "GET";
    upload = optEl.data("upload") || "";
    if (typeof upload !== "string") {
      // render as pretty-printed JSON
      upload = JSON.stringify(upload, undefined, "  ");
    }

    jForm.find("input[name=method]").removeAttr("checked");
    jForm.find("input[name=method][value=" + method + "]").trigger("click");
    jForm.find("textarea[name=upload]").val(upload);
  }

  function showAuthSupport(explore) {
    if (!explore.isAuthRequired()) {
      return;
    }

    var authBuilder = explore.authV2Builder();
    var sortedHeaderNames = authBuilder.canonicalHeaderNames();
    var canonicalReq = authBuilder.computeCanonicalRequestData(sortedHeaderNames);
    var signatureData = authBuilder.computeSignatureData(canonicalReq);

    $("#auth-header").text("Authorization: " + authBuilder.buildWithSavedKey());
    $("#req-message").text(canonicalReq);
    $("#auth-message").text(signatureData);
    $("#sign-key").text(Hex.stringify(authBuilder.signingKey));
  }

  function handleSamplerFormSubmit(form) {
    var creds = new Credentials(document.getElementById("credentials"));
    var explore = new Explorer(creds, form);
    var curlOnly = document.getElementById("curl-only-checkbox").checked;

    // show some developer info in the auth-message area
    showAuthSupport(explore);

    $("#curl-command").text(explore.curl());

    $("#result").empty();

    // make HTTP request and show the results
    if (!curlOnly) {
      explore
        .submit()
        .done(function(data, status, xhr) {
          showResult(textForDisplay(xhr, explore.output));
          addHistoryItem(explore);
        })
        .fail(function(xhr, status, reason) {
          showResult(textForDisplay(xhr, explore.output));
          alert(reason + ": " + status + " (" + xhr.status + ")");
        });
    }
  }

  function init() {
    // configure host to deployed hostname, unless file: or localhost
    if (
      window !== undefined &&
      window.location.protocol !== undefined &&
      window.location.protocol.toLowerCase().indexOf("http") === 0 &&
      window.location.host.toLowerCase().indexOf("localhost") !== 0
    ) {
      // if hosted on a .solarnetwork.net domain, default the Host input to 'data.solarnetwork.net'
      $("#credentials input[name=host]").val(
        window.location.protocol +
          "//" +
          (window.location.host.indexOf(".solarnetwork.net") > 0
            ? "data.solarnetwork.net"
            : window.location.host)
      );
    }

    // handle shortcuts menu
    $("select.shortcuts").on("change", function(event) {
      event.preventDefault();
      var me = this;
      $("select.shortcuts")
        .not(me)
        .prop("selectedIndex", 0);
      handleShortcut(this);
    });

    // handle history menu
    $("#history").on("change", function(event) {
      event.preventDefault();
      handleHistory(this);
    });

    // handle toggling the auth-support/curl/etc pane
    $(".clickable.activator").on("click", function(event) {
      $(this).toggleClass("active");
    });

    // when toggling auth on/off re-write API path for /pub <-> /sec
    $("input[name=useAuth]")
      .on("change", function(event) {
        event.preventDefault();
        setupForUseAuth.call(this);
      })
      .filter(":checked")
      .first()
      .each(setupForUseAuth);

    // when toggling between GET/POST/etc show/hide the upload textfield
    $("input[name=method]")
      .on("change", function(event) {
        event.preventDefault();
        setupForMethod.call(this);
      })
      .filter(":checked")
      .first()
      .each(setupForMethod);

    // handle sampler form submit
    $("#sampler-form").on("submit", function(event) {
      event.preventDefault();
      handleSamplerFormSubmit(this);
    });

    return Object.defineProperties(self, {
      start: { value: start },
      stop: { value: stop }
    });
  }

  return init();
};

export default function startApp() {
  var config = new Configuration(
    Object.assign(
      {
        // TODO
      },
      urlQuery.urlQueryParse(window.location.search)
    )
  );

  app = samplerApp(config).start();

  window.onbeforeunload = function() {
    app.stop();
  };

  return app;
}
