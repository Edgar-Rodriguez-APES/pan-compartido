import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  ShoppingCart, 
  User, 
  Home, 
  Bell,
  Target,
  Users,
  Calendar,
  TrendingUp,
  Gift,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import api from '../../services/api';
import DonationFlow from './DonationFlow';
import ProductCatalog from './ProductCatalog';
import ShoppingFlow from './ShoppingFlow';
import UnifiedCart from './UnifiedCart';
import OneButtonCheckout from './OneButtonCheckout';
import { useCart } from '../../hooks/useCart';

const MobileApp = ({ tenantId, user }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [tenant, setTenant] = useState(null);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  
  // Use cart hook
  const { totalItems, formatCurrency: cartFormatCurrency, quickAddDonation, quickAddPurchase } = useCart();

  useEffect(() => {
    loadMobileData();
  }, [tenantId]);

  const loadMobileData = async () => {
    try {
      setLoading(true);
      const [tenantResponse, campaignsResponse, statsResponse] = await Promise.all([
        api.get('/branding/frontend', {
          headers: { 'X-Tenant-ID': tenantId }
        }),
        api.get('/campaigns/active', {
          headers: { 'X-Tenant-ID': tenantId }
        }),
        user ? api.get('/profile/stats', {
          headers: { 'X-Tenant-ID': tenantId }
        }).catch(() => ({ data: { stats: null } })) : Promise.resolve({ data: { stats: null } })
      ]);

      setTenant(tenantResponse.data);
      setActiveCampaigns(campaignsResponse.data.campaigns || []);
      setUserStats(statsResponse.data.stats);
    } catch (error) {
      console.error('Error cargando datos móviles:', error);
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

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const renderHomeTab = () => (
    <div className="pb-20">
      {/* Header with Parish Branding */}
      <div 
        className="px-4 py-6 text-white relative overflow-hidden"
        style={{ backgroundColor: tenant?.colors?.primary || '#2563eb' }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {tenant?.logoUrl && (
                <img 
                  src={tenant.logoUrl} 
                  alt={tenant.name}
                  className="w-12 h-12 rounded-full bg-white p-1 mr-3"
                />
              )}
              <div>
                <h1 className="text-xl font-bold">{tenant?.name}</h1>
                <p className="text-white text-opacity-90 text-sm">Pan Compartido</p>
              </div>
            </div>
            <Bell className="w-6 h-6" />
          </div>

          {user && (
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <p className="text-sm text-white text-opacity-90">¡Hola, {user.name}!</p>
              <p className="text-xs text-white text-opacity-75">
                Gracias por ser parte de nuestra comunidad
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {userStats && (
        <div className="px-4 py-4 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Tu Impacto</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-600">{userStats.donations}</div>
              <div className="text-xs text-gray-600">Donaciones</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(userStats.totalDonated)}
              </div>
              <div className="text-xs text-gray-600">Total Donado</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Campaigns */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Necesidades Actuales</h2>
          <span className="text-sm text-gray-500">{activeCampaigns.length} activas</span>
        </div>

        {activeCampaigns.length > 0 ? (
          <div className="space-y-4">
            {activeCampaigns.map(campaign => (
              <div key={campaign.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                        {campaign.title}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {campaign.description}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <div className="text-xs text-gray-500">
                        {campaign.daysRemaining} días
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progreso</span>
                      <span>{Math.round(campaign.completionPercentage)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(campaign.completionPercentage)}`}
                        style={{ width: `${Math.min(campaign.completionPercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Campaign Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(campaign.raisedAmount)}
                      </div>
                      <div className="text-xs text-gray-500">Recaudado</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-900">
                        {campaign.targetFamilies || 0}
                      </div>
                      <div className="text-xs text-gray-500">Familias</div>
                    </div>
                  </div>

                  {/* Impact Message */}
                  {campaign.impactMessage && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-800">{campaign.impactMessage}</p>
                    </div>
                  )}

                  {/* Urgent Needs */}
                  {campaign.urgentNeeds && campaign.urgentNeeds.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-orange-700 mb-2">Necesidades Urgentes:</h4>
                      <div className="space-y-1">
                        {campaign.urgentNeeds.slice(0, 3).map((need, index) => (
                          <div key={index} className="flex justify-between items-center text-xs">
                            <span className="text-gray-700">{need.productId}</span>
                            <span className="text-orange-600 font-medium">
                              Faltan {need.remaining} {need.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => window.location.href = `/mobile/donate/${campaign.id}`}
                      className="flex-1 bg-red-500 text-white text-sm font-medium py-2.5 px-4 rounded-lg flex items-center justify-center"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      Donar
                    </button>
                    <button
                      onClick={() => window.location.href = `/mobile/shop/${campaign.id}`}
                      className="flex-1 bg-blue-500 text-white text-sm font-medium py-2.5 px-4 rounded-lg flex items-center justify-center"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Comprar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay campañas activas</p>
            <p className="text-gray-400 text-xs">Pronto habrá nuevas necesidades</p>
          </div>
        )}
      </div>

      {/* Community Impact */}
      <div className="px-4 py-4 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-600 mb-3">Impacto Comunitario</h3>
        <div className="bg-white rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green-600">150</div>
              <div className="text-xs text-gray-600">Familias Ayudadas</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">89</div>
              <div className="text-xs text-gray-600">Donantes Activos</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600">12</div>
              <div className="text-xs text-gray-600">Campañas Completadas</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCartTab = () => (
    <div className="pb-20">
      <div className="px-4 py-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Mi Carrito</h2>
        <OneButtonCheckout 
          tenantId={tenantId}
          user={user}
          onSuccess={(result) => {
            console.log('Checkout successful:', result);
            // Show success message or redirect
            alert('¡Orden procesada exitosamente!');
          }}
          onError={(error) => {
            console.error('Checkout error:', error);
            alert(`Error: ${error}`);
          }}
        />
      </div>
    </div>
  );

  const renderProfileTab = () => (
    <div className="pb-20">
      {/* Profile Header */}
      <div className="px-4 py-6 bg-white border-b">
        <div className="flex items-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-gray-500" />
          </div>
          <div className="ml-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {user ? user.name : 'Invitado'}
            </h2>
            <p className="text-sm text-gray-600">
              {user ? user.email : 'Inicia sesión para ver tu perfil'}
            </p>
          </div>
        </div>
      </div>

      {user ? (
        <>
          {/* User Stats */}
          {userStats && (
            <div className="px-4 py-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Mis Estadísticas</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-4 border">
                  <div className="text-2xl font-bold text-green-600">{userStats.donations}</div>
                  <div className="text-sm text-gray-600">Donaciones Realizadas</div>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(userStats.totalDonated)}
                  </div>
                  <div className="text-sm text-gray-600">Total Donado</div>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <div className="text-2xl font-bold text-purple-600">{userStats.purchases}</div>
                  <div className="text-sm text-gray-600">Compras Realizadas</div>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(userStats.totalPurchased)}
                  </div>
                  <div className="text-sm text-gray-600">Total Comprado</div>
                </div>
              </div>
            </div>
          )}

          {/* Profile Actions */}
          <div className="px-4 py-4">
            <div className="space-y-2">
              <button className="w-full bg-white border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <Gift className="w-5 h-5 text-gray-500 mr-3" />
                  <span className="text-sm font-medium">Mis Donaciones</span>
                </div>
                <span className="text-gray-400">→</span>
              </button>
              
              <button className="w-full bg-white border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <ShoppingCart className="w-5 h-5 text-gray-500 mr-3" />
                  <span className="text-sm font-medium">Mis Compras</span>
                </div>
                <span className="text-gray-400">→</span>
              </button>
              
              <button className="w-full bg-white border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <User className="w-5 h-5 text-gray-500 mr-3" />
                  <span className="text-sm font-medium">Editar Perfil</span>
                </div>
                <span className="text-gray-400">→</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="px-4 py-8 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Inicia Sesión</h3>
          <p className="text-sm text-gray-600 mb-6">
            Accede a tu cuenta para ver tu historial de donaciones y compras
          </p>
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium">
            Iniciar Sesión
          </button>
        </div>
      )}

      {/* Parish Contact */}
      <div className="px-4 py-4 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-600 mb-3">Contacto</h3>
        <div className="bg-white rounded-lg p-4 space-y-3">
          {tenant?.contactInfo?.phone && (
            <div className="flex items-center">
              <Phone className="w-4 h-4 text-gray-500 mr-3" />
              <span className="text-sm text-gray-700">{tenant.contactInfo.phone}</span>
            </div>
          )}
          {tenant?.contactInfo?.email && (
            <div className="flex items-center">
              <Mail className="w-4 h-4 text-gray-500 mr-3" />
              <span className="text-sm text-gray-700">{tenant.contactInfo.email}</span>
            </div>
          )}
          {tenant?.contactInfo?.address && (
            <div className="flex items-center">
              <MapPin className="w-4 h-4 text-gray-500 mr-3" />
              <span className="text-sm text-gray-700">{tenant.contactInfo.address}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="relative">
        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'cart' && renderCartTab()}
        {activeTab === 'profile' && renderProfileTab()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg ${
              activeTab === 'home' 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-500'
            }`}
          >
            <Home className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">Inicio</span>
          </button>
          
          <button
            onClick={() => setActiveTab('cart')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg relative ${
              activeTab === 'cart' 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-500'
            }`}
          >
            <ShoppingCart className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">Carrito</span>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg ${
              activeTab === 'profile' 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-500'
            }`}
          >
            <User className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">Perfil</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileApp;