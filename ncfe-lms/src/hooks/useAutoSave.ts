'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface UseAutoSaveOptions<T> {
  /** Async function that receives the accumulated changes and persists them. Return true on success. */
  saveFn: (updates: Partial<T>) => Promise<boolean>;
  /** URL for the keepalive fetch on unmount (best-effort flush) */
  flushUrl: string;
  /** HTTP method for keepalive flush, default 'PUT' */
  flushMethod?: string;
  /** Debounce delay in milliseconds, default 1000 */
  debounceMs?: number;
}

interface UseAutoSaveReturn<T> {
  saveStatus: SaveStatus;
  scheduleUpdate: (updates: Partial<T>) => void;
  setSaveStatus: React.Dispatch<React.SetStateAction<SaveStatus>>;
}

export function useAutoSave<T extends Record<string, unknown>>({
  saveFn,
  flushUrl,
  flushMethod = 'PUT',
  debounceMs = 1000,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Partial<T>>({});
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const scheduleUpdate = useCallback(
    (updates: Partial<T>) => {
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
      setSaveStatus('unsaved');

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        const toSave = { ...pendingUpdatesRef.current };
        pendingUpdatesRef.current = {} as Partial<T>;
        setSaveStatus('saving');

        try {
          const success = await saveFnRef.current(toSave);
          setSaveStatus(success ? 'saved' : 'unsaved');
        } catch {
          setSaveStatus('unsaved');
        }
      }, debounceMs);
    },
    [debounceMs]
  );

  // Keepalive flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const pending = pendingUpdatesRef.current;
      if (Object.keys(pending).length > 0) {
        fetch(flushUrl, {
          method: flushMethod,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pending),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [flushUrl, flushMethod]);

  return { saveStatus, scheduleUpdate, setSaveStatus };
}
