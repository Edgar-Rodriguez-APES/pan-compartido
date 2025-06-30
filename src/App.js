import React, { useState, useEffect } from 'react';
import { Plus, Package, Users, Bell, CheckCircle, AlertCircle, Calendar, Phone, ShoppingCart, MessageCircle, FileText, Clock } from 'lucide-react';

const PanCompartidoSystem = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [donations, setDonations] = useState([]);
  const [families, setFamilies] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reports, setReports] = useState([]);
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    setDonations([
      {
        id: 1,
        donorName: 'María González',
        phone: '300-123-4567',
        items: [
          { name: 'Arroz', quantity: 5, unit: 'kg' },
          { name: 'Aceite', quantity: 2, unit: 'litros' }
        ],
        date: '2024-06-28',
        status: 'disponible'
      },
      {
        id: 2,
        donorName: 'Familia Rodríguez',
        phone: '311-987-6543',
        items: [
          { name: 'Lentejas', quantity: 3, unit: 'kg' },
          { name: 'Pasta', quantity: 4, unit: 'paquetes' }
        ],
        date: '2024-06-27',
        status: 'disponible'
      }
    ]);

    setFamilies([
      { id: 1, name: 'Familia Pérez', members: 4, phone: '320-111-2222', needs: ['arroz', 'aceite', 'lentejas'] },
      { id: 2, name: 'Familia López', members: 6, phone: '315-333-4444', needs: ['pasta', 'atún', 'arroz'] }
    ]);

    setNotifications([
      { id: 1, message: 'Necesitamos más aceite para completar mercados', type: 'urgent', date: '2024-06-30' },
      { id: 2, message: 'María González confirmó su donación para mañana', type: 'info', date: '2024-06-30' }
    ]);

    setReminders([
      { id: 1, donorName: 'Familia Rodríguez', phone: '311-987-6543', message: 'Recordatorio: Donación programada para mañana', date: '2024-07-01', sent: false },
      { id: 2, donorName: 'María González', phone: '300-123-4567', message: 'Gracias por su donación. ¿Podrá donar la próxima semana?', date: '2024-07-05', sent: false }
    ]);

    setReports([
      {
        id: 1,
        week: 'Semana del 24-30 Junio 2024',
        totalDonations: 15,
        totalFamiliesHelped: 8,
        totalKgFood: 125,
        topDonors: ['María González', 'Familia Rodríguez', 'Pedro Martínez'],
        mostNeeded: ['aceite', 'azúcar', 'atún'],
        completionRate: 65
      }
    ]);
  }, []);

  const [newDonation, setNewDonation] = useState({
    donorName: '',
    phone: '',
    email: '',
    items: [{ name: '', quantity: '', unit: 'kg' }],
    date: ''
  });

  const addItemToDonation = () => {
    setNewDonation({
      ...newDonation,
      items: [...newDonation.items, { name: '', quantity: '', unit: 'kg' }]
    });
  };

  const updateDonationItem = (index, field, value) => {
    const updatedItems = newDonation.items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setNewDonation({ ...newDonation, items: updatedItems });
  };

  const submitDonation = () => {
    if (!newDonation.donorName || !newDonation.phone) {
      alert('Por favor complete los campos obligatorios');
      return;
    }

    const donation = {
      id: donations.length + 1,
      ...newDonation,
      status: 'disponible'
    };

    setDonations([...donations, donation]);
    setNewDonation({
      donorName: '',
      phone: '',
      email: '',
      items: [{ name: '', quantity: '', unit: 'kg' }],
      date: ''
    });

    const newNotification = {
      id: notifications.length + 1,
      message: `Nueva donación registrada: ${newDonation.donorName}`,
      type: 'success',
      date: new Date().toISOString().split('T')[0]
    };
    setNotifications([newNotification, ...notifications]);
    
    alert('¡Donación registrada exitosamente!');
    setActiveTab('dashboard');
  };

  const sendWhatsAppReminder = (reminder) => {
    const message = encodeURIComponent(`Hola ${reminder.donorName}, ${reminder.message}. Bendiciones! - Parroquia`);
    const whatsappUrl = `https://wa.me/57${reminder.phone.replace(/\D/g, '')}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    
    setReminders(reminders.map(r => 
      r.id === reminder.id ? { ...r, sent: true } : r
    ));
  };

  const getNeededItems = () => {
    const needed = {
      'arroz': { current: 0, needed: 25, unit: 'kg' },
      'aceite': { current: 0, needed: 15, unit: 'litros' },
      'lentejas': { current: 0, needed: 20, unit: 'kg' },
      'pasta': { current: 0, needed: 30, unit: 'paquetes' },
      'atún': { current: 0, needed: 50, unit: 'latas' },
      'azúcar': { current: 0, needed: 10, unit: 'kg' }
    };

    donations.forEach(donation => {
      donation.items.forEach(item => {
        const key = item.name.toLowerCase();
        if (needed[key]) {
          needed[key].current += parseFloat(item.quantity) || 0;
        }
      });
    });

    return needed;
  };

  const generateShoppingList = () => {
    const neededItems = getNeededItems();
    const shoppingList = [];
    
    Object.entries(neededItems).forEach(([item, data]) => {
      const deficit = Math.max(0, data.needed - data.current);
      if (deficit > 0) {
        shoppingList.push({
          item: item.charAt(0).toUpperCase() + item.slice(1),
          needed: deficit,
          unit: data.unit,
          priority: deficit > (data.needed * 0.7) ? 'Alta' : deficit > (data.needed * 0.3) ? 'Media' : 'Baja'
        });
      }
    });
    
    return shoppingList.sort((a, b) => {
      const priorityOrder = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  const renderDashboard = () => {
    const neededItems = getNeededItems();
    const totalDonations = donations.length;
    const totalFamilies = families.length;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <Package className="text-blue-600" size={24} />
              <div>
                <p className="text-sm text-gray-600">Donaciones Registradas</p>
                <p className="text-2xl font-bold text-blue-600">{totalDonations}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <Users className="text-green-600" size={24} />
              <div>
                <p className="text-sm text-gray-600">Familias a Atender</p>
                <p className="text-2xl font-bold text-green-600">{totalFamilies}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-orange-600" size={24} />
              <div>
                <p className="text-sm text-gray-600">Mercados Objetivo</p>
                <p className="text-2xl font-bold text-orange-600">100</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Bell size={20} />
            Notificaciones Recientes
          </h3>
          <div className="space-y-2">
            {notifications.slice(0, 3).map(notification => (
              <div key={notification.id} className={`p-3 rounded ${
                notification.type === 'urgent' ? 'bg-red-50 border-red-200' :
                notification.type === 'success' ? 'bg-green-50 border-green-200' :
                'bg-blue-50 border-blue-200'
              } border`}>
                <p className="text-sm">{notification.message}</p>
                <p className="text-xs text-gray-500 mt-1">{notification.date}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Package size={20} />
            Estado del Inventario
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(neededItems).map(([item, data]) => {
              const percentage = data.needed > 0 ? (data.current / data.needed) * 100 : 0;
              const isLow = percentage < 30;
              const isMedium = percentage >= 30 && percentage < 70;
              
              return (
                <div key={item} className={`p-3 rounded border ${
                  isLow ? 'bg-red-50 border-red-200' :
                  isMedium ? 'bg-yellow-50 border-yellow-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium capitalize">{item}</span>
                    <span className={`text-sm ${
                      isLow ? 'text-red-600' :
                      isMedium ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {data.current} / {data.needed} {data.unit}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full ${
                        isLow ? 'bg-red-500' :
                        isMedium ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDonations = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Gestión de Donaciones</h2>
        <button
          onClick={() => setActiveTab('new-donation')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={16} />
          Nueva Donación
        </button>
      </div>
      
      <div className="grid gap-4">
        {donations.map(donation => (
          <div key={donation.id} className="bg-white p-4 rounded-lg border">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold">{donation.donorName}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Phone size={14} />
                  {donation.phone}
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                donation.status === 'disponible' ? 'bg-green-100 text-green-800' :
                donation.status === 'entregado' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {donation.status}
              </span>
            </div>
            
            <div className="mb-3">
              <h4 className="text-sm font-medium mb-2">Artículos donados:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {donation.items.map((item, index) => (
                  <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                    {item.name}: {item.quantity} {item.unit}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {donation.date}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderNewDonation = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-6">Registrar Nueva Donación</h2>
      
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre del Donante *</label>
            <input
              type="text"
              value={newDonation.donorName}
              onChange={(e) => setNewDonation({...newDonation, donorName: e.target.value})}
              className="w-full p-2 border rounded-lg"
              placeholder="Nombre completo"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono *</label>
            <input
              type="tel"
              value={newDonation.phone}
              onChange={(e) => setNewDonation({...newDonation, phone: e.target.value})}
              className="w-full p-2 border rounded-lg"
              placeholder="300-123-4567"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={newDonation.email}
              onChange={(e) => setNewDonation({...newDonation, email: e.target.value})}
              className="w-full p-2 border rounded-lg"
              placeholder="correo@ejemplo.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Fecha de Donación</label>
            <input
              type="date"
              value={newDonation.date}
              onChange={(e) => setNewDonation({...newDonation, date: e.target.value})}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Artículos a Donar</label>
          {newDonation.items.map((item, index) => (
            <div key={index} className="grid grid-cols-3 gap-2 mb-2">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateDonationItem(index, 'name', e.target.value)}
                className="p-2 border rounded-lg"
                placeholder="Nombre del artículo"
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateDonationItem(index, 'quantity', e.target.value)}
                className="p-2 border rounded-lg"
                placeholder="Cantidad"
              />
              <select
                value={item.unit}
                onChange={(e) => updateDonationItem(index, 'unit', e.target.value)}
                className="p-2 border rounded-lg"
              >
                <option value="kg">kg</option>
                <option value="litros">litros</option>
                <option value="paquetes">paquetes</option>
                <option value="latas">latas</option>
                <option value="unidades">unidades</option>
              </select>
            </div>
          ))}
          
          <button
            onClick={addItemToDonation}
            className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-2"
          >
            <Plus size={14} />
            Agregar otro artículo
          </button>
        </div>
        
        <div className="flex gap-3 pt-4">
          <button
            onClick={submitDonation}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            Registrar Donación
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );

  const renderShoppingList = () => {
    const shoppingList = generateShoppingList();
    
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart size={24} />
          Lista de Compras
        </h2>
        
        {shoppingList.length === 0 ? (
          <div className="bg-green-50 p-6 rounded-lg border border-green-200 text-center">
            <CheckCircle className="mx-auto mb-2 text-green-600" size={48} />
            <h3 className="text-lg font-semibold text-green-800 mb-2">¡Excelente!</h3>
            <p className="text-green-700">Tenemos suficientes donaciones para cubrir las necesidades.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Artículos Necesarios</h3>
              <p className="text-sm text-gray-600">Ordenados por prioridad</p>
            </div>
            
            <div className="divide-y">
              {shoppingList.map((item, index) => (
                <div key={index} className="p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{item.item}</h4>
                    <p className="text-sm text-gray-600">{item.needed} {item.unit}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.priority === 'Alta' ? 'bg-red-100 text-red-800' :
                    item.priority === 'Media' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {item.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderReminders = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <MessageCircle size={24} />
        Recordatorios WhatsApp
      </h2>
      
      <div className="grid gap-4">
        {reminders.map(reminder => (
          <div key={reminder.id} className="bg-white p-4 rounded-lg border">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold">{reminder.donorName}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Phone size={14} />
                  {reminder.phone}
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                reminder.sent ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {reminder.sent ? 'Enviado' : 'Pendiente'}
              </span>
            </div>
            
            <div className="mb-3">
              <p className="text-sm bg-gray-50 p-2 rounded">{reminder.message}</p>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <Calendar size={14} />
                {reminder.date}
              </span>
              {!reminder.sent && (
                <button
                  onClick={() => sendWhatsAppReminder(reminder)}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Enviar WhatsApp
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <FileText size={24} />
        Reportes Semanales
      </h2>
      
      <div className="grid gap-4">
        {reports.map(report => (
          <div key={report.id} className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">{report.week}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{report.totalDonations}</p>
                <p className="text-sm text-gray-600">Donaciones</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{report.totalFamiliesHelped}</p>
                <p className="text-sm text-gray-600">Familias Atendidas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{report.totalKgFood}</p>
                <p className="text-sm text-gray-600">Kg de Alimentos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{report.completionRate}%</p>
                <p className="text-sm text-gray-600">Completado</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Principales Donantes</h4>
                <ul className="space-y-1">
                  {report.topDonors.map((donor, index) => (
                    <li key={index} className="text-sm text-gray-700">• {donor}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Más Necesitados</h4>
                <div className="flex flex-wrap gap-2">
                  {report.mostNeeded.map((item, index) => (
                    <span key={index} className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Package className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Pan Compartido</h1>
                <p className="text-sm text-gray-600">Sistema de Gestión de Donaciones</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <Bell className="text-gray-600" size={20} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                <Clock size={16} className="inline mr-1" />
                {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Package },
              { id: 'donations', label: 'Donaciones', icon: Package },
              { id: 'shopping', label: 'Lista Compras', icon: ShoppingCart },
              { id: 'reminders', label: 'Recordatorios', icon: MessageCircle },
              { id: 'reports', label: 'Reportes', icon: FileText }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-2 border-b-2 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'donations' && renderDonations()}
        {activeTab === 'new-donation' && renderNewDonation()}
        {activeTab === 'shopping' && renderShoppingList()}
        {activeTab === 'reminders' && renderReminders()}
        {activeTab === 'reports' && renderReports()}
      </main>
    </div>
  );
};

export default PanCompartidoSystem;