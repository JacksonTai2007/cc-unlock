function makeFunction(name) {
  return function () {
    throw new Error("Unimplemented host function: " + name);
  };
}

function watch(path, value) {
  return new Proxy(value, {
    get(target, prop, receiver) {
      console.log("[env:get]", path + "." + String(prop));
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, next, receiver) {
      console.log("[env:set]", path + "." + String(prop));
      return Reflect.set(target, prop, next, receiver);
    }
  });
}

function recordFirstDivergence(location, note) {
  console.log("[first-divergence]", location, note || "");
}

globalThis.__env = { makeFunction, watch, recordFirstDivergence };
