import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  TrendingUp, 
  Users, 
  Target, 
  AlertTriangle, 
  Calendar,
  DollarSign,
  Activity,
  Eye,
  Edit,
  Play,
  Square,
  RotateCcw
} from 'lucide-react';
import api from '../services/api';

const CampaignDashboard = ({ tenantId }) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    loadDashboard();
  }, [tenantId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/campaigns/dashboard', {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setDashboard(response.data.dashboard);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateCampaign = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/activate`, {}, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      await loadDashboard();
      alert('Campaña activada exitosamente');
    } catch (error) {
      console.error('Error activando campaña:', error);
      alert('Error activando campaña');
    }
  };

  const handleCompleteCampaign = async (campaignId) => {
    if (!confirm('¿Estás seguro de que quieres completar esta campaña?')) {
      return;
    }

    try {
      await api.post(`/campaigns/${campaignId}/complete`, {}, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      await loadDashboard();
      alert('Campaña completada exitosamente');
    } catch (error) {
      console.error('Error completando campaña:', error);
      alert('Error completando campaña');
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando dashboard...</span>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Error cargando el dashboard de campañas</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Campañas</h1>
          <p className="text-gray-600">Gestiona y monitorea las campañas de tu parroquia</p>
        </div>
        
        <button
          onClick={() => window.location.href = '/campaigns/new'}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Campaña
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Campañas Activas</p>
              <p className="text-2xl font-bold text-gray-900">{dashboard.summary.activeCampaigns}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
              <p className="text-2xl font-bold text-gray-900">{dashboard.summary.completionRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Recaudado</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(dashboard.summary.totalRaised)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Familias Ayudadas</p>
              <p className="text-2xl font-bold text-gray-900">{dashboard.summary.totalFamiliesHelped}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Resumen', icon: TrendingUp },
            { key: 'active', label: 'Campañas Activas', icon: Activity },
            { key: 'attention', label: 'Requieren Atención', icon: AlertTriangle }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
              {tab.key === 'attention' && dashboard.needsAttention.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                  {dashboard.needsAttention.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {selectedTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Actividad Reciente</h3>
              </div>
              <div className="p-6">
                {dashboard.recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {dashboard.recentActivity.slice(0, 5).map((activity, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{activity.message}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleDateString('es-CO')}
                          </p>
                        </div>
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(activity.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No hay actividad reciente</p>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Estadísticas Rápidas</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total de Campañas</span>
                  <span className="font-semibold">{dashboard.summary.totalCampaigns}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completadas</span>
                  <span className="font-semibold text-green-600">{dashboard.summary.completedCampaigns}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Activas</span>
                  <span className="font-semibold text-blue-600">{dashboard.summary.activeCampaigns}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Promedio por Campaña</span>
                  <span className="font-semibold">
                    {dashboard.summary.completedCampaigns > 0 
                      ? formatCurrency(dashboard.summary.totalRaised / dashboard.summary.completedCampaigns)
                      : formatCurrency(0)
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'active' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Campañas Activas</h3>
            </div>
            <div className="p-6">
              {dashboard.activeCampaigns.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.activeCampaigns.map(campaign => (
                    <div key={campaign.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{campaign.title}</h4>
                          <p className="text-sm text-gray-600">{campaign.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                            {getStatusText(campaign.status)}
                          </span>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => window.location.href = `/campaigns/${campaign.id}`}
                              className="p-2 text-gray-600 hover:text-blue-600"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => window.location.href = `/campaigns/${campaign.id}/edit`}
                              className="p-2 text-gray-600 hover:text-blue-600"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCompleteCampaign(campaign.id)}
                              className="p-2 text-gray-600 hover:text-green-600"
                              title="Completar"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Progreso</p>
                          <div className="flex items-center">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${Math.min(campaign.completionPercentage, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{Math.round(campaign.completionPercentage)}%</span>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-xs text-gray-500">Recaudado</p>
                          <p className="text-sm font-semibold">{formatCurrency(campaign.raisedAmount)}</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-gray-500">Días Restantes</p>
                          <p className="text-sm font-semibold">{campaign.daysRemaining}</p>
                        </div>
                      </div>

                      {campaign.impactMessage && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                          <p className="text-sm text-blue-800">{campaign.impactMessage}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No hay campañas activas</p>
                  <button
                    onClick={() => window.location.href = '/campaigns/new'}
                    className="mt-2 text-blue-600 hover:text-blue-700"
                  >
                    Crear la primera campaña
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'attention' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Campañas que Requieren Atención</h3>
              </div>
            </div>
            <div className="p-6">
              {dashboard.needsAttention.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.needsAttention.map(campaign => (
                    <div key={campaign.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{campaign.title}</h4>
                          <div className="flex items-center mt-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500 mr-1" />
                            <span className="text-sm text-orange-700">{campaign.attentionReason}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => window.location.href = `/campaigns/${campaign.id}`}
                            className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                          >
                            Ver Detalles
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Progreso: </span>
                          <span className="font-medium">{Math.round(campaign.completionPercentage)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Días restantes: </span>
                          <span className="font-medium">{campaign.daysRemaining}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Recaudado: </span>
                          <span className="font-medium">{formatCurrency(campaign.raisedAmount)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Target className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-gray-500">¡Excelente! Todas las campañas están en buen estado</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignDashboard;