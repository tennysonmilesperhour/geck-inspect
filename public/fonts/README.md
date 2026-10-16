# Fonts

Self-hosted copies of the three fonts the site uses, latin characters only, as served by Google Fonts in October 2026. All three are under the SIL Open Font License 1.1, which allows bundling them with a website; the copyright and licence notice is inside each file's name table.

| File | Family | Covers | Used for |
|---|---|---|---|
| `inter-latin-v20.woff2` | Inter (variable) | weights 100 to 900 | the app, guides and every page except the landing page |
| `montserrat-latin-v31.woff2` | Montserrat (variable) | weights 100 to 900 | the landing page (`.landing-font`) |
| `righteous-latin-v18.woff2` | Righteous | 400 | the "Geck Inspect" wordmark |

The `@font-face` rules are in `src/styles/fonts.css`; `index.html` preloads the one the page draws first. The version is in the file name, so a newer copy gets a new name and browsers never mix the two.
