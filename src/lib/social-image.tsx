import { ImageResponse } from 'next/og';

// DESIGN.md's monochrome sketch language, adapted to the app's dark palette.
// Keep these explicit: ImageResponse does not inherit globals.css or the browser theme.
const palette = {
  canvas: '#0a0a0a',
  surface: '#161616',
  ink: '#ffffff',
  body: '#d4d4d4',
  muted: '#999999',
  border: '#2e2e2e',
};

export function createSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          width: '100%', height: '100%', padding: '48px 64px',
          backgroundColor: palette.canvas, color: palette.ink, fontFamily: 'sans-serif',
        }}
      >
        <svg width="1160" height="590" viewBox="0 0 1160 590" style={{ position: 'absolute', left: 20, top: 20 }}>
          <path d="M4 8 L1152 3 L1156 580 L8 586 Z" fill="none" stroke={palette.border} strokeWidth="2" />
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, border: `2px solid ${palette.ink}`, borderRadius: 7, fontSize: 30, fontWeight: 700 }}>
              L
            </div>
            <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px' }}>LioranDB</span>
          </div>
          <span style={{ display: 'flex', padding: '10px 14px', border: `1px solid ${palette.border}`, borderRadius: 5, color: palette.body, fontSize: 15, letterSpacing: '2px' }}>
            MANAGED CLOUD
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 650 }}>
            <span style={{ color: palette.muted, fontSize: 15, letterSpacing: '3px', marginBottom: 20 }}>BUILD WITH LIORANDB</span>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 66, fontWeight: 700, lineHeight: 1.06, letterSpacing: '-2px' }}>
              <span>Your database.</span>
              <span>Ready to build.</span>
            </div>
            <span style={{ color: palette.body, fontSize: 23, lineHeight: 1.5, marginTop: 24, maxWidth: 600 }}>
              Provision databases, connect your apps, and manage everything in one place.
            </span>
          </div>

          <div style={{ display: 'flex', position: 'relative', width: 280, height: 280, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderRadius: 10 }}>
            <svg width="280" height="280" viewBox="0 0 280 280" style={{ position: 'absolute', left: 0, top: 0 }}>
              <path d="M6 4 L274 7 L276 272 L3 276 Z" fill="none" stroke={palette.muted} strokeWidth="2" />
              <path d="M12 10 L269 11 L270 268" fill="none" stroke={palette.border} strokeWidth="1" />
              <ellipse cx="140" cy="86" rx="70" ry="25" fill="none" stroke={palette.ink} strokeWidth="3" />
              <path d="M70 86 L70 182 C70 216 210 216 210 182 L210 86 M70 133 C70 167 210 167 210 133" fill="none" stroke={palette.ink} strokeWidth="3" strokeLinecap="round" />
              <path d="M96 235 L184 233" fill="none" stroke={palette.muted} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 22, borderTop: `1px solid ${palette.border}` }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {['Managed hosting', 'Developer tools', 'Studio'].map((label) => (
              <span key={label} style={{ display: 'flex', padding: '8px 12px', border: `1px solid ${palette.border}`, borderRadius: 5, color: palette.body, fontSize: 16 }}>
                {label}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 18, color: palette.body }}>app.liorandb.com</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
