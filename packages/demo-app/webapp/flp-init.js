// Core.ready() (since 1.118) replaces the deprecated
// sap.ui.getCore().attachInit. The ushell sandbox creates the Container
// during core init, so it is available by the time core is ready.
sap.ui.require(["sap/ushell/Container", "sap/ui/core/Core"], function (Container, Core) {
  Core.ready()
    .then(function () {
      // createRenderer is deprecated since 1.120 without a public successor
      // (createRendererInternal is @private), and instantiating the fiori2
      // renderer is the only way this static sandbox can put up a shell.
      // ui5lint-disable-next-line no-deprecated-api
      return Container.createRenderer(undefined, true);
    })
    .then(function (renderer) {
      renderer.placeAt("content");
    });
});
