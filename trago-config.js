(function () {
  "use strict";

  const STORAGE_KEY = "trago-cafe-site-config-v1";
  const PREVIEW_KEY = "trago-cafe-admin-preview-v1";
  const SCHEMA_VERSION = 9;
  const PUBLISHED_CONFIG_PATH = "data/site-config.json";
  const PRODUCT_IMAGE_PATHS = window.TragoCafeProductImages ? window.TragoCafeProductImages.byProductId : {};

  const DEFAULT_THEME = {
    primary: "#B47A4A",
    secondary: "#7A4B32",
    background: "#F6F0E7",
    surface: "#FFFBF5",
    heading: "#2E1D17",
    text: "#382820",
    muted: "#74665C",
    buttonBg: "#6B3E2B",
    buttonText: "#FFF9F0",
    buttonHover: "#4E2C1F",
    border: "#E2D3C3",
    accent: "#E7D1B6"
  };

  const CATEGORY_COPY = {
    Coffee: "A familiar cafe classic for your everyday coffee pause.",
    Frappe: "A chilled menu pick for a slower afternoon.",
    "Non-Coffee": "A flavor-forward sip for a change of pace.",
    Waffle: "A sweet cafe-side treat for a little pause in your day.",
    "Ramyeon and Fries": "A savory choice when your break calls for something more."
  };

  const BASE_PRODUCTS = [
    ["americano", "Americano", "Coffee", [["12oz", "12 oz", 7900], ["12oz-hot", "12 oz Hot", 7900], ["16oz", "16 oz", 8900]]],
    ["latte", "Latte", "Coffee", [["12oz", "12 oz", 7900], ["12oz-hot", "12 oz Hot", 7900], ["16oz", "16 oz", 8900]]],
    ["caramel-macchiato", "Caramel Macchiato", "Coffee", [["12oz", "12 oz", 8900], ["12oz-hot", "12 oz Hot", 8900], ["16oz", "16 oz", 9900]]],
    ["spanish-latte", "Spanish Latte", "Coffee", [["12oz", "12 oz", 8900], ["12oz-hot", "12 oz Hot", 8900], ["16oz", "16 oz", 9900]]],
    ["french-vanilla", "French Vanilla", "Coffee", [["12oz", "12 oz", 8900], ["12oz-hot", "12 oz Hot", 8900], ["16oz", "16 oz", 9900]]],
    ["dirty-matcha-coffee", "Dirty Matcha", "Coffee", [["16oz", "16 oz", 9900]]],
    ["hershey-coffee", "Hershey Coffee", "Coffee", [["16oz", "16 oz", 9900]]],
    ["tres-leches", "Tres Leches", "Coffee", [["16oz", "16 oz", 9900]]],
    ["white-chocolate-mocha", "White Chocolate Mocha", "Coffee", [["16oz", "16 oz", 9900]]],
    ["biscoff-latte", "Biscoff Latte", "Coffee", [["16oz", "16 oz", 9900]]],
    ["java-chip-frappe", "Java Chip", "Frappe", [["16oz", "16 oz", 10900]]],
    ["hershey-coffee-frappe", "Hershey Coffee", "Frappe", [["16oz", "16 oz", 10900]]],
    ["dirty-matcha-frappe", "Dirty Matcha", "Frappe", [["16oz", "16 oz", 10900]]],
    ["white-chocolate-mocha-frappe", "White Chocolate Mocha", "Frappe", [["16oz", "16 oz", 10900]]],
    ["biscoff-frappe", "Biscoff", "Frappe", [["16oz", "16 oz", 10900]]],
    ["strawberry-frappe", "Strawberry", "Frappe", [["16oz", "16 oz", 10900]]],
    ["blueberry-frappe", "Blueberry", "Frappe", [["16oz", "16 oz", 10900]]],
    ["hershey-choco-frappe", "Hershey Choco", "Frappe", [["16oz", "16 oz", 10900]]],
    ["matcha-frappe", "Matcha", "Frappe", [["16oz", "16 oz", 10900]]],
    ["cookies-cream-frappe", "Cookies and Cream", "Frappe", [["16oz", "16 oz", 10900]]],
    ["ube-frappe", "Ube Frappe", "Frappe", [["16oz", "16 oz", 10900]]],
    ["strawberry-non-coffee", "Strawberry", "Non-Coffee", [["12oz", "12 oz", 8900], ["16oz", "16 oz", 9900]]],
    ["blueberry-non-coffee", "Blueberry", "Non-Coffee", [["12oz", "12 oz", 8900], ["16oz", "16 oz", 9900]]],
    ["hershey-choco-non-coffee", "Hershey Choco", "Non-Coffee", [["12oz-hot", "12 oz Hot", 9900], ["16oz", "16 oz", 9900]]],
    ["matcha-latte", "Matcha Latte", "Non-Coffee", [["12oz-hot", "12 oz Hot", 9900], ["16oz", "16 oz", 9900]]],
    ["ube-latte", "Ube Latte", "Non-Coffee", [["16oz", "16 oz", 9900]]],
    ["chocolate-waffle", "Chocolate", "Waffle", [["single", "Single", 3900], ["double", "Double", 4900]]],
    ["caramel-waffle", "Caramel", "Waffle", [["single", "Single", 3900], ["double", "Double", 4900]]],
    ["cookies-cream-waffle", "Cookies and Cream", "Waffle", [["single", "Single", 4900], ["double", "Double", 5900, 500]]],
    ["strawberry-waffle", "Strawberry", "Waffle", [["single", "Single", 4900], ["double", "Double", 5900, 500]]],
    ["blueberry-waffle", "Blueberry", "Waffle", [["single", "Single", 4900], ["double", "Double", 5900, 500]]],
    ["samyang-overload", "Samyang Overload", "Ramyeon and Fries", [["listed-price", "", 15900, 500]]],
    ["cheesy-samyang", "Cheesy Samyang", "Ramyeon and Fries", [["listed-price", "", 12900, 500]]],
    ["jin-ramen-overload", "Jin Ramen Overload", "Ramyeon and Fries", [["listed-price", "", 10900, 500]]],
    ["samyang-alacarte", "Samyang Ala-carte", "Ramyeon and Fries", [["listed-price", "", 11900, 500]]],
    ["jin-ramen-alacarte", "Jin Ramen Ala-carte", "Ramyeon and Fries", [["listed-price", "", 8900, 500]]],
    ["cheesy-fries", "Cheesy Fries", "Ramyeon and Fries", [["listed-price", "", 6900, 500]]]
  ];

  const FEATURED_IDS = new Set(["spanish-latte", "caramel-macchiato", "biscoff-latte", "java-chip-frappe", "matcha-latte", "chocolate-waffle"]);
  const CATEGORIES = ["Coffee", "Frappe", "Non-Coffee", "Waffle", "Ramyeon and Fries"];

  const DEFAULT_ADD_ONS = {
    categoryGroups: {
      Coffee: "drinkExtras",
      Frappe: "drinkExtras",
      "Non-Coffee": "drinkExtras",
      "Ramyeon and Fries": "foodExtras"
    },
    groups: {
      drinkExtras: {
        label: "Drink extras",
        items: [
          { id: "espresso", name: "Add Espresso", priceCents: 3000 },
          { id: "flavor", name: "Add Flavor", priceCents: 3000 },
          { id: "toppings-whipped-cream", name: "Add Toppings / Whipped Cream", priceCents: 2000 }
        ]
      },
      foodExtras: {
        label: "Food extras",
        items: [
          { id: "ham", name: "Add Ham", priceCents: 3000 },
          { id: "egg", name: "Add Egg", priceCents: 2500 },
          { id: "cheese", name: "Add Cheese", priceCents: 3500 },
          { id: "nori", name: "Add Nori (1 pack)", priceCents: 2500 }
        ]
      }
    }
  };

  const DEFAULT_CONTENT = {
    announcement: "A warm cup. A sweet pause. Your Trago moment.",
    navigation: { home: "Home", menu: "Menu", story: "Our Story", findUs: "Find Us", contact: "Contact" },
    heroHeading: "Sip slowly.\nStay awhile.",
    heroDescription: "Familiar café favorites, considered little details, and an order made just the way you like it.",
    heroPrimaryCta: "Explore the Menu",
    heroSecondaryCta: "The Trago Feeling",
    featuredEyebrow: "The Trago edit",
    featuredHeading: "A few favorites for your next pause",
    featuredDescription: "Find a familiar pick, try a different flavor, and make a little room for a good café moment.",
    menuEyebrow: "The Trago menu",
    menuHeading: "Something for every kind of break",
    menuDescription: "Browse the menu, choose an available size or serving, and add your picks to an order request.",
    emptyMenuHeading: "No menu items found",
    emptyMenuDescription: "Try another name or choose a different category.",
    storyEyebrow: "The Trago feeling",
    storyHeading: "A café pause, made entirely yours",
    storyParagraphOne: "Trago Cafe brings together the drinks and bites that make an ordinary break feel a little more considered—from familiar coffee to creamy frappes, waffles, and savory favorites.",
    storyParagraphTwo: "Choose your listed size or serving, add the extras you love, and prepare an order request in a few simple steps. Every request is reviewed and confirmed directly by Trago Cafe.",
    orderEyebrow: "Ordering, made easy",
    orderHeading: "From your cart to confirmation",
    orderDescription: "Build your request, review the details, and copy your summary. Trago Cafe will confirm availability and fulfillment details with you.",
    orderNote: "Free delivery is available around {freeArea} when Trago Cafe confirms that the address qualifies. Outside this area, customers need to self-book a delivery courier. Confirm availability, operating hours, and other fulfillment details through an available Trago Cafe contact channel.",
    orderSteps: [
      { title: "Browse the Trago Cafe menu.", description: "Explore drinks and food by category or search by name." },
      { title: "Choose your drinks and food.", description: "Select a listed size or serving, then add items to your cart." },
      { title: "Select pickup or delivery.", description: "Share your contact details and delivery address when needed." },
      { title: "Review and copy your order summary.", description: "Check every item, option, quantity, and estimated total." },
      { title: "Send your summary to Trago Cafe.", description: "Use an available contact link and paste the prepared summary into your conversation." },
      { title: "Wait for Trago Cafe to confirm.", description: "Availability, final total, and fulfillment details are confirmed by the shop." }
    ],
    contactEyebrow: "Find us and say hello",
    contactMessageCta: "Message {businessName}",
    contactDirectionsCta: "Get Directions",
    contactOrderCta: "Start an Order",
    footerExploreHeading: "Explore",
    footerMenuHeading: "Menu & contact",
    footerQuickLinks: [
      { id: "home", label: "Home", target: "home" },
      { id: "menu", label: "Full menu", target: "menu" },
      { id: "story", label: "Our story", target: "story" },
      { id: "ordering", label: "How to order", target: "ordering" }
    ],
    footerMessengerLabel: "Message us on Messenger",
    footerFacebookLabel: "Facebook page",
    footerMapsLabel: "Open Google Maps",
    footerBrandLine: "{businessName} — {tagline}.",
    footerCopyrightText: "All rights reserved.",
    footerOrderNotice: "Orders are requests until confirmed by {businessName}."
  };

  const DEFAULT_STORE_STATUS = {
    isOpen: false,
    followHours: false,
    timezone: "Asia/Manila",
    days: {
      mon: { closed: true, openTime: "", closeTime: "" },
      tue: { closed: true, openTime: "", closeTime: "" },
      wed: { closed: true, openTime: "", closeTime: "" },
      thu: { closed: true, openTime: "", closeTime: "" },
      fri: { closed: true, openTime: "", closeTime: "" },
      sat: { closed: true, openTime: "", closeTime: "" },
      sun: { closed: true, openTime: "", closeTime: "" }
    }
  };

  function defaultConfig() {
    return {
      version: SCHEMA_VERSION,
      theme: Object.assign({}, DEFAULT_THEME),
      categories: CATEGORIES.slice(),
      menu: BASE_PRODUCTS.map(([id, name, category, sourceOptions]) => ({
        id,
        name,
        category,
        description: CATEGORY_COPY[category],
        image: PRODUCT_IMAGE_PATHS[id] || "",
        available: true,
        featured: FEATURED_IDS.has(id),
        options: sourceOptions.map(([optionId, label, priceCents, takeoutBoxCents]) => {
          const option = { id: optionId, label, priceCents };
          if (Number.isSafeInteger(takeoutBoxCents)) option.takeoutBoxCents = takeoutBoxCents;
          return option;
        })
      })),
      addOns: clone(DEFAULT_ADD_ONS),
      content: clone(DEFAULT_CONTENT),
      storeStatus: clone(DEFAULT_STORE_STATUS),
      images: {
        hero: "./assets/trago-hero.webp",
        logo: "",
        story: "./assets/trago-story.webp",
        contact: "./assets/trago-contact.webp",
        products: {}
      },
      contact: {
        businessName: "Trago Cafe",
        tagline: "Your Everyday Coffee Ritual",
        messengerUrl: "",
        facebookUrl: "https://www.facebook.com/profile.php?id=61594437308252",
        mapsUrl: "https://maps.app.goo.gl/CHBrBKNfoLFi73PT9",
        heading: "Your Next Coffee Moment Is Waiting",
        description: "Questions about the menu, delivery, availability, or hours? Get in touch with Trago Cafe to confirm the details and send your prepared order request.",
        phone: "",
        email: "",
        address: "",
        instructions: "Use the available Trago Cafe contact links to confirm delivery coverage, fees, operating hours, and current availability."
      },
      delivery: {
        freeArea: "Barangay 176-A and nearby barangays",
        pinLocation: "Trago Cafe",
        contactNames: "Resty or Jezzel",
        contactNumber: "09690431840"
      },
      updatedAt: ""
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isHexColor(value) {
    return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
  }

  function isSafeImage(value, allowEmpty) {
    if (typeof value !== "string") return false;
    const src = value.trim();
    if (!src) return Boolean(allowEmpty);
    if (src.length > 320000) return false;
    if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(src)) return true;
    if (/^(?:\.?\/?assets\/|\/assets\/)[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp)$/i.test(src) && !src.includes("..")) return true;
    try {
      const url = new URL(src, window.location.href);
      return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
    } catch (_error) {
      return false;
    }
  }

  function isHttpsUrl(value, allowEmpty) {
    if (typeof value !== "string") return false;
    const text = value.trim();
    if (!text) return Boolean(allowEmpty);
    try {
      const url = new URL(text);
      return url.protocol === "https:" && Boolean(url.hostname);
    } catch (_error) {
      return false;
    }
  }

  function cleanString(value, maxLength) {
    return typeof value === "string" && value.trim().length <= maxLength ? value.trim() : null;
  }

  function validateConfig(raw) {
    const errors = [];
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || ![1, 2, 3, 4, 5, 6, 7, 8, SCHEMA_VERSION].includes(raw.version)) {
      return { ok: false, errors: ["Configuration is missing or uses an unsupported version."] };
    }
    const isLegacyConfig = raw.version < SCHEMA_VERSION;
    const config = defaultConfig();
    if (!raw.theme || typeof raw.theme !== "object") errors.push("Theme settings are missing.");
    else {
      Object.keys(DEFAULT_THEME).forEach((key) => {
        if (!isHexColor(raw.theme[key])) errors.push(`Theme color "${key}" must be a six-digit HEX value.`);
        else config.theme[key] = raw.theme[key].toUpperCase();
      });
    }

    if (!Array.isArray(raw.categories) || raw.categories.length < 1 || raw.categories.length > 30) errors.push("Add between 1 and 30 menu categories.");
    else {
      const categories = raw.categories.map((category) => cleanString(category, 50));
      const keys = categories.map((category) => category && category.toLocaleLowerCase());
      if (categories.some((category) => !category || category.length < 2 || category === "All")) errors.push("Category names must be 2 to 50 characters and cannot be All.");
      if (new Set(keys).size !== keys.length) errors.push("Category names must be unique.");
      if (!errors.some((error) => error.startsWith("Category"))) config.categories = categories;
    }

    if (!Array.isArray(raw.menu) || raw.menu.length < 1 || raw.menu.length > 250) errors.push("The menu must contain between 1 and 250 products.");
    else {
      const products = [];
      const productIds = new Set();
      const usedProductImages = new Map();
      raw.menu.forEach((candidate, productIndex) => {
        const prefix = `Product ${productIndex + 1}`;
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
          errors.push(`${prefix} is invalid.`);
          return;
        }
        const id = typeof candidate.id === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(candidate.id) ? candidate.id : "";
        const name = cleanString(candidate.name, 80);
        const category = cleanString(candidate.category, 50);
        const description = cleanString(candidate.description, 500);
        if (!id || productIds.has(id)) errors.push(`${prefix} needs a unique product ID.`);
        if (!name) errors.push(`${prefix} needs a name of 1 to 80 characters.`);
        if (!category || !config.categories.includes(category)) errors.push(`${prefix} must use an existing category.`);
        if (description === null) errors.push(`${prefix} description is too long or invalid.`);
        if (typeof candidate.available !== "boolean" || typeof candidate.featured !== "boolean") errors.push(`${prefix} availability and featured status must be set.`);
        const legacyCandidateImage = (candidate.image || "").trim();
        const legacyImageIsOldCategoryPhoto = /^https:\/\/images\.pexels\.com\//i.test(legacyCandidateImage);
        const legacyProductImage = isLegacyConfig
          ? (legacyImageIsOldCategoryPhoto
            ? (PRODUCT_IMAGE_PATHS[id] || "")
            : (legacyCandidateImage || (raw.images && raw.images.products && raw.images.products[id]) || PRODUCT_IMAGE_PATHS[id] || ""))
          : (candidate.image === undefined ? (PRODUCT_IMAGE_PATHS[id] || "") : candidate.image);
        if (!isSafeImage(legacyProductImage, true)) errors.push(`${prefix} image must be HTTPS, a local assets image, or a supported small image upload.`);
        if (legacyProductImage && usedProductImages.has(legacyProductImage)) {
          errors.push(`${prefix} uses the same image as ${usedProductImages.get(legacyProductImage)}. Give every menu item its own image.`);
        } else if (legacyProductImage) {
          usedProductImages.set(legacyProductImage, name || prefix);
        }
        if (!Array.isArray(candidate.options) || candidate.options.length < 1 || candidate.options.length > 20) errors.push(`${prefix} must have between 1 and 20 price options.`);
        const optionIds = new Set();
        const options = [];
        if (Array.isArray(candidate.options)) {
          candidate.options.forEach((option, optionIndex) => {
            const optionPrefix = `${prefix}, option ${optionIndex + 1}`;
            if (!option || typeof option !== "object" || Array.isArray(option)) {
              errors.push(`${optionPrefix} is invalid.`);
              return;
            }
            const optionId = typeof option.id === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(option.id) ? option.id : "";
            const label = cleanString(option.label, 40);
            const priceCents = option.priceCents;
            const boxFee = option.takeoutBoxCents === undefined ? 0 : option.takeoutBoxCents;
            if (!optionId || optionIds.has(optionId)) errors.push(`${optionPrefix} needs a unique option ID.`);
            if (label === null) errors.push(`${optionPrefix} label is invalid.`);
            if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 99999900) errors.push(`${optionPrefix} needs a valid non-negative price.`);
            if (!Number.isSafeInteger(boxFee) || boxFee < 0 || boxFee > 99999900) errors.push(`${optionPrefix} has an invalid take-out box fee.`);
            if (optionId && label !== null && Number.isSafeInteger(priceCents) && priceCents >= 0 && priceCents <= 99999900 && Number.isSafeInteger(boxFee) && boxFee >= 0 && boxFee <= 99999900) {
              optionIds.add(optionId);
              const cleanedOption = { id: optionId, label, priceCents };
              if (boxFee > 0) cleanedOption.takeoutBoxCents = boxFee;
              options.push(cleanedOption);
            }
          });
        }
        if (isLegacyConfig) {
          const defaultProduct = config.menu.find((product) => product.id === id);
          const hotOption = defaultProduct && defaultProduct.options.find((option) => option.id === "12oz-hot");
          if (hotOption && !options.some((option) => option.id === hotOption.id)) {
            const regular12oz = options.find((option) => option.id === "12oz");
            options.push({ id: hotOption.id, label: hotOption.label, priceCents: regular12oz ? regular12oz.priceCents : hotOption.priceCents });
          }
        }
        if (id && name && category && config.categories.includes(category) && description !== null && isSafeImage(legacyProductImage, true) && (!legacyProductImage || usedProductImages.get(legacyProductImage) === (name || prefix)) && options.length >= candidate.options.length && options.length <= candidate.options.length + 1 && typeof candidate.available === "boolean" && typeof candidate.featured === "boolean") {
          productIds.add(id);
          products.push({ id, name, category, description, image: (legacyProductImage || "").trim(), available: candidate.available, featured: candidate.featured, options });
        }
      });
      if (products.length === raw.menu.length && !errors.some((error) => error.startsWith("Product"))) config.menu = products;
    }

    const rawAddOns = isLegacyConfig && (!raw.addOns || typeof raw.addOns !== "object") ? DEFAULT_ADD_ONS : raw.addOns;
    if (!rawAddOns || typeof rawAddOns !== "object" || Array.isArray(rawAddOns) || !rawAddOns.groups || typeof rawAddOns.groups !== "object" || Array.isArray(rawAddOns.groups) || !rawAddOns.categoryGroups || typeof rawAddOns.categoryGroups !== "object" || Array.isArray(rawAddOns.categoryGroups)) {
      errors.push("Optional menu add-on settings are missing or invalid.");
    } else {
      const groups = {};
      const groupIds = Object.keys(rawAddOns.groups);
      if (!groupIds.length || groupIds.length > 20) errors.push("Configure between 1 and 20 add-on groups.");
      groupIds.forEach((groupId) => {
        const group = rawAddOns.groups[groupId];
        if (!/^[a-z][A-Za-z0-9-]{0,39}$/.test(groupId) || !group || typeof group !== "object" || Array.isArray(group)) {
          errors.push(`Add-on group "${groupId}" is invalid.`);
          return;
        }
        const label = cleanString(group.label, 60);
        if (!label) errors.push(`Add-on group "${groupId}" needs a label.`);
        if (!Array.isArray(group.items) || group.items.length > 30) {
          errors.push(`Add-on group "${groupId}" must contain up to 30 add-ons.`);
          return;
        }
        const itemIds = new Set();
        const items = [];
        group.items.forEach((item, index) => {
          const prefix = `Add-on "${groupId}" item ${index + 1}`;
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            errors.push(`${prefix} is invalid.`);
            return;
          }
          const id = typeof item.id === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(item.id) ? item.id : "";
          const name = cleanString(item.name, 60);
          const priceCents = item.priceCents;
          if (!id || itemIds.has(id)) errors.push(`${prefix} needs a unique ID.`);
          if (!name) errors.push(`${prefix} needs a name up to 60 characters.`);
          if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 99999900) errors.push(`${prefix} needs a valid non-negative price.`);
          if (id && name && Number.isSafeInteger(priceCents) && priceCents >= 0 && priceCents <= 99999900 && !itemIds.has(id)) {
            itemIds.add(id);
            items.push({ id, name, priceCents });
          }
        });
        if (label && Array.isArray(group.items) && items.length === group.items.length) groups[groupId] = { label, items };
      });
      const categoryGroups = {};
      Object.entries(rawAddOns.categoryGroups).forEach(([category, groupId]) => {
        if (!config.categories.includes(category)) return;
        if (groupId !== "" && (typeof groupId !== "string" || !groups[groupId])) {
          errors.push(`Category "${category}" refers to an unknown add-on group.`);
          return;
        }
        if (groupId) categoryGroups[category] = groupId;
      });
      config.addOns = { groups, categoryGroups };
    }

    if ((!raw.content || typeof raw.content !== "object" || Array.isArray(raw.content)) && !isLegacyConfig) errors.push("Website content settings are missing.");
    const rawContent = raw.content && typeof raw.content === "object" && !Array.isArray(raw.content) ? raw.content : {};
    const content = Object.assign(clone(DEFAULT_CONTENT), rawContent);
    const contentTextLimits = {
      announcement: 180,
      heroHeading: 160,
      heroDescription: 500,
      heroPrimaryCta: 60,
      heroSecondaryCta: 60,
      featuredEyebrow: 80,
      featuredHeading: 120,
      featuredDescription: 500,
      menuEyebrow: 80,
      menuHeading: 120,
      menuDescription: 500,
      emptyMenuHeading: 120,
      emptyMenuDescription: 300,
      storyEyebrow: 80,
      storyHeading: 180,
      storyParagraphOne: 1200,
      storyParagraphTwo: 1200,
      orderEyebrow: 80,
      orderHeading: 120,
      orderDescription: 500,
      orderNote: 900,
      contactEyebrow: 80,
      contactMessageCta: 60,
      contactDirectionsCta: 60,
      contactOrderCta: 60,
      footerExploreHeading: 60,
      footerMenuHeading: 80,
      footerMessengerLabel: 80,
      footerFacebookLabel: 80,
      footerMapsLabel: 80,
      footerBrandLine: 180,
      footerCopyrightText: 120,
      footerOrderNotice: 180
    };
    Object.entries(contentTextLimits).forEach(([key, maxLength]) => {
      const value = cleanString(content[key], maxLength);
      if (!value) errors.push(`Website content "${key}" is required and must be no longer than ${maxLength} characters.`);
      else content[key] = value;
    });
    const navDefaults = DEFAULT_CONTENT.navigation;
    if (!content.navigation || typeof content.navigation !== "object" || Array.isArray(content.navigation)) {
      errors.push("Public navigation labels are missing.");
      content.navigation = clone(navDefaults);
    } else {
      Object.entries(navDefaults).forEach(([key, defaultValue]) => {
        const value = cleanString(content.navigation[key] === undefined ? defaultValue : content.navigation[key], 50);
        if (!value) errors.push(`Navigation label "${key}" is required and must be no longer than 50 characters.`);
        else content.navigation[key] = value;
      });
    }
    if (!Array.isArray(content.orderSteps) || content.orderSteps.length < 1 || content.orderSteps.length > 12) {
      errors.push("Ordering instructions must contain between 1 and 12 steps.");
    } else {
      content.orderSteps = content.orderSteps.map((step, index) => {
        const title = cleanString(step && step.title, 140);
        const description = cleanString(step && step.description, 500);
        if (!title || !description) errors.push(`Ordering step ${index + 1} needs a title and description.`);
        return { title: title || "", description: description || "" };
      });
    }
    const footerTargets = new Set(["home", "menu", "story", "ordering", "findUs"]);
    if (!Array.isArray(content.footerQuickLinks) || content.footerQuickLinks.length < 1 || content.footerQuickLinks.length > 10) {
      errors.push("Footer quick links must contain between 1 and 10 links.");
    } else {
      const footerIds = new Set();
      content.footerQuickLinks = content.footerQuickLinks.map((link, index) => {
        const id = link && typeof link.id === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(link.id) ? link.id : "";
        const label = cleanString(link && link.label, 60);
        const target = link && link.target;
        if (!id || footerIds.has(id)) errors.push(`Footer quick link ${index + 1} needs a unique ID.`);
        if (!label) errors.push(`Footer quick link ${index + 1} needs a label.`);
        if (!footerTargets.has(target)) errors.push(`Footer quick link ${index + 1} has an unsupported destination.`);
        if (id) footerIds.add(id);
        return { id, label: label || "", target: footerTargets.has(target) ? target : "home" };
      });
    }
    config.content = content;

    const rawStoreStatus = raw.storeStatus && typeof raw.storeStatus === "object" && !Array.isArray(raw.storeStatus)
      ? raw.storeStatus
      : DEFAULT_STORE_STATUS;
    if (typeof rawStoreStatus.isOpen !== "boolean") errors.push("Store manual status must be set to Open or Closed.");
    const followHours = typeof rawStoreStatus.followHours === "boolean" ? rawStoreStatus.followHours : DEFAULT_STORE_STATUS.followHours;
    if (!isLegacyConfig && typeof rawStoreStatus.followHours !== "boolean") errors.push("Choose manual store status or operation-hours schedule.");
    const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const rawDays = rawStoreStatus.days && typeof rawStoreStatus.days === "object" && !Array.isArray(rawStoreStatus.days)
      ? rawStoreStatus.days
      : DEFAULT_STORE_STATUS.days;
    const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const days = {};
    dayKeys.forEach((day) => {
      const candidate = rawDays[day];
      if (!candidate || typeof candidate !== "object" || typeof candidate.closed !== "boolean") {
        if (!isLegacyConfig) errors.push(`Operation hours for ${day} must be configured.`);
        days[day] = clone(DEFAULT_STORE_STATUS.days[day]);
        return;
      }
      const openTime = typeof candidate.openTime === "string" ? candidate.openTime : "";
      const closeTime = typeof candidate.closeTime === "string" ? candidate.closeTime : "";
      if (candidate.closed) {
        if ((openTime && !validTime(openTime)) || (closeTime && !validTime(closeTime))) errors.push(`Operation hours for ${day} contain an invalid time.`);
        days[day] = { closed: true, openTime: validTime(openTime) ? openTime : "", closeTime: validTime(closeTime) ? closeTime : "" };
        return;
      }
      if (!validTime(openTime) || !validTime(closeTime)) {
        errors.push(`Set valid opening and closing times for ${day}, or mark the day Closed.`);
        days[day] = { closed: false, openTime, closeTime };
        return;
      }
      if (openTime === closeTime) errors.push(`Opening and closing times for ${day} cannot be the same.`);
      days[day] = { closed: false, openTime, closeTime };
    });
    const timezone = rawStoreStatus.timezone === undefined ? "Asia/Manila" : rawStoreStatus.timezone;
    if (timezone !== "Asia/Manila") errors.push("Operation hours use the fixed Asia/Manila time zone.");
    config.storeStatus = {
      isOpen: typeof rawStoreStatus.isOpen === "boolean" ? rawStoreStatus.isOpen : DEFAULT_STORE_STATUS.isOpen,
      followHours,
      timezone: "Asia/Manila",
      days
    };

    if (!raw.images || typeof raw.images !== "object") errors.push("Image settings are missing.");
    else {
      ["hero", "logo", "story", "contact"].forEach((key) => {
        if (!isSafeImage(raw.images[key] || "", true)) errors.push(`The ${key} image is invalid.`);
        else config.images[key] = (raw.images[key] || "").trim();
      });
      if (!raw.images.products || typeof raw.images.products !== "object" || Array.isArray(raw.images.products)) errors.push("Product image settings are invalid.");
      else {
        const productImages = {};
        Object.entries(raw.images.products).forEach(([id, src]) => {
          if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || !config.menu.some((product) => product.id === id)) return;
          if (!isSafeImage(src, true)) errors.push(`Product image "${id}" is invalid.`);
          else if (src.trim()) productImages[id] = src.trim();
        });
        config.images.products = productImages;
      }
    }

    const rawContact = raw.contact;
    const contactFields = ["businessName", "tagline", "heading", "description", "phone", "email", "address", "instructions"];
    if (!rawContact || typeof rawContact !== "object") errors.push("Contact settings are missing.");
    else {
      contactFields.forEach((key) => {
        const value = cleanString(rawContact[key], key === "description" || key === "instructions" || key === "address" ? 700 : 120);
        if (value === null || (["businessName", "tagline", "heading", "description"].includes(key) && !value)) errors.push(`Contact field "${key}" is required or too long.`);
        else config.contact[key] = value;
      });
      ["messengerUrl", "facebookUrl", "mapsUrl"].forEach((key) => {
        const value = typeof rawContact[key] === "string" ? rawContact[key].trim() : "";
        const optional = key === "facebookUrl" || key === "messengerUrl";
        if (!isHttpsUrl(value, optional)) errors.push(`Contact link "${key}" must be a valid HTTPS URL${optional ? " or blank" : ""}.`);
        else config.contact[key] = value;
      });
      if (config.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.contact.email)) errors.push("Enter a valid email address or leave the email field blank.");
      if (config.contact.phone && !/^[+()0-9\s.-]{7,30}$/.test(config.contact.phone)) errors.push("Enter a valid phone number or leave the phone field blank.");
    }

    if (!raw.delivery || typeof raw.delivery !== "object") errors.push("Delivery guidance settings are missing.");
    else {
      ["freeArea", "pinLocation", "contactNames", "contactNumber"].forEach((key) => {
        const value = cleanString(raw.delivery[key], 120);
        if (value === null || !value) errors.push(`Delivery field "${key}" is required.`);
        else config.delivery[key] = value;
      });
      if (config.delivery.contactNumber && !/^[+()0-9\s.-]{7,30}$/.test(config.delivery.contactNumber)) errors.push("Enter a valid delivery contact number.");
    }

    config.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : "";
    return errors.length ? { ok: false, errors } : { ok: true, config, errors: [] };
  }

  function readStored(key) {
    try {
      const text = window.localStorage.getItem(key);
      return text ? JSON.parse(text) : null;
    } catch (_error) {
      return null;
    }
  }

  function loadConfig(options) {
    const usePreview = Boolean(options && options.preview);
    if (usePreview) {
      const record = readStored(PREVIEW_KEY);
      if (record && Number.isFinite(record.expiresAt) && record.expiresAt > Date.now()) {
        const checked = validateConfig(record.config);
        if (checked.ok) return { config: checked.config, isPreview: true, warning: "" };
      }
      try { window.localStorage.removeItem(PREVIEW_KEY); } catch (_error) { /* Storage may be unavailable in private browsing. */ }
    }
    let text = null;
    try { text = window.localStorage.getItem(STORAGE_KEY); } catch (_error) { return { config: defaultConfig(), isPreview: false, warning: "Browser storage is unavailable; default website settings are in use." }; }
    if (!text) return { config: defaultConfig(), isPreview: false, warning: "" };
    let raw;
    try { raw = JSON.parse(text); } catch (_error) { return { config: defaultConfig(), isPreview: false, warning: "Saved website settings could not be read; defaults are being used. The stored data was not overwritten." }; }
    const checked = validateConfig(raw);
    if (!checked.ok) return { config: defaultConfig(), isPreview: false, warning: `Saved website settings are invalid; defaults are being used. ${checked.errors[0]}` };
    return { config: checked.config, isPreview: false, warning: "" };
  }

  async function loadPublished(options) {
    if (options && options.preview) {
      const preview = loadConfig({ preview: true });
      if (preview.isPreview) return Object.assign({ source: "preview" }, preview);
    }
    const fallback = loadConfig();
    if (window.location.protocol === "file:") return Object.assign({ source: "local" }, fallback);
    try {
      const url = new URL(PUBLISHED_CONFIG_PATH, window.location.href);
      url.searchParams.set("_trago", String(Date.now()));
      const response = await fetch(url.href, { cache: "no-store", credentials: "same-origin" });
      if (response.status === 404) return Object.assign({ source: "local" }, fallback);
      if (!response.ok) return { config: fallback.config, source: "local", isPreview: false, warning: `The published GitHub configuration could not be loaded (HTTP ${response.status}); the last valid browser/default configuration is in use.` };
      const raw = await response.json();
      const checked = validateConfig(raw);
      if (!checked.ok) return { config: fallback.config, source: "local", isPreview: false, warning: `The published configuration is invalid; the last valid browser/default configuration is in use. ${checked.errors[0]}` };
      return { config: checked.config, source: "github", isPreview: false, warning: "" };
    } catch (_error) {
      return { config: fallback.config, source: "local", isPreview: false, warning: "The published GitHub configuration could not be reached; the last valid browser/default configuration is in use." };
    }
  }

  function saveConfig(raw) {
    const checked = validateConfig(raw);
    if (!checked.ok) return { ok: false, errors: checked.errors };
    checked.config.updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked.config));
      const verified = loadConfig();
      if (verified.warning || verified.config.updatedAt !== checked.config.updatedAt) return { ok: false, errors: ["Saved settings could not be verified after writing. The previous working settings were retained where browser storage allowed."] };
      return { ok: true, config: verified.config, errors: [] };
    } catch (_error) {
      return { ok: false, errors: ["The browser could not save these settings. Reduce uploaded image sizes or use a persistent hosted configuration service."] };
    }
  }

  function savePreview(raw) {
    const checked = validateConfig(raw);
    if (!checked.ok) return { ok: false, errors: checked.errors };
    try {
      window.localStorage.setItem(PREVIEW_KEY, JSON.stringify({ expiresAt: Date.now() + 60 * 60 * 1000, config: checked.config }));
      return { ok: true, errors: [] };
    } catch (_error) {
      return { ok: false, errors: ["The preview could not be saved in browser storage. Remove some large uploads and try again."] };
    }
  }

  window.TragoCafeData = {
    schemaVersion: SCHEMA_VERSION,
    categoryCopy: clone(CATEGORY_COPY),
    productImages: clone(PRODUCT_IMAGE_PATHS),
    featuredIds: Array.from(FEATURED_IDS)
  };
  window.TragoCafeConfig = {
    storageKey: STORAGE_KEY,
    previewKey: PREVIEW_KEY,
    publishedPath: PUBLISHED_CONFIG_PATH,
    defaultConfig,
    clone,
    isHexColor,
    isSafeImage,
    isHttpsUrl,
    validate: validateConfig,
    load: loadConfig,
    loadPublished,
    save: saveConfig,
    savePreview
  };
})();