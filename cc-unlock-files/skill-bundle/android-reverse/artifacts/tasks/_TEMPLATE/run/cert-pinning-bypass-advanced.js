"use strict";

const CONFIG = {
  replaceTrustManagers: true,
  patchOkHttp: true,
  patchConscrypt: true,
  patchHttpsURLConnection: true,
  patchWebView: true,
  patchNativeVerify: false,
  nativeVerifySymbols: [
    "X509_verify_cert"
  ]
};

let PermissiveTrustManager = null;
let PermissiveHostnameVerifier = null;

function log(message) {
  console.log("[cert-pinning-bypass-advanced] " + message);
}

function ensureTrustManager() {
  if (PermissiveTrustManager !== null) {
    return PermissiveTrustManager;
  }

  const X509TrustManager = Java.use("javax.net.ssl.X509TrustManager");
  const X509Array = Java.array("java.security.cert.X509Certificate", []);
  PermissiveTrustManager = Java.registerClass({
    name: "org.null119.codex.AdvancedPermissiveTrustManager",
    implements: [X509TrustManager],
    methods: {
      checkClientTrusted: function () {},
      checkServerTrusted: function () {},
      getAcceptedIssuers: function () {
        return X509Array;
      }
    }
  });

  return PermissiveTrustManager;
}

function ensureHostnameVerifier() {
  if (PermissiveHostnameVerifier !== null) {
    return PermissiveHostnameVerifier;
  }

  const HostnameVerifier = Java.use("javax.net.ssl.HostnameVerifier");
  PermissiveHostnameVerifier = Java.registerClass({
    name: "org.null119.codex.AdvancedPermissiveHostnameVerifier",
    implements: [HostnameVerifier],
    methods: {
      verify: function (hostname) {
        log("HostnameVerifier.verify => true for " + hostname);
        return true;
      }
    }
  });

  return PermissiveHostnameVerifier;
}

function hookClassIfPresent(name, installer) {
  try {
    installer(Java.use(name));
    log("hooked " + name);
  } catch (error) {
    log("skip " + name + ": " + error);
  }
}

function hookNativeVerify() {
  if (!CONFIG.patchNativeVerify) {
    return;
  }

  CONFIG.nativeVerifySymbols.forEach(function (symbolName) {
    const address = Module.findExportByName(null, symbolName);
    if (!address) {
      log("skip native verify " + symbolName + " (not found)");
      return;
    }

    Interceptor.attach(address, {
      onLeave: function (retval) {
        log(symbolName + " => 1");
        retval.replace(ptr(1));
      }
    });
  });
}

Java.perform(function () {
  if (CONFIG.replaceTrustManagers) {
    const SSLContext = Java.use("javax.net.ssl.SSLContext");
    const Manager = ensureTrustManager();
    const initOverload = SSLContext.init.overload(
      "[Ljavax.net.ssl.KeyManager;",
      "[Ljavax.net.ssl.TrustManager;",
      "java.security.SecureRandom"
    );

    initOverload.implementation = function (keyManagers, trustManagers, secureRandom) {
      log("SSLContext.init replace trustManagers");
      const patchedManagers = Java.array("javax.net.ssl.TrustManager", [Manager.$new()]);
      return initOverload.call(this, keyManagers, patchedManagers, secureRandom);
    };
  }

  if (CONFIG.patchConscrypt) {
    [
      "com.android.org.conscrypt.TrustManagerImpl",
      "org.conscrypt.TrustManagerImpl"
    ].forEach(function (name) {
      hookClassIfPresent(name, function (TrustManagerImpl) {
        if (TrustManagerImpl.verifyChain) {
          TrustManagerImpl.verifyChain.implementation = function (chain) {
            log(name + ".verifyChain");
            return chain;
          };
        }

        if (TrustManagerImpl.checkTrustedRecursive) {
          TrustManagerImpl.checkTrustedRecursive.implementation = function () {
            log(name + ".checkTrustedRecursive");
            return Java.use("java.util.ArrayList").$new();
          };
        }
      });
    });
  }

  if (CONFIG.patchOkHttp) {
    [
      "okhttp3.CertificatePinner",
      "com.squareup.okhttp.CertificatePinner"
    ].forEach(function (name) {
      hookClassIfPresent(name, function (CertificatePinner) {
        CertificatePinner.check.overloads.forEach(function (overload) {
          overload.implementation = function () {
            const args = Array.prototype.slice.call(arguments);
            log(name + ".check " + args.map(String).join(", "));
          };
        });
      });
    });

    hookClassIfPresent("okhttp3.internal.tls.OkHostnameVerifier", function (OkHostnameVerifier) {
      OkHostnameVerifier.verify.overloads.forEach(function (overload) {
        overload.implementation = function () {
          const args = Array.prototype.slice.call(arguments);
          log("OkHostnameVerifier.verify => true for " + args[0]);
          return true;
        };
      });
    });
  }

  if (CONFIG.patchHttpsURLConnection) {
    const HttpsURLConnection = Java.use("javax.net.ssl.HttpsURLConnection");
    const verifier = ensureHostnameVerifier();
    const trustManager = ensureTrustManager();
    const setDefaultHostnameVerifierOverload = HttpsURLConnection.setDefaultHostnameVerifier.overload("javax.net.ssl.HostnameVerifier");
    const setHostnameVerifierOverload = HttpsURLConnection.setHostnameVerifier.overload("javax.net.ssl.HostnameVerifier");
    const setSocketFactoryOverload = HttpsURLConnection.setSSLSocketFactory.overload("javax.net.ssl.SSLSocketFactory");

    setDefaultHostnameVerifierOverload.implementation = function () {
      log("HttpsURLConnection.setDefaultHostnameVerifier replace");
      return setDefaultHostnameVerifierOverload.call(this, verifier.$new());
    };

    setHostnameVerifierOverload.implementation = function () {
      log("HttpsURLConnection.setHostnameVerifier replace");
      return setHostnameVerifierOverload.call(this, verifier.$new());
    };

    setSocketFactoryOverload.implementation = function (factory) {
      log("HttpsURLConnection.setSSLSocketFactory passthrough");
      return setSocketFactoryOverload.call(this, factory);
    };

    log("HttpsURLConnection ready with permissive verifier " + trustManager);
  }

  if (CONFIG.patchWebView) {
    hookClassIfPresent("android.webkit.WebViewClient", function (WebViewClient) {
      if (WebViewClient.onReceivedSslError) {
        WebViewClient.onReceivedSslError.implementation = function (view, handler) {
          log("WebViewClient.onReceivedSslError proceed");
          handler.proceed();
        };
      }
    });
  }

  hookClassIfPresent("org.chromium.net.CronetEngine$Builder", function (Builder) {
    Builder.enableHttp2.overloads.forEach(function (overload) {
      overload.implementation = function (enabled) {
        log("CronetBuilder.enableHttp2 " + enabled);
        return overload.call(this, enabled);
      };
    });

    Builder.enableQuic.overloads.forEach(function (overload) {
      overload.implementation = function (enabled) {
        log("CronetBuilder.enableQuic " + enabled);
        return overload.call(this, enabled);
      };
    });
  });
});

hookNativeVerify();
