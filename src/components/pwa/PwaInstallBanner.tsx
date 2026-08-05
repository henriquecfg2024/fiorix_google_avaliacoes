'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, X, Download, Share } from 'lucide-react';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if already running in standalone (PWA app) mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Check if user dismissed the banner previously
    const dismissed = localStorage.getItem('fiorix_pwa_dismissed');
    if (dismissed) {
      return;
    }

    // 3. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(iosDevice);

    if (iosDevice) {
      setShowBanner(true);
    }

    // 4. Capture Android/Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(!showIosGuide);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('fiorix_pwa_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #002B49 0%, #1e3a8a 100%)',
        color: '#ffffff',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        position: 'relative',
        zIndex: 1000,
        flexWrap: 'wrap',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ background: 'rgba(255,255,255,0.15)', padding: '6px', borderRadius: '8px', display: 'flex' }}>
          <Smartphone size={18} />
        </div>
        <div>
          <span style={{ fontWeight: 700 }}>
            Instale o FIORIX Google Avaliações no seu celular!
          </span>
          <span style={{ fontSize: '11px', color: '#93c5fd', marginLeft: '8px', display: 'inline-block' }}>
            Acesso nativo sem barra de navegação
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={handleInstallClick}
          style={{
            background: '#10b981',
            color: '#ffffff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          {isIos ? <Share size={14} /> : <Download size={14} />}
          {isIos ? 'Ver Como Instalar' : 'Instalar App'}
        </button>

        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#cbd5e1',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
          }}
          title="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      {/* iOS Instructions Dropdown Modal */}
      {showIosGuide && (
        <div
          style={{
            width: '100%',
            background: 'rgba(15, 23, 42, 0.95)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginTop: '6px',
            fontSize: '12px',
            color: '#e2e8f0',
            lineHeight: 1.5,
          }}
        >
          📱 <b>Como instalar no iPhone / iPad (Safari):</b>
          <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
            <li>Toque no botão <b>Compartilhar 📤</b> na barra inferior do Safari.</li>
            <li>Role para baixo e selecione <b>"Adicionar à Tela de Início ➕"</b>.</li>
            <li>Pronto! O FIORIX abrirá em tela cheia como aplicativo nativo.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
