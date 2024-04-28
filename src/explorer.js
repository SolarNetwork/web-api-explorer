import $ from "jquery";
import {
  AuthorizationV2Builder,
  HttpContentType,
  HttpHeaders,
  HttpMethod,
} from "solarnetwork-api-core";

export default class Explorer {
  /**
   * Constructor.
   *
   * @param {Credentials} creds the credentials
   * @param {HTMLFormElement} form the explorer form
   */
  constructor(creds, form) {
    this.creds = creds;
    this.env = creds.getEnvironment();
    this._withoutDigestHeader = false;
    if (form && form.elements) {
      var jForm = $(form);
      this.authType = jForm.find("input[name=useAuth]:checked").val();
      this.method = jForm.find("input[name=method]:checked").val();
      this.output = jForm.find("input[name=output]:checked").val();
      this._path = form.elements["path"].value;
      this.path = this._path;
      if (this.supportsContent) {
        this.upload = jForm.find("textarea[name=upload]").val();
        this.data = this.upload;
        if (this.data.length < 1) {
          // move any parameters into post body
          var a = document.createElement("a");
          a.href = this.path;
          this.path = a.pathname;
          this.data = a.search;
          if (this.data.indexOf("?") === 0) {
            this.data = this.data.substring(1);
          }
          this.contentType = HttpContentType.FORM_URLENCODED_UTF8;
        } else {
          // assume content type is json if post body provided (escape newlines and tabs)
          try {
            this.data = JSON.stringify(JSON.parse(this.data));
          } catch (e) {
            console.warn("Error parsing content as JSON: %s", e);
          }
          this.contentType = HttpContentType.APPLICATION_JSON_UTF8;
        }
        if (this.data !== undefined && this.data.length < 1) {
          delete this.data;
          delete this.contentType;
        }
      }
    }
  }

  get servicePath() {
    return this._path;
  }

  get supportsContent() {
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
    if (port && ((protocol === "https" && port !== 443) || (protocol === "http" && port !== 80))) {
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

  /**
   * Get the "without Digest header" flag.
   *
   * @type {Boolean}
   */
  get withoutDigestHeader() {
    return this._withoutDigestHeader;
  }

  /**
   * Set the "without Digest header" flag.
   *
   * @param {Boolean} val `true` to omit the HTTP `Digest` header when body content is posted
   */
  set withoutDigestHeader(val) {
    this._withoutDigestHeader = !!val;
  }

  set contentType(contentType) {
    this._contentType = contentType;
  }

  /**
   * Get the request content type.
   *
   * @returns {string} the content type, or `undefined` if the request does not support content or has none
   */
  get contentType() {
    var cType = undefined;
    if (this.supportsContent && this.data) {
      cType = this._contentType ? this._contentType : HttpContentType.FORM_URLENCODED_UTF8;
    }
    return cType;
  }

  /**
   * Test if authorization is required.
   *
   * @returns {Boolean} `true` if authorization is being used
   */
  isAuthRequired() {
    return this.authType > 0;
  }

  /**
   * Test if a content digest should be included in the request.
   *
   * @returns {Boolean} `true` if a content digest should be included
   */
  shouldIncludeContentDigest() {
    // we don't send Content-MD5/Digest for form data, because server treats this as URL parameters
    const contentType = this.contentType;
    return contentType && contentType.indexOf(HttpContentType.FORM_URLENCODED) < 0;
  }

  /**
   * Create a new `AuthorizationV2Builder` from this explorer, configured with the request details.
   *
   * @returns {AuthorizationV2Builder}
   */
  authV2Builder() {
    var authBuilder = new AuthorizationV2Builder(this.creds.token, this.env);
    var contentType = this.contentType;
    var url = this.authUrl;
    if (contentType && contentType.indexOf(HttpContentType.FORM_URLENCODED) >= 0) {
      url += "?" + this.data;
    }
    var authBuilder = authBuilder
      .method(this.method)
      .url(url)
      .contentType(contentType)
      .snDate(true)
      .date(this.creds.date)
      .saveSigningKey(this.creds.secret);
    if (this.data && this.method !== HttpMethod.GET && this.shouldIncludeContentDigest()) {
      authBuilder.computeContentDigest(this.data);
    }
    if (this.withoutDigestHeader) {
      authBuilder.httpHeaders.remove("Digest");
    }
    return authBuilder;
  }

  handleAuthV2(xhr) {
    var authBuilder = this.authV2Builder();

    if (authBuilder.httpHeaders.firstValue(HttpHeaders.DIGEST)) {
      xhr.setRequestHeader(
        HttpHeaders.DIGEST,
        authBuilder.httpHeaders.firstValue(HttpHeaders.DIGEST)
      );
    }

    xhr.setRequestHeader(HttpHeaders.X_SN_DATE, authBuilder.requestDateHeaderValue);
    xhr.setRequestHeader(HttpHeaders.AUTHORIZATION, authBuilder.buildWithSavedKey());
  }

  /**
   * Get a `curl` command for the configured request.
   *
   * @returns {string} the `curl` command
   */
  curl() {
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
      curl += " -H '" + HttpHeaders.X_SN_DATE + ": " + this.creds.date.toUTCString() + "'";
      curl += " -H '" + HttpHeaders.AUTHORIZATION + ": " + authBuilder.buildWithSavedKey() + "'";
    }
    if (this.data && this.method !== HttpMethod.GET) {
      curl +=
        " -H '" + HttpHeaders.CONTENT_TYPE + ": " + this.contentType + "' -d '" + this.data + "'";
    }
    curl += " '" + this.requestUrl + "'";
    return curl;
  }

  submit() {
    var me = this;
    var accepts;
    var dType;
    if (this.output === "csv") {
      accepts = { text: "text/csv" };
      dType = "text";
    } else if (this.output === "xml") {
      accepts = { text: "text/xml" };
      dType = "text";
    } else {
      accepts = { json: "application/json" };
      dType = "json";
    }
    return $.ajax({
      type: this.method,
      url: this.requestUrl,
      accepts: accepts,
      dataType: dType,
      data: this.data,
      contentType: this.contentType,
      beforeSend: function (xhr) {
        if (!me.isAuthRequired()) {
          return;
        }

        if (me.authType == 2) {
          me.handleAuthV2(xhr);
        }
      },
    });
  }
}
