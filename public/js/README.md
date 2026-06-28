# Front-end Script Loading

This project intentionally uses classic browser scripts with `defer`, not a build step. Deferred scripts execute in the same order they appear in the HTML, so the order below is the loading contract.

## Groups

1. Core
   - `api.js` exposes `window.ApiService`.
   - `storage.js` exposes `window.StorageService`.

2. UI foundations
   - `ui-shared.js` exposes DOM helpers and escaping helpers as `window.UIShared`.
   - `ui-formatters.js` depends on `UIShared` and exposes `window.UIFormatters`.
   - Pages load `/shared/editorialModel.js`, `/shared/guideViewModel.js`, `/shared/cardModel.js`, and `/shared/catalogModel.js` before decision models.
   - `ui-decision-models.js` depends on `UIShared`, `UIFormatters`, and the shared models. It remains the compatibility facade for older renderer imports.

3. UI renderers
   - Public renderers: `ui-home.js`, `ui-catalog.js`, `ui-guide.js`, `ui-library.js`.
   - Admin renderer: `ui-admin-render.js`.
   - `ui.js` must load after all renderers needed by the page. It builds `window.UI` by combining common helpers with any loaded renderer modules. Keep `window.UI` as the compatibility surface for controllers.

4. Controllers and bindings
   - Public: `app-search.js`, `app-catalog.js`, `app-library.js`, `guide-presenter.js`, `app-pagination.js`, `app-view-bindings.js`, `app-search-view.js`, `app-guide-view.js`, `app-public-nav.js`, `app-library-controller.js`, `app-guide-controller.js`, `app-user-auth.js`, `app-analytics.js`, `app-feedback.js`.
   - Admin: `app-pagination.js`, `app-admin.js`, `app-admin-draft.js`.
   - `app-pagination.js` is shared because admin and public pagination both use `[data-page-target]`.

5. Bootstrap
   - `app-context.js` wires available globals into one context and provides no-op fallbacks for modules that are not loaded on a page.
   - Page init files (`app-public-init.js` or `app-admin-init.js`) bind events for the current page.
   - `app.js` is always last; it creates the context and starts the matching initializer.

## Current HTML Orders

### `public/index.html`

Core -> UI foundations + shared models -> public UI renderers -> `ui.js` -> public controllers/bindings -> bootstrap.

The public page does not load admin renderers/controllers or expose an editorial/admin CTA. Administrators access the panel through the direct `/admin` route, which loads the admin-only scripts.

### `public/admin.html`

Core -> admin UI foundations + shared models -> `ui-admin-render.js` -> `ui.js` -> admin controllers -> bootstrap.

The admin page should not load public-only renderers such as `ui-home.js`, `ui-catalog.js`, `ui-guide.js`, or `ui-library.js`.

## Adding a Script

- Add the file to the smallest group that satisfies its dependencies.
- If it exports a global, use a clear `window.Name` namespace.
- If a module is optional for one page, `app-context.js` should handle its absence with a no-op or local fallback.
- Update this README and the script order assertions in `scripts/regression-smoke.js`.

## Bundles

There is no mandatory bundle or minification step. If simple `ui-bundle.js` or `app-bundle.js` files are introduced later, they should be generated or maintained as ordered concatenations of the groups above and must continue exposing `window.UI`.
