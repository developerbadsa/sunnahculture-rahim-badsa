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
        renderCartSections(cartResponse).finally(function () {
          openCartDrawer(getCartOpener());
        });
      }
    }).catch(function () {});
  }

  function uniqueSectionIds(sections) {
    return sections.reduce(function (ids, section) {
      var id = section && (section.section || section.id);

      if (id && ids.indexOf(id) === -1) {
        ids.push(id);
      }

      return ids;
    }, []);
  }

  function getSectionsToRender() {
    var sections = [];
    var notification = document.querySelector("sht-cart-noti");
    var drawer = getCartDrawer();
    var drawerForm = document.querySelector("sht-cart-drwr-frm");

    if (notification && typeof notification.getSectionsToRender === "function") {
      sections = sections.concat(notification.getSectionsToRender());
    }

    if (drawer && typeof drawer.getSectionsToRender === "function") {
      sections = sections.concat(drawer.getSectionsToRender());
    }

    if (drawerForm && typeof drawerForm.getSectionsToRender === "function") {
      sections = sections.concat(drawerForm.getSectionsToRender());
    }

    return sections;
  }

  function getSectionInnerHTML(html, selector) {
    if (!html) return "";

    var element = new DOMParser().parseFromString(html, "text/html").querySelector(selector);
    return element ? element.innerHTML : "";
  }

  function fetchCartSections(cartResponse) {
    var sections = uniqueSectionIds(getSectionsToRender());

    if (!sections.length || cartResponse && cartResponse.sections && cartResponse.sections["cart-drawer"]) {
      return Promise.resolve(cartResponse);
    }

    var query = sections.map(function (section) {
      return encodeURIComponent(section);
    }).join(",");

    return fetch(window.location.pathname + "?sections=" + query, {
      credentials: "same-origin"
    }).then(function (response) {
      return response.json();
    }).then(function (renderedSections) {
      cartResponse.sections = Object.assign({}, cartResponse.sections || {}, renderedSections);
      return cartResponse;
    }).catch(function () {
      return cartResponse;
    });
  }

  function renderFallbackSections(cartResponse) {
    if (!cartResponse || !cartResponse.sections) return;

    var drawerContainer = document.getElementById("cartDrawer");
    var drawerHtml = cartResponse.sections["cart-drawer"];
    var headerStatus = document.querySelector("#headerCartStatus");
    var headerHtml = cartResponse.sections["header-cart-status"];

    if (drawerContainer && drawerHtml) {
      var drawerInner = getSectionInnerHTML(drawerHtml, ".js-cart-drawer-wrapper");
      var drawerWrapper = drawerContainer.querySelector(".js-cart-drawer-wrapper");

      if (drawerInner && drawerWrapper) {
        drawerWrapper.innerHTML = drawerInner;
        drawerWrapper.classList.remove("is-empty");
      }
    }

    if (headerStatus && headerHtml) {
      var headerInner = getSectionInnerHTML(headerHtml, "#headerCartStatus");

      if (headerInner) {
        headerStatus.innerHTML = headerInner;
        headerStatus.classList.add("header-cart-status--animate");
      }
    }
  }

  function renderCartSections(cartResponse) {
    return fetchCartSections(cartResponse).then(function (responseWithSections) {
      var notification = document.querySelector("sht-cart-noti");
      var drawerForm = document.querySelector("sht-cart-drwr-frm");

      if (notification && typeof notification.renderContents === "function") {
        try {
          notification.renderContents(responseWithSections);
        } catch (error) {
          console.error(error);
        }
      }

      if (drawerForm && typeof drawerForm.renderContents === "function") {
        try {
          drawerForm.renderContents(responseWithSections);
        } catch (error) {
          console.error(error);
        }
      }

      renderFallbackSections(responseWithSections);
      return responseWithSections;
    });
  }

  function toggleSubmitState(form, submitter, isLoading) {
    var submitButton = submitter || form.querySelector('[type="submit"][name="add"]') || form.querySelector('[type="submit"]');
    var spinner = form.querySelector(".js-product-form-spinner, .js-featured-product-form-spinner");

    if (submitButton) {
      submitButton.classList.toggle("loading", isLoading);
      submitButton.toggleAttribute("aria-disabled", isLoading);
    }

    if (spinner) {
      spinner.classList.toggle("hidden", !isLoading);
    }
  }

  function showFormError(form, message) {
    var wrapper = form.closest("sht-prd-frm, sht-prd-qck-vw-frm, sht-featured-prd-frm") || form;
    var errorWrapper = wrapper.querySelector(".js-product-form-error-wrapper, .js-featured-product-form-error-wrapper");
    var errorMessage = wrapper.querySelector(".js-product-form-error-message, .js-featured-product-form-error-message");

    if (errorWrapper) {
      errorWrapper.toggleAttribute("hidden", !message);
    }

    if (errorMessage && message) {
      errorMessage.textContent = message;
    }
  }

  function isAddToCartForm(form) {
    if (!form || form.tagName !== "FORM") return false;

    var action = form.getAttribute("action") || form.action || "";
    if (!isCartAddUrl(action)) return false;

    return !!form.querySelector('[name="id"]');
  }

  function enableVariantInputs(form) {
    form.querySelectorAll('[name="id"]:disabled').forEach(function (input) {
      input.disabled = false;
    });
  }

  function submitCartForm(form, submitter) {
    if (!isAddToCartForm(form)) return;
    if (submitter && submitter.name !== "add") return;
    if (form.dataset.shtCartDrawerSubmitting === "true") return;

    form.dataset.shtCartDrawerSubmitting = "true";
    showFormError(form, "");
    toggleSubmitState(form, submitter, true);
    enableVariantInputs(form);

    var sections = uniqueSectionIds(getSectionsToRender());
    var body = new FormData(form);

    if (sections.length) {
      body.append("sections", sections.join(","));
      body.append("sections_url", window.location.pathname);
    }

    fetch(window.routes.cart_add_url, {
      method: "POST",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/javascript"
      },
      body: body,
      credentials: "same-origin"
    }).then(function (response) {
      return response.json();
    }).then(function (cartResponse) {
      if (cartResponse && cartResponse.status) {
        showFormError(form, cartResponse.description || cartResponse.message || "");
        return;
      }

      return renderCartSections(cartResponse).finally(function () {
        openCartDrawer(getCartOpener());

        var quickShopDialog = document.querySelector("sht-dialog-quickshop");
        if (quickShopDialog && typeof quickShopDialog.closeModal === "function") {
          quickShopDialog.closeModal();
        }
      });
    }).catch(function (error) {
      console.error(error);
      showFormError(form, "Cart update failed. Please try again.");
    }).finally(function () {
      delete form.dataset.shtCartDrawerSubmitting;
      toggleSubmitState(form, submitter, false);
    });
  }

  function handleAddToCartSubmit(event) {
    var form = event.target;
    var submitter = event.submitter;

    if (!isAddToCartForm(form)) return;
    if (submitter && submitter.name !== "add") return;

    event.preventDefault();
    event.stopImmediatePropagation();
    submitCartForm(form, submitter || form.querySelector('[type="submit"][name="add"]'));
  }

  function handleAddToCartClick(event) {
    var submitter = event.target.closest && event.target.closest('button[type="submit"], input[type="submit"]');
    if (!submitter || submitter.name !== "add") return;

    var form = submitter.form || submitter.closest("form");
    if (!isAddToCartForm(form)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    submitCartForm(form, submitter);
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

    if (openCartDrawer(link)) {
      event.preventDefault();
      event.stopPropagation();
    }
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

  if (!window.__shtCartDrawerSubmitPatched) {
    document.addEventListener("click", handleAddToCartClick, true);
    document.addEventListener("submit", handleAddToCartSubmit, true);
    window.__shtCartDrawerSubmitPatched = true;
  }
})();
