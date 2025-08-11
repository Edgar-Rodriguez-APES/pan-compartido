import React, { useState, useEffect } from 'react';
import { MessageSquare, Mail, Bell, Plus, Edit, Trash2, Eye, Save, X } from 'lucide-react';
import api from '../services/api';

const MessageTemplateManager = ({ tenantId }) => {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [saving, setSaving] = useState(false);

  const categories = [
    { key: 'all', label: 'Todos' },
    { key: 'onboarding', label: 'Bienvenida' },
    { key: 'campaigns', label: 'Campañas' },
    { key: 'donations', label: 'Donaciones' },
    { key: 'payments', label: 'Pagos' },
    { key: 'reminders', label: 'Recordatorios' },
    { key: 'reports', label: 'Reportes' }
  ];

  const channels = [
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-600' },
    { key: 'email', label: 'Email', icon: Mail, color: 'text-blue-600' },
    { key: 'push', label: 'Push', icon: Bell, color: 'text-purple-600' }
  ];

  useEffect(() => {
    loadTemplates();
  }, [tenantId, selectedCategory]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = selectedCategory !== 'all' ? { category: selectedCategory } : {};
      const response = await api.get('/message-templates', {
        headers: { 'X-Tenant-ID': tenantId },
        params
      });
      setTemplates(response.data.templates);
    } catch (error) {
      console.error('Error cargando templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (channel, templateKey, template) => {
    setEditingTemplate({
      channel,
      templateKey,
      ...template,
      originalKey: templateKey
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const templateData = {
        id: editingTemplate.id,
        channel: editingTemplate.channel,
        templateKey: editingTemplate.templateKey,
        name: editingTemplate.name,
        content: editingTemplate.content || '',
        subject: editingTemplate.subject || '',
        title: editingTemplate.title || '',
        body: editingTemplate.body || '',
        category: editingTemplate.category
      };

      if (editingTemplate.id) {
        await api.put(`/message-templates/${editingTemplate.id}`, templateData, {
          headers: { 'X-Tenant-ID': tenantId }
        });
      } else {
        await api.post('/message-templates', templateData, {
          headers: { 'X-Tenant-ID': tenantId }
        });
      }

      setEditingTemplate(null);
      await loadTemplates();
      alert('Template guardado exitosamente');
    } catch (error) {
      console.error('Error guardando template:', error);
      alert('Error guardando template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este template?')) {
      return;
    }

    try {
      await api.delete(`/message-templates/${templateId}`, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      await loadTemplates();
      alert('Template eliminado exitosamente');
    } catch (error) {
      console.error('Error eliminando template:', error);
      alert('Error eliminando template');
    }
  };

  const handlePreview = async (channel, templateKey) => {
    try {
      const response = await api.get(`/message-templates/${channel}/${templateKey}/preview`, {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setPreviewTemplate(response.data);
    } catch (error) {
      console.error('Error generando previsualización:', error);
    }
  };

  const handleNewTemplate = (channel) => {
    setEditingTemplate({
      channel,
      templateKey: '',
      name: '',
      content: '',
      subject: '',
      title: '',
      body: '',
      category: 'campaigns',
      isNew: true
    });
  };

  const renderTemplateEditor = () => {
    if (!editingTemplate) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-semibold">
              {editingTemplate.isNew ? 'Nuevo Template' : 'Editar Template'}
            </h3>
            <button
              onClick={() => setEditingTemplate(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Canal
                </label>
                <select
                  value={editingTemplate.channel}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, channel: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={!editingTemplate.isNew}
                >
                  {channels.map(channel => (
                    <option key={channel.key} value={channel.key}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
                <select
                  value={editingTemplate.category}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {categories.slice(1).map(category => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clave del Template
              </label>
              <input
                type="text"
                value={editingTemplate.templateKey}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev, templateKey: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="ej: welcome, campaign_new"
                disabled={!editingTemplate.isNew}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Template
              </label>
              <input
                type="text"
                value={editingTemplate.name}
                onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Nombre descriptivo del template"
              />
            </div>

            {editingTemplate.channel === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asunto del Email
                </label>
                <input
                  type="text"
                  value={editingTemplate.subject || ''}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Asunto del email"
                />
              </div>
            )}

            {editingTemplate.channel === 'push' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título de la Notificación
                </label>
                <input
                  type="text"
                  value={editingTemplate.title || ''}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Título de la notificación push"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editingTemplate.channel === 'push' ? 'Cuerpo del Mensaje' : 'Contenido'}
              </label>
              <textarea
                value={editingTemplate.channel === 'push' ? (editingTemplate.body || '') : (editingTemplate.content || '')}
                onChange={(e) => {
                  const field = editingTemplate.channel === 'push' ? 'body' : 'content';
                  setEditingTemplate(prev => ({ ...prev, [field]: e.target.value }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={editingTemplate.channel === 'email' ? 10 : 6}
                placeholder="Contenido del mensaje. Usa {{variable}} para variables dinámicas"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Variables disponibles:</p>
              <div className="flex flex-wrap gap-2">
                {['name', 'parish_name', 'campaign_title', 'items', 'families', 'amount'].map(variable => (
                  <span
                    key={variable}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded cursor-pointer hover:bg-blue-200"
                    onClick={() => {
                      const field = editingTemplate.channel === 'push' ? 'body' : 'content';
                      const currentValue = editingTemplate[field] || '';
                      setEditingTemplate(prev => ({
                        ...prev,
                        [field]: currentValue + `{{${variable}}}`
                      }));
                    }}
                  >
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t">
            <button
              onClick={() => setEditingTemplate(null)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPreviewModal = () => {
    if (!previewTemplate) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-semibold">Vista Previa del Template</h3>
            <button
              onClick={() => setPreviewTemplate(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <h4 className="font-medium text-gray-900">{previewTemplate.template.name}</h4>
              <p className="text-sm text-gray-500">
                Canal: {previewTemplate.template.channel} | Variables de ejemplo
              </p>
            </div>

            <div className="space-y-4">
              {previewTemplate.rendered.subject && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asunto:
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    {previewTemplate.rendered.subject}
                  </div>
                </div>
              )}

              {previewTemplate.rendered.title && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título:
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    {previewTemplate.rendered.title}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {previewTemplate.template.channel === 'push' ? 'Cuerpo:' : 'Contenido:'}
                </label>
                <div className="p-3 bg-gray-50 rounded-lg whitespace-pre-wrap">
                  {previewTemplate.rendered.body || previewTemplate.rendered.content}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <Eye className="w-4 h-4 inline mr-1" />
                Esta es una previsualización con datos de ejemplo. En el uso real, las variables se reemplazarán con datos reales.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando templates...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates de Mensajes</h1>
          <p className="text-gray-600">Personaliza los mensajes automáticos de tu parroquia</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex space-x-2 mb-6 overflow-x-auto">
        {categories.map(category => (
          <button
            key={category.key}
            onClick={() => setSelectedCategory(category.key)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              selectedCategory === category.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Templates by Channel */}
      <div className="space-y-8">
        {channels.map(channel => {
          const channelTemplates = templates[channel.key] || {};
          const hasTemplates = Object.keys(channelTemplates).length > 0;

          return (
            <div key={channel.key} className="bg-white rounded-lg shadow">
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center">
                  <channel.icon className={`w-5 h-5 mr-2 ${channel.color}`} />
                  <h2 className="text-lg font-semibold">{channel.label}</h2>
                  <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                    {Object.keys(channelTemplates).length} templates
                  </span>
                </div>
                <button
                  onClick={() => handleNewTemplate(channel.key)}
                  className="flex items-center px-3 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Nuevo
                </button>
              </div>

              <div className="p-6">
                {hasTemplates ? (
                  <div className="grid gap-4">
                    {Object.entries(channelTemplates).map(([templateKey, template]) => (
                      <div key={templateKey} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-gray-900">{template.name}</h3>
                            <p className="text-sm text-gray-500">
                              Clave: {templateKey} | Categoría: {template.category}
                              {template.isCustom && (
                                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                  Personalizado
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handlePreview(channel.key, templateKey)}
                              className="p-2 text-gray-600 hover:text-blue-600"
                              title="Vista previa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(channel.key, templateKey, template)}
                              className="p-2 text-gray-600 hover:text-blue-600"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {template.isCustom && (
                              <button
                                onClick={() => handleDelete(template.id)}
                                className="p-2 text-gray-600 hover:text-red-600"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                          {template.subject && (
                            <div className="mb-2">
                              <strong>Asunto:</strong> {template.subject}
                            </div>
                          )}
                          {template.title && (
                            <div className="mb-2">
                              <strong>Título:</strong> {template.title}
                            </div>
                          )}
                          <div className="truncate">
                            <strong>Contenido:</strong> {template.content || template.body}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <channel.icon className={`w-12 h-12 mx-auto mb-3 ${channel.color} opacity-50`} />
                    <p>No hay templates para {channel.label}</p>
                    <button
                      onClick={() => handleNewTemplate(channel.key)}
                      className="mt-2 text-blue-600 hover:text-blue-700"
                    >
                      Crear el primero
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {renderTemplateEditor()}
      {renderPreviewModal()}
    </div>
  );
};

export default MessageTemplateManager;