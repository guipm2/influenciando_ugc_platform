import React from 'react';
import { MessageCircle, Mail, Phone, FileText } from 'lucide-react';

const Help = () => {
  const faqs = [
    {
      question: 'Como me candidato a uma oportunidade?',
      answer: 'Para se candidatar, acesse a seção "Oportunidades", encontre uma campanha de seu interesse e clique em "Candidatar-se". Certifique-se de que seu perfil está completo.'
    },
    {
      question: 'Como funciona o pagamento?',
      answer: 'Os pagamentos são processados após a conclusão e aprovação da campanha. O valor é transferido diretamente para sua conta bancária cadastrada.'
    },
    {
      question: 'Posso negociar os valores?',
      answer: 'Sim! Você pode entrar em contato com a empresa através do chat para discutir valores e condições da campanha.'
    },
    {
      question: 'Como conectar meu Instagram?',
      answer: 'Vá até seu perfil e clique em "Conectar Instagram". Você será redirecionado para autorizar a conexão com sua conta.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Ajuda</h1>
        <p className="text-gray-600 mt-1">Encontre respostas para suas dúvidas ou entre em contato conosco</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FAQ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Perguntas Frequentes</h3>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                <h4 className="font-medium text-gray-900 mb-2">{faq.question}</h4>
                <p className="text-gray-600 text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Entre em Contato</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <MessageCircle className="h-5 w-5 text-[#00FF41]" />
                <div>
                  <div className="font-medium text-gray-900">Chat ao Vivo</div>
                  <div className="text-sm text-gray-600">Resposta em até 5 minutos</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <Mail className="h-5 w-5 text-[#00FF41]" />
                <div>
                  <div className="font-medium text-gray-900">Email</div>
                  <div className="text-sm text-gray-600">contato@influenciando.com</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <Phone className="h-5 w-5 text-[#00FF41]" />
                <div>
                  <div className="font-medium text-gray-900">Telefone</div>
                  <div className="text-sm text-gray-600">(27) 99263-0725</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Recursos</h3>
            <div className="space-y-3">
              <a href="#" className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-gray-600" />
                <span className="text-gray-900">Guia do Criador</span>
              </a>
              <a href="#" className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-gray-600" />
                <span className="text-gray-900">Termos de Uso</span>
              </a>
              <a href="#" className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-gray-600" />
                <span className="text-gray-900">Política de Privacidade</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;