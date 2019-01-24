import { Environment } from "solarnetwork-api-core";

export default class Credentials {
  /**
   * Constructor.
   *
   * @param {HTMLFormElement} form the explorer form
   */
  constructor(form) {
    if (form && form.elements) {
      this.token = form.elements["token"].value;
      this.secret = form.elements["secret"].value;
      this.host = form.elements["host"].value;
      if (form.elements["date"].value.length > 0) {
        this.date = new Date(form.elements["date"].value);
      } else {
        this.date = new Date();
      }
    }
  }

  /**
   * Get an environment for the configured host.
   *
   * @returns {Environment} environment
   */
  getEnvironment() {
    var config = undefined;
    if (this.host) {
      let a = document.createElement("a");
      a.href = this.host;
      config = {
        host: a.hostname,
        protocol: a.protocol.substring(0, a.protocol.length - 1),
        hostname: a.hostname,
        port: a.port
      };
    }
    return new Environment(config);
  }
}
