import { useCallback, useEffect, useRef, useState } from 'react';
import s from './Toast.module.scss';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { message, show };
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div className={`${s.toast} ${message ? s.on : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
