import React from 'react';
import { ArrowLeft, FileText, Users, Camera } from 'lucide-react';

interface TermsOfServiceProps {
  onBack?: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      {onBack && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FileText className="h-6 w-6 text-influenciando-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Termos de Uso</h1>
              <p className="text-gray-600">Última atualização: Janeiro de 2025</p>
            </div>
          </div>
        </div>
      )}

      {!onBack && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <FileText className="h-6 w-6 text-influenciando-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Termos de Uso</h1>
            <p className="text-gray-600">Última atualização: Janeiro de 2025</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="prose max-w-none">
            
            {/* Seção 1: Introdução */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-influenciando-primary" />
                1. Introdução e Aceitação
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Bem-vindo à Influenciando, uma plataforma que conecta criadores de conteúdo com empresas e analistas para campanhas de marketing. 
                Ao utilizar nossa plataforma, você concorda com estes Termos de Uso e nossa Política de Privacidade.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Estes termos estabelecem os direitos e responsabilidades de todas as partes envolvidas: criadores de conteúdo, 
                analistas e empresas que utilizam nossa plataforma.
              </p>
            </section>

            {/* Seção 2: Definições */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Definições</h2>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <ul className="space-y-2 text-gray-700">
                  <li><strong>Plataforma:</strong> A Influenciando e todos os seus serviços</li>
                  <li><strong>Criador:</strong> Usuário que produz conteúdo para campanhas</li>
                  <li><strong>Analista:</strong> Representante de empresa que cria oportunidades</li>
                  <li><strong>Oportunidade:</strong> Campanha de marketing criada por analistas</li>
                  <li><strong>Conteúdo:</strong> Qualquer material criativo produzido (vídeos, imagens, textos, etc.)</li>
                  <li><strong>Ativos:</strong> Todo conteúdo final entregue pelo criador</li>
                </ul>
              </div>
            </section>

            {/* Seção 3: Direitos de Uso e Propriedade Intelectual */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Camera className="h-5 w-5 text-red-600" />
                3. Direitos de Uso e Propriedade Intelectual
              </h2>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-red-900 mb-3">⚠️ CLÁUSULA IMPORTANTE - DIREITOS DE IMAGEM E USO</h3>
                <p className="text-red-800 leading-relaxed mb-4">
                  <strong>Ao aceitar uma oportunidade e entregar o conteúdo solicitado, o CRIADOR concede automaticamente 
                  à EMPRESA contratante e seus representantes:</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 text-red-800">
                  <li><strong>Direito perpétuo e irrevogável</strong> de uso de todos os ativos produzidos</li>
                  <li><strong>Direito de imagem completo</strong> para uso comercial e promocional</li>
                  <li><strong>Licença mundial e exclusiva</strong> para reprodução, distribuição e exibição</li>
                  <li><strong>Direito de modificação</strong> e adaptação do conteúdo conforme necessário</li>
                  <li><strong>Uso em qualquer mídia</strong> (digital, impressa, televisiva, etc.) sem limitação temporal</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-3">3.1 Transferência de Direitos</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                O criador entende e concorda que, uma vez entregue o conteúdo e recebido o pagamento acordado:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                <li>A empresa adquire todos os direitos comerciais sobre o conteúdo produzido</li>
                <li>O criador não poderá revogar ou limitar o uso futuro do conteúdo</li>
                <li>A empresa pode usar o conteúdo sem necessidade de aprovação adicional</li>
                <li>Não há limitação geográfica ou temporal para o uso dos ativos</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mb-3">3.2 Exceções e Limitações</h3>
              <p className="text-gray-700 leading-relaxed">
                O criador mantém o direito de incluir o trabalho em seu portfólio pessoal, desde que não interfira 
                com os direitos comerciais da empresa contratante.
              </p>
            </section>

            {/* Seção 4: Responsabilidades dos Usuários */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Responsabilidades dos Usuários</h2>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-3">4.1 Criadores de Conteúdo</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                <li>Entregar conteúdo original e de qualidade conforme especificado</li>
                <li>Cumprir prazos estabelecidos nas oportunidades</li>
                <li>Garantir que possuem todos os direitos necessários para o conteúdo produzido</li>
                <li>Não infringir direitos autorais de terceiros</li>
                <li>Manter confidencialidade sobre informações da campanha quando solicitado</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mb-3">4.2 Analistas e Empresas</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                <li>Fornecer briefings claros e completos</li>
                <li>Efetuar pagamentos conforme acordado</li>
                <li>Respeitar os prazos de avaliação de conteúdo</li>
                <li>Usar o conteúdo de forma ética e legal</li>
                <li>Manter a confidencialidade de dados pessoais dos criadores</li>
              </ul>
            </section>

            {/* Seção 5: Pagamentos e Cancelamentos */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Pagamentos e Cancelamentos</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Os pagamentos serão processados após a aprovação final do conteúdo pela empresa contratante. 
                Em caso de cancelamento da campanha, as partes devem negociar uma compensação justa pelo trabalho já realizado.
              </p>
              <p className="text-gray-700 leading-relaxed">
                A plataforma Influenciando atua como intermediária, mas não é responsável por disputas contratuais entre as partes.
              </p>
            </section>

            {/* Seção 6: Limitação de Responsabilidade */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Limitação de Responsabilidade</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A Influenciando fornece a plataforma "como está" e não garante resultados específicos das campanhas. 
                Nossa responsabilidade é limitada ao funcionamento técnico da plataforma.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Não nos responsabilizamos por disputas contratuais, qualidade do conteúdo, ou questões legais 
                decorrentes do uso dos ativos produzidos.
              </p>
            </section>

            {/* Seção 7: Modificações */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Modificações dos Termos</h2>
              <p className="text-gray-700 leading-relaxed">
                Reservamos o direito de modificar estes termos a qualquer momento. Usuários serão notificados 
                sobre mudanças significativas e deverão aceitar os novos termos para continuar usando a plataforma.
              </p>
            </section>

            {/* Seção 8: Contato */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Contato</h2>
              <p className="text-gray-700 leading-relaxed">
                Para dúvidas sobre estes termos, entre em contato conosco através do email: 
                <a href="mailto:legal@influenciando.com" className="text-[#00FF41] hover:text-[#00CC34] font-medium">
                  legal@influenciando.com
                </a>
              </p>
            </section>

      </div>

      {/* Footer */}
      <div className="text-center mt-8 text-gray-500 text-sm">
        <p>© 2025 Influenciando. Todos os direitos reservados.</p>
      </div>
    </div>
  );
};

export default TermsOfService;