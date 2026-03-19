import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAnalystAuth } from '../../contexts/AnalystAuthContext';
import ModalPortal from '../common/ModalPortal';
import { Clock, X } from 'lucide-react';

interface TimeLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverableId: string;
  deliverableTitle: string;
  onSuccess?: () => void;
}

const TimeLogModal: React.FC<TimeLogModalProps> = ({
  isOpen,
  onClose,
  deliverableId,
  deliverableTitle,
  onSuccess
}) => {
  const { user } = useAnalystAuth();
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hours || !date) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('time_entries')
        .insert({
          deliverable_id: deliverableId,
          user_id: user.id,
          hours: parseFloat(hours),
          date,
          description
        });

      if (error) throw error;

      if (onSuccess) onSuccess();
      onClose();
      // Reset form
      setHours('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error logging time:', error);
      alert('Erro ao registrar horas');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#00FF41]" />
              Registrar Tempo
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
             <p className="text-sm text-gray-500">Deliverable</p>
             <p className="font-medium text-gray-900 line-clamp-1">{deliverableTitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00FF41] focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Horas Gastas *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00FF41] focus:border-transparent transition-all"
                placeholder="Ex: 1.5"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00FF41] focus:border-transparent transition-all"
                placeholder="O que foi feito..."
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-[#00FF41] hover:bg-[#00CC34] text-black rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default TimeLogModal;
