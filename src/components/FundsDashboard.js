import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  Shield,
  Settings,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import api from '../services/api';

const FundsDashboard = ({ tenantId, user }) => {
  const [fundsData, setFundsData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [showTransferModal, setShowTransferModal] = useState(false);

  useEffect(() => {
    loadFundsData();
  }, [tenantId, selectedPeriod]);

  const loadFundsData = async () => {
    try {
      setLoading(true);
      const [balancesResponse, analyticsResponse] = await Promise.all([
        api.get('/funds/balances', {
          headers: { 'X-Tenant-ID': tenantId }
        }),
        api.get(`/funds/analytics?period=${selectedPeriod}`, {
          headers: { 'X-Tenant-ID': tenantId }
        })
      ]);

      setFundsData(balancesResponse.data);
      setAnalytics(analyticsResponse.data.analytics);
    } catch (error) {
      console.error('Error loading funds data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getFundColor = (fundType) => {
    const colors = {
      supplier: '#10B981',    // Green
      sustainability: '#3B82F6', // Blue
      reserve: '#F59E0B',     // Yellow
      platform: '#8B5CF6'    // Purple
    };
    return colors[fundType] || '#6B7280';
  };

  const getFundIcon = (fundType) => {
    const icons = {
      supplier: Package,
      sustainability: Users,
      reserve: Shield,
      platform: Settings
    };
    return icons[fundType] || DollarSign;
  };

  const getFundName = (fundType) => {
    const names = {
      supplier: 'Proveedores',
      sustainability: 'Sostenimiento',
      reserve: 'Reserva de Emergencia',
      platform: 'Plataforma'
    };
    return names[fundType] || fundType;
  };

  const renderFundCard = (fundType, balance) => {
    const IconComponent = getFundIcon(fundType);
    const color = getFundColor(fundType);
    const name = getFundName(fundType);

    return (
      <div key={fundType} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              <IconComponent className="w-6 h-6" style={{ color }} />
            </div>
            <div className="ml-3">
              <h3 className="font-semibold text-gray-900">{name}</h3>
              <p className="text-sm text-gray-600">Saldo actual</p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(balance)}
          </div>
        </div>

        {/* Progress indicator based on minimum balance */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Estado del fondo</span>
            <span>{balance > 50000 ? 'Saludable' : 'Bajo'}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min((balance / 100000) * 100, 100)}%`,
                backgroundColor: balance > 50000 ? color : '#EF4444'
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Último movimiento</span>
          <span className="text-gray-900 font-medium">Hace 2 horas</span>
        </div>
      </div>
    );
  };

  const renderDistributionChart = () => {
    if (!analytics?.currentBalances) return null;

    const data = Object.entries(analytics.currentBalances)
      .filter(([key]) => key !== 'total')
      .map(([key, value]) => ({
        name: getFundName(key),
        value,
        color: getFundColor(key)
      }));

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Distribución de Fondos</h3>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            Ver detalles
          </button>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderRecentDistributions = () => {
    const mockDistributions = [
      {
        id: 1,
        date: '2024-01-15',
        amount: 150000,
        type: 'donation',
        status: 'completed',
        breakdown: {
          supplier: 112500,
          sustainability: 22500,
          reserve: 10500,
          platform: 4500
        }
      },
      {
        id: 2,
        date: '2024-01-14',
        amount: 85000,
        type: 'purchase',
        status: 'completed',
        breakdown: {
          supplier: 55250,
          sustainability: 21250,
          reserve: 5950,
          platform: 2550
        }
      }
    ];

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Distribuciones Recientes</h3>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            Ver todas
          </button>
        </div>

        <div className="space-y-4">
          {mockDistributions.map(distribution => (
            <div key={distribution.id} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    distribution.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <div className="font-medium text-gray-900">
                      {formatCurrency(distribution.amount)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {distribution.type === 'donation' ? 'Donación' : 'Compra'} • {distribution.date}
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  {distribution.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-sm">
                {Object.entries(distribution.breakdown).map(([fund, amount]) => (
                  <div key={fund} className="text-center">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(amount)}
                    </div>
                    <div className="text-gray-600 text-xs">
                      {getFundName(fund)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAlerts = () => {
    if (!analytics?.alerts || analytics.alerts.length === 0) return null;

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center mb-4">
          <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Alertas</h3>
        </div>

        <div className="space-y-3">
          {analytics.alerts.map((alert, index) => (
            <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-start">
                <AlertTriangle className="w-4 h-4 text-orange-600 mr-2 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900">
                    Saldo bajo en {getFundName(alert.fund)}
                  </p>
                  <p className="text-sm text-orange-700">
                    Saldo actual: {formatCurrency(alert.currentBalance)} 
                    (Mínimo recomendado: {formatCurrency(alert.minimumBalance)})
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMetrics = () => {
    const metrics = [
      {
        title: 'Total Distribuido',
        value: analytics?.distributionReport?.totalAmount || 0,
        change: '+12.5%',
        trend: 'up',
        icon: DollarSign,
        color: 'text-green-600'
      },
      {
        title: 'Distribuciones',
        value: analytics?.distributionReport?.totalDistributions || 0,
        change: '+8.2%',
        trend: 'up',
        icon: TrendingUp,
        color: 'text-blue-600'
      },
      {
        title: 'Promedio por Distribución',
        value: analytics?.distributionReport?.averageDistribution || 0,
        change: '-2.1%',
        trend: 'down',
        icon: TrendingDown,
        color: 'text-orange-600'
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {typeof metric.value === 'number' && metric.title.includes('Total') 
                    ? formatCurrency(metric.value)
                    : metric.value
                  }
                </p>
                <div className="flex items-center mt-2">
                  {metric.trend === 'up' ? (
                    <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm font-medium ${
                    metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change}
                  </span>
                  <span className="text-sm text-gray-600 ml-1">vs mes anterior</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                metric.color === 'text-green-600' ? 'bg-green-50' :
                metric.color === 'text-blue-600' ? 'bg-blue-50' : 'bg-orange-50'
              }`}>
                <metric.icon className={`w-6 h-6 ${metric.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos de fondos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestión de Fondos</h1>
            <p className="text-gray-600 mt-1">
              Administra la distribución automática de fondos de la parroquia
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 90 días</option>
              <option value="1y">Último año</option>
            </select>
            
            <button
              onClick={loadFundsData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </button>
            
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>

        {/* Metrics */}
        {renderMetrics()}

        {/* Alerts */}
        {renderAlerts()}

        {/* Fund Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {fundsData?.balances && Object.entries(fundsData.balances)
            .filter(([key]) => key !== 'total')
            .map(([fundType, balance]) => renderFundCard(fundType, balance))
          }
        </div>

        {/* Charts and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderDistributionChart()}
          {renderRecentDistributions()}
        </div>
      </div>
    </div>
  );
};

export default FundsDashboard;