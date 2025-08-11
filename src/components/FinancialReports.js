import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Users,
  Package,
  Shield,
  Download,
  Calendar,
  Filter,
  Eye,
  FileText,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import api from '../services/api';

const FinancialReports = ({ tenantId, user }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedReport, setSelectedReport] = useState('overview');

  useEffect(() => {
    loadReportData();
  }, [tenantId, selectedPeriod, selectedReport]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/funds/reports/${selectedPeriod}`, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setReportData(response.data.report);
    } catch (error) {
      console.error('Error loading report data:', error);
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

  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const generateMockData = () => {
    // Mock data for demonstration
    return {
      totalAmount: 2450000,
      totalDistributions: 18,
      averageDistribution: 136111,
      breakdown: {
        suppliers: 1715000,
        sustainability: 490000,
        reserve: 171500,
        platform: 73500
      },
      currentBalances: {
        supplier: 850000,
        sustainability: 320000,
        reserve: 180000,
        total: 1350000
      },
      monthlyTrend: [
        { month: 'Ene', donations: 180000, purchases: 120000, total: 300000 },
        { month: 'Feb', donations: 220000, purchases: 150000, total: 370000 },
        { month: 'Mar', donations: 280000, purchases: 180000, total: 460000 },
        { month: 'Abr', donations: 320000, purchases: 200000, total: 520000 },
        { month: 'May', donations: 380000, purchases: 240000, total: 620000 },
        { month: 'Jun', donations: 420000, purchases: 280000, total: 700000 }
      ],
      distributionTrend: [
        { date: '2024-01-01', suppliers: 70, sustainability: 20, reserve: 7, platform: 3 },
        { date: '2024-01-15', suppliers: 72, sustainability: 18, reserve: 7, platform: 3 },
        { date: '2024-02-01', suppliers: 68, sustainability: 22, reserve: 7, platform: 3 },
        { date: '2024-02-15', suppliers: 75, sustainability: 15, reserve: 7, platform: 3 }
      ]
    };
  };

  const data = reportData || generateMockData();

  const renderOverviewReport = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Distribuido</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.totalAmount)}
              </p>
              <div className="flex items-center mt-2">
                <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm font-medium text-green-600">+15.3%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Distribuciones</p>
              <p className="text-2xl font-bold text-gray-900">{data.totalDistributions}</p>
              <div className="flex items-center mt-2">
                <ArrowUpRight className="w-4 h-4 text-blue-500 mr-1" />
                <span className="text-sm font-medium text-blue-600">+8.7%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Promedio</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.averageDistribution)}
              </p>
              <div className="flex items-center mt-2">
                <ArrowDownRight className="w-4 h-4 text-orange-500 mr-1" />
                <span className="text-sm font-medium text-orange-600">-2.1%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Saldo Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.currentBalances.total)}
              </p>
              <div className="flex items-center mt-2">
                <ArrowUpRight className="w-4 h-4 text-purple-500 mr-1" />
                <span className="text-sm font-medium text-purple-600">+12.4%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Distribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribución por Categoría
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Proveedores', value: data.breakdown.suppliers, color: '#10B981' },
                    { name: 'Sostenimiento', value: data.breakdown.sustainability, color: '#3B82F6' },
                    { name: 'Reserva', value: data.breakdown.reserve, color: '#F59E0B' },
                    { name: 'Plataforma', value: data.breakdown.platform, color: '#8B5CF6' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[
                    { color: '#10B981' },
                    { color: '#3B82F6' },
                    { color: '#F59E0B' },
                    { color: '#8B5CF6' }
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Tendencia Mensual
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${(value / 1000)}K`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="donations"
                  stackId="1"
                  stroke="#EF4444"
                  fill="#EF4444"
                  fillOpacity={0.6}
                  name="Donaciones"
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  stackId="1"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.6}
                  name="Compras"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Desglose Detallado de Distribución
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Categoría</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Monto</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Porcentaje</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Saldo Actual</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'suppliers', name: 'Proveedores', icon: Package, color: 'text-green-600' },
                { key: 'sustainability', name: 'Sostenimiento', icon: Users, color: 'text-blue-600' },
                { key: 'reserve', name: 'Reserva', icon: Shield, color: 'text-yellow-600' },
                { key: 'platform', name: 'Plataforma', icon: DollarSign, color: 'text-purple-600' }
              ].map(({ key, name, icon: Icon, color }) => (
                <tr key={key} className="border-b border-gray-100">
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <Icon className={`w-4 h-4 mr-2 ${color}`} />
                      <span className="font-medium text-gray-900">{name}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 font-medium text-gray-900">
                    {formatCurrency(data.breakdown[key])}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-600">
                    {formatPercentage(data.breakdown[key] / data.totalAmount)}
                  </td>
                  <td className="text-right py-3 px-4 font-medium text-gray-900">
                    {formatCurrency(data.currentBalances[key] || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDistributionReport = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Evolución de Porcentajes de Distribución
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.distributionTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
              <YAxis tickFormatter={(value) => `${value}%`} />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value) => [`${value}%`, '']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="suppliers"
                stroke="#10B981"
                strokeWidth={2}
                name="Proveedores"
              />
              <Line
                type="monotone"
                dataKey="sustainability"
                stroke="#3B82F6"
                strokeWidth={2}
                name="Sostenimiento"
              />
              <Line
                type="monotone"
                dataKey="reserve"
                stroke="#F59E0B"
                strokeWidth={2}
                name="Reserva"
              />
              <Line
                type="monotone"
                dataKey="platform"
                stroke="#8B5CF6"
                strokeWidth={2}
                name="Plataforma"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderBalanceReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { key: 'supplier', name: 'Proveedores', icon: Package, color: 'green' },
          { key: 'sustainability', name: 'Sostenimiento', icon: Users, color: 'blue' },
          { key: 'reserve', name: 'Reserva', icon: Shield, color: 'yellow' }
        ].map(({ key, name, icon: Icon, color }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`w-12 h-12 bg-${color}-50 rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 text-${color}-600`} />
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">{name}</h3>
                  <p className="text-sm text-gray-600">Saldo actual</p>
                </div>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2">
              {formatCurrency(data.currentBalances[key] || 0)}
            </div>
            <div className="text-sm text-gray-600">
              Estado: {(data.currentBalances[key] || 0) > 50000 ? 'Saludable' : 'Requiere atención'}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Evolución de Saldos
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${(value / 1000)}K`} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="total" fill="#3B82F6" name="Total Mensual" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generando reportes...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Reportes Financieros</h1>
            <p className="text-gray-600 mt-1">
              Análisis detallado de la distribución automática de fondos
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
            
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* Report Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg">
          {[
            { key: 'overview', name: 'Resumen General', icon: Eye },
            { key: 'distribution', name: 'Distribución', icon: TrendingUp },
            { key: 'balances', name: 'Saldos', icon: DollarSign }
          ].map(({ key, name, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedReport(key)}
              className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                selectedReport === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {name}
            </button>
          ))}
        </div>

        {/* Report Content */}
        {selectedReport === 'overview' && renderOverviewReport()}
        {selectedReport === 'distribution' && renderDistributionReport()}
        {selectedReport === 'balances' && renderBalanceReport()}
      </div>
    </div>
  );
};

export default FinancialReports;