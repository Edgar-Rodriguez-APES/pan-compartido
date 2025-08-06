import React, { useState, useEffect } from 'react';
import { brandingService, handleApiError } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Palette, Save, Eye, AlertCircle, CheckCircle } from 'lucide-react';

const BrandingConfig = () => {
  const { user, hasAnyRole } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('colors');

  // Verificar permisos
  if (!hasAnyRole(['parroco', 'admin'])) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Acceso Denegado</h3>
        <p className="text-gray-600">No tienes permisos para acceder a la configuración de branding.</p>
      </div>
    );
  }

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await brandingService.getConfig();
      setConfig(data);
    } catch (error) {
      setMessage({
        type: 'error',
        text: handleApiError(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await brandingService.updateConfig(config);
      setMessage({
        type: 'success',
        text: 'Configuración guardada exitosamente'
      });
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: handleApiError(error)
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (section, field, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const updateNestedConfig = (section, subsection, field, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...prev[section][subsection],
          [field]: value
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando configuración...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
        <p className="text-gray-600">No se pudo cargar la configuración de branding.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Palette className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Configuración de Branding</h1>
        </div>
        <p className="text-gray-600">Personaliza la apariencia y mensajes de tu parroquia</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'colors', label: 'Colores' },
            { id: 'contact', label: 'Contacto' },
            { id: 'settings', label: 'Configuración' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido de tabs */}
      <div className="space-y-6">
        {activeTab === 'colors' && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Colores de la Marca</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Primario
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.branding?.colors?.primary || '#2563eb'}
                    onChange={(e) => updateNestedConfig('branding', 'colors', 'primary', e.target.value)}
                    className="h-10 w-20 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={config.branding?.colors?.primary || '#2563eb'}
                    onChange={(e) => updateNestedConfig('branding', 'colors', 'primary', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="#2563eb"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Secundario
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.branding?.colors?.secondary || '#10b981'}
                    onChange={(e) => updateNestedConfig('branding', 'colors', 'secondary', e.target.value)}
                    className="h-10 w-20 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={config.branding?.colors?.secondary || '#10b981'}
                    onChange={(e) => updateNestedConfig('branding', 'colors', 'secondary', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="#10b981"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color de Acento
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.branding?.colors?.accent || '#f59e0b'}
                    onChange={(e) => updateNestedConfig('branding', 'colors', 'accent', e.target.value)}
                    className="h-10 w-20 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={config.branding?.colors?.accent || '#f59e0b'}
                    onChange={(e) => updateNestedConfig('branding', 'colors', 'accent', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="#f59e0b"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color de Fondo
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.branding?.colors?.background || '#f8fafc'}
                    onChange={(e) => updateNestedConfig('branding', 'colors', 'background', e.target.value)}
                    className="h-10 w-20 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={config.branding?.colors?.background || '#f8fafc'}
                    onChange={(e) => updateNestedConfig('branding', 'colors', 'background', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="#f8fafc"
                  />
                </div>
              </div>
            </div>

            {/* Vista previa de colores */}
            <div className="mt-6 p-4 border rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Vista Previa</h4>
              <div className="flex gap-4">
                <button 
                  className="px-4 py-2 rounded text-white font-medium"
                  style={{ backgroundColor: config.branding?.colors?.primary }}
                >
                  Botón Primario
                </button>
                <button 
                  className="px-4 py-2 rounded text-white font-medium"
                  style={{ backgroundColor: config.branding?.colors?.secondary }}
                >
                  Botón Secundario
                </button>
                <div 
                  className="px-4 py-2 rounded font-medium"
                  style={{ 
                    backgroundColor: config.branding?.colors?.accent,
                    color: 'white'
                  }}
                >
                  Acento
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Información de Contacto</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={config.contact?.phone || ''}
                  onChange={(e) => updateConfig('contact', 'phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="300-123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={config.contact?.email || ''}
                  onChange={(e) => updateConfig('contact', 'email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="contacto@parroquia.org"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dirección
                </label>
                <textarea
                  value={config.contact?.address || ''}
                  onChange={(e) => updateConfig('contact', 'address', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Calle 123 #45-67, Ciudad, País"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sitio Web
                </label>
                <input
                  type="url"
                  value={config.contact?.website || ''}
                  onChange={(e) => updateConfig('contact', 'website', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://www.parroquia.org"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  value={config.contact?.socialMedia?.whatsapp || ''}
                  onChange={(e) => updateNestedConfig('contact', 'socialMedia', 'whatsapp', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="300-123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facebook
                </label>
                <input
                  type="url"
                  value={config.contact?.socialMedia?.facebook || ''}
                  onChange={(e) => updateNestedConfig('contact', 'socialMedia', 'facebook', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://facebook.com/parroquia"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instagram
                </label>
                <input
                  type="url"
                  value={config.contact?.socialMedia?.instagram || ''}
                  onChange={(e) => updateNestedConfig('contact', 'socialMedia', 'instagram', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://instagram.com/parroquia"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Configuración General</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frecuencia de Campañas
                </label>
                <select
                  value={config.settings?.campaignFrequency || 'weekly'}
                  onChange={(e) => updateConfig('settings', 'campaignFrequency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto Mínimo de Pedido (COP)
                </label>
                <input
                  type="number"
                  value={config.settings?.minOrderAmount || 50000}
                  onChange={(e) => updateConfig('settings', 'minOrderAmount', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="0"
                  step="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Porcentaje de Sostenimiento de Plataforma (%)
                </label>
                <input
                  type="number"
                  value={config.settings?.platformFeePercentage || 5}
                  onChange={(e) => updateConfig('settings', 'platformFeePercentage', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="0"
                  max="20"
                  step="0.1"
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Notificaciones</h4>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="whatsapp-notifications"
                    checked={config.settings?.enableWhatsAppNotifications !== false}
                    onChange={(e) => updateConfig('settings', 'enableWhatsAppNotifications', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="whatsapp-notifications" className="ml-2 text-sm text-gray-700">
                    Habilitar notificaciones por WhatsApp
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="email-notifications"
                    checked={config.settings?.enableEmailNotifications !== false}
                    onChange={(e) => updateConfig('settings', 'enableEmailNotifications', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="email-notifications" className="ml-2 text-sm text-gray-700">
                    Habilitar notificaciones por email
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="phone-verification"
                    checked={config.settings?.requirePhoneVerification === true}
                    onChange={(e) => updateConfig('settings', 'requirePhoneVerification', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="phone-verification" className="ml-2 text-sm text-gray-700">
                    Requerir verificación de teléfono
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="public-donations"
                    checked={config.settings?.allowPublicDonations !== false}
                    onChange={(e) => updateConfig('settings', 'allowPublicDonations', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="public-donations" className="ml-2 text-sm text-gray-700">
                    Permitir donaciones públicas (sin registro)
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botón de guardar */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
};

export default BrandingConfig;