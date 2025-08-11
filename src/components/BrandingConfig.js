import React, { useState, useEffect } from 'react';
import { Upload, Palette, Type, Layout, RotateCcw, Eye, Save } from 'lucide-react';
import api from '../services/api';

const BrandingConfig = ({ tenantId }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [changes, setChanges] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadBrandingConfig();
  }, [tenantId]);

  const loadBrandingConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/branding/config');
      setConfig(response.data.branding);
    } catch (error) {
      console.error('Error cargando configuración de branding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleColorChange = (colorKey, value) => {
    setChanges(prev => ({
      ...prev,
      [`${colorKey}Color`]: value
    }));
  };

  const handleTypographyChange = (key, value) => {
    setChanges(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleLayoutChange = (key, value) => {
    setChanges(prev => ({
      ...prev,
      layout: {
        ...prev.layout,
        [key]: value
      }
    }));
  };

  const handlePreview = async () => {
    try {
      const response = await api.post('/branding/preview', changes, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setPreviewMode(true);
      // Aplicar estilos de previsualización
      applyPreviewStyles(response.data.preview.branding);
    } catch (error) {
      console.error('Error generando previsualización:', error);
    }
  };

  const applyPreviewStyles = (branding) => {
    const root = document.documentElement;
    
    // Aplicar colores
    if (branding.colors) {
      Object.entries(branding.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
      });
    }

    // Aplicar tipografía
    if (branding.typography) {
      if (branding.typography.fontFamily) {
        root.style.setProperty('--font-family', branding.typography.fontFamily);
      }
      if (branding.typography.headingFont) {
        root.style.setProperty('--font-heading', branding.typography.headingFont);
      }
    }

    // Aplicar layout
    if (branding.layout) {
      if (branding.layout.borderRadius) {
        root.style.setProperty('--border-radius', branding.layout.borderRadius);
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/branding/config', changes);
      
      setChanges({});
      setPreviewMode(false);
      await loadBrandingConfig();
      
      // Mostrar mensaje de éxito
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert('Error guardando configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append('logo', file);

      await api.post('/branding/logo', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        }
      });

      await loadBrandingConfig();
      alert('Logo subido exitosamente');
    } catch (error) {
      console.error('Error subiendo logo:', error);
      alert('Error subiendo logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('¿Estás seguro de que quieres resetear toda la configuración a los valores por defecto?')) {
      return;
    }

    try {
      await api.post('/branding/reset', {}, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      
      setChanges({});
      setPreviewMode(false);
      await loadBrandingConfig();
      
      alert('Configuración reseteada exitosamente');
    } catch (error) {
      console.error('Error reseteando configuración:', error);
      alert('Error reseteando configuración');
    }
  };

  const getCurrentValue = (path) => {
    // Check if value exists in changes first
    if (changes[path] !== undefined) {
      return changes[path];
    }
    
    // Fallback to current config
    if (config && config[path] !== undefined) {
      return config[path];
    }
    
    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando configuración...</span>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Error cargando la configuración de branding</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración de Branding</h1>
          <p className="text-gray-600">Personaliza la apariencia de tu parroquia</p>
        </div>
        
        <div className="flex space-x-3">
          {previewMode && (
            <button
              onClick={() => setPreviewMode(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar Vista Previa
            </button>
          )}
          
          <button
            onClick={handlePreview}
            disabled={Object.keys(changes).length === 0}
            className="flex items-center px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            Vista Previa
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(changes).length === 0}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {previewMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            <Eye className="w-4 h-4 inline mr-2" />
            Modo vista previa activo. Los cambios se aplicarán temporalmente para que puedas verlos.
          </p>
        </div>
      )}

      {/* Logo Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Upload className="w-5 h-5 mr-2 text-gray-600" />
          <h2 className="text-lg font-semibold">Logo</h2>
        </div>
        
        <div className="flex items-center space-x-6">
          {config.logoUrl && (
            <div className="flex-shrink-0">
              <img
                src={config.logoUrl}
                alt="Logo actual"
                className="w-20 h-20 object-contain border border-gray-200 rounded-lg"
              />
            </div>
          )}
          
          <div>
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4 mr-2" />
                {uploadingLogo ? 'Subiendo...' : 'Subir Logo'}
              </span>
            </label>
            <p className="text-sm text-gray-500 mt-1">
              Formatos: JPEG, PNG, SVG, WebP. Máximo 2MB.
            </p>
          </div>
        </div>
      </div>

      {/* Colors Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Palette className="w-5 h-5 mr-2 text-gray-600" />
          <h2 className="text-lg font-semibold">Colores</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { key: 'primary', label: 'Primario' },
            { key: 'secondary', label: 'Secundario' },
            { key: 'accent', label: 'Acento' },
            { key: 'background', label: 'Fondo' },
            { key: 'text', label: 'Texto' }
          ].map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {label}
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={getCurrentValue(`${key}Color`)}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={getCurrentValue(`${key}Color`)}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="#000000"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Type className="w-5 h-5 mr-2 text-gray-600" />
          <h2 className="text-lg font-semibold">Tipografía</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fuente Principal
            </label>
            <input
              type="text"
              value={getCurrentValue('fontFamily')}
              onChange={(e) => handleTypographyChange('fontFamily', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Inter, system-ui, sans-serif"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fuente de Títulos
            </label>
            <input
              type="text"
              value={getCurrentValue('typography.headingFont')}
              onChange={(e) => handleTypographyChange('headingFont', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Inter, system-ui, sans-serif"
            />
          </div>
        </div>
      </div>

      {/* Layout Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Layout className="w-5 h-5 mr-2 text-gray-600" />
          <h2 className="text-lg font-semibold">Layout</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Radio de Bordes
            </label>
            <input
              type="text"
              value={getCurrentValue('layout.borderRadius')}
              onChange={(e) => handleLayoutChange('borderRadius', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="0.5rem"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-6 border-t">
        <button
          onClick={handleReset}
          className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Resetear a Valores por Defecto
        </button>
        
        <div className="text-sm text-gray-500">
          {Object.keys(changes).length > 0 && (
            <span>Tienes cambios sin guardar</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandingConfig;