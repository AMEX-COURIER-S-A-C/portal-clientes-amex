'use client';

import React from 'react';
import { Camera, X, ExternalLink } from 'lucide-react';
import { parseTibImageUrls } from '@/lib/portal/photo-urls';

export interface PhotoLightboxModalProps {
  selectedPhoto: { url: string; wr: string } | null;
  openingPhotoIndex: number | null;
  photoOpenError: string | null;
  fallbackPhotoUrl: { url: string; label: string } | null;
  onClose: () => void;
  onOpenOriginalPhoto: (wr: string, photoIndex: number) => void;
}

export default function PhotoLightboxModal({
  selectedPhoto,
  openingPhotoIndex,
  photoOpenError,
  fallbackPhotoUrl,
  onClose,
  onOpenOriginalPhoto,
}: PhotoLightboxModalProps) {
  if (!selectedPhoto) return null;

  const photos = parseTibImageUrls(selectedPhoto.url);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', maxWidth: '720px', width: '100%', padding: '16px', position: 'relative', maxHeight: '90dvh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb', marginBottom: '14px', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#fff3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Camera style={{ width: '18px', height: '18px', color: '#ff5722' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>
                Foto de Recepción Miami — WR {selectedPhoto.wr}
              </h3>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>
                Evidencia fotográfica registrada en bodega Miami
                {photos.length > 1 ? ` (${photos.length} fotos)` : ''}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar visor de foto"
            style={{ minWidth: '38px', minHeight: '38px', padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '68vh', overflowY: 'auto' }}>
          {photos.map((imgUrl, photoIdx, arr) => (
            <div
              key={`${imgUrl}-${photoIdx}`}
              style={{ backgroundColor: '#0f172a', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}
            >
              {arr.length > 1 && (
                <div style={{ width: '100%', padding: '6px 12px', backgroundColor: '#1e293b', color: '#cbd5e1', fontSize: '11.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Foto {photoIdx + 1} de {arr.length}</span>
                  <button
                    type="button"
                    onClick={() => onOpenOriginalPhoto(selectedPhoto.wr, photoIdx)}
                    disabled={openingPhotoIndex !== null}
                    style={{
                      color: '#fb923c',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: openingPhotoIndex !== null ? 'wait' : 'pointer',
                      opacity: openingPhotoIndex !== null && openingPhotoIndex !== photoIdx ? 0.6 : 1,
                    }}
                  >
                    <span>{openingPhotoIndex === photoIdx ? 'Abriendo...' : 'Ver original'}</span>
                    <ExternalLink style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt={`Paquete ${selectedPhoto.wr} - Foto ${photoIdx + 1}`}
                style={{ maxWidth: '100%', maxHeight: arr.length > 1 ? '54vh' : '65vh', objectFit: 'contain' }}
              />
            </div>
          ))}
        </div>

        {(photoOpenError || fallbackPhotoUrl) && (
          <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '6px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {photoOpenError && <span>{photoOpenError}</span>}
            {fallbackPhotoUrl && (
              <a
                href={fallbackPhotoUrl.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  alignSelf: 'flex-start',
                  padding: '8px 14px',
                  minHeight: '40px',
                  borderRadius: '6px',
                  backgroundColor: '#ff5722',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  textDecoration: 'none',
                }}
              >
                <span>{fallbackPhotoUrl.label}</span>
                <ExternalLink style={{ width: '14px', height: '14px' }} />
              </a>
            )}
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            Presiona <kbd style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>ESC</kbd> o haz clic afuera para cerrar
          </span>
          <button
            type="button"
            onClick={() => onOpenOriginalPhoto(selectedPhoto.wr, 0)}
            disabled={openingPhotoIndex !== null}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '42px', padding: '8px 16px', backgroundColor: '#ff5722', color: '#ffffff', fontWeight: 700, borderRadius: '6px', border: 'none', fontSize: '12.5px', cursor: openingPhotoIndex !== null ? 'wait' : 'pointer', opacity: openingPhotoIndex !== null ? 0.8 : 1, boxShadow: '0 2px 6px rgba(255,87,34,0.3)' }}
          >
            <span>{openingPhotoIndex === 0 ? 'Abriendo...' : 'Ver tamaño original'}</span>
            <ExternalLink style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
