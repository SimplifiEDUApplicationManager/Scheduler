'use client';

import { useState } from 'react';

interface Project {
  gid: string;
  name: string;
}

interface Props {
  /** Whether the coordinator already has a connected Asana project. */
  connected: boolean;
  /** Project name shown when connected. Null when not connected. */
  projectName: string | null;
}

type Step = 'idle' | 'validating' | 'picking' | 'connecting' | 'connected';

export function AsanaConnectionClient({ connected: initialConnected, projectName: initialProjectName }: Props) {
  const [connected, setConnected]       = useState(initialConnected);
  const [projectName, setProjectName]   = useState(initialProjectName);
  const [step, setStep]                 = useState<Step>(initialConnected ? 'connected' : 'idle');
  const [pat, setPat]                   = useState('');
  const [projects, setProjects]         = useState<Project[]>([]);
  const [selectedGid, setSelectedGid]   = useState('');
  const [error, setError]               = useState<string | null>(null);
  const [toast, setToast]               = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  async function safeJson(res: Response): Promise<Record<string, unknown>> {
    try { return await res.json() as Record<string, unknown>; } catch { return {}; }
  }

  async function handleValidate() {
    setError(null);
    setStep('validating');
    try {
      const res = await fetch('/api/coordinator/asana/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pat }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        setError(String(body.error ?? 'Failed to validate token'));
        setStep('idle');
        return;
      }
      const fetched = (body.projects as Project[] | undefined) ?? [];
      if (!fetched.length) {
        setError('No projects found in your Asana workspace.');
        setStep('idle');
        return;
      }
      setProjects(fetched);
      setSelectedGid(fetched[0]!.gid);
      setStep('picking');
    } catch {
      setError('Network error — check your connection and try again');
      setStep('idle');
    }
  }

  async function handleConnect() {
    setError(null);
    setStep('connecting');
    try {
      const res = await fetch('/api/coordinator/asana/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pat, projectGid: selectedGid }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        setError(String(body.error ?? 'Failed to connect'));
        setStep('picking');
        return;
      }
      setConnected(true);
      setProjectName(String(body.projectName ?? ''));
      setPat('');
      setProjects([]);
      setStep('connected');
      showToast('Asana connected — requests will now sync from this project');
    } catch {
      setError('Network error — check your connection and try again');
      setStep('picking');
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      const res = await fetch('/api/coordinator/asana/disconnect', { method: 'POST' });
      if (!res.ok) {
        const body = await safeJson(res);
        setError(String(body.error ?? 'Failed to disconnect'));
        return;
      }
      setConnected(false);
      setProjectName(null);
      setPat('');
      setProjects([]);
      setStep('idle');
      showToast('Asana disconnected');
    } catch {
      setError('Network error — check your connection and try again');
    }
  }

  const busy = step === 'validating' || step === 'connecting';

  return (
    <div>
      {/* Connected state */}
      {connected && step === 'connected' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', border: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {/* Asana logo-ish icon */}
            <svg width={18} height={18} viewBox="0 0 24 24" fill="#F06A6A" aria-hidden>
              <circle cx={12} cy={6} r={4} />
              <circle cx={5} cy={17} r={4} />
              <circle cx={19} cy={17} r={4} />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Asana connected</div>
            <div style={{ fontSize: 12, color: '#15803D', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={busy}
            style={btnStyle('secondary')}
          >
            Disconnect
          </button>
        </div>
      ) : (
        /* Connection form */
        <div>
          <p style={{ fontSize: 12, color: '#71717A', margin: '0 0 14px', lineHeight: 1.55 }}>
            Enter your Asana Personal Access Token. You can create one at{' '}
            <a href="https://app.asana.com/0/my-apps" target="_blank" rel="noreferrer" style={{ color: '#2B7265', fontWeight: 600 }}>
              app.asana.com/0/my-apps
            </a>
            . Each coordinator uses their own token — Simplifi only accesses the project you choose.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle()}>Personal Access Token</label>
            <input
              type="password"
              value={pat}
              onChange={e => { setPat(e.target.value); setError(null); }}
              placeholder="1/1234567890:abcdef..."
              disabled={step === 'picking' || busy}
              style={inputStyle(step === 'picking' || busy)}
            />
          </div>

          {step !== 'picking' && (
            <button
              onClick={handleValidate}
              disabled={pat.trim().length < 10 || busy}
              style={{ ...btnStyle('primary'), opacity: (pat.trim().length < 10 || busy) ? 0.5 : 1, cursor: (pat.trim().length < 10 || busy) ? 'not-allowed' : 'pointer' }}
            >
              {step === 'validating' ? 'Validating…' : 'Fetch projects'}
            </button>
          )}

          {(step === 'picking' || step === 'connecting') && (
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle()}>Choose your Asana project</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={selectedGid}
                  onChange={e => setSelectedGid(e.target.value)}
                  style={{ ...inputStyle(busy), flex: 1 }}
                >
                  {projects.map(p => (
                    <option key={p.gid} value={p.gid}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleConnect}
                  disabled={!selectedGid || busy}
                  style={btnStyle('primary')}
                >
                  {step === 'connecting' ? 'Connecting…' : 'Connect'}
                </button>
                <button
                  onClick={() => { setStep('idle'); setProjects([]); setError(null); }}
                  disabled={busy}
                  style={btnStyle('secondary')}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#DC2626' }}>
          {error}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#18181B', color: '#fff', borderRadius: 10, boxShadow: '0 10px 24px rgba(22,32,51,0.18)', fontSize: 13, fontWeight: 500 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: '#22C55E', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </div>
  );
}

function labelStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 12, fontWeight: 600, color: '#3F3F46', marginBottom: 6 };
}

function inputStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', height: 36, padding: '0 10px', border: '1px solid #E4E4E7', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    background: disabled ? '#FAFAFA' : '#fff', color: disabled ? '#71717A' : '#18181B',
  };
}

function btnStyle(variant: 'primary' | 'secondary'): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 36, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
    gap: 6, whiteSpace: 'nowrap', flexShrink: 0,
  };
  return variant === 'primary'
    ? { ...base, background: '#18181B', color: '#fff', border: 'none' }
    : { ...base, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7' };
}
