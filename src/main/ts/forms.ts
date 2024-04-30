export interface SnSettingsFormElements extends HTMLFormControlsCollection {
	token: HTMLInputElement;
	secret: HTMLInputElement;
	host: HTMLInputElement;
	date: HTMLInputElement;
	proxy: HTMLInputElement;
}

export interface ExplorerFormElements extends HTMLFormControlsCollection {
	path: HTMLTextAreaElement;
	shortcutSolarQuery: HTMLSelectElement;
	shortcutSolarUser: HTMLSelectElement;
	useAuth: HTMLInputElement;
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
