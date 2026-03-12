import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook para detectar quando a aba volta a ficar ativa/visível
 * e executar um callback para recarregar dados.
 *
 * - Aguarda 1.5s antes de executar o callback (tempo para o auth
 *   terminar o token refresh que o Supabase dispara ao focar).
 * - Se o callback falhar, faz 1 retry automático após 2s.
 */
export function useTabVisibility(onVisible?: () => void | Promise<void>) {
  const wasHiddenRef = useRef(false);
  const callbackRef = useRef(onVisible);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Atualizar ref do callback
  useEffect(() => {
    callbackRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const executeWithRetry = async () => {
      if (!callbackRef.current) return;

      try {
        await callbackRef.current();
      } catch (err) {
        console.error('❌ [TAB] Erro ao recarregar dados:', err);

        // Retry 1x após 2s
        retryTimerRef.current = setTimeout(async () => {
          try {
            await callbackRef.current?.();
          } catch (retryErr) {
            console.error('❌ [TAB] Retry falhou:', retryErr);
          }
        }, 2000);
      }
    };

    const handleVisibilityChange = () => {
      const isHidden = document.hidden;

      // Se estava escondido e agora ficou visível, executa callback após delay
      if (wasHiddenRef.current && !isHidden) {
        console.log('🔄 [TAB] Aba voltou a ficar visível - aguardando 1.5s para token refresh');

        // Cancelar timers pendentes de uma troca anterior
        if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

        // Aguarda 1.5s para o auth terminar o token refresh
        delayTimerRef.current = setTimeout(() => {
          executeWithRetry();
        }, 1500);
      }

      wasHiddenRef.current = isHidden;
    };

    // Adicionar listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Retornar função para forçar reload manualmente se necessário
  const forceReload = useCallback(() => {
    if (callbackRef.current) {
      const result = callbackRef.current();
      if (result instanceof Promise) {
        result.catch((err) => {
          console.error('❌ [TAB] Erro ao forçar reload:', err);
        });
      }
    }
  }, []);

  return { forceReload };
}
