import $ from "jquery";
import { default as Hex } from "crypto-js/enc-hex.js";
import hljs from "highlight.js/lib/core";
import { iso8601Date } from "solarnetwork-api-core/lib/util/dates";
import { urlQueryParse } from "solarnetwork-api-core/lib/net/urls";
import { Configuration } from "solarnetwork-api-core/lib/util";
import { SnSettingsFormElements, ExplorerFormElements } from "./forms";
import Credentials from "./credentials";
import Explorer from "./explorer";

var helpWindow: Window | null = null;

function showDocLink(this: HTMLElement) {
	var href = this.dataset.docLink;
	if (href) {
		if (!helpWindow || helpWindow.closed) {
			helpWindow = window.open(href, "SolarNet-Help");
		} else {
			helpWindow.location = href;
			helpWindow.focus();
		}
	}
}

function copyCurl(e: Event) {
	var range,
		selection = window.getSelection(),
		curlEl = document.getElementById("curl-command")!;

	if (!(curlEl && curlEl.firstChild)) {
		return;
	}

	range = document.createRange();

	// work around Firefox bug https://bugzilla.mozilla.org/show_bug.cgi?id=730257
	// where `range.selectNodeContents(e.target);` adds 4 spaces to start of copied text
	range.setStart(curlEl.firstChild, 0);
	range.setEnd(curlEl.lastChild!, curlEl.lastChild!.textContent!.length);

	if (selection) {
		selection.removeAllRanges();
		selection.addRange(range);
		document.execCommand("copy");
	}
}

/**
 * SolarNetwork web API sampler app.
 */
export default class SamplerApp {
	readonly config: Configuration;
	readonly snSettingsForm: HTMLFormElement;
	readonly snSettingsElements: SnSettingsFormElements;
	readonly explorerForm: HTMLFormElement;
	readonly explorerElements: ExplorerFormElements;

	/**
	 * Constructor.
	 * @param queryParams query parameters from `window.location.search` for example
	 */
	constructor(queryParams: string) {
		this.config = new Configuration(
			Object.assign(
				{
					maxHistoryItemDisplayLength: 100,
				},
				urlQueryParse(queryParams)
			)
		);

		this.snSettingsForm =
			document.querySelector<HTMLFormElement>("#credentials")!;
		this.snSettingsElements = this.snSettingsForm
			.elements as unknown as SnSettingsFormElements;

		this.explorerForm =
			document.querySelector<HTMLFormElement>("#sampler-form")!;
		this.explorerElements = this.explorerForm
			.elements as unknown as ExplorerFormElements;
	}

	start(): ThisType<SamplerApp> {
		this.#init();
		return this;
	}

	stop(): ThisType<SamplerApp> {
		return this;
	}

