(function () {
  function getCartDrawer() {
    return document.querySelector("sht-cart-drwr");
  }

  function getCartOpener() {
    return document.querySelector(".js-header-cart-status-btn") || document.querySelector("#headerCartStatus");
  }

  function normalizePath(value) {
    try {
      return new URL(value, window.location.origin).pathname.replace(/\/$/, "");
    } catch (error) {
      return "";
    }
  }

  function closeCartNotification() {
    var notification = document.querySelector("sht-cart-noti");
    if (!notification) return;

    if (typeof notification.close === "function") {
      notification.close();
      return;
    }

    notification.setAttribute("hidden", "true");
  }

  function openCartDrawer(opener) {
    var drawer = getCartDrawer();
    if (!drawer || typeof drawer.openDrawer !== "function") return false;

    closeCartNotification();
    drawer.openDrawer(opener || getCartOpener() || document.activeElement);
    return true;
  }

  function isCartUrl(url) {
    var cartUrl = window.routes && window.routes.cart_url;
    return cartUrl && normalizePath(url) === normalizePath(cartUrl);
  }

  function isCartAddUrl(url) {
    var cartAddUrl = window.routes && window.routes.cart_add_url;
    var path = normalizePath(url);
    return path && (path === normalizePath(cartAddUrl) || /\/cart\/add(?:\.js)?$/.test(path));
  }

  function shouldOpenCartDrawerFromResponse(response) {
    return response && response.ok && isCartAddUrl(response.url);
  }

  function scheduleCartDrawerOpen(response) {
    if (!shouldOpenCartDrawerFromResponse(response)) return;

    response.clone().json().then(function (cartResponse) {
      if (cartResponse && !cartResponse.status) {
        window.setTimeout(function () {
          openCartDrawer(getCartOpener());
        }, 80);
      }
    }).catch(function () {});
  }

  window.shtOpenCartDrawer = openCartDrawer;

  if (window.SHTHelper) {
    window.SHTHelper.openCartDrawer = openCartDrawer;
  }

  customElements.whenDefined("sht-cart-noti").then(function () {
    var CartNotification = customElements.get("sht-cart-noti");
    if (!CartNotification || CartNotification.prototype.__shtCartDrawerPatched) return;

    var originalOpen = CartNotification.prototype.open;
    CartNotification.prototype.open = function () {
      if (getCartDrawer()) {
        this.setAttribute("hidden", "true");
        window.setTimeout(function () {
          openCartDrawer(getCartOpener());
        }, 0);
        return;
      }

      return originalOpen.apply(this, arguments);
    };

    CartNotification.prototype.__shtCartDrawerPatched = true;
  }).catch(function () {});

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || !isCartUrl(link.href)) return;

    event.preventDefault();
    event.stopPropagation();
    openCartDrawer(link);
  }, true);

  if (typeof window.fetch === "function" && !window.fetch.__shtCartDrawerPatched) {
    var originalFetch = window.fetch.bind(window);

    window.fetch = function () {
      return originalFetch.apply(window, arguments).then(function (response) {
        scheduleCartDrawerOpen(response);
        return response;
      });
    };

    window.fetch.__shtCartDrawerPatched = true;
  }
})();
