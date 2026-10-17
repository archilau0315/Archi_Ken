// English dictionary: Help panel (manual / shortcuts / about / subscription).
export default {
  'help.title': 'Help',
  'help.tagline': 'User guide · Version · Subscription',
  'help.close': 'Close',
  'help.tab.manual': 'User Guide',
  'help.tab.shortcuts': 'View Controls',
  'help.tab.about': 'About',
  'help.tab.subscribe': 'Subscription',
  'help.tab.legal': 'Legal',

  'help.manual.s1.title': '1. Quick Start',
  'help.manual.s1.body':
    '① Add one or more IFC models in the left "Model Sources" panel (sample models available).\n② Click "Load Federation" to merge models with automatic discipline coloring.\n③ Click "Real Model" to build meshes and inspect real geometry and materials.',
  'help.manual.s2.title': '2. Run Check & Issue List',
  'help.manual.s2.body':
    'Click "Run Check" to evaluate rulesets against the first model source; results appear in the Issue List.\nClick an issue to locate and highlight the element in 3D.',
  'help.manual.s3.title': '3. Clash Matrix',
  'help.manual.s3.body':
    'The Clash Matrix detects hard clashes, clearance, headroom and duplicates.\nClick a clash to fly to the contact point, highlight and isolate both elements.\nSupports custom pair selections, ignore rules, proximity merging and review status.',
  'help.manual.s4.title': '4. Takeoff (Quantities)',
  'help.manual.s4.body':
    'Takeoff reports area / volume / surface area per template.\nComposite walls split into construction layers: structural by volume, plaster / insulation by area, with openings deducted.\nGroup subtotals by storey, type, layer role, material or any custom column.',
  'help.manual.s5.title': '5. IDS Validation',
  'help.manual.s5.body':
    'Validate element properties against buildingSMART IDS specifications.\nFailed items can be converted into issues for tracking.',
  'help.manual.s6.title': '6. Report Export',
  'help.manual.s6.body':
    'Reports summarize check results and clashes in HTML / PDF / Excel.\nElement GUIDs and clash contact points are included for traceability.',
  'help.manual.s7.title': '7. Communication & BCF',
  'help.manual.s7.body':
    'Manage the full issue lifecycle (new / confirmed / resolved / closed).\nSupports view snapshots, comments and BCF 2.1 import/export with the Solibri / Revit ecosystem.',
  'help.manual.s8.title': '8. View Tools',
  'help.manual.s8.body':
    'The View panel offers section cuts, transparent shell, preset viewpoints (top / front / back / left / right) and orthographic projection.\nSwitch between discipline coloring and original IFC colors in the left panel.',

  'help.shortcuts.s1.keys': 'Left-drag',
  'help.shortcuts.s1.desc': 'Rotate model',
  'help.shortcuts.s2.keys': 'Right-drag',
  'help.shortcuts.s2.desc': 'Pan view',
  'help.shortcuts.s3.keys': 'Wheel',
  'help.shortcuts.s3.desc': 'Zoom',
  'help.shortcuts.s4.keys': 'Click element',
  'help.shortcuts.s4.desc': 'Select and view properties',
  'help.shortcuts.s5.keys': 'Click empty space',
  'help.shortcuts.s5.desc': 'Deselect',
  'help.shortcuts.s6.keys': 'Click section axis',
  'help.shortcuts.s6.desc': 'Toggle section cut (View panel)',
  'help.shortcuts.s7.keys': 'Click clash item',
  'help.shortcuts.s7.desc': 'Fly to contact point and isolate both elements',
  'help.shortcuts.s8.keys': 'F1',
  'help.shortcuts.s8.desc': 'Open this help panel',

  'help.about.version': 'Version v{v}',
  'help.about.developer': 'Developer',
  'help.about.developerValue': 'Kuanform Boundless Intelligent Technology (Tianjin) Co., Ltd.',
  'help.about.stack': 'Architecture',
  'help.about.stackValue': 'Electron + React UI · Python FastAPI kernel (IfcOpenShell) · Node business server',
  'help.about.license': 'License',
  'help.about.licenseValue': 'Internal use (unreleased)',
  'help.about.feedback': 'Feedback',
  'help.about.feedbackValue': 'Create an issue in the Communication panel or contact the team',
  'help.about.update': 'Updates',
  'help.about.checkBtn': 'Check now',
  'help.about.checking': 'Checking…',
  'help.about.latest': 'You are on the latest version',

  'help.subscribe.title': 'Subscription (Coming Soon)',
  'help.subscribe.body1': 'This is an internal beta. All features are free.',
  'help.subscribe.body2': 'Planned tiers for the official release:',
  'help.subscribe.f1': 'Basic: model check + clash matrix + report export',
  'help.subscribe.f2': 'Pro: + IDS validation + takeoff + BCF collaboration',
  'help.subscribe.f3': 'Team: + multi-user collaboration + shared rulesets + priority support',
  'help.subscribe.note': 'Subscription is not available yet. Stay tuned.',

  'help.legal.title': 'Legal',
  'help.legal.placeholder': 'Privacy policy and EULA will be added with the official release.',
}
