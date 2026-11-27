'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/** BarcodeDetector todavía no está en los tipos del DOM de TypeScript. */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

function detectorClass(): BarcodeDetectorConstructor | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector ?? null
  );
}

/** Solo Chrome en Android (y pocos más) traen el lector de códigos: si no, se pega la clave. */
export function canScanBarcodes(): boolean {
  return !!detectorClass() && !!navigator.mediaDevices?.getUserMedia;
}

interface AccessKeyScannerProps {
  onDetected: (accessKey: string) => void;
  onClose: () => void;
}

/**
 * Lee con la cámara el código de barras del RIDE (CODE 128 con la clave de acceso) o su código QR.
 * Se detiene en cuanto encuentra 49 dígitos.
 */
export function AccessKeyScanner({ onDetected, onClose }: AccessKeyScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Detector = detectorClass();
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const detector = new Detector({ formats: ['code_128', 'qr_code'] });

    const scan = async () => {
      const video = videoRef.current;
      if (stopped || !video) return;
      try {
        if (video.readyState >= 2) {
          for (const code of await detector.detect(video)) {
            const key = code.rawValue.match(/\d{49}/)?.[0];
            if (key) {
              stopped = true;
              onDetected(key);
              return;
            }
          }
        }
      } catch {
        // Un cuadro que no se pudo leer: se prueba con el siguiente.
      }
      frame = window.setTimeout(scan, 250);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((media) => {
        stream = media;
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = media;
        void videoRef.current.play();
        void scan();
      })
      .catch(() => setError('No pudimos abrir la cámara. Revisa el permiso o pega la clave.'));

    return () => {
      stopped = true;
      window.clearTimeout(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected]);

  return (
    <div className="space-y-3 rounded-lg bg-surface-container p-3">
      {error ? (
        <p className="text-body-md text-error">{error}</p>
      ) : (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-video w-full rounded-md bg-on-surface object-cover"
          />
          <p className="text-body-sm text-on-surface-variant">
            Apunta al código de barras que está sobre la clave de acceso en el RIDE.
          </p>
        </>
      )}
      <Button type="button" variant="outlined" size="sm" onClick={onClose}>
        Cerrar cámara
      </Button>
    </div>
  );
}