	setupForUseAuth(input: HTMLInputElement) {
		const el = $(input);
		let val = this.explorerElements.path.value;
		if (el.val() === "0") {
			val = val.replace(/\/sec\//, "/pub/");
			$(this.snSettingsElements.token).attr("disabled", "disabled");
			$(this.snSettingsElements.secret).attr("disabled", "disabled");
			$("#auth-result").hide();
		} else {
			val = val.replace(/\/pub\//, "/sec/");
			$(this.snSettingsElements.token).removeAttr("disabled");
			$(this.snSettingsElements.secret).removeAttr("disabled");
			$("#auth-result").show();
		}
		this.explorerElements.path.value = val;
	}

	setupForMethod(input: HTMLInputElement) {
		var val = $(input).val();
		if (val === "POST" || val === "PUT" || val === "PATCH") {
			$("#upload").show();
		} else {
			$("#upload").hide();
		}
	}

	/**
	 * Add a history item to the history menu.
	 *
	 * @param explore the explore
	 */
	addHistoryItem(explore: Explorer) {
		var histSelect = $("#history"),
			histEl = histSelect.get(0)! as HTMLSelectElement,
			histItem: HTMLOptionElement,
			displayPath,
			i,
			path = explore.servicePath;
		const maxHistoryLength: number = this.config.value(
			"maxHistoryItemDisplayLength"
		)! as number;

		// don't add duplicate items
		for (i = 0; i < histEl.options.length; i += 1) {
			histItem = histEl.options.item(i)!;
			if (histItem.value === path) {
				return;
			}
		}

		displayPath = path;
		if (displayPath.length > maxHistoryLength) {
			displayPath = displayPath.substr(0, maxHistoryLength) + "\u2026";
		}
		histItem = new Option(displayPath, path);
		histItem.dataset["authType"] = "" + explore.authType;
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

	handleHistory(item: HTMLSelectElement) {
		var formEl = item.form!,
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
		form.find("input[name=useAuth][value=" + authType + "]").trigger(
			"click"
		);
		this.explorerElements.path.value = path;
		form.find("input[name=method]").removeAttr("checked");
		form.find("input[name=method][value=" + method + "]").trigger("click");
		form.find("input[name=output]").removeAttr("checked");
		form.find("input[name=output][value=" + output + "]").trigger("click");
		this.explorerElements.upload.value = upload || "";
	}

	static #formatXml(xml: string) {
		var formatted = "";
		var reg = /(>)(<)(\/*)/g;
		xml = xml.replace(reg, "$1\r\n$2$3");
		var pad = 0;
		$.each(xml.split("\r\n"), function (index, node) {
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

	async textForDisplay(xhr: Response, output: string): Promise<string> {
		var result = "";
		if (xhr.status >= 400 && xhr.status < 422) {
			result = "Unauthorized.";
		} else if (xhr.ok) {
			if (output === "json") {
				try {
					result = JSON.stringify(await xhr.json(), null, 2);
				} catch (e) {
					result = await xhr.text();
				}
			} else if (output === "xml") {
				result = SamplerApp.#formatXml(await xhr.text());
			} else {
				result = await xhr.text();
			}
		}
		return result;
	}

	showResult(msg: string, highlight: boolean) {
		var el = document.getElementById("result")!;
		el.innerText = msg;
		if (highlight) {
			hljs.highlightElement(el);
		}
	}

	handleShortcut(select: HTMLSelectElement) {
		var form = select.form!,
			jForm = $(form),
			val = select.value,
			appName = select.dataset["app"],
			optEl,
			method,
			upload,
			docs;
		if (jForm.find("input[name=useAuth]:checked").val() === "0") {
			val = val.replace(/\/sec\//, "/pub/");
		}
		this.explorerElements.path.value = val;
		optEl = $(select.options[select.selectedIndex]);
		method = optEl.data("method") || "GET";
		upload = optEl.data("upload") || "";
		docs = optEl.data("docs");
		if (typeof upload !== "string") {
			// render as pretty-printed JSON
			upload = JSON.stringify(upload, undefined, "  ");
		}

		jForm.find("input[name=method]").removeAttr("checked");
		jForm.find("input[name=method][value=" + method + "]").trigger("click");
		jForm.find("textarea[name=upload]").val(upload);

		if (appName) {
			if (docs && !docs.startsWith("http")) {
				// assume a link to the wiki
				docs =
					"https://github.com/SolarNetwork/solarnetwork/wiki/" + docs;
			}
			$("#" + appName + "-help")
				.attr("data-doc-link", docs)
				.prop("disabled", !docs);
		}
	}

	showAuthSupport(explore: Explorer) {
		if (!explore.isAuthRequired()) {
			return;
		}

		var authBuilder = explore.authV2Builder();
		//var sortedHeaderNames = authBuilder.canonicalHeaderNames();
		var canonicalReq = authBuilder.buildCanonicalRequestData();
		var signatureData = authBuilder.computeSignatureData(canonicalReq);

		$("#auth-header").text(
			"Authorization: " + authBuilder.buildWithSavedKey()
		);
		$("#req-message").text(canonicalReq);
		$("#auth-message").text(signatureData);
		$("#auth-sign-date").text(iso8601Date(authBuilder.date()));
		$("#sign-key").text(
			Hex.stringify(authBuilder.computeSigningKey(explore.creds.token))
		);
	}

	async handleSamplerFormSubmit(form: HTMLFormElement) {
		var creds = new Credentials(this.snSettingsElements);
		var explore = new Explorer(creds, this.explorerElements);
		var curlOnly = (
			document.getElementById("curl-only-checkbox")! as HTMLInputElement
		).checked;

		// allow leaving off the Digest header
		explore.withoutDigestHeader = !(
			document.getElementById("auth-with-digest")! as HTMLInputElement
		).checked;

		// show some developer info in the auth-message area
		this.showAuthSupport(explore);

		$("#curl-command").text(explore.curl());

		$("#result").empty();

		// make HTTP request and show the results
		if (!curlOnly) {
			const res: Response = await explore.submit();
			var highlight = res.ok && !!this.explorerElements.highlight.checked;
			this.showResult(
				await this.textForDisplay(res, explore.output),
				highlight
			);
			if (res.ok) {
				this.addHistoryItem(explore);
			}
		}
	}

	#init() {
		// configure host to deployed hostname, unless file: or localhost
		const app = this;

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
		$("select.shortcuts").on("change", function (event) {
			event.preventDefault();
			var me = this as HTMLSelectElement;
			$("select.shortcuts").not(me).prop("selectedIndex", 0);
			app.handleShortcut(me);
		});

		// handle history menu
		$("#history").on("change", function (event) {
			event.preventDefault();
			app.handleHistory(this as HTMLSelectElement);
		});

		// handle toggling the auth-support/curl/etc pane
		$(".clickable.activator").on("click", function (event) {
			$(this).toggleClass("active");
		});

		// when toggling auth on/off re-write API path for /pub <-> /sec
		$("input[name=useAuth]")
			.on("change", function (event) {
				event.preventDefault();
				app.setupForUseAuth(this as HTMLInputElement);
			})
			.filter(":checked")
			.first()
			.each(function (idx, el) {
				app.setupForUseAuth(el as HTMLInputElement);
			});

		// when toggling between GET/POST/etc show/hide the upload textfield
		$("input[name=method]")
			.on("change", function (event) {
				event.preventDefault();
				app.setupForMethod(this as HTMLInputElement);
			})
			.filter(":checked")
			.first()
			.each(function (idx, el) {
				app.setupForMethod(el as HTMLInputElement);
			});

		// handle sampler form submit
		$("#sampler-form").on("submit", function (event) {
			event.preventDefault();
			app.handleSamplerFormSubmit(this as HTMLFormElement);
		});

		// handle curl copy
		$("#curl-copy-btn").on("click", copyCurl);

		// handle doc link
		$("button.doc-link").on("click", showDocLink);
	}
}
