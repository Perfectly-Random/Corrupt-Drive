# Corrupt Drive

Corrupt Drive is an educational data-recovery roguelite prototype for IGCSE Computer Science practice.

The player explores a damaged drive as a recovery program. Repair encounters practise storage-unit conversions, binary and denary, hexadecimal, ASCII, image file-size calculations, and audio file-size calculations. Recovered files gradually reveal a subtle story.

## Run locally

```sh
python -m http.server 8080 --directory public
```

Then open `http://localhost:8080`.

## Deployment

This repository is configured for static deployment on Vercel. The playable app lives in `public/index.html` and has no backend or environment-variable requirements.

Progress is stored locally in the browser.
