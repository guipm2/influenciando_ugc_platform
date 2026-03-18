# 🚀 Influenciando - Sua Plataforma UGC

Uma plataforma inovadora que conecta **criadores de conteúdo** com **oportunidades de marcas** de forma eficiente, moderna e tecnológica.

## 📋 Sobre o Projeto

**Influenciando** é uma aplicação web full-stack desenvolvida para revolucionar a gestão de campanhas de UGC (User Generated Content). Com uma identidade visual moderna em preto e verde neon, a plataforma oferece uma experiência única onde analistas podem criar oportunidades, gerenciar projetos e definir prazos, enquanto criadores podem se candidatar a projetos e acompanhar suas entregas em tempo real.

### 🎪 Funcionalidades Principais

#### 👥 Para Criadores
- **Dashboard personalizado** com visão geral dos projetos
- **Sistema de candidaturas** para oportunidades
- **Gerenciamento de prazos** definidos pelos analistas
- **Sistema de mensagens** para comunicação com analistas
- **Notificações em tempo real** para atualizações importantes

#### 🔍 Para Analistas  
- **Gestão completa de oportunidades** e campanhas
- **Definição de prazos personalizados** para cada projeto
- **Gerenciamento de etapas** dos projetos
- **Lista de criadores** e suas candidaturas
- **Sistema de mensagens** integrado
- **Dashboard analítico** com métricas e insights

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 18.3.1** - Biblioteca para interface de usuário
- **TypeScript 5.5.3** - Tipagem estática para JavaScript
- **Vite 5.4.2** - Build tool e dev server ultra-rápido
- **Tailwind CSS 3.4.1** - Framework CSS utility-first
- **Lucide React** - Biblioteca de ícones moderna

### Backend & Database
- **Supabase** - Backend-as-a-Service com PostgreSQL
- **Row Level Security (RLS)** - Segurança avançada de dados
- **Real-time subscriptions** - Atualizações em tempo real
- **PostgreSQL** - Banco de dados relacional robusto

### Ferramentas de Desenvolvimento
- **ESLint** - Linter para qualidade de código
- **PostCSS & Autoprefixer** - Processamento de CSS
- **Git & GitHub** - Controle de versão

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn
- Conta no Supabase

### 1. Clone o repositório
```bash
git clone https://github.com/your-username/ugc-platform.git
cd ugc-platform
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Site Configuration
VITE_SITE_URL=https://your-platform-domain.com

# Webhooks (opcional)
VITE_OPPORTUNITY_CREATED_WEBHOOK_URL=https://your-webhook-url.com/webhook/opportunity-created

# Analyst Access Control (server-side)
VITE_ANALYST_SIGNUP_VALIDATION_ENDPOINT=https://your-platform-domain.com/api/validate-analyst-signup
```

### 4. Configure o banco de dados
Execute as migrações do Supabase:
```bash
# Se usando Supabase CLI
supabase db push

# Ou execute manualmente as migrações em supabase/migrations/
```

### 5. Execute o projeto
```bash
npm run dev
```

Acesse `http://localhost:5173` no seu navegador.

## 📁 Estrutura do Projeto

```
ugc-platform/
├── 📱 src/
│   ├── 🎨 components/          # Componentes React
│   │   ├── analyst/           # Componentes específicos para analistas
│   │   ├── auth/              # Componentes de autenticação  
│   │   ├── creator/           # Componentes específicos para criadores
│   │   └── legal/             # Componentes legais (termos, etc.)
│   ├── 🔧 contexts/           # Context API (AuthContext, etc.)
│   ├── 🪝 hooks/              # Custom React hooks
│   ├── 📚 lib/                # Configurações (Supabase, etc.)
│   └── 🛠️ utils/              # Funções utilitárias
├── 🗄️ supabase/
│   ├── migrations/           # Migrações oficiais do banco
│   └── config.toml          # Configuração do Supabase
├── 📝 sql-queries/           # Queries SQL utilitárias
│   ├── README.md            # Documentação das queries
│   └── *.sql               # Scripts para debug e manutenção
├── ⚙️ Arquivos de configuração
│   ├── tailwind.config.js   # Configuração do Tailwind
│   ├── vite.config.ts       # Configuração do Vite
│   ├── tsconfig.json        # Configuração do TypeScript
│   └── eslint.config.js     # Configuração do ESLint
└── 📄 README.md
```

## 🗄️ Arquitetura do Banco de Dados

### Principais Tabelas
- **`profiles`** - Perfis de usuários (criadores)
- **`analysts`** - Perfis de analistas  
- **`opportunities`** - Oportunidades de UGC
- **`applications`** - Candidaturas dos criadores
- **`project_deliverables`** - Prazos definidos pelos analistas
- **`messages`** - Sistema de mensagens
- **`conversations`** - Conversas entre analistas e criadores

### Recursos de Segurança
- **RLS (Row Level Security)** implementado em todas as tabelas
- **Políticas de acesso** baseadas no tipo de usuário
- **Autenticação** via Supabase Auth

## 🔄 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento

# Build  
npm run build        # Gera build de produção
npm run preview      # Preview do build de produção

# Qualidade de código
npm run lint         # Executa ESLint
```

## 📊 Funcionalidades Avançadas

### 🎯 Sistema de Prazos Inteligente
- Analistas definem prazos específicos para cada projeto
- Sistema de fallback mantém compatibilidade
- Priorização automática por urgência
- Notificações de prazos próximos

### 💬 Comunicação em Tempo Real  
- Sistema de mensagens integrado
- Notificações push instantâneas
- Status de leitura das mensagens
- Conversas organizadas por projeto

### 📈 Dashboard Analítico
- Métricas de performance dos criadores
- Acompanhamento de prazos e entregas  
- Gestão completa de oportunidades
- Filtros avançados e busca

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para dúvidas ou suporte:
- 📧 Email: [your-email@example.com]
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/ugc-platform/issues)

## 🎨 Personalização (White Label)

Esta plataforma foi desenvolvida para ser completamente personalizável:

1. **Branding**: Altere cores, logos e identidade visual no `tailwind.config.js` e componentes
2. **Domínio**: Configure sua própria URL através da variável `VITE_SITE_URL`
3. **Email**: Personalize os endereços de contato nos componentes (ex: `Help.tsx`)
4. **Webhooks**: Configure suas próprias integrações via variáveis de ambiente
5. **Conteúdo**: Todos os textos podem ser customizados diretamente nos componentes

---

<div align="center">
  <strong>Desenvolvido com ❤️ para revolucionar a gestão de UGC</strong>
</div>
