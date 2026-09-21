export interface SnSettingsFormElements extends HTMLFormControlsCollection {
	token: HTMLInputElement;
	secret: HTMLInputElement;
	host: HTMLInputElement;
	date: HTMLInputElement;
	proxy: HTMLInputElement;
}

/**
 * The supported API authentication schemes.
 *
 * These are the values of the `useAuth` radio group.
 */
export enum AuthType {
	/** No authentication. */
	None = 0,

	/** The SolarNetwork V2 scheme. */
	Snws2 = 2,

	/** HTTP Message Signatures, as defined in RFC 9421. */
	Rfc9421 = 9421,
}

/** The supported RFC 9421 signing key modes. */
export enum SigningKeyMode {
	/**
	 * Use a signing key derived from the token secret and the signing date.
	 *
	 * This is the default, as the derived key expires and so can be given to a
	 * signer without disclosing the token secret.
	 */
	Derived = "derived",

	/** Use the token secret as the signing key. */
	Secret = "secret",
}

export interface ExplorerFormElements extends HTMLFormControlsCollection {
	path: HTMLTextAreaElement;
	shortcutSolarQuery: HTMLSelectElement;
	shortcutSolarUser: HTMLSelectElement;
	useAuth: HTMLInputElement;
	keyMode: HTMLSelectElement;
	method: HTMLInputElement;
	upload: HTMLTextAreaElement;
	output: HTMLInputElement;
	highlight: HTMLInputElement;
}

export interface AuthSupportFormElements extends HTMLFormControlsCollection {
	withDigest: HTMLInputElement;
}

export interface CurlSupportFormElements extends HTMLFormControlsCollection {
	curlOnly: HTMLInputElement;
}
