/* global React */
// Icon set — 16px stroke icons. All inline SVG for sharpness.
const Icon = ({ name, size = 16, className = '', style = {} }) => {
  const s = size;
  const props = {
    width: s, height: s,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    style,
  };
  switch (name) {
    case 'star':
      return <svg {...props}><path d="M8 1.5l1.9 4.2 4.6.5-3.4 3.1.9 4.5L8 11.5 3.9 13.8l.9-4.5L1.4 6.2l4.6-.5z"/></svg>;
    case 'compass':
      return <svg {...props}><circle cx="8" cy="8" r="6.5"/><path d="M10.5 5.5L9 9l-3.5 1.5L7 7z"/></svg>;
    case 'bell':
      return <svg {...props}><path d="M3.5 6.5a4.5 4.5 0 119 0c0 3 1 4 1 4h-11s1-1 1-4z"/><path d="M6.5 13.5a1.5 1.5 0 003 0"/></svg>;
    case 'cmd':
      return <svg {...props}><path d="M5 3.5a1.5 1.5 0 1 1 1.5 1.5H5z M11 3.5a1.5 1.5 0 1 0-1.5 1.5H11z M5 12.5a1.5 1.5 0 1 0 1.5-1.5H5z M11 12.5a1.5 1.5 0 1 1-1.5-1.5H11z M5 5h6v6H5z"/></svg>;
    case 'user':
      return <svg {...props}><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5c.5-2.5 2.5-3.5 5-3.5s4.5 1 5 3.5"/></svg>;
    case 'search':
      return <svg {...props}><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>;
    case 'plus':
      return <svg {...props}><path d="M8 3v10M3 8h10"/></svg>;
    case 'arrow-right':
      return <svg {...props}><path d="M3 8h10M9 4l4 4-4 4"/></svg>;
    case 'arrow-up':
      return <svg {...props}><path d="M8 13V3M4 7l4-4 4 4"/></svg>;
    case 'arrow-down':
      return <svg {...props}><path d="M8 3v10M4 9l4 4 4-4"/></svg>;
    case 'check':
      return <svg {...props}><path d="M3 8.5l3 3 7-7"/></svg>;
    case 'x':
      return <svg {...props}><path d="M3 3l10 10M13 3L3 13"/></svg>;
    case 'chevron-right':
      return <svg {...props}><path d="M6 3l4 5-4 5"/></svg>;
    case 'chevron-down':
      return <svg {...props}><path d="M3 6l5 4 5-4"/></svg>;
    case 'chevron-up':
      return <svg {...props}><path d="M3 10l5-4 5 4"/></svg>;
    case 'chevron-left':
      return <svg {...props}><path d="M10 3L6 8l4 5"/></svg>;
    case 'circle':
      return <svg {...props}><circle cx="8" cy="8" r="6"/></svg>;
    case 'circle-fill':
      return <svg {...props} fill="currentColor"><circle cx="8" cy="8" r="5"/></svg>;
    case 'play':
      return <svg {...props} fill="currentColor" stroke="none"><path d="M4 3l9 5-9 5z"/></svg>;
    case 'pause':
      return <svg {...props} fill="currentColor" stroke="none"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>;
    case 'bolt':
      return <svg {...props}><path d="M9 1l-6 8h4l-1 6 6-8H8z"/></svg>;
    case 'bolt-fill':
      return <svg {...props} fill="currentColor" stroke="none"><path d="M9 1l-6 8h4l-1 6 6-8H8z"/></svg>;
    case 'flame':
      return <svg {...props}><path d="M8 1.5s2 2 2 4-1 2-1 3 1 1 1 2.5C10 13 9 14 8 14s-3-1-3-3 1-2 1-3-1-1-1-2.5S8 1.5 8 1.5z"/></svg>;
    case 'beaker':
      return <svg {...props}><path d="M6 2v4L3 13a1 1 0 001 1h8a1 1 0 001-1l-3-7V2"/><path d="M5 2h6"/></svg>;
    case 'cube':
      return <svg {...props}><path d="M8 1.5l5.5 3v6.5L8 14 2.5 11V4.5z"/><path d="M2.5 4.5l5.5 3 5.5-3M8 7.5V14"/></svg>;
    case 'database':
      return <svg {...props}><ellipse cx="8" cy="3.5" rx="5.5" ry="2"/><path d="M2.5 3.5v9c0 1 2.5 2 5.5 2s5.5-1 5.5-2v-9"/><path d="M2.5 8c0 1 2.5 2 5.5 2s5.5-1 5.5-2"/></svg>;
    case 'graph':
      return <svg {...props}><path d="M2 13L6 8l3 2 5-6"/><path d="M10 4h4v4"/></svg>;
    case 'list':
      return <svg {...props}><path d="M2 4h12M2 8h12M2 12h12"/></svg>;
    case 'kanban':
      return <svg {...props}><rect x="2" y="2" width="3" height="12"/><rect x="6.5" y="2" width="3" height="8"/><rect x="11" y="2" width="3" height="10"/></svg>;
    case 'gear':
      return <svg {...props}><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/></svg>;
    case 'doc':
      return <svg {...props}><path d="M3 1.5h6L13 5.5v9H3z"/><path d="M9 1.5V6h4M5.5 9h5M5.5 11.5h3"/></svg>;
    case 'shield':
      return <svg {...props}><path d="M8 1.5l5.5 2v5c0 3.5-3 5.5-5.5 6-2.5-.5-5.5-2.5-5.5-6v-5z"/></svg>;
    case 'shield-check':
      return <svg {...props}><path d="M8 1.5l5.5 2v5c0 3.5-3 5.5-5.5 6-2.5-.5-5.5-2.5-5.5-6v-5z"/><path d="M5.5 8L7 9.5 10.5 6"/></svg>;
    case 'github':
      return <svg {...props} fill="currentColor" stroke="none"><path d="M8 .5C3.86.5.5 3.86.5 8c0 3.31 2.15 6.12 5.13 7.11.37.07.51-.16.51-.36v-1.26c-2.09.45-2.53-1.01-2.53-1.01-.34-.87-.84-1.1-.84-1.1-.69-.47.05-.46.05-.46.76.05 1.16.78 1.16.78.67 1.16 1.77.82 2.2.63.07-.49.26-.82.48-1.01-1.67-.19-3.43-.84-3.43-3.72 0-.82.29-1.49.78-2.02-.08-.19-.34-.96.07-2 0 0 .63-.2 2.07.77a7.2 7.2 0 013.77 0c1.44-.97 2.07-.77 2.07-.77.41 1.04.15 1.81.07 2 .49.53.78 1.21.78 2.02 0 2.89-1.76 3.53-3.43 3.71.27.23.51.69.51 1.39v2.06c0 .2.14.43.51.36C13.35 14.12 15.5 11.31 15.5 8c0-4.14-3.36-7.5-7.5-7.5z"/></svg>;
    case 'gitlab':
      return <svg {...props} fill="currentColor" stroke="none"><path d="M8 14.5L4.5 5l-1 4 4.5 5.5zM8 14.5l3.5-9.5 1 4-4.5 5.5zM3.5 5L1 7.5l1 4 1.5-2.5L3.5 5zM12.5 5L15 7.5l-1 4-1.5-2.5L12.5 5z"/></svg>;
    case 'microsoft':
      return <svg {...props} fill="currentColor" stroke="none"><rect x="1" y="1" width="6.5" height="6.5"/><rect x="8.5" y="1" width="6.5" height="6.5"/><rect x="1" y="8.5" width="6.5" height="6.5"/><rect x="8.5" y="8.5" width="6.5" height="6.5"/></svg>;
    case 'help':
      return <svg {...props}><circle cx="8" cy="8" r="6.5"/><path d="M6 6c0-1.1.9-2 2-2s2 .9 2 2c0 1-1 1.5-1.5 1.5S8 8 8 9"/><circle cx="8" cy="11.5" r="0.5" fill="currentColor"/></svg>;
    case 'sparkle':
      return <svg {...props}><path d="M8 1l1.2 4 4 1.2-4 1.2L8 11.5 6.8 7.4l-4-1.2 4-1.2zM12.5 11l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L11 13l1.5-.5z"/></svg>;
    case 'terminal':
      return <svg {...props}><rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M4 6l2 2-2 2M7.5 10.5h3"/></svg>;
    case 'eye':
      return <svg {...props}><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="1.5"/></svg>;
    case 'filter':
      return <svg {...props}><path d="M2 3h12l-4.5 5v5l-3-1.5V8z"/></svg>;
    case 'tree':
      return <svg {...props}><circle cx="8" cy="3" r="1.5"/><circle cx="3.5" cy="11" r="1.5"/><circle cx="12.5" cy="11" r="1.5"/><path d="M8 4.5v3M8 7.5L4 9.5M8 7.5l4 2"/></svg>;
    case 'commit':
      return <svg {...props}><circle cx="8" cy="8" r="2.5"/><path d="M2 8h3.5M10.5 8H14"/></svg>;
    case 'branch':
      return <svg {...props}><circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="5" r="1.5"/><path d="M4 4.5v7M4 8h5a3 3 0 003-3v-.5"/></svg>;
    case 'pr':
      return <svg {...props}><circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="13" r="1.5"/><path d="M4 4.5v7M12 11.5V8a3 3 0 00-3-3H7M9 3l-2 2 2 2"/></svg>;
    case 'lock':
      return <svg {...props}><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>;
    case 'globe':
      return <svg {...props}><circle cx="8" cy="8" r="6.5"/><path d="M2 8h12M8 1.5C5 5 5 11 8 14.5M8 1.5c3 3.5 3 9.5 0 13"/></svg>;
    case 'layers':
      return <svg {...props}><path d="M8 1.5L1.5 5 8 8.5 14.5 5z"/><path d="M1.5 8L8 11.5 14.5 8M1.5 11L8 14.5 14.5 11"/></svg>;
    case 'network':
      return <svg {...props}><circle cx="8" cy="3" r="1.5"/><circle cx="3" cy="11" r="1.5"/><circle cx="13" cy="11" r="1.5"/><circle cx="8" cy="13" r="1.5"/><path d="M7 4l-3 6M9 4l3 6M8 4.5v7"/></svg>;
    case 'menu':
      return <svg {...props}><circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="13" cy="8" r="1.2" fill="currentColor"/></svg>;
    case 'alert':
      return <svg {...props}><path d="M8 1.5L14.5 13.5h-13z"/><path d="M8 6v3.5"/><circle cx="8" cy="11.5" r="0.5" fill="currentColor"/></svg>;
    case 'flag':
      return <svg {...props}><path d="M3 1.5v13M3 2h8l-1.5 3 1.5 3H3"/></svg>;
    case 'inbox':
      return <svg {...props}><path d="M2 9.5l1.5-7h9L14 9.5v4h-12z"/><path d="M2 9.5h4l1 1.5h2l1-1.5h4"/></svg>;
    case 'rocket':
      return <svg {...props}><path d="M11 2c-3 0-6 3-7.5 6.5L6 11c3.5-1.5 6.5-4.5 6.5-7.5 0-.8-.2-1-.5-1zM3.5 8.5l1 1M4 11l1 1M2 13s1.5-.5 2.5.5S5 16 5 16M9 5.5a1 1 0 102 0 1 1 0 00-2 0z"/></svg>;
    case 'pulse':
      return <svg {...props}><path d="M1.5 8h3l1.5-4 3 8 1.5-4h3"/></svg>;
    default:
      return <svg {...props}><circle cx="8" cy="8" r="3"/></svg>;
  }
};

window.Icon = Icon;
