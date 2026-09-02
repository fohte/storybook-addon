# Changelog

## [0.1.9](https://github.com/fohte/storybook-addon/compare/v0.1.8...v0.1.9) (2026-09-02)


### Features

* **vitest-plugin:** block external network requests in browser tests ([#68](https://github.com/fohte/storybook-addon/issues/68)) ([59c35bd](https://github.com/fohte/storybook-addon/commit/59c35bdfb366ac52e4da0c77f175d08c940a6bab))


### Bug Fixes

* **checks:** detect external resource requests completing across story transitions ([#69](https://github.com/fohte/storybook-addon/issues/69)) ([5dd5e3f](https://github.com/fohte/storybook-addon/commit/5dd5e3fd61fae322bca61fb6bfcf11c7464fa932))
* **checks:** remove dependency on vitest ([#72](https://github.com/fohte/storybook-addon/issues/72)) ([411bff3](https://github.com/fohte/storybook-addon/commit/411bff371e8afa6b759af7240ca05a8d2c6d18f6))

## [0.1.8](https://github.com/fohte/storybook-addon/compare/v0.1.7...v0.1.8) (2026-08-29)


### Features

* **overflow-check:** detect viewport overflow ([#62](https://github.com/fohte/storybook-addon/issues/62)) ([4d1ec5e](https://github.com/fohte/storybook-addon/commit/4d1ec5ef11f75dbe2e89f76f996a1e952df3ba07))

## [0.1.7](https://github.com/fohte/storybook-addon/compare/v0.1.6...v0.1.7) (2026-08-23)


### Bug Fixes

* use `performance.now()` for pending-fetch wait deadline ([#42](https://github.com/fohte/storybook-addon/issues/42)) ([96d4bdf](https://github.com/fohte/storybook-addon/commit/96d4bdfa7e11f03f4bf39dde664f193cd25f0978))

## [0.1.6](https://github.com/fohte/storybook-addon/compare/v0.1.5...v0.1.6) (2026-08-23)


### Bug Fixes

* **vitest-plugin:** apply viewport to story mount and play() ([#40](https://github.com/fohte/storybook-addon/issues/40)) ([1ed7784](https://github.com/fohte/storybook-addon/commit/1ed7784dd04289f95d04ab88f379b57801883e2c))

## [0.1.5](https://github.com/fohte/storybook-addon/compare/v0.1.4...v0.1.5) (2026-08-21)


### Bug Fixes

* **unhandled-api-request-check:** detect fire-and-forget fetches in stories without a play function ([#33](https://github.com/fohte/storybook-addon/issues/33)) ([3280e17](https://github.com/fohte/storybook-addon/commit/3280e17d70f56225ff9627002fc82368edfaa544))
* **vitest-plugin:** pin the Playwright context viewport to the story viewport ([#35](https://github.com/fohte/storybook-addon/issues/35)) ([43b5082](https://github.com/fohte/storybook-addon/commit/43b5082e68db8eea543975d6b96c6ed337104e22))

## [0.1.4](https://github.com/fohte/storybook-addon/compare/v0.1.3...v0.1.4) (2026-08-20)


### Bug Fixes

* **vitest-plugin:** correct storycap fullPage screenshot tiling ([#30](https://github.com/fohte/storybook-addon/issues/30)) ([ee11bab](https://github.com/fohte/storybook-addon/commit/ee11bab83e3de55da58a46736fb5bd60abd5ad76))

## [0.1.3](https://github.com/fohte/storybook-addon/compare/v0.1.2...v0.1.3) (2026-08-19)


### Features

* **vitest-plugin:** add subpath export ([#26](https://github.com/fohte/storybook-addon/issues/26)) ([4e2e3da](https://github.com/fohte/storybook-addon/commit/4e2e3da868f5f94ca1919df21f8b4a5f78f541f7))

## [0.1.2](https://github.com/fohte/storybook-addon/compare/v0.1.1...v0.1.2) (2026-08-17)


### Bug Fixes

* **checks:** stop losing consumer-set config to bundler module duplication ([#21](https://github.com/fohte/storybook-addon/issues/21)) ([b86715e](https://github.com/fohte/storybook-addon/commit/b86715e67851989155789fd324eed9a9372aab7c))

## [0.1.1](https://github.com/fohte/storybook-addon/compare/v0.1.0...v0.1.1) (2026-08-16)


### Bug Fixes

* **overflow-check:** keep global ignoreSelectors when a story sets its own ([#19](https://github.com/fohte/storybook-addon/issues/19)) ([46529c4](https://github.com/fohte/storybook-addon/commit/46529c420b84d00734e338b3889d90dc0d20d964))
* **overflow-check:** make story root detection independent of document.body mutations ([#17](https://github.com/fohte/storybook-addon/issues/17)) ([2c49a15](https://github.com/fohte/storybook-addon/commit/2c49a1542365acb3a59b0d235ac2d19412f84e75))

## [0.1.0](https://github.com/fohte/storybook-addon/compare/v0.1.0...v0.1.0) (2026-08-16)


* trigger release ([9ef7f68](https://github.com/fohte/storybook-addon/commit/9ef7f68c2d116586fce8279eeb9f97120325b878))


### Bug Fixes

* add repository field to package.json ([#15](https://github.com/fohte/storybook-addon/issues/15)) ([63e533c](https://github.com/fohte/storybook-addon/commit/63e533ccc0b6453b138e40891988579b07aa69c4))

## [0.1.0](https://github.com/fohte/storybook-addon/compare/v0.1.0...v0.1.0) (2026-08-16)


* trigger release ([3713801](https://github.com/fohte/storybook-addon/commit/3713801eed61d52f6452d668e0b1418c3abf8e49))


### Features

* extract Storybook checks into a reusable addon ([#10](https://github.com/fohte/storybook-addon/issues/10)) ([8831fc6](https://github.com/fohte/storybook-addon/commit/8831fc6c779036e98103f2684b3cdff296de950f))
