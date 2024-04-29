import $ from "jquery";
import Credentials from "./credentials";
import {
	AuthorizationV2Builder,
	EnvironmentConfig,
	HostConfig,
	HttpContentType,
	HttpHeaders,
	HttpMethod,
} from "solarnetwork-api-core/lib/net";
import { ExplorerFormElements } from "./forms";

export default class Explorer {
	creds: Credentials;
	env: EnvironmentConfig & HostConfig;
	withoutDigestHeader: boolean;

	authType: number; // 0 for none, 2 for V2
	method: string;
	output: string;

	#path: string;
	path: string;

	upload?: string;
	#data?: string;
	#contentType?: string;

	/**
	 * Constructor.
	 *
	 * @param creds the credentials
	 * @param form the explorer form
	 */
	constructor(creds: Credentials, form: ExplorerFormElements) {
		this.creds = creds;
		this.env = creds.getEnvironment();
		this.withoutDigestHeader = false;

		const jForm = $(form.path.form!);
		this.authType = Number(
			jForm.find("input[name=useAuth]:checked").val() as string
		);
		this.method = jForm.find("input[name=method]:checked").val() as string;
		this.output = jForm.find("input[name=output]:checked").val() as string;
		this.#path = form.path.value;
		this.path = this.#path;
		if (this.supportsContent) {
			this.upload = form.upload.value;
			this.#data = this.upload;
			if (this.#data.length < 1) {
				// move any parameters into post body
				var a = document.createElement("a");
				a.href = this.path;
				this.path = a.pathname;
				this.#data = a.search;
				if (this.#data.indexOf("?") === 0) {
					this.#data = this.#data.substring(1);
				}
				this.#contentType = HttpContentType.FORM_URLENCODED_UTF8;
			} else {
				// assume content type is json if post body provided (escape newlines and tabs)
				try {
					this.#data = JSON.stringify(JSON.parse(this.#data));
				} catch (e) {
					console.warn("Error parsing content as JSON: %s", e);
				}
				this.#contentType = HttpContentType.APPLICATION_JSON_UTF8;
			}
			if (this.#data !== undefined && this.#data.length < 1) {
				this.#data = undefined;
				this.#contentType = undefined;
			}
		}
	}

	get servicePath(): string {
		return this.#path;
	}

	get supportsContent(): boolean {
		return this.method === HttpMethod.POST ||
			this.method === HttpMethod.PUT ||
			this.method === HttpMethod.PATCH
			? true
			: false;
	}

	/**
	 * The URL used for authorization.
	 *
	 * @type {String}
	 */
	get authUrl() {
		var protocol = this.env.protocol,
			port = this.env.port,
			url = protocol + "://" + this.env.host;
		if (
			port &&
			((protocol === "https" && port !== 443) ||
				(protocol === "http" && port !== 80))
		) {
			url += ":" + port;
		}
		url += this.path;
		return url;
	}

	/**
	 * The URL used for the request, which may differ from `authUrl` if a proxy is used.
	 *
	 * @type {String}
	 */
	get requestUrl() {
		if (!this.creds.proxy) {
			return this.authUrl;
		}
		return this.creds.proxy + this.path;
	}

	set contentType(contentType: string) {
		this.#contentType = contentType;
	}

	/**
	 * Get the request content type.
	 *
	 * @returns the content type, or `undefined` if the request does not support content or has none
	 */
	get contentType(): string | undefined {
		var cType = undefined;
		if (this.supportsContent && this.#data) {
			cType = this.#contentType
				? this.#contentType
				: HttpContentType.FORM_URLENCODED_UTF8;
		}
		return cType;
	}

	/**
	 * Test if authorization is required.
	 *
	 * @returns `true` if authorization is being used
	 */
	isAuthRequired(): boolean {
		return this.authType > 0;
	}

	/**
	 * Test if a content digest should be included in the request.
	 *
	 * @returns `true` if a content digest should be included
	 */
	shouldIncludeContentDigest(): boolean {
		// we don't send Content-MD5/Digest for form data, because server treats this as URL parameters
		const contentType = this.#contentType;
		return !!(
			contentType &&
			contentType.indexOf(HttpContentType.FORM_URLENCODED) < 0
		);
	}

	/**
	 * Create a new `AuthorizationV2Builder` from this explorer, configured with the request details.
	 *
	 * @returns the builder
	 */
	authV2Builder(): AuthorizationV2Builder {
		var authBuilder = new AuthorizationV2Builder(
			this.creds.token,
			this.env
		);
		var contentType = this.#contentType;
		var url = this.authUrl;
		if (
			contentType &&
			contentType.indexOf(HttpContentType.FORM_URLENCODED) >= 0
		) {
			url += "?" + this.#data;
		}
		var authBuilder = authBuilder
			.method(this.method)
			.url(url)
			.snDate(true)
			.date(this.creds.date)
			.saveSigningKey(this.creds.secret);
		if (contentType) {
			authBuilder.contentType(contentType);
		}
		if (
			this.#data &&
			this.method !== HttpMethod.GET &&
			this.shouldIncludeContentDigest()
		) {
			authBuilder.computeContentDigest(this.#data);
		}
		if (this.withoutDigestHeader) {
			authBuilder.httpHeaders.remove("Digest");
		}
		return authBuilder;
	}

	authorize(): Headers {
		const auth = this.authV2Builder();
		const headers = new Headers();
		headers.set(
			HttpHeaders.ACCEPT,
			this.output === "xml"
				? "text/xml"
				: this.output === "csv"
				? "text/csv"
				: "application/json"
		);
		headers.set(HttpHeaders.AUTHORIZATION, auth.buildWithSavedKey());
		headers.set(HttpHeaders.X_SN_DATE, auth.requestDateHeaderValue!);
		if (auth.httpHeaders.firstValue(HttpHeaders.DIGEST)) {
			headers.set(
				HttpHeaders.DIGEST,
				auth.httpHeaders.firstValue(HttpHeaders.DIGEST)
			);
		}
		return headers;
	}

	/**
	 * Get a `curl` command for the configured request.
	 *
	 * @returns the `curl` command
	 */
	curl(): string {
		var authBuilder = this.authV2Builder();
		var curl =
			"curl" +
			(this.method !== "GET" ? " -X " + this.method : "") +
			" -H 'Accept: " +
			(this.output === "xml"
				? "text/xml"
				: this.output === "csv"
				? "text/csv"
				: "application/json") +
			"'";

		if (authBuilder.httpHeaders.firstValue(HttpHeaders.DIGEST)) {
			curl +=
				" -H '" +
				HttpHeaders.DIGEST +
				": " +
				authBuilder.httpHeaders.firstValue(HttpHeaders.DIGEST) +
				"'";
		}

		if (this.isAuthRequired()) {
			curl +=
				" -H '" +
				HttpHeaders.X_SN_DATE +
				": " +
				this.creds.date.toUTCString() +
				"'";
			curl +=
				" -H '" +
				HttpHeaders.AUTHORIZATION +
				": " +
				authBuilder.buildWithSavedKey() +
				"'";
		}
		if (this.#data && this.method !== HttpMethod.GET) {
			curl +=
				" -H '" +
				HttpHeaders.CONTENT_TYPE +
				": " +
				this.#contentType +
				"' -d '" +
				this.#data +
				"'";
		}
		curl += " '" + this.requestUrl + "'";
		return curl;
	}

	submit(): Promise<Response> {
		const headers = this.authorize();
		const req: RequestInit = {
			method: this.method,
			headers: headers,
		};
		if (this.#data) {
			req.body = this.#data;
		}
		return fetch(this.requestUrl, req);
	}
}
