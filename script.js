/* ---------------------------------------------------------
   BTK Coffee product image helpers
   Product photography lives in the repository directly under assets/.
   Every product has its own local image path; category cards never
   borrow or rotate another product's image.
---------------------------------------------------------- */
(function () {
  "use strict";

  const px = (filename) => `./assets/${filename}`;

  const IMG = Object.freeze({
    americano: px("americano.jpg"),
    latte: px("latte.jpg"),
    caramel: px("caramel-macchiato.jpg"),
    spanish: px("spanish-latte.jpg"),
    vanilla: px("french-vanilla.jpg"),
    dirtyMatcha: px("dirty-matcha.jpg"),
    hershey: px("hershey-coffee.jpg"),
    tresLeches: px("tres-leches.jpg"),
    whiteMocha: px("white-chocolate-mocha.jpg"),
    biscoff: px("biscoff-latte.jpg"),
    frappe: px("java-chip-frappe.jpg"),
    berry: px("strawberry.jpg"),
    blueberry: px("blueberry.jpg"),
    matcha: px("matcha.jpg"),
    cafe: px("cafe.jpg"),
    waffleChoc: px("chocolate-waffle.jpg"),
    waffleIce: px("waffle-ice-cream.jpg"),
    waffleDessert: px("waffle-dessert.jpg"),
    ramenA: px("samyang-overload.jpg"),
    ramenB: px("cheesy-samyang.jpg"),
    ramenC: px("jin-ramen-overload.jpg"),
    ramenD: px("samyang-alacarte.jpg"),
    ramenE: px("jin-ramen-alacarte.jpg"),
    fries: px("cheesy-fries.jpg"),
    friesB: px("fries.jpg")
  });

  const PRODUCT_IMAGES = Object.freeze({
    americano: IMG.americano,
    latte: IMG.latte,
    "caramel-macchiato": IMG.caramel,
    "spanish-latte": IMG.spanish,
    "french-vanilla": IMG.vanilla,
    "dirty-matcha-coffee": IMG.dirtyMatcha,
    "hershey-coffee": IMG.hershey,
    "tres-leches": IMG.tresLeches,
    "white-chocolate-mocha": IMG.whiteMocha,
    "biscoff-latte": IMG.biscoff,

    "java-chip-frappe": IMG.frappe,
    "hershey-coffee-frappe": px("hershey-coffee-frappe.jpg"),
    "dirty-matcha-frappe": px("dirty-matcha-frappe.jpg"),
    "white-chocolate-mocha-frappe": px("white-chocolate-mocha-frappe.jpg"),
    "biscoff-frappe": px("biscoff-frappe.jpg"),
    "strawberry-frappe": px("strawberry-frappe.jpg"),
    "blueberry-frappe": px("blueberry-frappe.jpg"),
    "hershey-choco-frappe": px("hershey-choco-frappe.jpg"),
    "matcha-frappe": px("matcha-frappe.jpg"),
    "cookies-cream-frappe": px("cookies-and-cream-frappe.jpg"),
    "ube-frappe": px("ube-frappe.jpg"),

    "strawberry-non-coffee": IMG.berry,
    "blueberry-non-coffee": IMG.blueberry,
    "hershey-choco-non-coffee": px("hershey-choco.jpg"),
    "matcha-latte": IMG.matcha,
    "ube-latte": px("ube-latte.jpg"),

    "chocolate-waffle": IMG.waffleChoc,
    "caramel-waffle": IMG.waffleIce,
    "cookies-cream-waffle": IMG.waffleDessert,
    "strawberry-waffle": px("strawberry-waffle.jpg"),
    "blueberry-waffle": px("blueberry-waffle.jpg"),

    "samyang-overload": IMG.ramenA,
    "cheesy-samyang": IMG.ramenB,
    "jin-ramen-overload": IMG.ramenC,
    "samyang-alacarte": IMG.ramenD,
    "jin-ramen-alacarte": IMG.ramenE,
    "cheesy-fries": IMG.fries
  });

  const imagePaths = Object.values(PRODUCT_IMAGES);
  const uniquePaths = new Set(imagePaths);
  if (uniquePaths.size !== imagePaths.length) {
    throw new Error("BTK product image paths must be unique. Each menu item needs its own image file.");
  }

  window.BTKCoffeeProductImages = Object.freeze({ px, IMG, byProductId: PRODUCT_IMAGES });
})();