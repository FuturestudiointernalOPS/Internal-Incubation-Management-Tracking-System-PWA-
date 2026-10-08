/** @type {import('tailwindcss').Config} */

// ─── CHARTER PALETTE ────────────────────────────────────────────────────────
// Every Tailwind colour family a page may use is mapped onto the charter, so a
// class such as `text-emerald-400` or `bg-slate-800/40` looks the same on every
// page of every role. Green and red are the only colours outside the charter.
const mix = (hex, target, amount) => {
  const channels = (value) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
  const from = channels(hex);
  const to = channels(target);
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
};
const rgb = (parts) => `rgb(${parts.join(" ")} / <alpha-value>)`;
/** A 50–950 scale around `base` (the 500 step): lighter toward white, darker toward black. */
const scale = (base) => {
  const steps = { 50: ["#ffffff", 0.92], 100: ["#ffffff", 0.84], 200: ["#ffffff", 0.68], 300: ["#ffffff", 0.5], 400: ["#ffffff", 0.25], 500: ["#000000", 0], 600: ["#000000", 0.15], 700: ["#000000", 0.3], 800: ["#000000", 0.45], 900: ["#000000", 0.6], 950: ["#000000", 0.72] };
  const out = {};
  for (const [step, [target, amount]] of Object.entries(steps)) out[step] = rgb(mix(base, target, amount));
  out.DEFAULT = out[500];
  return out;
};
const charterBlue = scale("#8f8fe8"); // in progress
const charterNeutral = {
  50: "#f4f5fc", 100: "#ecedfb", 200: "#d6d8f0", 300: "#b4b6dc", 400: "#8a8abf",
  500: "#6c6cae", 600: "#5a5a9c", 700: "#2a2a80", 800: "#14146e", 900: "#0d0d58", 950: "#06063f",
};
const neutral = Object.fromEntries(Object.entries(charterNeutral).map(([step, hex]) => [step, rgb(mix(hex, "#000000", 0))]));
const charterGreen = scale("#2dd4a0"); // done
const charterRed = scale("#ff5470"); // blocked / critical
const charterPending = scale("#9a9ad0"); // pending
const charterOrange = scale("#ff6600"); // accent
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundColor: {
        primary: "var(--bg-primary)",
        secondary: "var(--bg-secondary)",
        tertiary: "var(--bg-tertiary)",
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
      },
      colors: {
        // Theme colours that accept an opacity modifier (`bg-brand-orange/10`,
        // `border-divider/50`). An arbitrary value such as
        // `bg-[var(--brand-orange)]/10` generates NO CSS in Tailwind 3: the
        // opacity cannot be applied to a bare var(), so the class is silently
        // dropped. Use these names whenever a theme colour needs transparency.
        "brand-orange": "rgb(255 102 0 / <alpha-value>)",
        divider: "rgb(var(--border-primary-rgb) / <alpha-value>)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        slate: neutral, gray: neutral, zinc: neutral, neutral, stone: neutral,
        blue: charterBlue, sky: charterBlue, cyan: charterBlue, teal: charterBlue,
        indigo: charterBlue, violet: charterBlue, purple: charterBlue, fuchsia: charterBlue, pink: charterBlue,
        emerald: charterGreen, green: charterGreen, lime: charterGreen,
        red: charterRed, rose: charterRed,
        amber: charterPending, yellow: charterPending,
        orange: charterOrange,
        primary: {
          50: "#f5f7ff",
          100: "#ebf0fe",
          200: "#ced9fd",
          300: "#b1c2fb",
          400: "#7695f8",
          500: "#3b67f5",
          600: "#355ddc",
          700: "#2c4eb8",
          800: "#233e93",
          900: "#1d3378",
        },
      },
      borderRadius: {
        // One corner language: cards, panels and modals are 14px everywhere.
        "2xl": "14px",
        "3xl": "14px",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        headings: ["Poppins", "sans-serif"],
      },
      animation: {
        // Learner "ask for coaching" call-to-action: a soft, continuous blink
        // (opacity + a fading halo) that stays legible instead of a harsh
        // on/off flash. `motion-reduce` in the component stops it.
        "coaching-blink": "coachingBlink 1.6s ease-in-out infinite",
      },
      keyframes: {
        coachingBlink: {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgb(255 102 0 / 0.55)" },
          "50%": { opacity: "0.6", boxShadow: "0 0 0 8px rgb(255 102 0 / 0)" },
        },
      },
    },
  },
  plugins: [],
};
