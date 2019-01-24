import $ from "jquery";
import { AuthorizationV2Builder, Environment, HttpHeaders } from "solarnetwork-api-core";

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
    if (form && form.elements) {
      var jForm = $(form);
      this.authType = jForm.find("input[name=useAuth]:checked").val();
      this.method = jForm.find("input[name=method]:checked").val();
      this.output = jForm.find("input[name=output]:checked").val();
      this.path = form.elements["path"].value;
      if (this.method === "POST" || this.method === "PUT" || this.method === "PATCH") {
        this.data = jForm.find("textarea[name=upload]").val();
        if (this.data.length < 1) {
          // move any parameters into post body
          var a = document.createElement("a");
          a.href = params.path;
          this.path = a.pathname;
          this.data = a.search;
          if (this.data.indexOf("?") === 0) {
            this.data = params.data.substring(1);
          }
          this.contentType = "application/x-www-form-urlencoded; charset=UTF-8";
        } else {
          // assume content type is json if post body provided
          this.contentType = "application/json; charset=UTF-8";
        }
        if (this.data !== undefined && this.data.length < 1) {
          delete this.data;
          delete this.contentType;
        }
      }
    }
  }

  get url() {
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
   * Test if authorization is required.
   *
   * @returns {Boolean} `true` if authorization is being used
   */
  isAuthRequired() {
    return this.authType > 0 ? true : false;
  }

  shouldIncludeContentDigest() {
    // we don't send Content-MD5/Digest for form data, because server treats this as URL parameters
    return this.contentType && this.contentType.indexOf("application/x-www-form-urlencoded") < 0;
  }

  handleAuthV2(xhr) {
    var authBuilder = new AuthorizationV2Builder(this.creds.token, this.env);
    authBuilder
      .url(this.url)
      .snDate(true)
      .date(this.creds.date)
      .saveSigningKey(this.creds.secret);

    if (this.data && this.shouldIncludeContentDigest()) {
      authBuilder.computeContentDigest(this.data);
      xhr.setRequestHeader("Digest", authBuilder.httpHeaders.firstValue(HttpHeaders.DIGEST));
    }

    xhr.setRequestHeader(HttpHeaders.X_SN_DATE, authBuilder.requestDateHeaderValue);
    xhr.setRequestHeader(HttpHeaders.AUTHORIZATION, authBuilder.buildWithSavedKey());
  }

  submit() {
    var me = this,
      cType =
        this.data && this.contentType === undefined
          ? "application/x-www-form-urlencoded; charset=UTF-8"
          : this.contentType;
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
      url: this.url,
      accepts: accepts,
      dataType: dType,
      data: this.data,
      contentType: cType,
      beforeSend: function(xhr) {
        if (!me.isAuthRequired()) {
          return;
        }

        if (me.authType == 2) {
          me.handleAuthV2(xhr);
        }
      }
    });
  }
}
