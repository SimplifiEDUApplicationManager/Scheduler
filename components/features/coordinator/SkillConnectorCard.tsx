'use client';

import { useState } from 'react';

interface Props {
  skillApiKey: string | null;
  connectorUrl: string;
}

export function SkillConnectorCard({ skillApiKey, connectorUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const fullUrl = skillApiKey ? `${connectorUrl}?key=${skillApiKey}` : connectorUrl;
  const maskedUrl = skillApiKey
    ? `${connectorUrl}?key=${skillApiKey.slice(0, 12)}••••••••••••••••••••${skillApiKey.slice(-4)}`
    : connectorUrl;

  async function copyUrl() {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {skillApiKey ? (
        <>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#52525B', marginBottom: 6 }}>Connector URL</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{ flex: 1, fontSize: 11, background: '#F4F4F5', border: '1px solid #E4E4E7', borderRadius: 6, padding: '7px 10px', color: '#18181B', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {maskedUrl}
              </code>
              <button
                onClick={copyUrl}
                style={{ flexShrink: 0, padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', border: '1px solid #E4E4E7', borderRadius: 6, background: '#fff', color: copied ? '#16A34A' : '#52525B', cursor: 'pointer' }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#71717A', margin: 0, lineHeight: 1.6 }}>
            In claude.ai → Settings → Integrations → Add custom connector, paste this URL into <strong>Remote MCP server URL</strong>. Leave OAuth fields blank. Your token is embedded in the URL — keep it private.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 12, color: '#A1A1AA', margin: 0 }}>No key generated yet — contact Austin to set one up.</p>
      )}
    </div>
  );
}
