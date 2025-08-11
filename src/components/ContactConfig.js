import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, Globe, Facebook, Instagram, Twitter, Youtube, Save } from 'lucide-react';
import api from '../services/api';

const ContactConfig = () => {
  const [contactInfo, setContactInfo] = useState({
    phone: '',
    email: '',
    address: '',
    website: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: '',
      youtube: ''
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState({});

  useEffect(() => {
    loadContactInfo();
  }, []);

  const loadContactInfo = async () => {
    try {
      setLoading(true);
      const response = await api.get('/branding/contact');
      setContactInfo(response.data.contactInfo);
    } catch (error) {
      console.error('Error cargando información de contacto:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setChanges(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSocialMediaChange = (platform, value) => {
    setChanges(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/branding/contact', changes);
      
      setChanges({});
      await loadContactInfo();
      
      alert('Información de contacto actualizada exitosamente');
    } catch (error) {
      console.error('Error guardando información de contacto:', error);
      alert('Error guardando información de contacto');
    } finally {
      setSaving(false);
    }
  };

  const getCurrentValue = (field) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      return changes[parent]?.[child] !== undefined 
        ? changes[parent][child] 
        : contactInfo[parent]?.[child] || '';
    }
    return changes[field] !== undefined ? changes[field] : contactInfo[field] || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando información de contacto...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Información de Contacto</h1>
          <p className="text-gray-600">Configura los datos de contacto de tu parroquia</p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving || Object.keys(changes).length === 0}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Basic Contact Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Información Básica</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 mr-2" />
              Teléfono
            </label>
            <input
              type="tel"
              value={getCurrentValue('phone')}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+57 300 123 4567"
            />
          </div>
          
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 mr-2" />
              Email
            </label>
            <input
              type="email"
              value={getCurrentValue('email')}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="contacto@parroquia.com"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 mr-2" />
              Dirección
            </label>
            <textarea
              value={getCurrentValue('address')}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Calle 123 #45-67, Barrio, Ciudad, País"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Globe className="w-4 h-4 mr-2" />
              Sitio Web
            </label>
            <input
              type="url"
              value={getCurrentValue('website')}
              onChange={(e) => handleInputChange('website', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://www.parroquia.com"
            />
          </div>
        </div>
      </div>

      {/* Social Media */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Redes Sociales</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Facebook className="w-4 h-4 mr-2 text-blue-600" />
              Facebook
            </label>
            <input
              type="text"
              value={getCurrentValue('socialMedia.facebook')}
              onChange={(e) => handleSocialMediaChange('facebook', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://facebook.com/parroquia o @parroquia"
            />
          </div>
          
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Instagram className="w-4 h-4 mr-2 text-pink-600" />
              Instagram
            </label>
            <input
              type="text"
              value={getCurrentValue('socialMedia.instagram')}
              onChange={(e) => handleSocialMediaChange('instagram', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://instagram.com/parroquia o @parroquia"
            />
          </div>
          
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Twitter className="w-4 h-4 mr-2 text-blue-400" />
              Twitter
            </label>
            <input
              type="text"
              value={getCurrentValue('socialMedia.twitter')}
              onChange={(e) => handleSocialMediaChange('twitter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://twitter.com/parroquia o @parroquia"
            />
          </div>
          
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Youtube className="w-4 h-4 mr-2 text-red-600" />
              YouTube
            </label>
            <input
              type="text"
              value={getCurrentValue('socialMedia.youtube')}
              onChange={(e) => handleSocialMediaChange('youtube', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://youtube.com/c/parroquia"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Vista Previa</h2>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-3">
            {getCurrentValue('phone') && (
              <div className="flex items-center text-gray-700">
                <Phone className="w-4 h-4 mr-3 text-gray-500" />
                <span>{getCurrentValue('phone')}</span>
              </div>
            )}
            
            {getCurrentValue('email') && (
              <div className="flex items-center text-gray-700">
                <Mail className="w-4 h-4 mr-3 text-gray-500" />
                <span>{getCurrentValue('email')}</span>
              </div>
            )}
            
            {getCurrentValue('address') && (
              <div className="flex items-start text-gray-700">
                <MapPin className="w-4 h-4 mr-3 mt-0.5 text-gray-500" />
                <span>{getCurrentValue('address')}</span>
              </div>
            )}
            
            {getCurrentValue('website') && (
              <div className="flex items-center text-gray-700">
                <Globe className="w-4 h-4 mr-3 text-gray-500" />
                <a 
                  href={getCurrentValue('website')} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {getCurrentValue('website')}
                </a>
              </div>
            )}
            
            {/* Social Media Links */}
            <div className="flex space-x-4 pt-2">
              {getCurrentValue('socialMedia.facebook') && (
                <a 
                  href={getCurrentValue('socialMedia.facebook').startsWith('http') 
                    ? getCurrentValue('socialMedia.facebook') 
                    : `https://facebook.com/${getCurrentValue('socialMedia.facebook').replace('@', '')}`
                  }
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              
              {getCurrentValue('socialMedia.instagram') && (
                <a 
                  href={getCurrentValue('socialMedia.instagram').startsWith('http') 
                    ? getCurrentValue('socialMedia.instagram') 
                    : `https://instagram.com/${getCurrentValue('socialMedia.instagram').replace('@', '')}`
                  }
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:text-pink-800"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              
              {getCurrentValue('socialMedia.twitter') && (
                <a 
                  href={getCurrentValue('socialMedia.twitter').startsWith('http') 
                    ? getCurrentValue('socialMedia.twitter') 
                    : `https://twitter.com/${getCurrentValue('socialMedia.twitter').replace('@', '')}`
                  }
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-600"
                >
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              
              {getCurrentValue('socialMedia.youtube') && (
                <a 
                  href={getCurrentValue('socialMedia.youtube')}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-red-600 hover:text-red-800"
                >
                  <Youtube className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      {Object.keys(changes).length > 0 && (
        <div className="text-center text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Tienes cambios sin guardar. No olvides hacer clic en "Guardar" para aplicar los cambios.
        </div>
      )}
    </div>
  );
};

export default ContactConfig;