import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import ModalPortal from './ModalPortal';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string) => Promise<void>;
  isSubmitting: boolean;
  title?: string;
}

const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  title = "Avaliar Projeto"
}) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    await onSubmit(rating, feedback);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <div className="glass-card max-w-md w-full p-6 sm:p-7 relative animate-in fade-in zoom-in duration-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <h3 className="text-xl font-semibold text-white/95 text-center mb-2">{title}</h3>
          <p className="text-sm text-gray-400 text-center mb-6">
            Como foi sua experiência neste projeto? Sua avaliação ajuda a melhorar a plataforma.
          </p>

          <div className="flex justify-center space-x-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= (hoverRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-600'
                  } transition-colors duration-200`}
                />
              </button>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">
              Feedback (Opcional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Compartilhe detalhes sobre sua experiência..."
              className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF41]/50 focus:ring-1 focus:ring-[#00FF41]/50 resize-none transition-all"
            />
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className={`btn-primary-glow w-full justify-center py-3 text-base ${
                (rating === 0 || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </span>
              ) : (
                'Enviar Avaliação'
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-ghost-glass w-full justify-center py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RatingModal;
