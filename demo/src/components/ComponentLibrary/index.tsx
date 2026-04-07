import React, { useCallback, useMemo, useState } from 'react';
import { X, Search, Puzzle, Package } from 'lucide-react';
import { ComponentRecord } from '@demo/utils/api';

interface ComponentLibraryProps {
  components: ComponentRecord[];
  onInsert: (blockData: any) => void;
  onClose: () => void;
}

export function ComponentLibrary({ components, onInsert, onClose }: ComponentLibraryProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return components;
    const q = search.toLowerCase();
    return components.filter(c => c.name.toLowerCase().includes(q));
  }, [components, search]);

  const handleInsert = useCallback((comp: ComponentRecord) => {
    try {
      const blockData = typeof comp.block_data === 'string'
        ? JSON.parse(comp.block_data)
        : comp.block_data;
      onInsert(blockData);
      onClose();
    } catch {
      // Invalid block data
    }
  }, [onInsert, onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '90%',
        maxWidth: 720,
        maxHeight: '80vh',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Puzzle size={18} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
              Component Library
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#6366f1',
              background: '#eef2ff', borderRadius: 10, padding: '2px 8px',
            }}>
              {components.length}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', padding: 4, borderRadius: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        {components.length > 3 && (
          <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: '#9ca3af', pointerEvents: 'none',
              }} />
              <input
                type='text'
                placeholder='Search components…'
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px 8px 32px',
                  border: '1px solid #e5e7eb', borderRadius: 6,
                  fontSize: 13, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        {/* Grid */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: 20,
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center', color: '#9ca3af',
            }}>
              <Package size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: 14, fontWeight: 500 }}>
                {components.length === 0
                  ? 'No components yet'
                  : `No components matching "${search}"`
                }
              </p>
              {components.length === 0 && (
                <p style={{ fontSize: 12, marginTop: 4 }}>
                  Container blocks in the template will appear here after saving.
                </p>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}>
              {filtered.map((comp, i) => (
                <button
                  key={comp.id || i}
                  onClick={() => handleInsert(comp)}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 0,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px rgba(99,102,241,0.15)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: '100%',
                    height: 140,
                    background: '#f9fafb',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {comp.thumbnail ? (
                      <img
                        src={comp.thumbnail}
                        alt={comp.name}
                        style={{
                          width: '100%', height: '100%',
                          objectFit: 'cover', objectPosition: 'top',
                        }}
                      />
                    ) : (
                      <Package size={32} style={{ color: '#d1d5db' }} />
                    )}
                  </div>

                  {/* Name */}
                  <div style={{
                    padding: '10px 12px',
                    fontSize: 13, fontWeight: 500, color: '#374151',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {comp.name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
