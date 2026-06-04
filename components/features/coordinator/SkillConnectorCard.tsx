'use client';

import { useState } from 'react';

interface Props {
  skillApiKey: string | null;
  connectorUrl: string;
}

export function SkillConnectorCard({ skillApiKey, connectorUrl }: Props) {
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  async function copy(text: string, setCopied: (v: boolean) => void) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const maskedKey = skillApiKey
    ? skillApiKey.slice(0, 12) + '••••••••••••••••••••' + skillApiKey.slice(-4)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Connector URL */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#52525B', marginBottom: 6 }}>Connector URL</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{ flex: 1, fontSize: 12, background: '#F4F4F5', border: '1px solid #E4E4E7', borderRadius: 6, padding: '7px 10px', color: '#18181B', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {connectorUrl}
          </code>
          <button
            onClick={() => copy(connectorUrl, setUrlCopied)}
            style={{ flexShrink: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', border: '1px solid #E4E4E7', borderRadius: 6, background: '#fff', color: urlCopied ? '#16A34A' : '#52525B', cursor: 'pointer' }}
          >
            {urlCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Bearer token */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#52525B', marginBottom: 6 }}>Bearer Token</div>
        {skillApiKey ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 12, background: '#F4F4F5', border: '1px solid #E4E4E7', borderRadius: 6, padding: '7px 10px', color: '#18181B', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {keyVisible ? skillApiKey : maskedKey}
            </code>
            <button
              onClick={() => setKeyVisible(v => !v)}
              style={{ flexShrink: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', border: '1px solid #E4E4E7', borderRadius: 6, background: '#fff', color: '#52525B', cursor: 'pointer' }}
            >
              {keyVisible ? 'Hide' : 'Reveal'}
            </button>
            <button
              onClick={() => copy(skillApiKey, setKeyCopied)}
              style={{ flexShrink: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', border: '1px solid #E4E4E7', borderRadius: 6, background: '#fff', color: keyCopied ? '#16A34A' : '#52525B', cursor: 'pointer' }}
            >
              {keyCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: '#A1A1AA', margin: 0 }}>No key generated yet — contact Austin to set one up.</p>
        )}
      </div>

      <p style={{ fontSize: 11, color: '#A1A1AA', margin: 0, lineHeight: 1.5 }}>
        In claude.ai → Settings → Integrations, add the connector URL and set the Bearer token above. Each coordinator has a unique token — keep yours private.
      </p>
    </div>
  );
}
