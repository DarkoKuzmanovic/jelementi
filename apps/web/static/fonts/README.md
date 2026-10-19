# Reader fonts

Geist (Vercel) and Newsreader (Production Type), SIL Open Font License 1.1; copyright notices and licenses included (trailing whitespace normalized). No runtime font requests leave the site.

Three self-hosted WOFF2 subsets total **174,316 bytes**. Each includes Latin, Latin Extended A/B, combining marks, Latin Extended Additional, punctuation and supported currency/arrows. Geist retains its 100–900 weight axis; Newsreader normal/italic retain 400–700 with optical size fixed at 24. All use `font-display: swap`. Coverage was checked for `Čačak Ćć Šš Žž Đđ café naïve — “English”` in each saved font.

| Asset | Bytes | Upstream source |
| --- | ---: | --- |
| geist-latin.woff2 | 39364 | https://raw.githubusercontent.com/google/fonts/main/ofl/geist/Geist%5Bwght%5D.ttf |
| newsreader-latin.woff2 | 63584 | https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/Newsreader%5Bopsz,wght%5D.ttf |
| newsreader-italic-latin.woff2 | 71368 | https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/Newsreader-Italic%5Bopsz,wght%5D.ttf |

Subsetting uses FontTools `subset`/`varLib.instancer`, preserving copyright/license name records. Code-point ranges: U+0020–024F, U+0300–036F, U+1E00–1EFF, U+2000–206F, U+20A0–20CF, U+2190–21FF; plus U+2113, U+2122, U+2212, U+2215, U+FEFF, U+FFFD. Unsupported glyphs use the declared system fallback.

Source SHA-256 digests (before subsetting):

- Geist: `73894e0448cae90a92b6c2f8732b7bb9acb7b94c418bff559dad4a18e1de9659`
- Newsreader normal: `8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1`
- Newsreader italic: `796668611f80b64d5adf182fde3b6f29ed83b4e7cbec7b96937e84ac01364792`
