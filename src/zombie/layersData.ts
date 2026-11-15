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
    },
    "smg": {
      "posture": "long",
      "profil": {
        "at": [
          33,
          24
        ],
        "size": [
          17,
          11
        ],
        "muzzle": [
          16,
          2
        ]
      },
      "face": {
        "at": [
          26,
          26
        ],
        "size": [
          11,
          17
        ],
        "muzzle": [
          8,
          16
        ]
      },
      "dos": {
        "at": [
          36,
          13
        ],
        "size": [
          11,
          17
        ],
        "muzzle": [
          3,
          0
        ]
      }
    },
    "pompe": {
      "posture": "long",
      "profil": {
        "at": [
          32,
          24
        ],
        "size": [
          20,
          9
        ],
        "muzzle": [
          19,
          1
        ]
      },
      "face": {
        "at": [
          28,
          25
        ],
        "size": [
          9,
          20
        ],
        "muzzle": [
          7,
          19
        ]
      },
      "dos": {
        "at": [
          36,
          11
        ],
        "size": [
          9,
          20
        ],
        "muzzle": [
          3,
          0
        ]
      }
    },
    "precision": {
      "posture": "long",
      "profil": {
        "at": [
          30,
          24
        ],
        "size": [
          29,
          9
        ],
        "muzzle": [
          28,
          3
        ]
      },
      "face": {
        "at": [
          28,
          23
        ],
        "size": [
          9,
          29
        ],
        "muzzle": [
          5,
          28
        ]
      },
      "dos": {
        "at": [
          36,
          4
        ],
        "size": [
          9,
          29
        ],
        "muzzle": [
          3,
          0
        ]
      }
    },
    "kr4_mitrailleur": {
      "posture": "long",
      "profil": {
        "at": [
          29,
          23
        ],
        "size": [
          30,
          12
        ],
        "muzzle": [
          29,
          4
        ]
      },
      "face": {
        "at": [
          26,
          22
        ],
        "size": [
          12,
          30
        ],
        "muzzle": [
          7,
          29
        ]
      },
      "dos": {
        "at": [
          35,
          4
        ],
        "size": [
          12,
          30
        ],
        "muzzle": [
          4,
          0
        ]
      }
    },
    "revolver": {
      "posture": "poing",
      "profil": {
        "at": [
          45,
          15
        ],
        "size": [
          15,
          9
        ],
        "muzzle": [
          14,
          1
        ]
      },
      "face": {
        "at": [
          27,
          32
        ],
        "size": [
          9,
          15
        ],
        "muzzle": [
          7,
          14
        ]
      },
      "dos": {
        "at": [
          37,
          9
        ],
        "size": [
          9,
          15
        ],
        "muzzle": [
          2,
          0
        ]
      }
    }
  }
} as const;
