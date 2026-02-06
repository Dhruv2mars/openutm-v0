import { useEffect, useMemo, useRef, useState } from 'react';
import type { DisplaySession } from '@openutm/shared-types';

type SpiceMainConnCtor = new (config: Record<string, unknown>) => {
  stop?: () => void;
};

interface SpiceViewerProps {
  session: DisplaySession | null;
}

export function SpiceViewer({ session }: SpiceViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const connectionRef = useRef<{ stop?: () => void } | null>(null);

  const screenId = useMemo(
    () => `spice-screen-${session?.vmId || 'none'}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    [session?.vmId],
  );
  const messageId = useMemo(
    () => `spice-message-${session?.vmId || 'none'}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
    [session?.vmId],
  );

  useEffect(() => {
    let mounted = true;
    const wsUri = session?.websocketUri;
    if (!wsUri) {
      setConnected(false);
      setError(session ? 'Display websocket unavailable' : null);
      return;
    }

    const open = async () => {
      try {
        const spiceModule = await import('@spice-project/spice-html5/src/main.js');
        if (!mounted) return;
        const SpiceMainConn = spiceModule.SpiceMainConn as SpiceMainConnCtor;
        connectionRef.current?.stop?.();
        connectionRef.current = new SpiceMainConn({
          uri: wsUri,
          screen_id: screenId,
          message_id: messageId,
          onerror: () => {
            if (!mounted) return;
            setConnected(false);
            setError('SPICE display connection failed');
          },
          onsuccess: () => {
            if (!mounted) return;
            setConnected(true);
            setError(null);
          },
          onagent: () => {
            if (!mounted) return;
            setConnected(true);
            setError(null);
          },
        });
      } catch (err) {
        if (!mounted) return;
        setConnected(false);
        setError(err instanceof Error ? err.message : 'Failed to initialize SPICE viewer');
      }
    };

    void open();

    return () => {
      mounted = false;
      connectionRef.current?.stop?.();
      connectionRef.current = null;
    };
  }, [screenId, messageId, session, session?.websocketUri]);

  if (!session) {
    return (
      <div className="p-3 border rounded-lg">
        <p className="text-sm text-gray-500">No active display session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded border bg-gray-950 min-h-[360px] overflow-hidden">
        <div id={screenId} className="w-full h-full min-h-[360px]" />
      </div>
      <div id={messageId} className="text-xs text-gray-500" />
      <p className="text-xs text-gray-500">
        {connected ? `Connected: ${session.websocketUri || session.uri}` : `Connecting: ${session.websocketUri || session.uri}`}
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
