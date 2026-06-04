# Frontend Theme Guide

This file documents the theme used by the `frontend` React/Vite app and explains how to reuse it in other projects.

## Theme Overview

The theme is built using:

- CSS custom properties (`:root` variables)
- a light neutral palette with a bold accent
- clean typography with Google fonts
- subtle panel and border styling
- soft shadows, gradients, and motion
- React components styled with shared CSS variables

## Key Files

- `frontend/src/index.css` — main theme tokens, global reset, body styles, scrollbars, and keyframes.
- `frontend/index.html` — font imports.
- `frontend/src/App.jsx` — example layout and component style usage with CSS variables.
- `frontend/src/assets/logo.svg` — brand asset used in the header.

## CSS Variables

The theme uses the following CSS variables in `frontend/src/index.css`:

```css
:root {
  --bg: #f0f2f5;
  --surface: #e8ebf0;
  --panel: #ffffff;
  --panel-hi: #edf0f5;
  --border: #b8c2d0;
  --border-hi: #8a97aa;

  --accent: #c0182e;
  --accent-dim: rgba(192, 24, 46, 0.10);
  --accent-glow: rgba(192, 24, 46, 0.25);
  --accent-hi: #a0101f;

  --success: #0e7c4a;
  --warn: #b45309;
  --error: #c0182e;
  --info: #1d5fb4;

  --text: #0f1929;
  --text-dim: #3d4f66;
  --text-mid: #1e3050;
  --text-hi: #000912;

  --mono: 'IBM Plex Mono', monospace;
  --display: 'Syne', sans-serif;
  --body: 'DM Sans', sans-serif;

  --r: 6px;
  --r-sm: 4px;
}
```

### Usage patterns

Use these variables for consistent styling:

- backgrounds: `var(--bg)`, `var(--surface)`, `var(--panel)`, `var(--panel-hi)`
- borders: `var(--border)`, `var(--border-hi)`
- text: `var(--text)`, `var(--text-dim)`, `var(--text-mid)`, `var(--text-hi)`
- accents: `var(--accent)`, `var(--accent-dim)`, `var(--accent-glow)`
- radius: `var(--r)`, `var(--r-sm)`

## Typography

Fonts are loaded in `frontend/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet">
```

And used like this:

```css
body {
  font-family: var(--body);
}

.some-mono-element {
  font-family: var(--mono);
}

.heading {
  font-family: var(--display);
}
```

## Global styles

The theme includes a global reset and body styling in `frontend/src/index.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--body);
  font-size: 16px;
  line-height: 1.6;
  overflow: hidden;
}
```

It also includes a subtle dot-grid page background:

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: radial-gradient(circle, rgba(0, 0, 0, 0.07) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  z-index: 0;
}
```

## Scrollbar styling

Custom scrollbars are defined globally:

```css
::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

::-webkit-scrollbar-track {
  background: var(--panel-hi);
}

::-webkit-scrollbar-thumb {
  background: var(--border-hi);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-dim);
}
```

## Animations

The theme includes reusable animations for subtle UI motion:

- `slideIn`
- `riseIn`
- `scan`
- `blink`

Example:

```css
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-6px); }
  to { opacity: 1; transform: translateX(0); }
}
```

## Recommended integration steps

To reuse this theme in another React/Vite project:

1. Copy `frontend/src/index.css` into the new project.
2. Add the font imports to the new `index.html`.
3. Set `body` to use `var(--bg)`, `var(--text)`, and `var(--body)`.
4. Use the CSS variables for panels, borders, text, and accents.
5. Apply `border-radius` using `var(--r)` and `var(--r-sm)`.
6. Use the animations for small UI transitions.

## Example usage

A card component style can be:

```css
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 24px;
  box-shadow: 0 12px 30px rgba(15, 25, 41, 0.04);
}

.card-header {
  font-family: var(--display);
  color: var(--text-hi);
}

.button-primary {
  background: var(--accent);
  color: white;
  border-radius: var(--r-sm);
}
```

## Notes for React projects

- Use `import logo from './assets/logo.svg'` for SVG assets in `src/`.
- Keep `public/` only for truly static files that should be served as-is.
- Prefer CSS variables in inline styles or CSS modules to preserve theme consistency.

## Project dependencies

The frontend is a standard Vite + React app with these dependencies in `frontend/package.json`:

- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`

## Brand asset

The logo lives at `frontend/src/assets/logo.svg` and is imported from `App.jsx`.

---

This guide is intended to make theme reuse easy for other projects. Copy the CSS variables, font setup, and global styles to preserve the same look and feel.