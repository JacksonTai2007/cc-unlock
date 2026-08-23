globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.navigator = {
  userAgent: "masked-task-local-ua"
};
globalThis.location = {
  href: "https://masked.example/"
};
globalThis.document = {
  createElement() {
    return {
      style: {},
      getContext() {
        return {};
      }
    };
  }
};
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};
globalThis.sessionStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};
globalThis.TextEncoder = globalThis.TextEncoder || require("node:util").TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder || require("node:util").TextDecoder;
globalThis.crypto = globalThis.crypto || {
  subtle: {}
};
