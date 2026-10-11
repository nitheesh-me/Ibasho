/**
 * Find a building, floor or room by name: the header search box and the command palette
 * (owner request, 2026-10-11). Owner: WP-08.
 *
 * Results are grouped Buildings, Floors, Rooms, each with its city and type. Arrow keys move,
 * Enter opens, Escape closes. Recent searches are a per-viewer convenience in localStorage
 * (wrapped, optional). Empty and no-match states are plain words. Choosing a result sets the
 * building and the zoom level and asks the scene to focus it (`focus` in the URL; the scene reads
 * it). Ctrl or Cmd K opens the palette anywhere; phones get a search button in the top bar.
 */

import type { PlaceHit } from '@ibasho/core';
import { Mon, TYPE_INFO } from '@ibasho/ui';
import { type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStudio } from '../state/studio.ts';
import { cityLabel, findPlaces, hitDetail, hitPath } from './places.ts';

const RECENT_KEY = 'ibasho.search.recent';

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}
function pushRecent(q: string) {
  try {
    const next = [q, ...readRecent().filter((x) => x !== q)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: recent searches simply do not persist.
  }
}

const GROUPS: { kind: PlaceHit['kind']; label: string }[] = [
  { kind: 'place', label: 'Places' },
  { kind: 'building', label: 'Buildings' },
  { kind: 'storey', label: 'Floors' },
  { kind: 'room', label: 'Rooms' },
];

/** Search the studio. Swap point for agent A's `searchPlaces`. */
export function useSearch(query: string): PlaceHit[] {
  const places = useStudio((s) => s.places);
  const buildings = useStudio((s) => s.buildings);
  const areas = useStudio((s) => s.areas);
  return useMemo(() => findPlaces({ places, buildings, areas }, query), [places, buildings, areas, query]);
}

interface ResultsProps {
  query: string;
  hits: PlaceHit[];
  active: number;
  onPick: (h: PlaceHit) => void;
  onHover: (i: number) => void;
  listId: string;
  recent: string[];
  onRecent: (q: string) => void;
}

function Results({ query, hits, active, onPick, onHover, listId, recent, onRecent }: ResultsProps) {
  const places = useStudio((s) => s.places);
  const buildings = useStudio((s) => s.buildings);
  const state = { places, buildings };
  if (!query.trim()) {
    return (
      <div className="st-search__empty">
        <p>Type the name of a building, a floor or a room, or a use like "lab" or "classroom".</p>
        {recent.length ? (
          <>
            <p className="st-search__group">Recent</p>
            <ul className="st-search__recent">
              {recent.map((r) => (
                <li key={r}>
                  <button type="button" className="ib-chip" onClick={() => onRecent(r)}>
                    {r}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    );
  }
  if (!hits.length) {
    return (
      <p className="st-search__none" role="status">
        Nothing called "{query}" in the places loaded here. Try a room use, like classroom, or a building
        name.
      </p>
    );
  }
  let i = -1;
  return (
    <div id={listId} role="listbox" aria-label="Results" className="st-search__list">
      {GROUPS.map((g) => {
        const items = hits.filter((h) => h.kind === g.kind);
        if (!items.length) return null;
        return (
          // biome-ignore lint/a11y/useSemanticElements: an option group inside a listbox (ARIA 1.2)
          <div key={g.kind} role="group" aria-label={g.label}>
            <p className="st-search__group" aria-hidden="true">
              {g.label}
            </p>
            {items.map((h) => {
              i++;
              const idx = i;
              return (
                <div
                  key={`${h.kind}:${h.id}:${idx}`}
                  id={`${listId}-${idx}`}
                  role="option"
                  aria-selected={idx === active}
                  className="st-search__hit"
                  tabIndex={-1}
                  onMouseEnter={() => onHover(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPick(h)}
                  onKeyDown={() => undefined}
                >
                  {buildings[h.buildingId] ? (
                    <Mon id={TYPE_INFO[buildings[h.buildingId]?.typeId ?? 'office'].mon} size={16} />
                  ) : (
                    <span className="st-search__ctx" aria-hidden="true" />
                  )}
                  <span className="st-search__label">{h.name}</span>
                  <span className="st-search__detail">{hitDetail(state, h)}</span>
                  {h.kind === 'building' || h.kind === 'place' ? (
                    <span className="st-search__city">{cityLabel(h.city)}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function useSearchController(onPicked: (to: string, h: PlaceHit) => void) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const hits = useSearch(query);
  const flat = useMemo(() => GROUPS.flatMap((g) => hits.filter((h) => h.kind === g.kind)), [hits]);
  useEffect(() => setActive(0), []);
  const pick = useCallback(
    (h: PlaceHit) => {
      if (query.trim()) pushRecent(query.trim());
      setRecent(readRecent());
      onPicked(hitPath(useStudio.getState(), h), h);
    },
    [query, onPicked],
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      const h = flat[active];
      if (h) {
        e.preventDefault();
        pick(h);
      }
    }
  };
  return {
    query,
    setQuery: (q: string) => {
      setQuery(q);
      setActive(0);
    },
    active,
    setActive,
    recent,
    hits: flat,
    pick,
    onKey,
  };
}

/** Inline search box with a results popover (studio header, New flow). */
export function SearchBox({
  placeholder = 'Find a building, floor or room',
  onPicked,
  compact = false,
}: {
  placeholder?: string;
  onPicked?: (to: string) => void;
  compact?: boolean;
}) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const c = useSearchController((to) => {
    setOpen(false);
    (onPicked ?? nav)(to);
  });
  return (
    <div className="st-search" data-compact={compact ? '' : undefined}>
      <input
        type="search"
        className="st-search__input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && c.hits.length ? `${listId}-${c.active}` : undefined}
        aria-label="Find a building, floor or room"
        placeholder={placeholder}
        value={c.query}
        onChange={(e) => {
          c.setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          else c.onKey(e);
        }}
      />
      <span className="st-search__kbd" aria-hidden="true">
        Ctrl K
      </span>
      {open ? (
        <div className="st-search__pop">
          <Results
            query={c.query}
            hits={c.hits}
            active={c.active}
            onPick={c.pick}
            onHover={c.setActive}
            listId={listId}
            recent={c.recent}
            onRecent={(q) => c.setQuery(q)}
          />
        </div>
      ) : null}
    </div>
  );
}

/** The command palette: Ctrl or Cmd K, or the search button on phones. */
export function CommandPalette() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const on = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        back.current = document.activeElement as HTMLElement | null;
        setOpen(true);
      }
    };
    const onOpen = () => {
      back.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener('keydown', on);
    window.addEventListener('ibasho:search', onOpen);
    return () => {
      window.removeEventListener('keydown', on);
      window.removeEventListener('ibasho:search', onOpen);
    };
  }, []);
  if (!open) return null;
  // The body mounts fresh on every open, so the query starts empty (round 3: queries ran together).
  return (
    <PaletteBody
      onClose={() => {
        setOpen(false);
        setTimeout(() => back.current?.focus?.(), 0);
      }}
      onPicked={(to) => {
        setOpen(false);
        nav(to);
      }}
    />
  );
}

function PaletteBody({ onClose, onPicked }: { onClose: () => void; onPicked: (to: string) => void }) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const c = useSearchController(onPicked);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <div className="st-palette">
      <button type="button" className="st-palette__scrim" aria-label="Close search" tabIndex={-1} onClick={onClose} />
      <div className="st-palette__box" role="dialog" aria-modal="true" aria-label="Find a building, floor or room">
        <input
          ref={inputRef}
          type="search"
          className="st-search__input st-palette__input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={c.hits.length ? `${listId}-${c.active}` : undefined}
          placeholder="Find a building, floor or room"
          value={c.query}
          onChange={(e) => c.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            else c.onKey(e);
          }}
        />
        <Results
          query={c.query}
          hits={c.hits}
          active={c.active}
          onPick={c.pick}
          onHover={c.setActive}
          listId={listId}
          recent={c.recent}
          onRecent={(q) => c.setQuery(q)}
        />
        <p className="st-palette__keys" aria-hidden="true">
          <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}

/** Phone and tablet: a button that opens the palette. */
export function SearchButton() {
  return (
    <button
      type="button"
      className="st-searchbtn"
      aria-label="Find a building, floor or room"
      onClick={() => window.dispatchEvent(new Event('ibasho:search'))}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15L20 20" />
      </svg>
    </button>
  );
}
