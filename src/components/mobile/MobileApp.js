import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { campaignService, productService, handleApiError } from '../../services/api';
import { 
  Heart, 
  ShoppingCart, 
  Home, 
  User, 
  Bell,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Package,
  Target,
  TrendingUp,
  Gift
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

  const renderTabBar = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-bottom">
      <div className="flex justify-around items-center">
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
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                isActive 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-500'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs mt-1 font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderHeader = () => (
    <div className="bg-white border-b border-gray-200 px-4 py-3 safe-area-top">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: tenant?.branding?.colors?.primary || '#2563eb' }}
          >
            <Package className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{tenant?.name || 'Pan Compartido'}</h1>
            <p className="text-xs text-gray-600">¡Hola, {user?.name}!</p>
          </div>
        </div>
        
        <button className="relative p-2">
          <Bell size={20} className="text-gray-600" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
        </button>
      </div>
    </div>
  );

  const renderHomeTab = () => (
    <div className="pb-20">
      {/* Header */}
      {renderHeader()}
      
      {/* Quick Stats */}
      <div className="px-4 py-4 bg-gray-50">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Mis Donaciones</span>
            </div>
            <p className="text-xl font-bold text-green-600">12</p>
            <p className="text-xs text-gray-500">Este mes</p>
          </div>
          
          <div className="bg-white p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Familias Ayudadas</span>
            </div>
            <p className="text-xl font-bold text-blue-600">45</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>
      </div>

      {/* Active Campaigns */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Campañas Activas</h2>
          <button className="text-blue-600 text-sm font-medium">Ver todas</button>
        </div>
        
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-white p-4 rounded-xl border animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-2 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : activeCampaigns.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No hay campañas activas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCampaigns.slice(0, 3).map(campaign => (
              <div key={campaign.id} className="bg-white p-4 rounded-xl border">
                <h3 className="font-semibold text-gray-900 mb-2">{campaign.title}</h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{campaign.description}</p>
                
                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progreso</span>
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
                
                <button 
                  className="w-full py-2 px-4 rounded-lg font-medium text-white transition-colors"
                  style={{ backgroundColor: tenant?.branding?.colors?.primary || '#2563eb' }}
                  onClick={() => setActiveTab('donate')}
                >
                  Donar Ahora
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Popular Products */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Productos Populares</h2>
          <button className="text-blue-600 text-sm font-medium">Ver todos</button>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {popularProducts.slice(0, 4).map(product => (
            <div key={product.id} className="bg-white p-3 rounded-xl border">
              <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-medium text-sm text-gray-900 mb-1">{product.name}</h3>
              <p className="text-xs text-gray-600 mb-2">{product.categoryDisplayName}</p>
              <p className="text-sm font-bold text-green-600">{product.formattedPrice}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDonateTab = () => (
    <div className="pb-20">
      {renderHeader()}
      
      <div className="px-4 py-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Hacer Donación</h2>
        
        {activeCampaigns.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border text-center">
            <Heart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No hay campañas activas</p>
            <p className="text-sm text-gray-500">Vuelve pronto para ver nuevas oportunidades de ayudar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeCampaigns.map(campaign => (
              <CampaignDonationCard 
                key={campaign.id} 
                campaign={campaign} 
                tenant={tenant}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderShopTab = () => (
    <div className="pb-20">
      {renderHeader()}
      
      <div className="px-4 py-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Comprar Productos</h2>
        
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-800">Precios Mayoristas</span>
          </div>
          <p className="text-sm text-blue-700">
            Aprovecha precios especiales comprando productos de alta calidad
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {popularProducts.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              tenant={tenant}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderProfileTab = () => (
    <div className="pb-20">
      {renderHeader()}
      
      <div className="px-4 py-4">
        {/* User Info */}
        <div className="bg-white p-4 rounded-xl border mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <Heart className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-green-800">Donante</p>
              <p className="text-xs text-green-600">Nivel: Solidario</p>
            </div>
            
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-blue-800">Consumidor</p>
              <p className="text-xs text-blue-600">Nivel: Regular</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <button className="w-full bg-white p-4 rounded-xl border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Mis Donaciones</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
          
          <button className="w-full bg-white p-4 rounded-xl border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Mis Compras</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
          
          <button className="w-full bg-white p-4 rounded-xl border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Notificaciones</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (loading && activeCampaigns.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
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
          <button
            onClick={loadInitialData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {activeTab === 'home' && renderHomeTab()}
      {activeTab === 'donate' && renderDonateTab()}
      {activeTab === 'shop' && renderShopTab()}
      {activeTab === 'profile' && renderProfileTab()}
      
      {renderTabBar()}
    </div>
  );
};

// Componente para tarjeta de donación de campaña
const CampaignDonationCard = ({ campaign, tenant }) => {
  const [selectedItems, setSelectedItems] = useState({});
  const [showDonationForm, setShowDonationForm] = useState(false);

  const handleItemQuantityChange = (itemName, quantity) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemName]: Math.max(0, quantity)
    }));
  };

  const getTotalSelectedItems = () => {
    return Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);
  };

  if (showDonationForm) {
    return (
      <div className="bg-white p-4 rounded-xl border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{campaign.title}</h3>
          <button 
            onClick={() => setShowDonationForm(false)}
            className="text-gray-500"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {Object.entries(campaign.goals || {}).map(([itemName, goal]) => {
            const progress = campaign.currentProgress?.[itemName] || { received: 0 };
            const remaining = Math.max(0, goal.needed - progress.received);
            
            return (
              <div key={itemName} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{itemName}</span>
                  <span className="text-sm text-gray-600">
                    Faltan: {remaining} {goal.unit}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleItemQuantityChange(itemName, (selectedItems[itemName] || 0) - 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <Minus size={16} />
                  </button>
                  
                  <span className="font-medium min-w-[2rem] text-center">
                    {selectedItems[itemName] || 0}
                  </span>
                  
                  <button
                    onClick={() => handleItemQuantityChange(itemName, (selectedItems[itemName] || 0) + 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <Plus size={16} />
                  </button>
                  
                  <span className="text-sm text-gray-600">{goal.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          disabled={getTotalSelectedItems() === 0}
          className="w-full py-3 px-4 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: tenant?.branding?.colors?.primary || '#2563eb' }}
        >
          Confirmar Donación ({getTotalSelectedItems()} items)
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl border">
      <h3 className="font-semibold text-gray-900 mb-2">{campaign.title}</h3>
      <p className="text-sm text-gray-600 mb-3">{campaign.description}</p>
      
      {/* Necesidades */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Necesidades:</h4>
        <div className="space-y-2">
          {Object.entries(campaign.goals || {}).slice(0, 3).map(([itemName, goal]) => {
            const progress = campaign.currentProgress?.[itemName] || { received: 0 };
            const remaining = Math.max(0, goal.needed - progress.received);
            
            return (
              <div key={itemName} className="flex justify-between text-sm">
                <span className="capitalize">{itemName}</span>
                <span className="text-gray-600">
                  {remaining} {goal.unit} restantes
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      <button
        onClick={() => setShowDonationForm(true)}
        className="w-full py-2 px-4 rounded-lg font-medium text-white transition-colors"
        style={{ backgroundColor: tenant?.branding?.colors?.primary || '#2563eb' }}
      >
        Seleccionar Donación
      </button>
    </div>
  );
};

// Componente para tarjeta de producto
const ProductCard = ({ product, tenant }) => {
  const [quantity, setQuantity] = useState(0);

  return (
    <div className="bg-white p-3 rounded-xl border">
      <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
        <Package className="w-8 h-8 text-gray-400" />
      </div>
      
      <h3 className="font-medium text-sm text-gray-900 mb-1">{product.name}</h3>
      <p className="text-xs text-gray-600 mb-2">{product.categoryDisplayName}</p>
      <p className="text-sm font-bold text-green-600 mb-3">{product.formattedPrice}</p>
      
      {quantity === 0 ? (
        <button
          onClick={() => setQuantity(1)}
          className="w-full py-2 px-3 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: tenant?.branding?.colors?.secondary || '#10b981' }}
        >
          Agregar
        </button>
      ) : (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setQuantity(Math.max(0, quantity - 1))}
            className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <Minus size={12} />
          </button>
          
          <span className="font-medium">{quantity}</span>
          
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <Plus size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileApp;