"use strict";

const CONFIG = {
  replaceTrustManagers: true,
  patchOkHttp: true,
  patchConscrypt: true,
  patchWebView: true
};

let PermissiveTrustManager = null;

function log(message) {
  console.log("[cert-pinning-bypass] " + message);
}

function ensureTrustManager() {
  if (PermissiveTrustManager !== null) {
    return PermissiveTrustManager;
  }

  const X509TrustManager = Java.use("javax.net.ssl.X509TrustManager");
  PermissiveTrustManager = Java.registerClass({
    name: "org.null119.codex.PermissiveTrustManager",
    implements: [X509TrustManager],
    methods: {
      checkClientTrusted: function () {},
      checkServerTrusted: function () {},
      getAcceptedIssuers: function () {
        return [];
      }
    }
  });

  return PermissiveTrustManager;
}

function hookClassIfPresent(name, installer) {
  try {
    installer(Java.use(name));
    log("hooked " + name);
  } catch (error) {
    log("skip " + name + ": " + error);
  }
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
    hookClassIfPresent("okhttp3.CertificatePinner", function (CertificatePinner) {
      CertificatePinner.check.overloads.forEach(function (overload) {
        overload.implementation = function () {
          const args = Array.prototype.slice.call(arguments);
          log("okhttp3.CertificatePinner.check " + args.map(String).join(", "));
        };
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
});
