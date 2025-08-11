import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Send,
  Users,
  BarChart3,
  Settings,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Phone,
  MessageSquare,
  TrendingUp,
  Clock,
  Zap
} from 'lucide-react';
import api from '../services/api';

const WhatsAppBotManager = ({ tenantId, user }) => {
  const [botStatus, setBotStatus] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastRecipients, setBroadcastRecipients] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadBotData();
  }, [tenantId]);

  const loadBotData = async () => {
    try {
      setLoading(true);
      const [statusResponse, analyticsResponse, conversationsResponse] = await Promise.all([
        api.get('/whatsapp/status', {
          headers: { 'X-Tenant-ID': tenantId }
        }),
        api.get('/whatsapp/analytics', {
          headers: { 'X-Tenant-ID': tenantId }
        }),
        api.get('/whatsapp/conversations', {
          headers: { 'X-Tenant-ID': tenantId }
        })
      ]);

      setBotStatus(statusResponse.data.status);
      setAnalytics(analyticsResponse.data.analytics);
      setConversations(conversationsResponse.data.conversations);
    } catch (error) {
      console.error('Error loading bot data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestBot = async () => {
    if (!testPhone) {
      alert('Por favor ingresa un número de teléfono');
      return;
    }

    try {
      const response = await api.post('/whatsapp/test', {
        phone_number: testPhone
      }, {
        headers: { 'X-Tenant-ID': tenantId }
      });

      if (response.data.success) {
        alert('Mensaje de prueba enviado exitosamente');
        setTestPhone('');
      }
    } catch (error) {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage || !broadcastRecipients) {
      alert('Por favor completa el mensaje y los destinatarios');
      return;
    }

    try {
      const recipients = broadcastRecipients.split('\n').map(phone => phone.trim()).filter(phone => phone);
      
      const response = await api.post('/whatsapp/broadcast', {
        recipients,
        message: broadcastMessage
      }, {
        headers: { 'X-Tenant-ID': tenantId }
      });

      if (response.data.success) {
        alert(`Broadcast enviado: ${response.data.summary.successful} exitosos, ${response.data.summary.failed} fallidos`);
        setBroadcastMessage('');
        setBroadcastRecipients('');
      }
    } catch (error) {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Estado del Bot</p>
              <p className="text-2xl font-bold text-gray-900">
                {botStatus?.configured ? 'Activo' : 'Inactivo'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              botStatus?.configured ? 'bg-green-50' : 'bg-red-50'
            }`}>
              {botStatus?.configured ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Conversaciones</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics?.totalConversations || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Donaciones</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics?.completedDonations || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Conversión</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics?.conversionRate || 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de Configuración</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              botStatus?.configured ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-gray-700">
              WhatsApp API: {botStatus?.configured ? 'Configurado' : 'No configurado'}
            </span>
          </div>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              botStatus?.webhook_verified ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-gray-700">
              Webhook: {botStatus?.webhook_verified ? 'Verificado' : 'No verificado'}
            </span>
          </div>
        </div>
        
        {botStatus?.phone_number_id && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>ID del Número:</strong> {botStatus.phone_number_id}
            </p>
          </div>
        )}
      </div>

      {/* Top Commands */}
      {analytics?.topCommands && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comandos Más Usados</h3>
          <div className="space-y-3">
            {analytics.topCommands.map((command, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                  </div>
                  <span className="font-medium text-gray-900">/{command.command}</span>
                </div>
                <span className="text-sm text-gray-600">{command.count} usos</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderConversations = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Conversaciones Activas</h3>
          <button
            onClick={loadBotData}
            className="px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </button>
        </div>

        {conversations.length > 0 ? (
          <div className="space-y-3">
            {conversations.map((conversation, index) => (
              <div key={index} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 text-gray-500 mr-2" />
                    <span className="font-medium text-gray-900">{conversation.phone_number}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-1" />
                    {new Date(conversation.last_updated).toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Flujo: <span className="font-medium">{conversation.current_flow}</span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Paso: <span className="font-medium">{conversation.current_step}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No hay conversaciones activas</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderTools = () => (
    <div className="space-y-6">
      {/* Test Bot */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Probar Bot</h3>
        <div className="flex space-x-3">
          <input
            type="text"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Número de teléfono (ej: +573001234567)"
          />
          <button
            onClick={handleTestBot}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Send className="w-4 h-4 mr-2" />
            Enviar Prueba
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Envía un mensaje de prueba para verificar que el bot funciona correctamente.
        </p>
      </div>

      {/* Broadcast */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Envío Masivo</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje
            </label>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="4"
              placeholder="Escribe tu mensaje aquí..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destinatarios (un número por línea)
            </label>
            <textarea
              value={broadcastRecipients}
              onChange={(e) => setBroadcastRecipients(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="6"
              placeholder="+573001234567&#10;+573007654321&#10;+573009876543"
            />
          </div>
          
          <button
            onClick={handleBroadcast}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
          >
            <Users className="w-4 h-4 mr-2" />
            Enviar Broadcast
          </button>
        </div>
        
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Nota:</strong> Máximo 100 destinatarios por envío. Usa esta función responsablemente.
          </p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando bot de WhatsApp...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Bot de WhatsApp</h1>
            <p className="text-gray-600 mt-1">
              Gestiona el bot conversacional para donaciones y consultas
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={loadBotData}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg">
          {[
            { key: 'overview', name: 'Resumen', icon: BarChart3 },
            { key: 'conversations', name: 'Conversaciones', icon: MessageSquare },
            { key: 'tools', name: 'Herramientas', icon: Settings }
          ].map(({ key, name, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                activeTab === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {name}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'conversations' && renderConversations()}
        {activeTab === 'tools' && renderTools()}
      </div>
    </div>
  );
};

export default WhatsAppBotManager;