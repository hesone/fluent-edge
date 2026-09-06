# Licences

FluentEdge's own source is MIT. These are the third-party terms that come with it.

[← back to the README](../README.md)

## Project licence

FluentEdge's **source code** is licensed under the **MIT License** — see the [LICENSE](../LICENSE) file for details.

> This license covers only the source code in this repository. It does **not** cover third-party
> libraries or services that you use with it. See the section below for their individual terms.

---

FluentEdge relies on the following open-source projects and services. Each is distributed under its
own license; you are responsible for reviewing and complying with them, especially before any
redistribution or commercial use.

| Package / Service | License | Notes |
|---|---|---|
| [OpenRouter](https://openrouter.ai/) | Service (see terms) | Hosted LLM API — usage governed by OpenRouter's terms and each model's license |
| [@openrouter/ai-sdk-provider](https://github.com/OpenRouterTeam/ai-sdk-provider) | Apache 2.0 | OpenRouter provider for the Vercel AI SDK |
| [Vercel AI SDK](https://github.com/vercel/ai/blob/main/LICENSE) | Apache 2.0 | LLM orchestration |
| [MediaPipe](https://github.com/google-ai-edge/mediapipe) | Apache 2.0 | Face landmark detection |
| [Next.js](https://github.com/vercel/next.js/blob/canary/LICENSE) | MIT | Web framework |
| [React](https://github.com/facebook/react/blob/main/LICENSE) | MIT | UI library |
| [Zustand](https://github.com/pmndrs/zustand/blob/main/LICENSE) | MIT | State management |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE) | MIT | Utility-first CSS framework |
| [PDF Parse](https://github.com/mehmet-kozan/pdf-parse/blob/main/LICENSE) | Apache 2.0 | Resume PDF text extraction |
| [Zod](https://github.com/colinhacks/zod/blob/main/LICENSE) | MIT | Schema validation |
| [react-icons](https://github.com/react-icons/react-icons/blob/master/LICENSE) | MIT | Icon component wrapper |
| [Lucide](https://github.com/lucide-icons/lucide/blob/main/LICENSE) | ISC | The icon set actually drawn (`react-icons/lu`) |
| [canvas-confetti](https://github.com/catdad/canvas-confetti/blob/master/LICENSE) | ISC | Celebration effect on the results screen |
| Bundled fonts — see [`src/fonts/LICENSE.md`](../src/fonts/LICENSE.md) | SIL OFL 1.1 | Inter, Space Grotesk, Vazirmatn (+ Fraunces, Outfit for the design preview) |

> **Speech APIs:** Speech recognition and synthesis use the browser's built-in **Web Speech API**.
> No model or library is bundled for this — behaviour and voices depend on the user's browser/OS.
>
> **Apache 2.0 note:** If you redistribute a binary that includes MediaPipe (or other Apache-2.0
> components), Apache 2.0 requires you to include a copy of the license and any applicable NOTICE file.

## Fonts

The typefaces are **self-hosted** in `src/fonts/` and loaded with `next/font/local`, so no request
ever goes to Google Fonts and offline builds keep working. They are **not** covered by this
project's MIT licence — each is under the **SIL Open Font License 1.1**, which requires that the
licence text and copyright notices ship alongside the font files.

That obligation is met by [`src/fonts/LICENSE.md`](../src/fonts/LICENSE.md). **Keep that file next to
the fonts** if you fork, vendor, or redistribute this repository. The OFL also forbids reusing a
font's Reserved Font Name for a modified version — the bundled files are unmodified subsets, so
this only matters if you re-subset them and ship the result.

If you remove the `/design/directions` page, also delete `fraunces-var.woff2` and
`outfit-var.woff2`, which nothing else uses.

## Third-party assets fetched at runtime

Face scoring downloads two things from public CDNs the first time a practice session starts:

| Asset | Host | License |
|---|---|---|
| MediaPipe `tasks-vision` WASM runtime | `cdn.jsdelivr.net` | Apache 2.0 |
| `face_landmarker.task` model | `storage.googleapis.com` | Apache 2.0 |

> **This makes "local mode" not strictly offline.** No video or audio leaves the device — but
> fetching these assets does reveal the user's IP address to jsDelivr and Google, and the feature
> will not work on a machine with no internet access at all. To close that gap, vendor both assets
> into `public/` and point `FilesetResolver.forVisionTasks()` and `modelAssetPath` at your own
> copies (Apache 2.0 requires you to carry the licence and any NOTICE file with them).
