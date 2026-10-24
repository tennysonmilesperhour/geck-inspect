// Original symbols for this landing page, drawn on a shared 24-unit grid.
// Labels belong to the surrounding link/button; these marks are decorative.
const drawings = {
  'arrow-up-right': <path d="M5.5 18.5 18 6M7 6h11v11" />,
  'arrow-right': <path d="M4 12h15M13 6l6 6-6 6" />,
  play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
  expand: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 4l5 5m6 6 5 5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  reset: <><path d="M5 8a8 8 0 1 1-1 7M5 3v5h5" /><path d="M12 8v4l3 2" /></>,
  check: <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />,
  scan: <><path d="M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m13-5v4a1 1 0 0 1-1 1h-4" /><path d="M6 12c3.5-5 8.5-5 12 0-3.5 5-8.5 5-12 0Z" /><path d="M12 10.5v3" strokeWidth="2.4" /></>,
  care: <><path d="M12 21 4 13C-2 7 5 0 12 7c7-7 14 0 8 6Z" /><path d="M5 12h4l2-3 3 7 2-4h3" /></>,
  guide: <><path d="M12 6C9 3.5 5 3 2.5 4v15c3-1 6.5-.5 9.5 2 3-2.5 6.5-3 9.5-2V4C19 3 15 3.5 12 6Zm0 0v15M5.5 8l3 .7M5.5 12l3 .7M16.5 8v3m-2 0h4m-4 0v3m4-3v3" /></>,
};

export default function HomepageSymbol({ name, className = '' }) {
  return <svg
    className={`home-symbol home-symbol--${name} ${className}`.trim()}
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >{drawings[name]}</svg>;
}
