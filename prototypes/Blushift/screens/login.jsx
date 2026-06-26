/* global React, Icon, BrandMark, Btn, Kbd */
const { useState: uS_login } = React;

const Login = ({ navigate }) => {
  const [hover, setHover] = uS_login(null);
  const providers = [
    { id: 'microsoft', label: 'Continue with Microsoft', icon: 'microsoft', color: '#5E5E5E' },
    { id: 'github',    label: 'Continue with GitHub',    icon: 'github',    color: '#E5EAF2' },
    { id: 'gitlab',    label: 'Continue with GitLab',    icon: 'gitlab',    color: '#FCA28C' },
  ];
  return (
    <div style={{
      height: '100%', minHeight: '100vh',
      display: 'flex', flexDirection:'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32,
      background: 'radial-gradient(circle at 50% 30%, rgba(59,130,246,0.08), transparent 55%), var(--bg)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* faint grid */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(circle at 50% 40%, black 0%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 40%, black 0%, transparent 70%)',
      }}/>
      <div style={{ position: 'relative', display:'flex', flexDirection:'column', alignItems:'center', gap: 14, marginBottom: 30 }}>
        <BrandMark size={48}/>
        <div style={{ fontFamily:'var(--mono)', fontSize: 38, fontWeight: 600, letterSpacing:'-0.03em', color: 'var(--text)' }}>blushift</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Spec-driven SDLC for enterprise teams.</div>
      </div>

      <div style={{ position: 'relative', width: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {providers.map(p => (
          <button key={p.id}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => navigate('/portfolio')}
            style={{
              display:'flex', alignItems:'center', gap: 12,
              height: 44, padding: '0 16px',
              background: hover === p.id ? 'var(--overlay)' : 'var(--raised)',
              border: '1px solid ' + (hover === p.id ? 'var(--line-strong)' : 'var(--line)'),
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: 13.5, fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 120ms',
            }}>
            <span style={{ width: 18, display:'flex', justifyContent:'center', color: p.color }}>
              <Icon name={p.icon} size={16}/>
            </span>
            <span style={{ flex: 1, textAlign: 'left' }}>{p.label}</span>
            <Icon name="arrow-right" size={14} style={{ color: 'var(--text-mute)' }}/>
          </button>
        ))}
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
          <a href="#/portfolio" onClick={e => { e.preventDefault(); navigate('/portfolio'); }} style={{ color: 'var(--blue-bright)', textDecoration:'none' }}>
            Single sign-on (SSO) with your organization →
          </a>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display:'flex', justifyContent:'center', gap: 18, fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>
        <span>v4.2.7</span>
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <a style={{ color: 'var(--text-mute)', textDecoration:'none' }} onClick={() => navigate('/audit')} href="#/audit">[ audit verify ]</a>
        <span style={{ color: 'var(--text-faint)' }}>·</span>
        <a style={{ color: 'var(--text-mute)', textDecoration:'none' }} onClick={() => navigate('/help-me')} href="#/help-me">[ Help ]</a>
      </div>
    </div>
  );
};

window.Login = Login;
