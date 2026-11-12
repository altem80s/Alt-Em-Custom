// Store catalogue. Checkout uses ONLY Stripe Price IDs from this server-side file.
// Keep active=false and priceId=null until the matching product and one-time price
// have been created in the Stripe Dashboard and verified.
export const PRODUCTS = [
  {
    id: "studded-leather-moto-vest",
    name: "Studded leather moto vest",
    description: "Black leather, silver studs, fully lined.",
    kind: "physical",
    active: false,
    priceId: null,
    downloadKey: null
  },
  {
    id: "lace-babydoll-corset-top",
    name: "Lace babydoll corset top",
    description: "Boned bodice with a black lace overlay.",
    kind: "physical",
    active: false,
    priceId: null,
    downloadKey: null
  },
  {
    id: "polka-dot-wiggle-skirt",
    name: "Polka dot wiggle skirt",
    description: "High waist, fitted through the hip, with a back kick pleat.",
    kind: "physical",
    active: false,
    priceId: null,
    downloadKey: null
  },
  {
    id: "glam-rock-flare-pants",
    name: "Glam rock flare pants",
    description: "Stretch satin with a bell hem and a high rise.",
    kind: "physical",
    active: false,
    priceId: null,
    downloadKey: null
  },
  {
    id: "satin-bomber-jacket",
    name: "Satin bomber jacket",
    description: "Quilted lining, ribbed cuffs, and a bold back panel.",
    kind: "physical",
    active: false,
    priceId: null,
    downloadKey: null
  },
  {
    id: "fringe-leather-bolero",
    name: "Fringe leather bolero",
    description: "Cropped, with long swinging fringe.",
    kind: "physical",
    active: false,
    priceId: null,
    downloadKey: null
  }
];
