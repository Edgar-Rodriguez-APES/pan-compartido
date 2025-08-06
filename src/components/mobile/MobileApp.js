import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { campaignService, productService, handleApiError } from '../../services/api';
import { 
  Home, 
  Heart, 
  ShoppingCart, 
  User, 
  Bell,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Gift,
  Target,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

const MobileApp = () => {
  const { user, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [campaignsData, productsData] = await Promise.all([
        campaignService.getActive(),
        productService.getPopular(6)
      ]);
      
      setActiveCampaigns(campaignsData.campaigns || []);
      setPopularProducts(productsData.products || []);
    } catch (error) {
      setError(handleApiError(error));
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

  const getProgressPercentage = (current, target) => {
    if (!target || target === 0) return 0;
    return Math.min(100, (current / target) * 100);
  };

  const renderHome = () => (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-b-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold">¡Hola, {user?.name?.split(' ')[0]}!</h1>
            <p className="text-blue-100 text-sm">{tenant?.name}</p>
          </div>
          <div className="relative">
            <Bell className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              2
            </span>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <Heart className="w-5 h-5 mx-auto mb-1" />
            <p className="text-xs text-blue-100">Donaciones</p>
            <p className="font-bold">12</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <ShoppingCart className="w-5 h-5 mx-auto mb-1" />
            <p className="text-xs text-blue-100">Compras</p>
            <p className="font-bold">8</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <Gift className="w-5 h-5 mx-auto mb-1" />
            <p className="text-xs text-blue-100">Impacto</p>
            <p className="font-bold">45</p>
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Campañas Activas</h2>
          <button className="text-blue-600 text-sm font-medium">Ver todas</button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-32"></div>
            ))}
          </div>
        ) : activeCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No hay campañas activas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCampaigns.slice(0, 2).map(campaign => (
              <div key={campaign.id} className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{campaign.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{campaign.description}</p>
                  </div>
                  <button className="ml-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Donar
                  </button>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progreso</span>
                    <span className="font-medium">
                      {formatCurrency(campaign.raisedAmount)} / {formatCurrency(campaign.targetAmount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage(campaign.raisedAmount, campaign.targetAmount)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Goals */}
                {campaign.goals && Object.keys(campaign.goals).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(campaign.goals).slice(0, 3).map(([item, goal]) => {
                      const progress = campaign.currentProgress?.[item] || { received: 0 };
                      const percentage = getProgressPercentage(progress.received, goal.needed);
                      
                      return (
                        <div key={item} className="bg-gray-50 rounded-lg px-3 py-2 flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 capitalize truncate">{item}</p>
                          <p className="text-xs text-gray-500">
                            {progress.received} / {goal.needed} {goal.unit}
                          </p>
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div 
                              className="bg-blue-500 h-1 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Popular Products */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Productos Populares</h2>
          <button className="text-blue-600 text-sm font-medium">Ver todos</button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-24"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {popularProducts.slice(0, 4).map(product => (
              <div key={product.id} className="bg-white rounded-lg border p-3 shadow-sm">
                <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <h3 className="font-medium text-sm text-gray-900 mb-1 line-clamp-1">{product.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{product.categoryDisplayName}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-green-600">{product.formattedPrice}</span>
                  <button className="bg-blue-50 text-blue-600 p-1 rounded">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <Heart className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-green-800">Hacer Donación</p>
            <p className="text-xs text-green-600">Ayuda a tu comunidad</p>
          </button>
          <button className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <ShoppingCart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="font-medium text-blue-800">Comprar Mercado</p>
            <p className="text-xs text-blue-600">Precios mayoristas</p>
          </button>
        </div>
      </div>
    </div>
  );

  const renderDonate = () => (
    <div className="pb-20">
      <div className="p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Hacer Donación</h1>
        
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar campaña o producto..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Active Campaigns for Donation */}
        <div className="space-y-3">
          {activeCampaigns.map(campaign => (
            <div key={campaign.id} className="bg-white rounded-lg border p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">{campaign.title}</h3>
              
              {/* Most needed items */}
              {campaign.goals && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-2">Más necesitados:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(campaign.goals).slice(0, 3).map(([item, goal]) => {
                      const progress = campaign.currentProgress?.[item] || { received: 0 };
                      const remaining = Math.max(0, goal.needed - progress.received);
                      
                      return (
                        <button
                          key={item}
                          className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-left flex-1 min-w-0"
                        >
                          <p className="text-sm font-medium text-red-800 capitalize truncate">{item}</p>
                          <p className="text-xs text-red-600">
                            Faltan: {remaining} {goal.unit}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button className="w-full bg-green-600 text-white py-3 rounded-lg font-medium">
                Donar a esta campaña
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderShop = () => (
    <div className="pb-20">
      <div className="p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Comprar Mercado</h1>
        
        {/* Search and Filter */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar productos..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button className="bg-gray-100 p-3 rounded-lg">
            <Filter className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Categories */}
        <div className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['Todos', 'Granos', 'Aceites', 'Enlatados', 'Lácteos'].map(category => (
              <button
                key={category}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  category === 'Todos' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 gap-3">
          {popularProducts.map(product => (
            <div key={product.id} className="bg-white rounded-lg border p-3 shadow-sm">
              <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Package className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <h3 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
              <p className="text-xs text-gray-500 mb-2">{product.unit}</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-green-600">{product.formattedPrice}</span>
                <span className="text-xs text-gray-500 line-through">$8.500</span>
              </div>
              <button className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium">
                Agregar al carrito
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="pb-20">
      <div className="p-4">
        {/* User Info */}
        <div className="bg-white rounded-lg border p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
              <p className="text-sm text-gray-600">{user?.email}</p>
              <p className="text-xs text-gray-500">{tenant?.name}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">12</p>
              <p className="text-xs text-gray-600">Donaciones</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-blue-600">8</p>
              <p className="text-xs text-gray-600">Compras</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-purple-600">45</p>
              <p className="text-xs text-gray-600">Familias</p>
            </div>
          </div>
        </div>

        {/* Menu Options */}
        <div className="space-y-2">
          {[
            { icon: Heart, label: 'Mis Donaciones', color: 'text-green-600' },
            { icon: ShoppingCart, label: 'Mis Compras', color: 'text-blue-600' },
            { icon: TrendingUp, label: 'Mi Impacto', color: 'text-purple-600' },
            { icon: Bell, label: 'Notificaciones', color: 'text-orange-600' },
            { icon: User, label: 'Configuración', color: 'text-gray-600' }
          ].map((item, index) => (
            <button
              key={index}
              className="w-full bg-white rounded-lg border p-4 flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <span className="font-medium text-gray-900">{item.label}</span>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadInitialData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Content */}
      <div className="pb-16">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'donate' && renderDonate()}
        {activeTab === 'shop' && renderShop()}
        {activeTab === 'profile' && renderProfile()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-4">
          {[
            { id: 'home', icon: Home, label: 'Inicio' },
            { id: 'donate', icon: Heart, label: 'Donar' },
            { id: 'shop', icon: ShoppingCart, label: 'Comprar' },
            { id: 'profile', icon: User, label: 'Perfil' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-3 flex flex-col items-center justify-center ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileApp;