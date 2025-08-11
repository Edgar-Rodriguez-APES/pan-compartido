import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Calendar, Target, Users, DollarSign, ArrowLeft } from 'lucide-react';
import api from '../services/api';

const CampaignForm = ({ tenantId, campaignId = null, onSave, onCancel }) => {
  const [campaign, setCampaign] = useState({
    title: '',
    description: '',
    goals: {},
    frequency: 'weekly',
    startDate: '',
    endDate: '',
    targetFamilies: '',
    targetAmount: ''
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const isEditing = !!campaignId;

  useEffect(() => {
    loadProducts();
    if (isEditing) {
      loadCampaign();
    } else {
      // Set default dates for new campaigns
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      setCampaign(prev => ({
        ...prev,
        startDate: today.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0]
      }));
    }
  }, [campaignId, tenantId]);

  const loadProducts = async () => {
    try {
      const response = await api.get('/products', {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  };

  const loadCampaign = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/campaigns/${campaignId}`, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      
      const campaignData = response.data.campaign;
      setCampaign({
        title: campaignData.title || '',
        description: campaignData.description || '',
        goals: campaignData.goals || {},
        frequency: campaignData.frequency || 'weekly',
        startDate: campaignData.startDate ? campaignData.startDate.split('T')[0] : '',
        endDate: campaignData.endDate ? campaignData.endDate.split('T')[0] : '',
        targetFamilies: campaignData.targetFamilies || '',
        targetAmount: campaignData.targetAmount || ''
      });
    } catch (error) {
      console.error('Error cargando campaña:', error);
      setErrors({ general: 'Error cargando la campaña' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setCampaign(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleGoalChange = (productId, field, value) => {
    setCampaign(prev => ({
      ...prev,
      goals: {
        ...prev.goals,
        [productId]: {
          ...prev.goals[productId],
          [field]: field === 'needed' || field === 'estimated_price' ? parseFloat(value) || 0 : value
        }
      }
    }));
  };

  const addProductGoal = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCampaign(prev => ({
      ...prev,
      goals: {
        ...prev.goals,
        [productId]: {
          needed: 0,
          unit: product.unit,
          estimated_price: product.estimated_price || 0
        }
      }
    }));
  };

  const removeProductGoal = (productId) => {
    setCampaign(prev => {
      const newGoals = { ...prev.goals };
      delete newGoals[productId];
      return {
        ...prev,
        goals: newGoals
      };
    });
  };

  const calculateTargetAmount = () => {
    let total = 0;
    Object.keys(campaign.goals).forEach(productId => {
      const goal = campaign.goals[productId];
      if (goal.needed && goal.estimated_price) {
        total += goal.needed * goal.estimated_price;
      }
    });
    return total;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!campaign.title.trim()) {
      newErrors.title = 'El título es requerido';
    }

    if (Object.keys(campaign.goals).length === 0) {
      newErrors.goals = 'Debe agregar al menos una meta de producto';
    }

    // Validate goals
    Object.keys(campaign.goals).forEach(productId => {
      const goal = campaign.goals[productId];
      if (!goal.needed || goal.needed <= 0) {
        newErrors[`goal_${productId}`] = 'La cantidad debe ser mayor a 0';
      }
    });

    if (campaign.startDate && campaign.endDate) {
      if (new Date(campaign.startDate) >= new Date(campaign.endDate)) {
        newErrors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      
      const campaignData = {
        ...campaign,
        targetAmount: campaign.targetAmount || calculateTargetAmount(),
        targetFamilies: parseInt(campaign.targetFamilies) || 0
      };

      let response;
      if (isEditing) {
        response = await api.put(`/campaigns/${campaignId}`, campaignData, {
          headers: { 'X-Tenant-ID': tenantId }
        });
      } else {
        response = await api.post('/campaigns', campaignData, {
          headers: { 'X-Tenant-ID': tenantId }
        });
      }

      if (onSave) {
        onSave(response.data.campaign);
      } else {
        alert(`Campaña ${isEditing ? 'actualizada' : 'creada'} exitosamente`);
        window.location.href = '/campaigns';
      }
    } catch (error) {
      console.error('Error guardando campaña:', error);
      setErrors({ 
        general: error.response?.data?.message || `Error ${isEditing ? 'actualizando' : 'creando'} la campaña` 
      });
    } finally {
      setSaving(false);
    }
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : productId;
  };

  const availableProducts = products.filter(product => 
    !campaign.goals[product.id]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando campaña...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={onCancel || (() => window.history.back())}
            className="mr-4 p-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Editar Campaña' : 'Nueva Campaña'}
            </h1>
            <p className="text-gray-600">
              {isEditing ? 'Modifica los detalles de la campaña' : 'Crea una nueva campaña de donación'}
            </p>
          </div>
        </div>
      </div>

      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{errors.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Target className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold">Información Básica</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Título de la Campaña *
              </label>
              <input
                type="text"
                value={campaign.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Ej: Mercados Solidarios - Semana 15"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={campaign.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe el propósito y objetivos de esta campaña..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frecuencia
              </label>
              <select
                value={campaign.frequency}
                onChange={(e) => handleInputChange('frequency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Familias Objetivo
              </label>
              <input
                type="number"
                value={campaign.targetFamilies}
                onChange={(e) => handleInputChange('targetFamilies', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Número de familias a ayudar"
                min="1"
              />
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Calendar className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold">Fechas</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Inicio
              </label>
              <input
                type="date"
                value={campaign.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Fin
              </label>
              <input
                type="date"
                value={campaign.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.endDate ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Product Goals */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-gray-600" />
              <h2 className="text-lg font-semibold">Metas de Productos</h2>
            </div>
            
            {availableProducts.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addProductGoal(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Agregar producto...</option>
                {availableProducts.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {errors.goals && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 text-sm">{errors.goals}</p>
            </div>
          )}

          <div className="space-y-4">
            {Object.keys(campaign.goals).map(productId => {
              const goal = campaign.goals[productId];
              return (
                <div key={productId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{getProductName(productId)}</h3>
                    <button
                      type="button"
                      onClick={() => removeProductGoal(productId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cantidad Necesaria *
                      </label>
                      <input
                        type="number"
                        value={goal.needed || ''}
                        onChange={(e) => handleGoalChange(productId, 'needed', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors[`goal_${productId}`] ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                      {errors[`goal_${productId}`] && (
                        <p className="mt-1 text-sm text-red-600">{errors[`goal_${productId}`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unidad
                      </label>
                      <input
                        type="text"
                        value={goal.unit || ''}
                        onChange={(e) => handleGoalChange(productId, 'unit', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="kg, litros, unidades..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Precio Estimado
                      </label>
                      <input
                        type="number"
                        value={goal.estimated_price || ''}
                        onChange={(e) => handleGoalChange(productId, 'estimated_price', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  {goal.needed && goal.estimated_price && (
                    <div className="mt-2 text-sm text-gray-600">
                      Subtotal: ${(goal.needed * goal.estimated_price).toLocaleString('es-CO')}
                    </div>
                  )}
                </div>
              );
            })}

            {Object.keys(campaign.goals).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay productos agregados</p>
                <p className="text-sm">Usa el selector de arriba para agregar productos a la campaña</p>
              </div>
            )}
          </div>

          {Object.keys(campaign.goals).length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-blue-900">Monto Total Estimado:</span>
                <span className="text-xl font-bold text-blue-900">
                  ${calculateTargetAmount().toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel || (() => window.history.back())}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Campaña')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CampaignForm;