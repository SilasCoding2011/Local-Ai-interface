import type { ProjectFile, StudioSettings } from "../types/studio";

export const demoFiles: ProjectFile[] = [
  {
    path: "src/App.tsx",
    content: `type Feature = { title: string; detail: string; icon: string };

const features: Feature[] = [
  { title: "Thoughtful by default", detail: "A calmer space for your best work.", icon: "✳" },
  { title: "Made to move", detail: "Small details. A little more momentum.", icon: "↗" },
  { title: "Your own pace", detail: "A focused workspace, all yours.", icon: "◌" },
];

export default function App() {
  return (
    <main className="page">
      <nav><span className="brand-mark">S</span><span>STUDIO / NOTES</span><button>Get started <span>↗</span></button></nav>
      <section className="hero">
        <p className="eyebrow"><span></span> A small space for big ideas</p>
        <h1>Make room<br />for <em>good work.</em></h1>
        <p className="intro">A thoughtful workspace for the things you want to bring into the world. Clear your head, find your rhythm, and begin.</p>
        <button className="primary">Explore the studio <span>↗</span></button>
        <div className="hero-note"><span>01 — 03</span><span>DESIGNED FOR THE IN-BETWEEN</span></div>
      </section>
      <section className="features">{features.map((feature, index) => <article key={feature.title}><span className="feature-icon">{feature.icon}</span><span className="number">0{index + 1}</span><h2>{feature.title}</h2><p>{feature.detail}</p></article>)}</section>
      <footer><span>STUDIO NOTES</span><span>MADE WITH INTENTION · 2026</span></footer>
    </main>
  );
}`,
  },
  {
    path: "src/styles.css",
    content: `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap');

:root { font-family: 'DM Sans', sans-serif; color: #242722; background: #f6f5f0; font-synthesis: none; text-rendering: optimizeLegibility; }
* { box-sizing: border-box; }
body { margin: 0; }
.page { max-width: 1100px; margin: auto; padding: 0 64px; }
nav { height: 76px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #deded6; font-size: 10px; letter-spacing: .16em; font-weight: 700; }
.brand-mark { display: grid; place-items: center; width: 27px; height: 27px; background: #405747; color: white; border-radius: 50%; font-family: 'Playfair Display', serif; font-size: 16px; }
nav button { margin-left: auto; border: 0; background: none; font: inherit; letter-spacing: 0; font-size: 12px; color: inherit; }
nav button span, .primary span { margin-left: 12px; }
.hero { position: relative; padding: 92px 0 72px; min-height: 455px; }
.eyebrow { display: flex; align-items: center; gap: 9px; color: #687261; text-transform: uppercase; letter-spacing: .14em; font-size: 9px; font-weight: 700; }
.eyebrow span { width: 6px; height: 6px; border-radius: 50%; background: #a7b38b; }
h1 { margin: 23px 0 17px; font: 500 clamp(48px, 6vw, 76px)/.98 'Playfair Display', serif; letter-spacing: -.04em; }
h1 em { color: #65755d; }
.intro { max-width: 370px; color: #74766f; font-size: 13px; line-height: 1.8; }
.primary { margin-top: 25px; padding: 12px 16px; border: 0; color: white; background: #405747; border-radius: 3px; font: 500 11px 'DM Sans', sans-serif; }
.hero-note { position: absolute; right: 0; bottom: 42px; display: flex; flex-direction: column; gap: 7px; color: #92948a; font-size: 8px; letter-spacing: .15em; }
.features { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid #deded6; border-bottom: 1px solid #deded6; }
.features article { position: relative; padding: 28px 24px 33px 0; }
.features article + article { padding-left: 24px; border-left: 1px solid #deded6; }
.feature-icon { color: #687a62; font-size: 19px; }
.number { float: right; color: #a0a198; font-size: 9px; letter-spacing: .12em; }
h2 { margin: 25px 0 6px; font: 500 17px 'Playfair Display', serif; }
.features p { color: #85867e; font-size: 11px; }
footer { display: flex; justify-content: space-between; padding: 22px 0; color: #92948a; font-size: 8px; letter-spacing: .13em; }
@media (max-width: 650px) { .page { padding: 0 23px; } .hero { padding-top: 69px; } .hero-note { position: static; margin-top: 50px; } .features { grid-template-columns: 1fr; } .features article, .features article + article { padding: 20px 0; border-left: 0; } .features article + article { border-top: 1px solid #deded6; } h2 { margin-top: 12px; } }
`,
  },
  {
    path: "index.html",
    content: `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Studio Notes</title>
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f6f5f0;color:#242722;font-family:Arial,sans-serif}.page{max-width:1080px;margin:auto;padding:0 64px}nav{height:76px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #deded6;font-size:10px;letter-spacing:.16em;font-weight:700}.brand{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#405747;color:white;font-family:Georgia,serif;font-size:16px}nav button{margin-left:auto;border:0;background:none;font-size:12px}.hero{padding:83px 0 72px;min-height:443px}.eyebrow{color:#687261;text-transform:uppercase;letter-spacing:.14em;font-size:9px;font-weight:bold}.eyebrow i{display:inline-block;width:6px;height:6px;background:#a7b38b;border-radius:50%;margin-right:8px}h1{margin:22px 0 17px;font:500 clamp(48px,6vw,76px)/.98 Georgia,serif;letter-spacing:-.04em}h1 em{color:#65755d}.intro{max-width:370px;color:#74766f;font-size:13px;line-height:1.8}.primary{margin-top:18px;padding:12px 16px;border:0;color:white;background:#405747;border-radius:3px;font-size:11px}.features{display:grid;grid-template-columns:repeat(3,1fr);border-block:1px solid #deded6}.features article{padding:27px 20px 32px 0}.features article+article{padding-left:22px;border-left:1px solid #deded6}.symbol{color:#687a62;font-size:19px}.num{float:right;color:#a0a198;font-size:9px}h2{margin:24px 0 6px;font:500 17px Georgia,serif}.features p{color:#85867e;font-size:11px}footer{display:flex;justify-content:space-between;padding:22px 0;color:#92948a;font-size:8px;letter-spacing:.13em}@media(max-width:650px){.page{padding:0 23px}.hero{padding-top:65px}.features{grid-template-columns:1fr}.features article,.features article+article{padding:19px 0;border-left:0}.features article+article{border-top:1px solid #deded6}h2{margin-top:12px}}
    </style>
  </head>
  <body><main class="page"><nav><span class="brand">S</span><span>STUDIO / NOTES</span><button>Get started&nbsp; ↗</button></nav><section class="hero"><p class="eyebrow"><i></i>A small space for big ideas</p><h1>Make room<br>for <em>good work.</em></h1><p class="intro">A thoughtful workspace for the things you want to bring into the world. Clear your head, find your rhythm, and begin.</p><button class="primary">Explore the studio&nbsp; ↗</button></section><section class="features"><article><span class="symbol">✳</span><span class="num">01</span><h2>Thoughtful by default</h2><p>A calmer space for your best work.</p></article><article><span class="symbol">↗</span><span class="num">02</span><h2>Made to move</h2><p>Small details. A little more momentum.</p></article><article><span class="symbol">◌</span><span class="num">03</span><h2>Your own pace</h2><p>A focused workspace, all yours.</p></article></section><footer><span>STUDIO NOTES</span><span>MADE WITH INTENTION · 2026</span></footer></main></body>
</html>`,
  },
  {
    path: "package.json",
    content: `{
  "name": "studio-notes",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "tsc -b && vite build" }
}`,
  },
  {
    path: "README.md",
    content: `# Studio Notes\n\nA small, thoughtful space for good work.\n\n## Getting started\n\nOpen \`index.html\` in your browser or run the local preview from Local AI Studio.\n`,
  },
];

export const defaultSettings: StudioSettings = {
  model: "google/gemma-4-e4b",
  baseUrl: "/v1",
  temperature: 0.7,
  contextLength: 8192,
  systemPrompt: "You are a helpful, clear general-purpose assistant. Answer the user's actual question first. When they provide files, use their contents; only act as a coding agent when explicitly asked.",
  useLmStudio: true,
  fontSize: 13,
  animations: true,
  maxTokens: 2048,
  streaming: true,
  compactChat: false,
  theme: "dark",
  language: "English",
};