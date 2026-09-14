(function () {
    console.log("[taiga-react-plugin-example] index.js loaded and executing");

    // Taiga's plugin loader only supports a single JS path per plugin
    // (script.src = path, a plain string, not an array) — see loadJS() in
    // taiga-front's app-loader/app-loader.coffee. So React/ReactDOM aren't declared
    // in conf.json; we load them ourselves, dynamically, from inside this file.
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    var reactReady = Promise.all([
        loadScript("https://unpkg.com/react@18/umd/react.production.min.js"),
        loadScript("https://unpkg.com/react-dom@18/umd/react-dom.production.min.js")
    ]).then(function () {
        console.log("[taiga-react-plugin-example] React + ReactDOM loaded", window.React.version);
    }).catch(function (err) {
        console.error("[taiga-react-plugin-example] Failed to load React", err);
    });

    // ------------------------------------------------------------------------------
    // Example 1: inject a React component INSIDE an existing Taiga view.
    //
    // This decorates a real Taiga directive (tgTaskStatusDisplay, used in the Task
    // detail sidebar) via Taiga's official plugin decorator mechanism
    // (window.addDecorator -> $provide.decorator, applied during Angular's config
    // phase, before angular.bootstrap() runs — see app-loader.coffee / app.coffee).
    //
    // AngularJS-specific gotcha: a directive that only defines `link` (not `compile`)
    // gets normalized internally to `compile = valueFn(link)` the first time its
    // factory resolves — which happens before any decorator runs. From then on,
    // Angular's compiler only ever calls `.compile`, never `.link` again. So you must
    // decorate `.compile`, not `.link`, or your replacement is silently ignored.
    // ------------------------------------------------------------------------------
    function TaskTimeTrackingPanel(props) {
        var task = props.task;
        return React.createElement(
            "div",
            { className: "hello-plugin-react-panel" },
            React.createElement("strong", null, "React Time Tracking Panel"),
            React.createElement("div", null, "Task #" + task.ref + ": " + task.subject),
            React.createElement(
                "div",
                null,
                "Rendered by React " + React.version + " inside an AngularJS 1.x view"
            )
        );
    }

    window.addDecorator("tgTaskStatusDisplayDirective", ["$delegate", function ($delegate) {
        var directive = $delegate[0];
        var originalCompile = directive.compile;

        directive.compile = function () {
            var originalLinkFn = originalCompile.apply(this, arguments);

            return function (scope, element, attrs, ctrl) {
                if (typeof originalLinkFn === "function") {
                    originalLinkFn.apply(this, arguments);
                } else if (originalLinkFn && originalLinkFn.post) {
                    originalLinkFn.post.apply(this, arguments);
                }

                var mountPoint = document.createElement("div");
                mountPoint.className = "hello-plugin-task-panel";

                // Append at the end of the sidebar, not right after the decorated
                // element — the injection point is flexible, you can target any
                // container in the view.
                var sidebar = document.querySelector("sidebar.ticket-data");
                if (sidebar) {
                    sidebar.appendChild(mountPoint);
                } else {
                    element.after(mountPoint);
                }

                scope.$watch(attrs.ngModel, function (task) {
                    if (!task) {
                        return;
                    }
                    reactReady.then(function () {
                        if (!mountPoint._reactRoot) {
                            mountPoint._reactRoot = ReactDOM.createRoot(mountPoint);
                        }
                        mountPoint._reactRoot.render(React.createElement(TaskTimeTrackingPanel, { task: task }));
                    });
                });
            };
        };

        return $delegate;
    }]);

    // ------------------------------------------------------------------------------
    // Example 2: register a brand-new page, with its own shareable URL — not just
    // injecting into an existing view.
    //
    // Taiga's frontend uses AngularJS's classic $routeProvider (ngRoute). Routes are
    // registered during Angular's config phase, in Taiga's own app.coffee — a plugin
    // never gets direct access to $routeProvider. But you CAN decorate the runtime
    // "$route" SERVICE the same way as any other provider, and mutate its `.routes`
    // map directly to add a new entry. This runs once, during Angular's config
    // phase, independent of any other view or directive — so it works even on a
    // cold, direct load of the new URL (no need to have visited any other page
    // first, which is what "shareable via URL" requires).
    //
    // The shape of each route object (regexp, keys, template, etc.) was reverse
    // engineered by inspecting one of Taiga's own existing routes at runtime
    // (`angular.element(document.body).injector().get('$route').routes`).
    // ------------------------------------------------------------------------------
    window.addDecorator("$route", ["$delegate", function ($delegate) {
        $delegate.routes["/project/:pslug/hello-plugin-report"] = {
            originalPath: "/project/:pslug/hello-plugin-report",
            regexp: /^\/project\/(?:([^/]+))\/hello-plugin-report$/,
            keys: [{ name: "pslug", optional: false }],
            template: '<div id="hello-plugin-report-root"></div>',
            reloadOnSearch: true,
            caseInsensitiveMatch: false,
            controller: ["$scope", "$timeout", function ($scope, $timeout) {
                $timeout(function () {
                    reactReady.then(function () {
                        var el = document.getElementById("hello-plugin-report-root");
                        if (el) {
                            ReactDOM.createRoot(el).render(
                                React.createElement(
                                    "div",
                                    { className: "hello-plugin-react-panel" },
                                    "Hello from a brand-new route, registered by a plugin!"
                                )
                            );
                        }
                    });
                });
            }]
        };
        return $delegate;
    }]);
})();
