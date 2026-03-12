/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { router } from '../utils/router';
import { resolveSiteUrl } from '../utils/siteUrl';
import type { User } from '@supabase/supabase-js';

interface Analyst {
  id: string;
  email: string;
  name?: string;
  company?: string;
  role: 'analyst';
  terms_accepted?: boolean;
  terms_accepted_at?: string;
  terms_version?: string;
}

interface AnalystAuthContextType {
  profile: Analyst | null;
  user: User | null;
  analyst: Analyst | null; // Dados específicos da tabela analysts
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
    company: string,
    secretKey: string
  ) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AnalystAuthContext = createContext<AnalystAuthContextType | undefined>(undefined);

export function useAnalystAuth() {
  const context = useContext(AnalystAuthContext);
  if (context === undefined) {
    throw new Error('useAnalystAuth must be used within an AnalystAuthProvider');
  }
  return context;
}

export const AnalystAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Analyst | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [analyst, setAnalyst] = useState<Analyst | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const getSession = async () => {
            try {
        const { data: { session } } = await supabase.auth.getSession();
                
        if (session?.user) {
          setUser(session.user);
          // Busca perfil na tabela profiles
          let { data: userProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          
          // Se não existe perfil, cria automaticamente
          if (!userProfile) {
                        const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.name || '',
                company: session.user.user_metadata?.company || '',
                role: 'analyst',
                terms_accepted: true,
                terms_accepted_at: new Date().toISOString(),
                terms_version: '1.0',
              });
            
            if (!profileError) {
              // Criar também registro na tabela analysts
              const { error: analystError } = await supabase
                .from('analysts')
                .insert({
                  id: session.user.id, // Usar o mesmo ID do auth.users
                  email: session.user.email || '',
                  name: session.user.user_metadata?.name || '',
                  company: session.user.user_metadata?.company || '',
                  role: 'analyst'
                });
              
              if (analystError) {
                console.error('❌ Analyst record creation failed:', analystError);
              } else {
                console.log('✅ Analyst record created successfully');
              }
              
              await new Promise(res => setTimeout(res, 300));
              const { data: newProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
              userProfile = newProfile;
                          } else {
              console.error('❌ Profile creation failed:', profileError);
            }
          }
          
          setProfile(userProfile ?? null);
          
          // Buscar dados específicos da tabela analysts
          if (userProfile) {
            let { data: analystData } = await supabase
              .from('analysts')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
            
            // Se não existe registro na tabela analysts, criar automaticamente
            if (!analystData && userProfile.role === 'analyst') {
              const { error: analystError } = await supabase
                .from('analysts')
                .insert({
                  id: session.user.id,
                  email: userProfile.email,
                  name: userProfile.name || '',
                  company: userProfile.company || '',
                  role: 'analyst'
                });
              
              if (!analystError) {
                // Buscar o registro recém-criado
                const { data: newAnalystData } = await supabase
                  .from('analysts')
                  .select('*')
                  .eq('id', session.user.id)
                  .maybeSingle();
                analystData = newAnalystData;
                              } else {
                console.error('❌ Failed to create analyst record:', analystError);
              }
            }
            
            setAnalyst(analystData ?? null);
          }
        } else {
          setProfile(null);
          setUser(null);
          setAnalyst(null);
        }
      } catch (error) {
        console.error('💥 Error getting session:', error);
        setProfile(null);
        setUser(null);
        setAnalyst(null);
      }
      
            setLoading(false);
    };

    // Auth state change listener
    // IMPORTANTE: callback NÃO é async para não bloquear o lock interno do auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED: apenas atualizar referência interna, NÃO re-buscar perfil
      if (event === 'TOKEN_REFRESHED') {
        // O user não muda durante refresh de token — nada a fazer
        return;
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setUser(null);
        setAnalyst(null);
        setLoading(false);
      }
    });

    getSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Verifica se existe perfil de criador com esse email
      const { data: creatorExists } = await supabase
        .from('profiles')
        .select('email, role')
        .eq('email', email)
        .maybeSingle();

      if (creatorExists && creatorExists.role === 'creator') {
        return { error: 'Este email está cadastrado como criador. Acesse a área de criadores.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ [ANALYST] Erro no login:', error);
        
        // Verificar se é erro de email não confirmado
        if (error.message?.includes('Email not confirmed') || 
            error.message?.includes('email_not_confirmed') ||
            error.message?.includes('signup_disabled')) {
          return { error: 'Por favor, confirme seu email antes de fazer login. Verifique sua caixa de entrada.' };
        }
        
        // Verificar se a conta existe mas senha está incorreta
        if (error.message?.includes('Invalid login credentials')) {
          // Verificar se o email existe
          const { data: userExists } = await supabase
            .from('profiles')
            .select('email')
            .eq('email', email)
            .maybeSingle();
            
          if (userExists) {
            return { error: 'Senha incorreta' };
          } else {
            return { error: 'Conta não encontrada. Por favor, verifique seu email ou crie uma conta.' };
          }
        }
        
        return { error: 'Email ou senha incorretos' };
      }

      if (data.user) {
        const metadata = data.user.user_metadata ?? {};
        const profilePayload = {
          id: data.user.id,
          email: data.user.email ?? email,
          name: metadata.name ?? '',
          company: metadata.company ?? '',
          role: 'analyst' as const,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          terms_version: '1.0'
        };

        // Busca perfil na tabela profiles
        const { data: fetchedProfile, error: profileFetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        let userProfile = fetchedProfile;

        if (profileFetchError) {
          console.error('❌ Failed to fetch profile during login:', profileFetchError);
        }

        // Criar ou corrigir perfil automaticamente se necessário
        if (!userProfile) {
          const { error: profileInsertError } = await supabase
            .from('profiles')
            .upsert(profilePayload);

          if (profileInsertError) {
            console.error('❌ Failed to create analyst profile during login:', profileInsertError);
            await supabase.auth.signOut();
            return { error: 'Não foi possível preparar seu perfil de analista. Tente novamente em instantes.' };
          }

          const { data: newProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();
          userProfile = newProfile ?? null;
        } else if (userProfile.role !== 'analyst') {
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({
              role: 'analyst',
              name: profilePayload.name,
              company: profilePayload.company,
              terms_accepted: profilePayload.terms_accepted,
              terms_accepted_at: profilePayload.terms_accepted_at,
              terms_version: profilePayload.terms_version
            })
            .eq('id', data.user.id);

          if (profileUpdateError) {
            console.error('❌ Failed to update profile role during login:', profileUpdateError);
            await supabase.auth.signOut();
            return { error: 'Acesso negado. Esta área é apenas para analistas.' };
          }

          const { data: updatedProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();
          userProfile = updatedProfile ?? null;
        }

        if (!userProfile || userProfile.role !== 'analyst') {
          await supabase.auth.signOut();
          return { error: 'Acesso negado. Esta área é apenas para analistas.' };
        }

        // Buscar dados específicos da tabela analysts
        let { data: analystData } = await supabase
          .from('analysts')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!analystData) {
          const { error: analystUpsertError } = await supabase
            .from('analysts')
            .upsert({
              id: data.user.id,
              email: userProfile.email,
              name: userProfile.name ?? '',
              company: userProfile.company ?? '',
              role: 'analyst'
            });

          if (analystUpsertError) {
            console.error('❌ Failed to create analyst record during login:', analystUpsertError);
          } else {
            const { data: newAnalystData } = await supabase
              .from('analysts')
              .select('*')
              .eq('id', data.user.id)
              .maybeSingle();
            analystData = newAnalystData;
          }
        }

        setUser(data.user);
        setProfile(userProfile);
        setAnalyst(analystData ?? null);
      }

      return { error: null };
    } catch {
      return { error: 'Erro ao fazer login' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    company: string,
    secretKey: string
  ) => {
    try {
      // Verifica se já existe perfil de criador com esse email
      const { data: creatorExists } = await supabase
        .from('profiles')
        .select('email, role')
        .eq('email', email)
        .maybeSingle();

      if (creatorExists && creatorExists.role === 'creator') {
        return { error: 'Este email já está cadastrado como criador' };
      }

      const trimmedSecret = secretKey.trim();
      if (!trimmedSecret) {
        return { error: 'Insira a chave secreta fornecida pela administração.' };
      }

      const expectedSecret = import.meta.env.VITE_ANALYST_SIGNUP_SECRET?.trim();
      if (!expectedSecret) {
        return { error: 'Configuração do sistema incompleta. Contate o administrador.' };
      }

      if (trimmedSecret !== expectedSecret) {
        return { error: 'Chave secreta inválida. Verifique com a administração.' };
      }

      // Cria o usuário com role analyst no user_metadata
      const emailRedirectTo = `${resolveSiteUrl()}/auth/email-confirmed?type=analyst`;

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            role: 'analyst',
            name,
            company
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          return { error: 'Este email já está cadastrado' };
        }
        return { error: 'Erro ao criar conta' };
      }

      // ❌ NÃO definir setUser aqui! O usuário só deve ser setado após confirmação do email
      // setUser(authData.user ?? null);
      
      return { error: null };
    } catch {
      return { error: 'Erro ao criar conta' };
    }
  };

  const signOut = async () => {
    try {
      // Limpar estado local primeiro
      setProfile(null);
      setUser(null);
      setAnalyst(null);
      
      // Fazer logout no Supabase (remove a sessão do localStorage)
      await supabase.auth.signOut();
      
      // Limpar completamente o localStorage/sessionStorage de qualquer dados relacionados ao Supabase
      const keysToRemove = [
        'supabase.auth.token',
        'sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Limpar também qualquer chave que contenha 'supabase' ou 'auth'
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          sessionStorage.removeItem(key);
        }
      });

      // Força redirecionamento para landing page
      router.navigate('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, força limpeza e redirecionamento
      localStorage.clear();
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          sessionStorage.removeItem(key);
        }
      });
      router.navigate('/');
    }
  };

  const value = {
    profile,
    user,
    analyst,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AnalystAuthContext.Provider value={value}>{children}</AnalystAuthContext.Provider>;
};