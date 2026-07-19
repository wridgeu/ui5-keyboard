window["sap-ushell-config"] = {
  defaultRenderer: "fiori2",
  renderers: {
    fiori2: {
      componentData: {
        config: {
          search: "hidden",
          enableSearch: false,
        },
      },
    },
  },
  applications: {
    // The UI5 demo application (loaded as a SAPUI5 component from this
    // artifact root, next to flp.html).
    "DemoApp-display": {
      title: "UI5 Keyboard Libraries Demo",
      description: "UI5 controls: hotkeys + kiosk keyboard",
      additionalInformation: "SAPUI5.Component=demo.hotkeys",
      applicationType: "SAPUI5",
      url: "./",
      navigationMode: "embedded",
    },
    // The "raw" web components demo: a framework-less standalone page
    // (no UI5 runtime), opened inside the shell via a URL app.
    "WebComponents-display": {
      title: "Raw Web Components Demo",
      description: "Framework-less kiosk-keyboard custom element",
      applicationType: "URL",
      url: "./webc-demo/index.html",
      navigationMode: "embedded",
    },
  },
};
