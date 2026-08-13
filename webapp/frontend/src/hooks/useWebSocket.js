import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom Hook React pour gérer les connexions WebSocket en temps réel
 * avec reconnexion automatique et gestion d'état centralisée.
 * 
 * @param {string} url - URL du WebSocket (ex: '/ws/alerts' ou '/ws/sensors')
 * @returns {object} { messages, lastMessage, isConnected }
 */
export function useWebSocket(url) {
  const [messages, setMessages] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    // Calcul automatique de l'URL absolue WebSocket si chemin relatif
    let wsUrl = url;
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}${url}`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          // Conserve un historique glissant des 100 derniers messages en mémoire
          setMessages((prev) => [data, ...prev.slice(0, 99)]);
        } catch (err) {
          console.error("[-] Erreur de parsing du message WebSocket:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Tentative de reconnexion automatique toutes les 3 secondes
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error("[-] Erreur WebSocket:", err);
        ws.close();
      };
    } catch (err) {
      console.error("[-] Échec de connexion WebSocket:", err);
    }
  }, [url]);

  useEffect(() => {
    connect();

    // Nettoyage lors du démontage du composant
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { messages, lastMessage, isConnected };
}

export default useWebSocket;
