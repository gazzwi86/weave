/* global React, Icon */

const { useState, useEffect, useRef, useMemo } = React;

// Blushift logo: a stylized 'B' with a star/spectral shift accent.
const BrandMark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <defs>
      <linearGradient id="bs-grad" x1="0" y1="0" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#60A5FA"/>
        <stop offset="1" stopColor="#3B82F6"/>
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="20" height="20" rx="5" fill="#0E1420" stroke="url(#bs-grad)" strokeWidth="1"/>
    {/* B-shape */}
    <path d="M6.5 5.5h5a2.5 2.5 0 010 5h-5zM6.5 10.5h5.5a2.75 2.75 0 010 5.5H6.5z"
      stroke="url(#bs-grad)" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
    {/* spectral shift dot */}
    <circle cx="16" cy="6" r="1.4" fill="#60A5FA"/>
    <circle cx="16" cy="6" r="2.6" stroke="#60A5FA" strokeOpacity="0.35" strokeWidth="0.8"/>
  </svg>
);

// Avatar with initials and a deterministic hue from the string
const hueFor = (s) => {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
};
const Avatar = ({ name, initials, size = 22, color }) => {
  const init = initials || (name || '??').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const h = color ? null : hueFor(name || init);
  const bg = color || `linear-gradient(135deg, hsl(${h} 55% 38%), hsl(${(h+40)%360} 60% 28%))`;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(9, size*0.42), background: bg }}>{init}</span>
  );
};

// Sparkline
const Sparkline = ({ data, width = 80, height = 22, color = '#60A5FA', fill = 'rgba(96,165,250,0.15)' }) => {
  if (!data?.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const r = max - min || 1;
  const dx = width / (data.length - 1);
  const pts = data.map((v, i) => [i*dx, height - ((v - min)/r) * (height-2) - 1]);
  const path = pts.map((p,i) => (i===0?'M':'L') + p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const area = path + ` L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} className="spark">
      <path d={area} fill={fill}/>
      <path d={path} stroke={color} strokeWidth="1.25" fill="none"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="1.7" fill={color}/>
    </svg>
  );
};

// Status dot
const StatusDot = ({ kind = 'green' }) => <span className={`dot ${kind}`}></span>;

// Progress bar with optional segments
const Bar = ({ value, max, tone = 'blue', segments }) => {
  const pct = Math.min(100, Math.round((value/max)*100));
  if (segments) {
    return (
      <div className="bar" style={{ height: 6 }}>
        <div style={{ display: 'flex', height: '100%', width: pct + '%' }}>
          {segments.map((s,i) => (
            <div key={i} style={{ width: s.pct + '%', background: s.color, height: '100%' }}/>
          ))}
        </div>
      </div>
    );
  }
  const color = tone === 'amber' ? 'var(--amber)' : tone === 'red' ? 'var(--red)' : tone === 'green' ? 'var(--green)' : 'var(--blue)';
  return <div className="bar"><div style={{ width: pct + '%', background: color }}/></div>;
};

const Pill = ({ children, tone = '', icon }) => (
  <span className={`chip ${tone}`}>{icon && <Icon name={icon} size={11}/>}{children}</span>
);

const Btn = ({ children, variant = '', size = '', icon, iconRight, onClick, style }) => (
  <button className={`btn ${variant} ${size}`} onClick={onClick} style={style}>
    {icon && <Icon name={icon} size={14}/>}
    {children}
    {iconRight && <Icon name={iconRight} size={14}/>}
  </button>
);

const Kbd = ({ children }) => <span className="kbd">{children}</span>;

// Page heading
const PageHeader = ({ title, subtitle, actions, eyebrow, role, purpose, contributes, icon }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="h-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          {icon && <Icon name={icon} size={18} style={{ color:'var(--blue-bright)' }}/>}
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h1>
        </div>
        {subtitle && <div style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: 13 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display:'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
    {(role || purpose || contributes) && (
      <div className="page-explainer" style={{
        marginTop: 12,
        padding: '10px 14px',
        background: 'rgba(59,130,246,0.05)',
        border: '1px solid rgba(59,130,246,0.18)',
        borderLeft: '2px solid var(--blue)',
        borderRadius: 4,
        display: 'grid',
        gridTemplateColumns: role && purpose && contributes ? 'repeat(3, 1fr)' : '1fr',
        gap: 16,
      }}>
        {role && <Explainer label="What this is" body={role}/>}
        {purpose && <Explainer label="What you do here" body={purpose}/>}
        {contributes && <Explainer label="Where it fits" body={contributes}/>}
      </div>
    )}
  </div>
);

const Explainer = ({ label, body }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--blue-bright)', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-dim)' }}>{body}</div>
  </div>
);

const Section = ({ title, right, children, style }) => (
  <div style={{ marginBottom: 24, ...style }}>
    {(title || right) && (
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
        <div className="h-eyebrow">{title}</div>
        {right}
      </div>
    )}
    {children}
  </div>
);

// Simple tooltip
const Tip = ({ text, children }) => (
  <span title={text} style={{ borderBottom: '1px dashed var(--text-faint)' }}>{children}</span>
);

// Phase indicator
const PhaseBar = ({ pct, label }) => (
  <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
    <div style={{ width: 90 }}><Bar value={pct} max={100}/></div>
    <span className="mono" style={{ fontSize: 11, color: 'var(--text-mute)' }}>{pct}%</span>
  </div>
);

Object.assign(window, {
  BrandMark, Avatar, Sparkline, StatusDot, Bar, Pill, Btn, Kbd, PageHeader, Section, Tip, PhaseBar,
});
