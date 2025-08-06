import React, { useState, useEffect } from 'react';
import { campaignService, productService, handleApiError } from '../../services/api';
import { 
  ArrowLeft, 
  Heart, 
  Plus, 
  Minus, 
  Check, 
  AlertCircle,
  Gift,
  Users,
  Target,
  ChevronRight
} from 'lucide-react';

const DonationFlow = ({ onBack, campaignId = null }) => {
  const [step, setStep] = useState(1); // 1: Select Campaign, 2: Select Items, 3: Confirm
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [donationItems, setDonationItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (campaignId) {
      loadSpecificCampaign(campaignId);
    }
  }, [campaignId]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await campaignService.getActive();
      setCampaigns(data.campaigns || []);
      
      if (campaignId) {
        const campaign = data.campaigns?.find(c => c.id === campaignId);
        if (campaign) {
          setSelectedCampaign(campaign);
          setStep(2);
        }
      }
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificCampaign = async (id) => {
    try {
      const data = await campaignService.getById(id);
      setSelectedCampaign(data.campaign);
      setStep(2);
    } catch (error) {
      setError(handleApiError(error));
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

  const addDonationItem = (itemName, unit) => {
    const existingItem = donationItems.find(item => item.name === itemName);
    if (existingItem) {
      setDonationItems(donationItems.map(item =>
        item.name === itemName 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setDonationItems([...donationItems, {
        name: itemName,
        quantity: 1,
        unit: unit,
        estimatedValue: 0
      }]);
    }
  };

  const updateDonationQuantity = (itemName, quantity) => {
    if (quantity <= 0) {
      setDonationItems(donationItems.filter(item => item.name !== itemName));
    } else {
      setDonationItems(donationItems.map(item =>
        item.name === itemName 
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const getTotalEstimatedValue = () => {
    return donationItems.reduce((total, item) => total + (item.estimatedValue * item.quantity), 0);
  };

  const renderCampaignSelection = () => (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hacer Donación</h1>
          <p className="text-sm text-gray-600">Selecciona una campaña para ayudar</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-32"></div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12">
          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay campañas activas</h3>
          <p className="text-gray-600">No hay campañas disponibles para donaciones en este momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => (
            <button
              key={campaign.id}
              onClick={() => {
                setSelectedCampaign(campaign);
                setStep(2);
              }}
              className="w-full bg-white rounded-lg border p-4 shadow-sm text-left"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{campaign.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{campaign.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 ml-2 mt-1" />
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Progreso</span>
                  <span className="font-medium">
                    {getProgressPercentage(campaign.raisedAmount, campaign.targetAmount).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage(campaign.raisedAmount, campaign.targetAmount)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatCurrency(campaign.raisedAmount)}</span>
                  <span>{formatCurrency(campaign.targetAmount)}</span>
                </div>
              </div>

              {/* Most needed items */}
              {campaign.goals && Object.keys(campaign.goals).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(campaign.goals).slice(0, 3).map(([item, goal]) => {
                    const progress = campaign.currentProgress?.[item] || { received: 0 };
                    const remaining = Math.max(0, goal.needed - progress.received);
                    
                    return (
                      <div key={item} className="bg-red-50 border border-red-200 rounded px-2 py-1">
                        <p className="text-xs font-medium text-red-800 capitalize">{item}</p>
                        <p className="text-xs text-red-600">Faltan: {remaining} {goal.unit}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderItemSelection = () => (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStep(1)} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Seleccionar Artículos</h1>
          <p className="text-sm text-gray-600">{selectedCampaign?.title}</p>
        </div>
      </div>

      {/* Campaign needs */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Lo que más necesitamos
        </h3>
        <div className="space-y-3">
          {selectedCampaign?.goals && Object.entries(selectedCampaign.goals).map(([item, goal]) => {
            const progress = selectedCampaign.currentProgress?.[item] || { received: 0 };
            const remaining = Math.max(0, goal.needed - progress.received);
            const percentage = getProgressPercentage(progress.received, goal.needed);
            
            return (
              <div key={item} className="bg-white rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 capitalize">{item}</h4>
                  <button
                    onClick={() => addDonationItem(item, goal.unit)}
                    className="bg-green-600 text-white p-1 rounded-full"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progreso: {progress.received} / {goal.needed} {goal.unit}</span>
                  <span>{percentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${percentage >= 100 ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                {remaining > 0 && (
                  <p className="text-xs text-red-600 mt-1">Faltan: {remaining} {goal.unit}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected items */}
      {donationItems.length > 0 && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-green-600" />
            Tu Donación
          </h3>
          <div className="space-y-3">
            {donationItems.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 capitalize">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.unit}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateDonationQuantity(item.name, item.quantity - 1)}
                    className="bg-gray-100 p-1 rounded-full"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="font-medium text-lg min-w-[2rem] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateDonationQuantity(item.name, item.quantity + 1)}
                    className="bg-gray-100 p-1 rounded-full"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue button */}
      {donationItems.length > 0 && (
        <button
          onClick={() => setStep(3)}
          className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold text-lg"
        >
          Continuar con la Donación
        </button>
      )}
    </div>
  );

  const renderConfirmation = () => (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStep(2)} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Confirmar Donación</h1>
          <p className="text-sm text-gray-600">Revisa tu donación antes de confirmar</p>
        </div>
      </div>

      {/* Campaign info */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <h3 className="font-semibold text-gray-900 mb-2">{selectedCampaign?.title}</h3>
        <p className="text-sm text-gray-600">{selectedCampaign?.description}</p>
      </div>

      {/* Donation summary */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Gift className="w-5 h-5 text-green-600" />
          Resumen de tu Donación
        </h3>
        <div className="space-y-3">
          {donationItems.map(item => (
            <div key={item.name} className="flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900 capitalize">{item.name}</p>
                <p className="text-sm text-gray-600">{item.quantity} {item.unit}</p>
              </div>
              {item.estimatedValue > 0 && (
                <p className="font-medium text-green-600">
                  {formatCurrency(item.estimatedValue * item.quantity)}
                </p>
              )}
            </div>
          ))}
        </div>
        
        {getTotalEstimatedValue() > 0 && (
          <div className="border-t pt-3 mt-3">
            <div className="flex justify-between items-center">
              <p className="font-semibold text-gray-900">Valor Estimado Total</p>
              <p className="font-bold text-green-600 text-lg">
                {formatCurrency(getTotalEstimatedValue())}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Impact message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Users className="w-6 h-6 text-green-600 mt-1" />
          <div>
            <h4 className="font-semibold text-green-900 mb-1">Tu Impacto</h4>
            <p className="text-sm text-green-800">
              Con esta donación ayudarás a alimentar aproximadamente{' '}
              <span className="font-semibold">
                {Math.ceil(donationItems.reduce((total, item) => total + item.quantity, 0) / 3)} familias
              </span>{' '}
              de nuestra comunidad. ¡Gracias por tu generosidad!
            </p>
          </div>
        </div>
      </div>

      {/* Confirm button */}
      <button
        onClick={() => {
          // TODO: Implement donation submission
          alert('¡Donación confirmada! Gracias por tu generosidad.');
          onBack();
        }}
        className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2"
      >
        <Heart className="w-5 h-5" />
        Confirmar Donación
      </button>

      <p className="text-xs text-gray-500 text-center mt-3">
        Al confirmar, te contactaremos para coordinar la recolección de tu donación.
      </p>
    </div>
  );

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Error</h1>
        </div>
        
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Algo salió mal</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadCampaigns}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {step === 1 && renderCampaignSelection()}
      {step === 2 && renderItemSelection()}
      {step === 3 && renderConfirmation()}
    </div>
  );
};

export default DonationFlow;