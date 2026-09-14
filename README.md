# Taiga React Plugin Example

A minimal, working example of building [Taiga](https://taiga.io) frontend contrib plugins with
**React**, instead of Taiga's own legacy AngularJS 1.x / CoffeeScript stack.

Taiga's frontend (`taiga-front`) supports a `contribPlugins` mechanism for loading custom
JS/CSS into the app (see `conf.json`'s `contribPlugins` list), plus an official decorator API
(`window.addDecorator`) for hooking into Angular's own directives and services. Documentation
for this is sparse, so this repo exists as a concrete, runnable reference — built while
investigating whether React could be used for a real plugin's UI.

## What's here

Everything lives in `index.js` (plus `conf.json` registering it, and `main.css` for styling).
Two independent examples, both using the same underlying mechanism:

### 1. Inject a React component inside an existing Taiga view

Decorates Taiga's real `tgTaskStatusDisplay` directive (used in the Task detail sidebar) and
mounts a small React component next to it, with live data from the actual Task being viewed
(via `scope.$watch` on the directive's own `ngModel`) — not mock content.

```
window.addDecorator("tgTaskStatusDisplayDirective", ["$delegate", function ($delegate) { ... }]);
```

Includes a real AngularJS gotcha and its fix: a directive that only defines `link` (not
`compile`) gets normalized internally to `compile = valueFn(link)` the first time its factory
resolves, *before* any decorator runs — so decorating `.link` directly has no effect. You have
to decorate `.compile` instead.

### 2. Register a brand-new page, with its own shareable URL

Taiga's frontend uses AngularJS's `$routeProvider` (ngRoute), configured entirely inside
Taiga's own `app.coffee` — a plugin has no direct access to `$routeProvider`. Instead, this
decorates the runtime `$route` **service** and mutates its `.routes` map directly to add a new
route Taiga never defined:

```
window.addDecorator("$route", ["$delegate", function ($delegate) {
    $delegate.routes["/project/:pslug/hello-plugin-report"] = { ... };
    return $delegate;
}]);
```

This runs once, during Angular's config phase — independent of any other view or directive
having rendered first, so it works even on a **cold, direct load** of the new URL (open the
link fresh, no need to navigate through the app first).

## Running it locally

1. Bring up Taiga via its official docker-compose setup (e.g.
   [`taigaio/taiga-docker`](https://github.com/taigaio/taiga-docker)).
2. Mount this repo's files into the `taiga-front` container at
   `/usr/share/nginx/html/plugins/hello-world/`, and point the served `conf.json`'s
   `contribPlugins` at `["/plugins/hello-world/conf.json"]`.
3. Load a Task detail page (`/project/:slug/task/:ref`) to see Example 1, or navigate to
   `/project/:slug/hello-plugin-report` to see Example 2.

## Why this exists

Built while researching whether a modern React-based plugin was viable for extending Taiga
without forking `taiga-front`, or waiting on features Taiga's core team hasn't prioritized. Both
examples here are confirmed working against a real, running Taiga instance — not theoretical.
