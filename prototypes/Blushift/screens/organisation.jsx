/* global React, Icon, Btn, Avatar */
const { useState: uS_org } = React;

const ORG_SUBNAV = [
  { id:'company',         label:'Constitution' },
  { id:'org-graph',       label:'Graph' },
  { id:'transformations', label:'Transformations' },
  { id:'finops',          label:'FinOps' },
];

// Wrapper: renders the Organisation sub-nav, then routes to the right child screen.
// The page header for each child still lives in its own file.
const OrganisationShell = ({ subRoute, navigate }) => {
  // subRoute is like ['org-graph'] or ['transformations','lending-modernisation','new'] etc.
  const tab = subRoute[0] || 'company';
  return (
    <div className="page-enter" style={{ display:'flex', flexDirection:'column', minHeight:'calc(100vh - 44px)' }}>
      <window.SubNav
        items={ORG_SUBNAV}
        active={tab}
        onPick={(id) => navigate(`/organisation/${id}`)}
        right={
          <div style={{ display:'flex', alignItems:'center', gap: 8, paddingRight: 6 }}>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>Northwind Mutual</span>
            <span style={{ width: 1, height: 14, background:'var(--line)' }}/>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>5 domains · 6 workspaces · 11 projects</span>
          </div>
        }
      />
      <div style={{ flex:1, minHeight: 0 }}>
        {tab === 'org-graph'       && window.OrgGraphScreen        && <window.OrgGraphScreen        navigate={navigate}/>}
        {tab === 'transformations' && window.TransformationsScreen && <window.TransformationsScreen subRoute={subRoute.slice(1)} navigate={navigate}/>}
        {tab === 'company'         && window.Company                && <window.Company                subRoute={subRoute.slice(1)} navigate={navigate}/>}
        {tab === 'finops'          && window.FinOpsScreen          && <window.FinOpsScreen          navigate={navigate}/>}
      </div>
    </div>
  );
};

window.OrganisationShell = OrganisationShell;
