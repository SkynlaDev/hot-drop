// Généré par tools/art/layer-weapons.py : ne pas modifier à la main.
// Vues : décalage du point d'ancrage par image (0 = pose fixe, 1..8 = marche), et si une main passe devant
// l'arme. Armes : par vue, coin haut-gauche dans la pose fixe (px du corps), taille et bout du canon (px de
// l'arme).
export const LAYERS = {
  "views": {
    "long": {
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
      ],
      "hands": true
    },
    "poing": {
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
      ],
      "hands": true
    },
    "face": {
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
          0
        ],
        [
          0,
          0
        ],
        [
          0,
          1
        ],
        [
          0,
          0
        ]
      ],
      "hands": true
    },
    "dos": {
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
          0
        ],
        [
          0,
          1
        ],
        [
          0,
          1
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
          1
        ],
        [
          0,
          2
        ]
      ],
      "hands": false
    }
  },
  "weapons": {
    "fusil_assaut": {
      "posture": "long",
      "profil": {
        "at": [
          31,
          24
        ],
        "size": [
          24,
          10
        ],
        "muzzle": [
          23,
          2
        ]
      },
      "face": {
        "at": [
          27,
          24
        ],
        "size": [
          10,
          24
        ],
        "muzzle": [
          7,
          23
        ]
      },
      "dos": {
        "at": [
          36,
          8
        ],
        "size": [
          10,
          24
        ],
        "muzzle": [
          2,
          0
        ]
      }
    },
    "pistolet": {
      "posture": "poing",
      "profil": {
        "at": [
          45,
          14
        ],
        "size": [
          13,
          12
        ],
        "muzzle": [
          12,
          2
        ]
      },
      "face": {
        "at": [
          25,
          32
        ],
        "size": [
          12,
          13
        ],
        "muzzle": [
          9,
          12
        ]
      },
      "dos": {
        "at": [
          36,
          11
        ],
        "size": [
          12,
          13
        ],
        "muzzle": [
          2,
          0
        ]
      }
    }
  }
} as const;
