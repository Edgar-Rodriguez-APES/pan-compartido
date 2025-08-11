import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Edit, 
  Play, 
  Square, 
  X, 
  TrendingUp, 
  Users, 
  Calendar, 
  Target,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Activity
} from 'lucide-react';
import api from '../services/api';

const CampaignDetails = ({ tenantId, campaignId, onEdit, onBack }) => {
  const [campaign, setCampaign] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadCampaignDetails();
  }, [campaignId, tenantId]);

  const loadCampaignDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/campaigns/${campaignId}?includeStats=true`, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setCampaign(response.data.campaign);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error cargando detalles de campaña:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!confirm('¿Estás seguro de que quieres activar esta campaña?')) {
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/campaigns/${campaignId}/activate`, {}, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      await loadCampaignDetails();
      alert('Campaña activada exitosamente');
    } catch (error) {
      console.error('Error activando campaña:', error);
      alert('Error activando campaña: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('¿Estás seguro de que quieres completar esta campaña?')) {
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/campaigns/${campaignId}/complete`, {}, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      await loadCampaignDetails();
      alert('Campaña completada exitosamente');
    } catch (error) {
      console.error('Error completando campaña:', error);
      alert('Error completando campaña: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    const reason = prompt('¿Por qué quieres cancelar esta campaña? (opcional)');
    if (reason === null) return; // User clicked cancel

    try {
      setActionLoading(true);
      await api.post(`/campaigns/${campaignId}/cancel`, { reason }, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      await loadCampaignDetails();
      alert('Campaña cancelada exitosamente');
    } catch (error) {
      console.error('Error cancelando campaña:', error);
      alert('Error cancelando campaña: ' + (error.response?.data?.message || error.message));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const texts = {
      draft: 'Borrador',
      active: 'Activa',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    return texts[status] || status;
  };

  const getStatusIcon = (status) => {
    const icons = {
      draft: Edit,
      active: Activity,
      completed: CheckCircle,
      cancelled: X
    };
    return icons[status] || Edit;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const canActivate = campaign?.status === 'draft';
  const canComplete = campaign?.status === 'active';
  const canCancel = campaign?.status === 'draft' || campaign?.status === 'active';
  const canEdit = campaign?.status !== 'completed';

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando detalles...</span>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Error cargando los detalles de la campaña</p>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(campaign.status);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack || (() => window.history.back())}
            className="mr-4 p-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center mb-2">
              <h1 className="text-2xl font-bold text-gray-900 mr-3">{campaign.title}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(campaign.status)}`}>
                <StatusIcon className="w-4 h-4 mr-1" />
                {getStatusText(campaign.status)}
              </span>
            </div>
            <p className="text-gray-600">{campaign.description}</p>
          </div>
        </div>

        <div className="flex space-x-2">
          {canEdit && (
            <button
              onClick={onEdit || (() => window.location.href = `/campaigns/${campaignId}/edit`)}
              className="flex items-center px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </button>
          )}

          {canActivate && (
            <button
              onClick={handleActivate}
              disabled={actionLoading}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4 mr-2" />
              Activar
            </button>
          )}

          {canComplete && (
            <button
              onClick={handleComplete}
              disabled={actionLoading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Square className="w-4 h-4 mr-2" />
              Completar
            </button>
          )}

          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="w-5 h-5 mr-2 text-gray-600" />
          <h2 className="text-lg font-semibold">Progreso General</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{Math.round(campaign.completionPercentage)}%</div>
            <div className="text-sm text-gray-600">Completado</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{formatCurrency(campaign.raisedAmount)}</div>
            <div className="text-sm text-gray-600">Recaudado</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{campaign.daysRemaining}</div>
            <div className="text-sm text-gray-600">Días Restantes</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">{stats?.donations || 0}</div>
            <div className="text-sm text-gray-600">Donaciones</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progreso hacia la meta</span>
            <span>{formatCurrency(campaign.raisedAmount)} / {formatCurrency(campaign.targetAmount)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(campaign.completionPercentage)}`}
              style={{ width: `${Math.min(campaign.completionPercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {campaign.impactMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">{campaign.impactMessage}</p>
          </div>
        )}
      </div>

      {/* Campaign Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Calendar className="w-5 h-5 mr-2 text-gray-600" />
            <h3 className="text-lg font-semibold">Información</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Frecuencia</label>
              <p className="text-gray-900 capitalize">{campaign.frequency}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Fecha de Inicio</label>
              <p className="text-gray-900">{formatDate(campaign.startDate)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Fecha de Fin</label>
              <p className="text-gray-900">{formatDate(campaign.endDate)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Familias Objetivo</label>
              <p className="text-gray-900">{campaign.targetFamilies || 'No especificado'}</p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Activity className="w-5 h-5 mr-2 text-gray-600" />
              <h3 className="text-lg font-semibold">Estadísticas</h3>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Donaciones</span>
                <span className="font-semibold">{stats.donations}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Donantes Únicos</span>
                <span className="font-semibold">{stats.uniqueDonors}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Donación Promedio</span>
                <span className="font-semibold">{formatCurrency(stats.averageDonation)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Estado</span>
                <span className={`font-semibold ${stats.isActive ? 'text-green-600' : 'text-gray-600'}`}>
                  {stats.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Urgent Needs */}
        {campaign.urgentNeeds && campaign.urgentNeeds.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
              <h3 className="text-lg font-semibold">Necesidades Urgentes</h3>
            </div>

            <div className="space-y-3">
              {campaign.urgentNeeds.map((need, index) => (
                <div key={index} className="border border-orange-200 bg-orange-50 rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-orange-900">{need.productId}</span>
                    <span className="text-sm text-orange-700">{Math.round(need.percentage)}%</span>
                  </div>
                  <div className="text-sm text-orange-700">
                    Faltan {need.remaining} {need.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Progress */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Target className="w-5 h-5 mr-2 text-gray-600" />
          <h3 className="text-lg font-semibold">Progreso por Producto</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaign.productProgress.map((product, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-900">{product.productId}</h4>
                <span className="text-sm font-medium text-gray-600">
                  {Math.round(product.percentage)}%
                </span>
              </div>

              <div className="mb-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(product.percentage)}`}
                    style={{ width: `${Math.min(product.percentage, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Recibido:</span>
                  <span>{product.received} {product.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Necesario:</span>
                  <span>{product.needed} {product.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Restante:</span>
                  <span className={product.remaining > 0 ? 'text-orange-600' : 'text-green-600'}>
                    {product.remaining} {product.unit}
                  </span>
                </div>
                {product.estimatedPrice > 0 && (
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span>Valor:</span>
                    <span className="font-medium">
                      {formatCurrency(product.received * product.estimatedPrice)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {campaign.productProgress.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No hay productos definidos para esta campaña</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignDetails;