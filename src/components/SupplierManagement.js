import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Star,
  MapPin,
  Phone,
  Mail,
  Package,
  TrendingUp,
  Users,
  Clock,
  Download,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

const SupplierManagement = ({ tenantId, user }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });

  useEffect(() => {
    loadSuppliers();
    loadDashboard();
  }, [tenantId, searchTerm, statusFilter, categoryFilter, pagination.offset]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const params = {
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        limit: pagination.limit,
        offset: pagination.offset
      };

      const response = await api.get('/suppliers', {
        headers: { 'X-Tenant-ID': tenantId },
        params
      });

      setSuppliers(response.data.suppliers);
      setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await api.get('/suppliers/dashboard/summary', {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setDashboard(response.data.dashboard);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const handleSupplierAction = async (supplierId, action, data = {}) => {
    try {
      let response;
      
      switch (action) {
        case 'approve':
          response = await api.post(`/suppliers/${supplierId}/approve`, {}, {
            headers: { 'X-Tenant-ID': tenantId }
          });
          break;
        case 'reject':
          response = await api.post(`/suppliers/${supplierId}/reject`, data, {
            headers: { 'X-Tenant-ID': tenantId }
          });
          break;
        case 'suspend':
          response = await api.post(`/suppliers/${supplierId}/suspend`, data, {
            headers: { 'X-Tenant-ID': tenantId }
          });
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (response.data.success) {
        loadSuppliers();
        loadDashboard();
        alert(response.data.message);
      }
    } catch (error) {
      console.error(`Error ${action} supplier:`, error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'text-green-600 bg-green-50',
      pending: 'text-yellow-600 bg-yellow-50',
      suspended: 'text-red-600 bg-red-50',
      rejected: 'text-gray-600 bg-gray-50'
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  };

  const getStatusIcon = (status) => {
    const icons = {
      active: CheckCircle,
      pending: Clock,
      suspended: AlertTriangle,
      rejected: XCircle
    };
    return icons[status] || Clock;
  };

  const renderDashboardCards = () => {
    if (!dashboard) return null;

    const cards = [
      {
        title: 'Total Proveedores',
        value: dashboard.performance_summary.total_active,
        icon: Users,
        color: 'blue',
        change: '+12%'
      },
      {
        title: 'Pendientes',
        value: dashboard.status_counts.pending || 0,
        icon: Clock,
        color: 'yellow',
        change: '-5%'
      },
      {
        title: 'Calificación Promedio',
        value: dashboard.performance_summary.avg_rating.toFixed(1),
        icon: Star,
        color: 'green',
        change: '+0.3'
      },
      {
        title: 'Total Reseñas',
        value: dashboard.performance_summary.total_reviews,
        icon: TrendingUp,
        color: 'purple',
        change: '+28%'
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    card.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {card.change}
                  </span>
                  <span className="text-sm text-gray-600 ml-1">vs mes anterior</span>
                </div>
              </div>
              <div className={`w-12 h-12 bg-${card.color}-50 rounded-lg flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 text-${card.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSupplierCard = (supplier) => {
    const StatusIcon = getStatusIcon(supplier.status);
    
    return (
      <div key={supplier.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mr-4">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
              <p className="text-sm text-gray-600">{supplier.business_name}</p>
              <p className="text-xs text-gray-500">{supplier.category}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(supplier.status)}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {supplier.status}
            </span>
            
            <div className="relative">
              <button className="p-1 hover:bg-gray-100 rounded">
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Star className="w-4 h-4 mr-2 text-yellow-500" />
            <span>{supplier.rating || 0}/5 ({supplier.review_count || 0} reseñas)</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-2" />
            <span>{supplier.city || 'No especificado'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div className="flex items-center">
            <Phone className="w-4 h-4 mr-1" />
            <span>{supplier.contact_phone}</span>
          </div>
          <div className="flex items-center">
            <Mail className="w-4 h-4 mr-1" />
            <span className="truncate max-w-32">{supplier.contact_email}</span>
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => {
              setSelectedSupplier(supplier);
              setShowDetailsModal(true);
            }}
            className="flex-1 bg-blue-50 text-blue-600 py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center"
          >
            <Eye className="w-4 h-4 mr-1" />
            Ver Detalles
          </button>

          {supplier.status === 'pending' && (
            <>
              <button
                onClick={() => handleSupplierAction(supplier.id, 'approve')}
                className="flex-1 bg-green-50 text-green-600 py-2 px-3 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors flex items-center justify-center"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Aprobar
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Razón del rechazo:');
                  if (reason) {
                    handleSupplierAction(supplier.id, 'reject', { reason });
                  }
                }}
                className="flex-1 bg-red-50 text-red-600 py-2 px-3 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center justify-center"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Rechazar
              </button>
            </>
          )}

          {supplier.status === 'active' && (
            <button
              onClick={() => {
                const reason = prompt('Razón de la suspensión:');
                if (reason) {
                  handleSupplierAction(supplier.id, 'suspend', { reason });
                }
              }}
              className="flex-1 bg-orange-50 text-orange-600 py-2 px-3 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors flex items-center justify-center"
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Suspender
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSupplierDetails = () => {
    if (!selectedSupplier) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Detalles del Proveedor
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Información Básica</h3>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Nombre</label>
                      <p className="text-gray-900">{selectedSupplier.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Razón Social</label>
                      <p className="text-gray-900">{selectedSupplier.business_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Categoría</label>
                      <p className="text-gray-900">{selectedSupplier.category}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Estado</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedSupplier.status)}`}>
                        {selectedSupplier.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Contacto</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-gray-900">{selectedSupplier.contact_phone}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-gray-900">{selectedSupplier.contact_email}</span>
                    </div>
                    {selectedSupplier.address && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-500 mr-2" />
                        <span className="text-gray-900">{selectedSupplier.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Métricas de Rendimiento</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedSupplier.rating || 0}
                    </div>
                    <div className="text-sm text-green-800">Calificación</div>
                    <div className="flex justify-center mt-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= (selectedSupplier.rating || 0)
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedSupplier.review_count || 0}
                    </div>
                    <div className="text-sm text-blue-800">Reseñas</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Información Adicional</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Fecha de registro:</span>
                      <p className="text-gray-900">
                        {new Date(selectedSupplier.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Última actualización:</span>
                      <p className="text-gray-900">
                        {new Date(selectedSupplier.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading && suppliers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando proveedores...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Gestión de Proveedores</h1>
            <p className="text-gray-600 mt-1">
              Administra proveedores, calificaciones y actualizaciones de inventario
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={loadSuppliers}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </button>
            
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
            
            <button
              onClick={() => setShowSupplierModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Proveedor
            </button>
          </div>
        </div>

        {/* Dashboard Cards */}
        {renderDashboardCards()}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Buscar proveedores..."
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="pending">Pendientes</option>
              <option value="suspended">Suspendidos</option>
              <option value="rejected">Rechazados</option>
            </select>
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todas las categorías</option>
              <option value="alimentos">Alimentos</option>
              <option value="limpieza">Limpieza</option>
              <option value="medicinas">Medicinas</option>
              <option value="ropa">Ropa</option>
              <option value="otros">Otros</option>
            </select>
            
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center">
              <Filter className="w-4 h-4 mr-2" />
              Más Filtros
            </button>
          </div>
        </div>

        {/* Suppliers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map(supplier => renderSupplierCard(supplier))}
        </div>

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando {pagination.offset + 1} a {Math.min(pagination.offset + pagination.limit, pagination.total)} de {pagination.total} proveedores
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                disabled={pagination.offset === 0}
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={pagination.offset + pagination.limit >= pagination.total}
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* Supplier Details Modal */}
        {showDetailsModal && renderSupplierDetails()}
      </div>
    </div>
  );
};

export default SupplierManagement;