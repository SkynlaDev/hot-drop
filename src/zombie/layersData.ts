// Généré par tools/art/layer-weapons.py : ne pas modifier à la main.
// Postures : coin de la boîte de la main avant dans la pose fixe, puis son décalage par image
// (0 = pose fixe, 1..8 = marche). Armes : prise (point posé sur ce coin) et bouche, en px de l'arme.
export const LAYERS = {
  "postures": {
    "long": {
      "hand": [
        38,
        28
      ],
      "offsets": [
        [
          0,
          0
        ],
        [
          0,
          0
        ],
        [
          0,
          0
        ],
        [
          1,
          1
        ],
        [
          1,
          1
        ],
        [
          1,
          1
        ],
        [
          1,
          0
        ],
        [
          1,
          1
        ],
        [
          1,
          2
        ]
      ]
    },
    "poing": {
      "hand": [
        44,
        18
      ],
      "offsets": [
        [
          0,
          0
        ],
        [
          0,
          -1
        ],
        [
          0,
          -1
        ],
        [
          0,
          -1
        ],
        [
          0,
          0
        ],
        [
          0,
          0
        ],
        [
          0,
          -1
        ],
        [
          0,
          -2
        ],
        [
          0,
          -1
        ]
      ]
    }
  },
  "weapons": {
    "fusil_assaut": {
      "posture": "long",
      "grip": [
        7,
        4
      ],
      "muzzle": [
        23,
        2
      ],
      "size": [
        24,
        10
      ]
    },
    "pistolet": {
      "posture": "poing",
      "grip": [
        -1,
        4
      ],
      "muzzle": [
        12,
        2
      ],
      "size": [
        13,
        12
      ]
    }
  }
} as const;
