# Credits

## Art (free, CC0 / public domain)
| Files | Source | Author | Licence |
|---|---|---|---|
| `assets/img/dragon_idle.png`, `assets/img/dragon_breath.png` (Grotto-escape-2-boss-dragon) | https://opengameart.org/content/sideview-fantasy-patreon-collection | ansimuz | CC0 |
| `assets/img/bg_lava.png` (lava-background preview), `assets/img/bg_hoard.png` (treasure-hoard-platform preview) | https://opengameart.org/content/sideview-fantasy-patreon-collection | ansimuz | CC0 |
| `assets/img/hound_idle.png` (Hell-Hound idle, stage 1 boss), `assets/img/beast_idle.png` (Hell-Beast idle, without-stroke, stage 2 boss) | https://opengameart.org/content/gothicvania-patreons-collection | ansimuz | CC0 |
| `assets/img/bosses/mushroom.png` (sunny-mushroom), `frog.png` (sunny-froggy), `snake.png` / `lizard.png` (Grotto-escape-2 snake / lizzard, flipped), `bird.png` (flying-bird, flipped), `sghost.png` (enemy-ghost), `serpent.png` (sunny-dragon) - endless-mode bosses, frames cropped to a shared bounding box | https://opengameart.org/content/sideview-fantasy-patreon-collection | ansimuz | CC0 |
| `assets/img/bosses/skull.png` (Fire-Skull), `reaper.png` (Ghost idle), `nightmare.png` (Nightmare idle), `demon.png` (demon idle) - endless-mode bosses, cropped | https://opengameart.org/content/gothicvania-patreons-collection | ansimuz | CC0 |
| `assets/img/bosses/wyrm.png` ("Avaras Dragon Big", flipped, halved, 4-frame breathing loop generated from the single image) | https://opengameart.org/content/12-public-domain-boss-sprites | titleknown | CC0 |
| `assets/img/hero_idle.png`, `hero_run.png`, `hero_attack.png` ("Hero Swordsman", 64x64 frames, re-packed into strips) | https://opengameart.org/content/hero-swordsman | tbbk | CC0 |
| `assets/img/icons.png` (31 item icons), `chest_*.png` / `open_*.png` (I_Chest01/02, recoloured for wood/gold/black) | https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg | 7Soul1 (Henrique Lazarini) | CC0 |

## Font
- Pixelify Sans (`assets/fonts/PixelifySans.ttf`), Copyright 2021 The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans), SIL Open Font License 1.1 - full licence text in `assets/fonts/OFL.txt`. Downloaded from https://github.com/google/fonts/tree/main/ofl/pixelifysans

