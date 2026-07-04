import { setupManifest } from "@start9labs/start-sdk";

import { short, long } from "./i18n.js";

export const manifest = setupManifest({
  id: "meshdrop",
  title: "MeshDrop",
  license: "ISC",
  packageRepo: "https://github.com/sandwichfarm/meshdrop",
  upstreamRepo: "https://github.com/sandwichfarm/meshdrop",
  marketingUrl: "https://github.com/sandwichfarm/meshdrop",
  donationUrl: null,
  description: { short, long },
  volumes: ["main"],
  images: {
    main: {
      source: {
        dockerTag: "__MESHDROP_IMAGE__"
      },
      arch: ["x86_64", "aarch64"]
    }
  },
  dependencies: {}
});
