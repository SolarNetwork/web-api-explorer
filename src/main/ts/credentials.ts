import {
	Environment,
	EnvironmentConfig,
	HostConfig,
} from "solarnetwork-api-core/lib/net";
import { SnSettingsFormElements } from "./forms";

/**
 * Immutable credentials derived from the SN Settings form.
 */
export default class Credentials {
	readonly token: string;
	readonly secret: string;
	readonly host: string;
	readonly date: Date;
	readonly proxy?: string;

	/**
	 * Constructor.
	 *
	 * @param {HTMLFormElement} form the explorer form
	 */
	constructor(form: SnSettingsFormElements) {
		this.token = form.token.value;
		this.secret = form.secret.value;
		this.host = form.host.value;
		if (form.date.value.length > 0) {
			this.date = new Date(form.date.value);
		} else {
			this.date = new Date();
		}
		if (form.proxy.value.length > 0) {
			this.proxy = form.proxy.value;
		}
	}

	/**
	 * Get an environment for the configured host.
	 *
	 * @returns the environment
	 */
	getEnvironment(): EnvironmentConfig & HostConfig {
		let config: Partial<HostConfig> = {};
		if (this.host) {
			let a = document.createElement("a");
			a.href = this.host;
			config.host = a.hostname;
			config.protocol = a.protocol.substring(0, a.protocol.length - 1);
			config.hostname = a.hostname;
			if (a.port) {
				config.port = Number(a.port);
			}
		}
		return new Environment(config);
	}
}
