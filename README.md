# Bloom.txt

A tiny, static website for assembling an ASCII-art wildflower bouquet, writing a short letter, and sending it as a gift link — a birthday, a thank-you, a surprise, or just because.

The whole gift (flowers, colors, note, and letter) is packed into the URL hash with [lz-string](https://github.com/pieroxy/lz-string) compression. There is no backend and nothing is stored on a server.

**Stack:** Svelte 5 + Vite + TypeScript. The build is a plain folder of static files.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

Other commands:

```bash
npm run build      # production files go to dist/
npm run preview    # serve the production build locally
npm test           # share-link and render tests
npm run check      # TypeScript + svelte-check
```

## Deploy (free static hosting)

This is a static SPA. Upload the contents of `dist/` after `npm run build`. The app uses relative asset paths (`base: './'`), so it also works in a subdirectory.

### Cloudflare Pages

1. Push the project to a Git repository.
2. In Cloudflare Pages, create a project from that repo.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Leave the rest as defaults.

Or drag the `dist` folder into a [direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`

A `public/_redirects` or Netlify redirect is not required for gift links, because they live in the URL hash (`#/gift/...`) and never hit the server.

### GitHub Pages

1. Build with `npm run build`.
2. Publish the `dist` folder (for example with the [GitHub Pages official action](https://github.com/actions/upload-pages-artifact), or the `gh-pages` branch).
3. If the site is served from `https://user.github.io/repo/`, the relative `base: './'` already in `vite.config.ts` is what you want.

You can also preview a build with any static server:

```bash
npm run build
npx serve dist
```

## Share URL format

Gift links look like this:

```
https://your-domain.example/#/gift/<lz-string-token>
```

Example path (the token is shorter once compressed):

```
#/gift/N4IgDgTg9g...
```

Open the same origin with no hash (or `#/`) to use the builder. “Preview the gift” in the builder jumps to the reveal page for the bouquet you are editing.

For screenshots and automation, add `?open=1` to skip the sealed envelope and start the bloom:

```
https://your-domain.example/?open=1#/gift/<token>
```

## Using the site

1. **Builder** — pick from a dozen flower varieties, choose a color, and place them on the bunch. Stems fan automatically. The bouquet spins in 3D (drag to turn it by hand, or pause rotation) and is framed so the whole bunch, roots to blossom, stays in the panel. A Style switch next to the stage picks **3D** (the realistic shaded renderer) or **Retro** (the earlier chunky sprite-style ASCII look). A Detail slider changes how many ASCII cells the stage uses, from large readable glyphs up to the finest grid. Both travel with the gift link and the local draft; older links stay on 3D at full detail. “Surprise me” grows a random bouquet. Replay bloom grows the bunch from a little root tuft and ribbon, stems first, then leaves, then each flower opening at its tip. You can also invite ladybugs, bees, and butterflies — they come along in the gift link.
2. **Letter** — To, From, a short line that prints under the bouquet, a longer message, and a card style (love, birthday, thank you, surprise, just because).
3. **Share** — copy the gift link. The recipient sees a sealed envelope, taps to open it, and watches the bouquet grow from the roots as it turns (or taps / presses space to skip ahead). Then the letter types itself in. They can also copy the bouquet as plain text or download a PNG.

A draft of the builder is saved in `localStorage` on that browser so a refresh does not lose your work. The gift itself still travels only in the link.

## Caveats

- **URL length.** Very long letters make longer links. The letter is capped (72 characters for the under-bouquet line, 600 for the message, 16 flowers). Most browsers handle the compressed result comfortably, but some chat apps truncate unusually long URLs — keep the note short if you run into that.
- **Link previews.** Because the gift lives in the hash and there is no server, Slack/iMessage/etc. cannot generate a unique image of that bouquet. They will show the generic Bloom.txt description.
- **Private by obscurity.** Anyone with the exact link can open the gift. Do not put secrets in the letter. There is no password or expiry.
- **Motion.** The bouquet grows from the roots in about four seconds, then auto-rotates and sways. `prefers-reduced-motion` skips the grow and turns rotation down to a still (or very gentle) pose; you can still press Rotate or drag it yourself.
- **Fonts in the PNG.** The download uses IBM Plex Mono. If a browser has not finished loading the font, the PNG may fall back to another monospace face.
- **No accounts, no deploy step required of recipients.** They just open the link.

## License

You are free to use and adapt this project for personal, gift-giving, and small public sites. The inspiration was a handmade ASCII wildflower bouquet — “she wanted wild flowers, they're out of season, so I made them by hand.”
