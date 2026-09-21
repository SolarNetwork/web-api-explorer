import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	eslint.configs.recommended,
	tseslint.configs.recommended,
	{
		files: ["**/*.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",

			// jQuery event handlers have to be declared with `function` so that `this` is
			// bound to the DOM element, which means the app instance needs an alias
			"@typescript-eslint/no-this-alias": [
				"error",
				{ allowedNames: ["app"] },
			],
		},
	}
);
