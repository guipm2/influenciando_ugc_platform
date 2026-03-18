import React from 'react';
import { Play, Clock, Star, Users, Lock } from 'lucide-react';

const Training = () => {
  const courses = [
    {
      id: 1,
      title: 'Criação de Conteúdo para Instagram',
      description: 'Aprenda as melhores práticas para criar conteúdo engajador no Instagram',
      duration: '2h 30min',
      rating: 4.8,
      students: 1250,
      thumbnail: 'https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop',
      progress: 75
    },
    {
      id: 2,
      title: 'Negociação com Marcas',
      description: 'Como negociar contratos e valores justos com empresas',
      duration: '1h 45min',
      rating: 4.9,
      students: 890,
      thumbnail: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop',
      progress: 0
    },
    {
      id: 3,
      title: 'Análise de Métricas e Performance',
      description: 'Entenda como analisar suas métricas e melhorar sua performance',
      duration: '3h 15min',
      rating: 4.7,
      students: 2100,
      thumbnail: 'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop',
      progress: 30
    }
  ];

  return (
    <div className="space-y-6 relative">
      {/* Blur Overlay */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md mx-4 border border-gray-200">
          <div className="w-16 h-16 bg-[#00FF41]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-[#00FF41]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Em Breve</h2>
          <p className="text-gray-600 mb-4">
            Estamos preparando conteúdos incríveis para acelerar sua carreira como criador de conteúdo.
          </p>
          <div className="bg-[#00FF41]/10 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-black mb-2">O que você encontrará:</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Cursos de criação de conteúdo</li>
              <li>• Técnicas de negociação</li>
              <li>• Análise de métricas</li>
              <li>• Estratégias de crescimento</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Treinamentos</h1>
        <p className="text-gray-600 mt-1">Desenvolva suas habilidades como criador de conteúdo</p>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer"
          >
            {/* Thumbnail */}
            <div className="relative">
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Play className="h-12 w-12 text-white" />
              </div>
              {course.progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50">
                  <div className="h-1 bg-gray-300">
                    <div 
                      className="h-full bg-[#00FF41] transition-all duration-300"
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-2">{course.title}</h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {course.duration}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  {course.rating}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {course.students}
                </div>
              </div>

              {course.progress > 0 ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progresso</span>
                    <span className="text-[#00FF41] font-medium">{course.progress}%</span>
                  </div>
                  <button className="w-full bg-[#00FF41] hover:bg-[#00CC34] text-black py-2 px-4 rounded-lg font-medium transition-colors">
                    Continuar
                  </button>
                </div>
              ) : (
                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 px-4 rounded-lg font-medium transition-colors">
                  Começar Curso
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Seu Progresso</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#00FF41]">3</div>
            <div className="text-sm text-gray-600">Cursos Iniciados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">1</div>
            <div className="text-sm text-gray-600">Cursos Concluídos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#00FF41]">8h</div>
            <div className="text-sm text-gray-600">Tempo de Estudo</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;