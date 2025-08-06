import React, { useState, useEffect } from 'react';
import { profileService, handleApiError } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, 
  Heart, 
  ShoppingCart, 
  TrendingUp, 
  Award, 
  Settings, 
  Activity,
  DollarSign,
  Users,
  Calendar,
  Star,
  Gift,
  Target,
  AlertCircle
} from 'lucide-react';

const UserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await profileService.getCompleteProfile();
      setProfile(data);
    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando perfil...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
        <p className="text-gray-600">{error}</p>
        <button
          onClick={loadProfile}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center">
        <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Perfil no disponible</h3>
        <p className="text-gray-600">No se pudo cargar la información del perfil.</p>
      </div>
    );
  }

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

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Información básica del usuario */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile.user.name}</h2>
            <p className="text-gray-600">{profile.user.email}</p>
            <p className="text-sm text-gray-500">
              Miembro desde {formatDate(profile.user.createdAt)}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Heart className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">Como Donante</span>
            </div>
            <p className="text-lg font-bold text-green-600">
              {profile.donorProfile.level.icon} {profile.donorProfile.level.level}
            </p>
          </div>
          
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Como Consumidor</span>
            </div>
            <p className="text-lg font-bold text-blue-600">
              {profile.consumerProfile.level.icon} {profile.consumerProfile.level.level}
            </p>
          </div>
        </div>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Total Donado</span>
          </div>
          <p className="text-xl font-bold text-green-600">
            {formatCurrency(profile.donorProfile.stats.totalDonated)}
          </p>
          <p className="text-xs text-gray-500">
            {profile.donorProfile.stats.totalDonations} donaciones
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Familias Ayudadas</span>
          </div>
          <p className="text-xl font-bold text-blue-600">
            {profile.donorProfile.stats.familiesHelped}
          </p>
          <p className="text-xs text-gray-500">
            {profile.donorProfile.stats.campaignsSupported} campañas apoyadas
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Ahorros Obtenidos</span>
          </div>
          <p className="text-xl font-bold text-purple-600">
            {formatCurrency(profile.consumerProfile.savings.totalSaved)}
          </p>
          <p className="text-xs text-gray-500">
            {profile.consumerProfile.stats.totalPurchases} compras
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">Este Mes</span>
          </div>
          <p className="text-xl font-bold text-orange-600">
            {profile.donorProfile.stats.currentMonthDonations + profile.consumerProfile.stats.currentMonthPurchases}
          </p>
          <p className="text-xs text-gray-500">
            actividades realizadas
          </p>
        </div>
      </div>

      {/* Insignias y logros */}
      {profile.donorProfile.badges.length > 0 && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-600" />
            Insignias y Logros
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.donorProfile.badges.map((badge, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="font-medium text-yellow-800">{badge.name}</p>
                  <p className="text-sm text-yellow-600">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderDonorProfile = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-green-600" />
          Perfil de Donante
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl mb-2">{profile.donorProfile.level.icon}</div>
            <h4 className="font-semibold text-lg">{profile.donorProfile.level.level}</h4>
            <p className="text-sm text-gray-600">Nivel de Donante</p>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total Donaciones</p>
              <p className="text-xl font-bold">{profile.donorProfile.stats.totalDonations}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Promedio por Donación</p>
              <p className="text-xl font-bold">{formatCurrency(profile.donorProfile.stats.averageDonation)}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Campañas Apoyadas</p>
              <p className="text-xl font-bold">{profile.donorProfile.stats.campaignsSupported}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Familias Beneficiadas</p>
              <p className="text-xl font-bold">{profile.donorProfile.stats.familiesHelped}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campañas favoritas */}
      {profile.donorProfile.stats.favoriteCampaigns.length > 0 && (
        <div className="bg-white p-6 rounded-lg border">
          <h4 className="font-semibold mb-4">Campañas que Más Apoyas</h4>
          <div className="space-y-3">
            {profile.donorProfile.stats.favoriteCampaigns.map((campaign, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">{campaign.title}</span>
                <span className="text-sm text-gray-600">{campaign.donation_count} donaciones</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderConsumerProfile = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          Perfil de Consumidor
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl mb-2">{profile.consumerProfile.level.icon}</div>
            <h4 className="font-semibold text-lg">{profile.consumerProfile.level.level}</h4>
            <p className="text-sm text-gray-600">Nivel de Consumidor</p>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total Compras</p>
              <p className="text-xl font-bold">{profile.consumerProfile.stats.totalPurchases}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Promedio por Compra</p>
              <p className="text-xl font-bold">{formatCurrency(profile.consumerProfile.stats.averagePurchase)}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total Ahorrado</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(profile.consumerProfile.savings.totalSaved)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Contribución Plataforma</p>
              <p className="text-xl font-bold">{formatCurrency(profile.consumerProfile.stats.platformFeesContributed)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Productos favoritos */}
      {profile.consumerProfile.stats.favoriteProducts.length > 0 && (
        <div className="bg-white p-6 rounded-lg border">
          <h4 className="font-semibold mb-4">Productos que Más Compras</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.consumerProfile.stats.favoriteProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Producto {product.productId}</span>
                <span className="text-sm text-gray-600">{product.quantity} unidades</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderActivity = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-600" />
          Actividad Reciente
        </h3>
        
        {profile.recentActivity.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay actividad reciente</p>
        ) : (
          <div className="space-y-4">
            {profile.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.type === 'donation' ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                  {activity.type === 'donation' ? (
                    <Heart className={`w-5 h-5 ${activity.type === 'donation' ? 'text-green-600' : 'text-blue-600'}`} />
                  ) : (
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      {activity.type === 'donation' ? 'Donación' : 'Compra'}
                      {activity.campaign_title && ` - ${activity.campaign_title}`}
                    </h4>
                    <span className="text-sm text-gray-500">
                      {formatDate(activity.created_at)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-1">
                    Estado: <span className={`font-medium ${
                      activity.status === 'received' || activity.status === 'delivered' 
                        ? 'text-green-600' 
                        : 'text-yellow-600'
                    }`}>
                      {activity.status === 'received' ? 'Recibido' : 
                       activity.status === 'delivered' ? 'Entregado' :
                       activity.status === 'pending' ? 'Pendiente' : activity.status}
                    </span>
                  </p>
                  
                  {activity.total_amount && (
                    <p className="text-sm text-gray-600">
                      Monto: {formatCurrency(activity.total_amount)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mi Perfil</h1>
        <p className="text-gray-600">Gestiona tu información y revisa tu actividad como donante y consumidor</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Resumen', icon: TrendingUp },
            { id: 'donor', label: 'Como Donante', icon: Heart },
            { id: 'consumer', label: 'Como Consumidor', icon: ShoppingCart },
            { id: 'activity', label: 'Actividad', icon: Activity }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido de tabs */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'donor' && renderDonorProfile()}
      {activeTab === 'consumer' && renderConsumerProfile()}
      {activeTab === 'activity' && renderActivity()}
    </div>
  );
};

export default UserProfile;