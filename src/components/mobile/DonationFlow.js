import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { campaignService, donationService, handleApiError } from '../../services/api';
import {
  ArrowLeft,
  Heart,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Package,
  Users,
  Target,
  Calendar,
  Send
} from 'lucide-react';

const DonationFlow = ({ campaignId, onBack, onComplete }) => {
  const { user, tenant } = useAuth();
  const [step, setStep] = useState(1); // 1: Select items, 2: Review, 3: Confirm
  const [campaign, setCampaign] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCampaign();
  }, [campaignId]);

  const loadCampaign = async () => {
    try {
      setLoading(true);
      const response = await campaignService.getById(campaignId);
      setCampaign(response.campaign);
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleItemQuantityChange = (itemName, quantity) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemName]: Math.max(0, quantity)
    }));
  };

  const getTotalSelectedItems = () => {
    return Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);
  };

  const getSelectedItemsList = () => {
    return Object.entries(selectedItems)
      .filter(([_, quantity]) => quantity > 0)
      .map(([itemName, quantity]) => {
        const goal = campaign.goals[itemName];
        return {
          name: itemName,
          quantity,
          unit: goal?.unit || 'unidades'
        };
      });
  };

  const handleSubmitDonation = async () => {
    try {
      setSubmitting(true);

      const donationData = {
        campaignId: campaign.id,
        items: getSelectedItemsList(),
        source: 'mobile_app'
      };

      await donationService.create(donationData);

      setStep(3); // Success step

      // Auto-complete after 3 seconds
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 3000);

    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getProgressPercentage = (current, target) => {
    if (!target || target === 0) return 0;
    return Math.min(100, (current / target) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando campaña...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={loadCampaign}
              className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Reintentar
            </button>
            <button
              onClick={onBack}
              className="block w-full px-4 py-2 bg-gray-500 text-white rounded-lg"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Campaña no encontrada</h3>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const renderHeader = () => (
    <div className="bg-white border-b border-gray-200 px-4 py-3 safe-area-top">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Hacer Donación</h1>
          <p className="text-sm text-gray-600">Paso {step} de 3</p>
        </div>
      </div>
    </div>
  );

  const renderStepIndicator = () => (
    <div className="px-4 py-3 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between">
        {[1, 2, 3].map(stepNumber => (
          <div key={stepNumber} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${stepNumber <= step
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-600'
              }`}>
              {stepNumber < step ? <Check size={16} /> : stepNumber}
            </div>
            {stepNumber < 3 && (
              <div className={`w-12 h-1 mx-2 ${stepNumber < step ? 'bg-blue-600' : 'bg-gray-200'
                }`}></div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 text-center">
        <p className="text-sm font-medium text-gray-900">
          {step === 1 && 'Selecciona qué donar'}
          {step === 2 && 'Revisa tu donación'}
          {step === 3 && '¡Donación confirmada!'}
        </p>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Campaign Info */}
      <div className="bg-white p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{campaign.title}</h2>
        <p className="text-gray-600 mb-3">{campaign.description}</p>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Progreso de la campaña</span>
            <span className="font-medium">
              {formatCurrency(campaign.raisedAmount || 0)} / {formatCurrency(campaign.targetAmount || 0)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${getProgressPercentage(campaign.raisedAmount, campaign.targetAmount)}%`
              }}
            ></div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Users size={14} />
            <span>{campaign.stats?.uniqueDonors || 0} donantes</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={14} />
            <span>{campaign.stats?.daysRemaining || 0} días restantes</span>
          </div>
        </div>
      </div>

      {/* Items Selection */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">¿Qué quieres donar?</h3>

        <div className="space-y-4">
          {Object.entries(campaign.goals || {}).map(([itemName, goal]) => {
            const progress = campaign.currentProgress?.[itemName] || { received: 0 };
            const remaining = Math.max(0, goal.needed - progress.received);
            const selectedQty = selectedItems[itemName] || 0;

            return (
              <div key={itemName} className="bg-white p-4 rounded-xl border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold capitalize text-gray-900">{itemName}</h4>
                    <p className="text-sm text-gray-600">
                      Faltan: {remaining} {goal.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {progress.received} / {goal.needed}
                    </p>
                    <div className="w-16 bg-gray-200 rounded-full h-1 mt-1">
                      <div
                        className="bg-green-500 h-1 rounded-full"
                        style={{ width: `${getProgressPercentage(progress.received, goal.needed)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleItemQuantityChange(itemName, selectedQty - 1)}
                      disabled={selectedQty === 0}
                      className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-50"
                    >
                      <Minus size={16} />
                    </button>

                    <div className="text-center min-w-[3rem]">
                      <p className="text-lg font-bold text-gray-900">{selectedQty}</p>
                      <p className="text-xs text-gray-600">{goal.unit}</p>
                    </div>

                    <button
                      onClick={() => handleItemQuantityChange(itemName, selectedQty + 1)}
                      disabled={selectedQty >= remaining}
                      className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50"
                      style={{ backgroundColor: tenant?.branding?.colors?.primary || '#2563eb' }}
                    >
                      <Plus size={16} className="text-white" />
                    </button>
                  </div>

                  {selectedQty > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Check size={16} />
                      <span className="text-sm font-medium">Seleccionado</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Continue Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-bottom">
        <button
          onClick={() => setStep(2)}
          disabled={getTotalSelectedItems() === 0}
          className="w-full py-3 px-4 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: tenant?.branding?.colors?.primary || '#2563eb' }}
        >
          Continuar ({getTotalSelectedItems()} items seleccionados)
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const selectedItemsList = getSelectedItemsList();

    return (
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revisa tu donación</h3>

          {/* Campaign Summary */}
          <div className="bg-white p-4 rounded-xl border mb-4">
            <h4 className="font-semibold text-gray-900 mb-2">{campaign.title}</h4>
            <p className="text-sm text-gray-600">{campaign.description}</p>
          </div>

          {/* Selected Items */}
          <div className="bg-white p-4 rounded-xl border mb-4">
            <h4 className="font-semibold text-gray-900 mb-3">Artículos a donar:</h4>
            <div className="space-y-3">
              {selectedItemsList.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Package size={16} className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium capitalize text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.unit}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">{item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Impact Message */}
          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800">Tu impacto</span>
            </div>
            <p className="text-sm text-green-700">
              Con esta donación ayudarás a alimentar familias necesitadas de nuestra comunidad.
              ¡Cada contribución cuenta y hace la diferencia!
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-bottom">
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 px-4 rounded-xl font-semibold text-gray-700 bg-gray-100 transition-colors"
            >
              Volver
            </button>
            <button
              onClick={handleSubmitDonation}
              disabled={submitting}
              className="flex-2 py-3 px-4 rounded-xl font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: tenant?.branding?.colors?.primary || '#2563eb' }}
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Confirmando...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Send size={16} />
                  Confirmar Donación
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check size={32} className="text-green-600" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">¡Donación Confirmada!</h2>
        <p className="text-gray-600 mb-6">
          Gracias por tu generosidad. Tu donación ha sido registrada y ayudará a familias necesitadas.
        </p>

        <div className="bg-green-50 p-4 rounded-xl border border-green-200 mb-6">
          <p className="text-sm text-green-700">
            Recibirás una confirmación por WhatsApp con los detalles de tu donación.
          </p>
        </div>

        <button
          onClick={onComplete}
          className="w-full py-3 px-4 rounded-xl font-semibold text-white transition-colors"
          style={{ backgroundColor: tenant?.branding?.colors?.primary || '#2563eb' }}
        >
          Continuar
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {renderHeader()}
      {renderStepIndicator()}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
};

export default DonationFlow;