- Digits 0-9 (`assets/fonts/pixel-digits.woff2`, CSS family "PixelDigits", unicode-range U+0030-0039, U+E000-E004): a subset of Press Start 2P (digits, plus K M B T e remapped to private-use code points U+E000-E004 for the big-number suffixes), Copyright 2012 The Press Start 2P Project Authors (cody@zone38.net), SIL Open Font License 1.1 - licence in `assets/fonts/OFL-PressStart2P.txt`. Downloaded from https://github.com/google/fonts/tree/main/ofl/pressstart2p; renamed "PixelDigits" for the modified (subset) version as the OFL Reserved Font Name requires. Used so 2 / 3 / 5 / 8 stay distinct at every scale.
- Fusion Pixel Font 12px proportional (`assets/fonts/fusion-pixel-zh.woff2`, `-ja.woff2`, `-ko.woff2`; zh_hans / ja / ko builds, subset to only the glyphs used by the game's Chinese / Japanese / Korean text), Copyright TakWolf and contributors (https://github.com/TakWolf/fusion-pixel-font), SIL Open Font License 1.1 - licence in `assets/fonts/FusionPixel-OFL.txt`; it merges Ark Pixel, Cubic 11 and Galmuri glyphs, whose licences (OFL 1.1) are in `assets/fonts/fusion-licenses/`. Release v2026.11.10.

## Localization
UI, item names, damage rules, tooltips, banners and end screen in English, 简体中文, 日本語, 한국어, Português (BR) and Español (`i18n.js`). Auto-detected from the browser language (fallback English); the switcher on the title screen (top-right) cycles languages and saves the choice in localStorage.

## Audio (owned by the author, used under their pack licences; trimmed / re-encoded to mp3)
| File | Source pack | Source file |
|---|---|---|
| `music.mp3` (main loop) | Fantasy Music Pack Vol. 8 - Ovani Sound | `Fireborn (RT 2.572)/Fantasy Vol8 Fireborn Cut 30.wav` |
| `victory.mp3` (BIG BOSS milestone fanfare) | Fantasy Music Pack Vol. 8 - Ovani Sound | `Iron Sky (RT 3)/Fantasy Vol8 Iron Sky Cut 30.wav` |
| `defeat.mp3` (end screen, loss) | Fantasy Music Pack Vol. 8 - Ovani Sound | `Stone Chant (RT 3)/Fantasy Vol8 Stone Chant Cut 30.wav` |
| `legendary.mp3` (legendary reveal sting) | Simple Magic Sound FX Pack Vol. 1 - Ovani Sound | `Light/Heavenly Wrath.wav` |
| `epic.mp3` (epic reveal sting, first 3.2 s) | Simple Magic Sound FX Pack Vol. 1 - Ovani Sound | `Ice/Crystal Column.wav` |
| `charge.mp3` (chest charging rumble, first 1.8 s) | Simple Magic Sound FX Pack Vol. 1 - Ovani Sound | `Earth/Seismic Pulse.wav` |
| `rare.mp3`, `curse.mp3`, `hit.mp3`, `lose.mp3`, `swing.mp3` | Simple Magic Sound FX Pack Vol. 1 - Ovani Sound | `Holy Nova`, `Necrotic Touch`, `Large Fireball Impact`, `Shadow Bolt Impact`, `Aero Blade Cast A` (.wav) |
| `smash.mp3` (OVERKILL x2 hit, first 2.5 s) | Simple Magic Sound FX Pack Vol. 1 - Ovani Sound | `Earth/Boulder Throw Impact A.wav` |
| `boom.mp3` (MEGA OVERKILL x5 hit, first 3 s) | Simple Magic Sound FX Pack Vol. 1 - Ovani Sound | `Fire/Combustion.wav` |
| `nuke.mp3` (GODLIKE x10 hit, first 3.6 s) | Simple Magic Sound FX Pack Vol. 1 - Ovani Sound | `Fire/Phoenix Burst.wav` |
| `shatter.mp3` (boss blown apart, first 3 s) | Simple Magic Sound FX Pack Vol. 1 - Ovani Sound | `Dark/Soul Shatter.wav` |
| `stage.mp3` (stage intro card) | Fantasy UI Sound FX Pack Vol. 1 - Ovani Sound | `Transitions/Transition B 003.wav` |
| `banner.mp3` (rarity banner / total) | Fantasy UI Sound FX Pack Vol. 1 - Ovani Sound | `Signals/Signal Positive A 004.wav` |
| `tick.mp3` (damage roll tick) | Fantasy UI Sound FX Pack Vol. 1 - Ovani Sound | `Hovers/Hovers A 001.wav` |
| `click.mp3`, `open.mp3`, `win.mp3` | Fantasy UI Sound FX Pack Vol. 1 - Ovani Sound | Clicks / Inventory / Signal Positive clips |

Endless-mode boss roster (15 bosses, then cycling with ELDER / ABYSSAL / COSMIC / ETERNAL / PRIMORDIAL tiers, palette tints and a bigger body): Toxic Shroom, Bog Toad, Grotto Viper, Venom Lizard, Hell Hound, Storm Roc, Wailing Wisp, Fire Skull, Shadow Reaper, Hell Beast, Nightmare Steed, Cave Wyrm, Sky Serpent, Demon Lord, Ancient Dragon. Death = sprite shattered / knocked out in code; eat = lunge + chomp in code (works for every sprite).

All reveal / overkill light effects (beams, rays, rings, vignette, coins, confetti, floating damage numbers) and the boss shatter are drawn in code at runtime from the sprites above; no extra image assets.

Game code: Phaser 3 (MIT) via jsDelivr.
