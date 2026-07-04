import { sdk } from "./sdk";
import { uiPort, pollenPort } from "./utils";

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const web = sdk.MultiHost.of(effects, "web");
  const webOrigin = await web.bindPort(uiPort, {
    protocol: "http",
    preferredExternalPort: uiPort
  });
  const ui = sdk.createInterface(effects, {
    name: "MeshDrop",
    id: "ui",
    description: "MeshDrop web interface",
    type: "ui",
    masked: false,
    schemeOverride: null,
    username: null,
    path: "",
    query: {}
  });

  const pollen = sdk.MultiHost.of(effects, "pollen");
  const pollenOrigin = await pollen.bindPort(pollenPort, {
    protocol: null,
    addSsl: null,
    preferredExternalPort: pollenPort,
    secure: { ssl: false }
  });
  const pollenPeer = sdk.createInterface(effects, {
    name: "Pollen",
    id: "pollen",
    description: "Pollen peer transport",
    type: "p2p",
    masked: true,
    schemeOverride: null,
    username: null,
    path: "",
    query: {}
  });

  return [
    await webOrigin.export([ui]),
    await pollenOrigin.export([pollenPeer])
  ];
});
