import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Heart, 
  Plus, 
  Minus, 
  ShoppingCart,
  CreditCard,
  Check,
  Target,
  Users,
  Gift
} from 'lucide-react';
import api from '../../services/api';

const DonationFlow = ({ tenantId, campaignId, user, onComplete, onBack }) => {
  const [step, setStep] = useState(1); // 1: Select, 2: Review, 3: Payment, 4: Success
  const [campaign, setCampaign] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [includePersonalPurchase, setIncludePersonalPurchase] = useState(false);

  useEffect(() => {
    loadDonationData();
  }, [campaignId, tenantId]);

  const loadDonationData = async () => {
    try {
      setLoading(true);
      const [campaignResponse, productsResponse] = await Promise.all([
        api.get(`/campaigns/${campaignId}`, {
          headers: { 'X-Tenant-ID': tenantId }
        }),
        api.get('/products', {
          headers: { 'X-Tenant-ID': tenantId }
        })
      ]);

      setCampaign(campaignResponse.data.campaign);
      setProducts(productsResponse.data.products || []);

      // Pre-select urgent needs
      const urgentNeeds = campaignResponse.data.campaign.urgentNeeds || [];
      const preSelected = {};
      urgentNeeds.slice(0, 3).forEach(need => {
        preSelected[need.productId] = {
          quantity: Math.min(need.remaining, 5),
          unit: need.unit,
          price: need.estimatedPrice || 0
        };
      });
      setSelectedItems(preSelected);
    } catch (error) {
      console.error('Error cargando datos de donación:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (productId, change) => {
    setSelectedItems(prev => {
      const current = prev[productId] || { quantity: 0, unit: '', price: 0 };
      const newQuantity = Math.max(0, current.quantity + change);
      
      if (newQuantity === 0) {
        const { [productId]: removed, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [productId]: {
          ...current,
          quantity: newQuantity
        }
      };
    });
  };

  const addProduct = (product) => {
    setSelectedItems(prev => ({
      ...prev,
      [product.id]: {
        quantity: 1,
        unit: product.unit,
        price: product.estimated_price || 0
      }
    }));
  };

  const calculateTotal = () => {
    return Object.keys(selectedItems).reduce((total, productId) => {
      const item = selectedItems[productId];
      return total + (item.quantity * item.price);
    }, 0);
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : productId;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else if (onBack) {
      onBack();
    }
  };

  const handleDonate = async () => {
    try {
      setProcessing(true);
      
      // Simulate donation processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStep(4);
      
      // Call completion callback after a delay
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 3000);
    } catch (error) {
      console.error('Error procesando donación:', error);
      alert('Error procesando la donación. Intenta de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-2 mb-6">
      {[1, 2, 3].map(stepNumber => (
        <div key={stepNumber} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step >= stepNumber 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-500'
          }`}>
            {step > stepNumber ? <Check className="w-4 h-4" /> : stepNumber}
          </div>
          {stepNumber < 3 && (
            <div className={`w-8 h-0.5 ${
              step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderSelectStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">¿Qué quieres donar?</h2>
        <p className="text-sm text-gray-600">
          Selecciona los productos que deseas donar a {campaign?.title}
        </p>
      </div>

      {/* Urgent Needs */}
      {campaign?.urgentNeeds && campaign.urgentNeeds.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-orange-800 mb-2 flex items-center">
            <Target className="w-4 h-4 mr-2" />
            Necesidades Urgentes
          </h3>
          <div className="space-y-3">
            {campaign.urgentNeeds.slice(0, 3).map((need, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {getProductName(need.productId)}
                  </span>
                  <p className="text-xs text-orange-700">
                    Faltan {need.remaining} {need.unit}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => updateQuantity(need.productId, -1)}
                    className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"
                    disabled={!selectedItems[need.productId]?.quantity}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium">
                    {selectedItems[need.productId]?.quantity || 0}
                  </span>
                  <button
                    onClick={() => updateQuantity(need.productId, 1)}
                    className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Products */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Otros Productos</h3>
        <div className="grid grid-cols-2 gap-3">
          {products
            .filter(product => !campaign?.urgentNeeds?.some(need => need.productId === product.id))
            .slice(0, 6)
            .map(product => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-blue-300 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">{product.name}</div>
                <div className="text-xs text-gray-500">{product.unit}</div>
                {product.estimated_price > 0 && (
                  <div className="text-xs text-blue-600 mt-1">
                    {formatCurrency(product.estimated_price)}
                  </div>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* Selected Items Summary */}
      {Object.keys(selectedItems).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Tu Donación</h3>
          <div className="space-y-2">
            {Object.keys(selectedItems).map(productId => {
              const item = selectedItems[productId];
              return (
                <div key={productId} className="flex justify-between text-sm">
                  <span>{getProductName(productId)}</span>
                  <span className="font-medium">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              );
            })}
            <div className="border-t border-blue-200 pt-2 flex justify-between font-semibold">
              <span>Total Estimado:</span>
              <span className="text-blue-800">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
        </div>
      )}

      {/* Personal Purchase Option */}
      <div className="bg-gray-50 rounded-lg p-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={includePersonalPurchase}
            onChange={(e) => setIncludePersonalPurchase(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="ml-3">
            <span className="text-sm font-medium text-gray-900">
              También quiero comprar para mi familia
            </span>
            <p className="text-xs text-gray-600">
              Aprovecha precios mayoristas en la misma transacción
            </p>
          </div>
        </label>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Confirma tu Donación</h2>
        <p className="text-sm text-gray-600">
          Revisa los detalles antes de proceder al pago
        </p>
      </div>

      {/* Campaign Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">{campaign?.title}</h3>
        <div className="flex items-center text-sm text-gray-600">
          <Users className="w-4 h-4 mr-2" />
          <span>Ayudarás a {campaign?.targetFamilies || 0} familias</span>
        </div>
      </div>

      {/* Donation Items */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
          <Heart className="w-4 h-4 mr-2 text-red-500" />
          Tu Donación
        </h3>
        <div className="space-y-2">
          {Object.keys(selectedItems).map(productId => {
            const item = selectedItems[productId];
            const subtotal = item.quantity * item.price;
            return (
              <div key={productId} className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium">{getProductName(productId)}</span>
                  <p className="text-xs text-gray-500">
                    {item.quantity} {item.unit} × {formatCurrency(item.price)}
                  </p>
                </div>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Personal Purchase */}
      {includePersonalPurchase && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Compra Personal
          </h3>
          <p className="text-sm text-blue-700">
            Podrás agregar productos para tu familia en el siguiente paso
          </p>
        </div>
      )}

      {/* Total */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-green-800">Total a Donar:</span>
          <span className="text-xl font-bold text-green-800">
            {formatCurrency(calculateTotal())}
          </span>
        </div>
        <p className="text-sm text-green-700 mt-1">
          Tu generosidad alimentará familias necesitadas
        </p>
      </div>

      {/* Impact Message */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-1">Tu Impacto</h4>
        <p className="text-sm text-yellow-700">
          Con esta donación ayudarás a alimentar aproximadamente{' '}
          <span className="font-semibold">
            {Math.ceil(calculateTotal() / 50000)} familias
          </span>{' '}
          esta semana.
        </p>
      </div>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Pago Seguro</h2>
        <p className="text-sm text-gray-600">
          Procesa tu donación de forma segura
        </p>
      </div>

      {/* Payment Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-semibold">Total a Pagar:</span>
          <span className="text-xl font-bold text-blue-600">
            {formatCurrency(calculateTotal())}
          </span>
        </div>
        
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Donación:</span>
            <span>{formatCurrency(calculateTotal())}</span>
          </div>
          <div className="flex justify-between">
            <span>Comisión plataforma:</span>
            <span>$0</span>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Método de Pago</h3>
        <div className="space-y-3">
          <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="radio" name="payment" defaultChecked className="text-blue-600" />
            <CreditCard className="w-5 h-5 ml-3 mr-3 text-gray-500" />
            <div>
              <div className="font-medium">Tarjeta de Crédito/Débito</div>
              <div className="text-sm text-gray-500">Visa, Mastercard, American Express</div>
            </div>
          </label>
          
          <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="radio" name="payment" className="text-blue-600" />
            <div className="w-5 h-5 ml-3 mr-3 bg-green-500 rounded text-white text-xs flex items-center justify-center font-bold">
              $
            </div>
            <div>
              <div className="font-medium">PSE</div>
              <div className="text-sm text-gray-500">Pago desde tu banco</div>
            </div>
          </label>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          <span className="text-sm font-medium text-green-800">Pago 100% Seguro</span>
        </div>
        <p className="text-xs text-green-700 mt-1">
          Tus datos están protegidos con encriptación de nivel bancario
        </p>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <Check className="w-10 h-10 text-green-600" />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Gracias por tu Generosidad!</h2>
        <p className="text-gray-600">
          Tu donación de <span className="font-semibold">{formatCurrency(calculateTotal())}</span> ha sido procesada exitosamente
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Tu Impacto</h3>
        <p className="text-sm text-blue-700">
          Con tu donación ayudarás a alimentar familias necesitadas en nuestra comunidad. 
          Recibirás una confirmación por email con los detalles de tu donación.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => window.location.href = '/mobile'}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium"
        >
          Volver al Inicio
        </button>
        
        <button
          onClick={() => window.location.href = '/mobile/profile'}
          className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-medium"
        >
          Ver Mis Donaciones
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando campaña...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <div className="flex items-center">
          <button onClick={handleBack} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {step === 4 ? 'Donación Completada' : 'Hacer Donación'}
            </h1>
            {step < 4 && (
              <p className="text-sm text-gray-600">
                Paso {step} de 3
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {step < 4 && renderStepIndicator()}
        
        {step === 1 && renderSelectStep()}
        {step === 2 && renderReviewStep()}
        {step === 3 && renderPaymentStep()}
        {step === 4 && renderSuccessStep()}
      </div>

      {/* Bottom Actions */}
      {step < 4 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-4">
          <div className="flex space-x-3">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium"
              >
                Atrás
              </button>
            )}
            
            <button
              onClick={step === 3 ? handleDonate : handleNext}
              disabled={step === 1 && Object.keys(selectedItems).length === 0}
              className="flex-1 bg-red-500 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Procesando...
                </>
              ) : (
                <>
                  {step === 3 ? (
                    <>
                      <Heart className="w-4 h-4 mr-2" />
                      Donar {formatCurrency(calculateTotal())}
                    </>
                  ) : (
                    'Continuar'
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonationFlow;