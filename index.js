(function () {
    console.log("[hello-world plugin] index.js loaded and executing");

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    // --- Test 3: mount a real React component inside the injected panel ---
    //
    // IMPORTANT TIMING NOTE: Taiga's loader (app-loader.coffee) resolves this plugin's own
    // load-promise as soon as this script FILE finishes loading (script.onload) — it does not
    // wait for any promises we create inside it. Right after that, Taiga proceeds to
    // angular.bootstrap(), which reads window.getDecorators() exactly once during Angular's
    // config phase. So window.addDecorator(...) MUST be called synchronously, at the top level
    // of this script — NOT inside a .then() — or it registers too late and is silently ignored.
    //
    // React/ReactDOM aren't declared in this plugin's conf.json because Taiga's loader only
    // supports a single JS path per plugin (script.src = path, not an array) — so we load them
    // ourselves, asynchronously, in the background. The decorator itself is registered
    // synchronously below; only the actual React render call is deferred until the scripts
    // have finished loading.
    var reactReady = Promise.all([
        loadScript("https://unpkg.com/react@18/umd/react.production.min.js"),
        loadScript("https://unpkg.com/react-dom@18/umd/react-dom.production.min.js")
    ]).then(function () {
        console.log("[hello-world plugin] React + ReactDOM loaded", window.React.version);
    }).catch(function (err) {
        console.error("[hello-world plugin] Failed to load React", err);
    });

    function TaskTimeTrackingPanel(props) {
        var task = props.task;
        return React.createElement(
            "div",
            { className: "hello-plugin-react-panel" },
            React.createElement("strong", null, "React Time Tracking Panel"),
            React.createElement(
                "div",
                null,
                "Task #" + task.ref + ": " + task.subject
            ),
            React.createElement(
                "div",
                null,
                "Rendered by React " + React.version + " inside an AngularJS 1.x view"
            )
        );
    }

    // Registered synchronously — before Angular's config phase runs.
    window.addDecorator("tgTaskStatusDisplayDirective", ["$delegate", function ($delegate) {
        console.log("[hello-world plugin] decorating tgTaskStatusDisplayDirective (React version)");
        var directive = $delegate[0];

        // AngularJS normalizes a link-only directive into `compile` the first time its
        // factory resolves (compile = valueFn(link)), before this decorator runs. Angular's
        // runtime only calls `directive.compile` afterwards, so decorating `.link` directly
        // has no effect — `.compile` must be decorated instead.
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

                var sidebar = document.querySelector("sidebar.ticket-data");
                if (sidebar) {
                    sidebar.appendChild(mountPoint);
                } else {
                    element.after(mountPoint);
                }
                mountPoint.innerText = "React Time Tracking Panel (loading React...)";

                scope.$watch(attrs.ngModel, function (task) {
                    if (!task) {
                        return;
                    }
                    reactReady.then(function () {
                        if (!mountPoint._reactRoot) {
                            mountPoint._reactRoot = ReactDOM.createRoot(mountPoint);
                        }
                        mountPoint._reactRoot.render(React.createElement(TaskTimeTrackingPanel, { task: task }));
                        console.log("[hello-world plugin] React panel rendered with real task data", task.ref, task.subject);
                    });
                });
            };
        };

        return $delegate;
    }]);
})();
