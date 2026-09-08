import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'LioranDB — Managed Cloud Database Platform';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#001e2b',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
          border: '12px solid #002838',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '9999px',
                backgroundColor: '#00ed64',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: '900',
                color: '#001e2b',
              }}
            >
              L
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                fontSize: '32px',
                fontWeight: '800',
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
              }}
            >
              <span>Lioran</span>
              <span style={{ color: '#00ed64' }}>DB</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 18px',
              borderRadius: '9999px',
              backgroundColor: '#002838',
              border: '1px solid #1c3b4a',
              color: '#00ed64',
              fontSize: '16px',
              fontWeight: '600',
              fontFamily: 'monospace',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '5px',
                backgroundColor: '#00ed64',
                display: 'flex',
              }}
            />
            <span>ENGINE ONLINE &bull; 99.9% SLA</span>
          </div>
        </div>

        {/* Center content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxWidth: '900px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span
              style={{
                display: 'flex',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: '#063446',
                border: '1px solid #1c3b4a',
                color: '#00ed64',
                fontSize: '14px',
                fontWeight: '700',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Managed Hosting Dashboard
            </span>
            <span
              style={{
                display: 'flex',
                color: '#93a1a1',
                fontSize: '16px',
              }}
            >
              v1.0 Production
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '52px',
              fontWeight: '800',
              color: '#FFFFFF',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
            }}
          >
            High-Performance Cloud Database Platform
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '22px',
              color: '#93a1a1',
              lineHeight: 1.5,
              maxWidth: '820px',
            }}
          >
            Dedicated NVMe clusters, automated daily snapshots, and isolated document storage with sub-millisecond response profiles.
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingTop: '24px',
            borderTop: '1px solid #1c3b4a',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '32px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', color: '#93a1a1', textTransform: 'uppercase' }}>Throughput</span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#00ed64', fontFamily: 'monospace' }}>~45,000 ops/s</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', color: '#93a1a1', textTransform: 'uppercase' }}>Persistence</span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', fontFamily: 'monospace' }}>WAL + NVMe Tier</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', color: '#93a1a1', textTransform: 'uppercase' }}>Security</span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#FFFFFF', fontFamily: 'monospace' }}>AES-256 + TLS 1.3</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '18px',
              fontWeight: '700',
              color: '#00ed64',
              fontFamily: 'monospace',
            }}
          >
            app.liorandb.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

