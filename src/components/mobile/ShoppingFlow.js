import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2,
  CreditCard,
  Check,
  AlertCircle,
  MapPin,
  Clock,
  Truck
} from 'lucide-react';
import api from '../../services/api';

const ShoppingFlow = ({ tenantId, initialCart = {}, onBack, onComplete }) => {
  const [step, setStep] = useState(1); // 1: Carrito, 2: Dirección, 3: Pago, 4: Confirmación
  const [cart, setCart] = useState(initialCart);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState({
    address: '',
    city: '',
    phone: '',
    notes: '',
    deliveryType: 'delivery' // 'delivery' o 'pickup'
  });
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card', 'pse', 'cash'

  const handleQuantityChange = (productId, change) => {
    setCart(prev => {
      const currentQuantity = prev[productId]?.quantity || 0;
      const newQuantity = Math.max(0, currentQuantity + change);
      
      if (newQuantity === 0) {
        const { [productId]: removed, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          quantity: newQuantity,
          totalPrice: newQuantity * (prev[productId].product?.estimated_price || 0)
        }
      };
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => {
      const { [productId]: removed, ...rest } = prev;
      return rest;
    });
  };

  const getCartTotal = () => {
    return Object.values(cart).reduce((total, item) => {
      return total + (item.totalPrice || 0);
    }, 0);
  };

  const getCartItemsCount = () => {
    return Object.values(cart).reduce((total, item) => {
      return total + item.quantity;
    }, 0);
  };

  const getDeliveryFee = () => {
    return deliveryInfo.deliveryType === 'delivery' ? 5000 : 0;
  };

  const getFinalTotal = () => {
    return getCartTotal() + getDeliveryFee();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleSubmitOrder = async () => {
    try {
      setSubmitting(true);
      
      const orderData = {
        items: Object.values(cart).map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.estimated_price,
          total_price: item.totalPrice
        })),
        delivery_info: deliveryInfo,
        payment_method: paymentMethod,
        subtotal: getCartTotal(),
        delivery_fee: getDeliveryFee(),
        total: getFinalTotal()
      };

      // TODO: Implementar API de órdenes
      console.log('Datos de orden:', orderData);
      
      // Simular procesamiento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStep(4); // Paso de éxito
    } catch (error) {
      console.error('Error procesando orden:', error);
      alert('Error procesando la orden. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () => (
    <div className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="flex items-center p-4">
        <button onClick={onBack} className="mr-3 p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">
            {step === 1 && 'Mi Carrito'}
            {step === 2 && 'Información de Entrega'}
            {step === 3 && 'Pago'}
            {step === 4 && 'Orden Confirmada'}
          </h1>
          {step < 4 && (
            <p className="text-sm text-gray-600">Paso {step} de 3</p>
          )}
        </div>
        {step < 4 && (
          <div className="flex space-x-1">
            {[1, 2, 3].map(stepNum => (
              <div
                key={stepNum}
                className={`w-2 h-2 rounded-full ${
                  stepNum <= step ? 'bg-green-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep1Cart = () => (
    <div className="pb-24">
      <div className="p-4">
        {Object.keys(cart).length > 0 ? (
          <div className="space-y-4">
            {Object.values(cart).map(item => (
              <div key={item.product.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg mr-4 flex items-center justify-center flex-shrink-0">
                    {item.product.imageUrl ? (
                      <img 
                        src={item.product.imageUrl} 
                        alt={item.product.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <ShoppingCart className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-1">{item.product.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {formatCurrency(item.product.estimated_price)} por {item.product.unit}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleQuantityChange(item.product.id, -1)}
                          className="w-8 h-8 bg-gray-100 border border-gray-300 rounded-full flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="font-medium text-gray-900 w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item.product.id, 1)}
                          className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="ml-4 text-right">
                    <div className="font-bold text-gray-900">
                      {formatCurrency(item.totalPrice)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Order Summary */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="font-semibold text-green-900 mb-3">Resumen del Pedido</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-800">Subtotal ({getCartItemsCount()} productos)</span>
                  <span className="font-medium text-green-900">{formatCurrency(getCartTotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-800">Envío estimado</span>
                  <span className="font-medium text-green-900">A calcular</span>
                </div>
                <div className="border-t border-green-300 pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-green-900">Total estimado</span>
                    <span className="font-bold text-green-900 text-lg">{formatCurrency(getCartTotal())}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Benefits */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-medium text-blue-900 mb-2">Beneficios de tu Compra</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Precios mayoristas especiales</li>
                <li>• Apoyas la sostenibilidad de la plataforma</li>
                <li>• Productos de calidad garantizada</li>
                <li>• Entrega a domicilio disponible</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">Tu carrito está vacío</p>
            <p className="text-sm text-gray-500">Agrega productos para continuar</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2Delivery = () => (
    <div className="pb-24">
      <div className="p-4 space-y-4">
        {/* Delivery Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Tipo de Entrega</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDeliveryInfo(prev => ({ ...prev, deliveryType: 'delivery' }))}
              className={`p-4 rounded-xl border-2 text-center transition-colors ${
                deliveryInfo.deliveryType === 'delivery'
                  ? 'border-green-500 bg-green-50 text-green-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <Truck className="w-6 h-6 mx-auto mb-2" />
              <div className="font-medium">Domicilio</div>
              <div className="text-xs">Entrega a tu dirección</div>
            </button>
            
            <button
              onClick={() => setDeliveryInfo(prev => ({ ...prev, deliveryType: 'pickup' }))}
              className={`p-4 rounded-xl border-2 text-center transition-colors ${
                deliveryInfo.deliveryType === 'pickup'
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <MapPin className="w-6 h-6 mx-auto mb-2" />
              <div className="font-medium">Recoger</div>
              <div className="text-xs">Recoger en punto</div>
            </button>
          </div>
        </div>

        {/* Delivery Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            {deliveryInfo.deliveryType === 'delivery' ? 'Dirección de Entrega' : 'Información de Contacto'}
          </h3>
          
          <div className="space-y-3">
            {deliveryInfo.deliveryType === 'delivery' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección completa *
                  </label>
                  <input
                    type="text"
                    value={deliveryInfo.address}
                    onChange={(e) => setDeliveryInfo(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Calle 123 #45-67, Barrio..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad *
                  </label>
                  <input
                    type="text"
                    value={deliveryInfo.city}
                    onChange={(e) => setDeliveryInfo(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Bogotá, Medellín, Cali..."
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono de contacto *
              </label>
              <input
                type="tel"
                value={deliveryInfo.phone}
                onChange={(e) => setDeliveryInfo(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="300 123 4567"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas adicionales
              </label>
              <textarea
                value={deliveryInfo.notes}
                onChange={(e) => setDeliveryInfo(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows="3"
                placeholder="Instrucciones especiales, referencias, etc."
              />
            </div>
          </div>
        </div>

        {/* Delivery Time */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center mb-2">
            <Clock className="w-5 h-5 text-blue-600 mr-2" />
            <h4 className="font-medium text-blue-900">Tiempo de Entrega</h4>
          </div>
          <p className="text-sm text-blue-800">
            {deliveryInfo.deliveryType === 'delivery' 
              ? 'Entrega estimada: 2-3 días hábiles'
              : 'Disponible para recoger: 1-2 días hábiles'
            }
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep3Payment = () => (
    <div className="pb-24">
      <div className="p-4 space-y-4">
        {/* Order Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Resumen Final</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(getCartTotal())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                {deliveryInfo.deliveryType === 'delivery' ? 'Envío' : 'Sin envío'}
              </span>
              <span className="font-medium">{formatCurrency(getDeliveryFee())}</span>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-green-600 text-lg">{formatCurrency(getFinalTotal())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Método de Pago</h3>
          <div className="space-y-3">
            <button
              onClick={() => setPaymentMethod('card')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                paymentMethod === 'card'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <CreditCard className="w-5 h-5 mr-3 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-900">Tarjeta de Crédito/Débito</div>
                  <div className="text-sm text-gray-600">Visa, Mastercard, American Express</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setPaymentMethod('pse')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                paymentMethod === 'pse'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <CreditCard className="w-5 h-5 mr-3 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-900">PSE</div>
                  <div className="text-sm text-gray-600">Pago desde tu banco</div>
                </div>
              </div>
            </button>
            
            {deliveryInfo.deliveryType === 'pickup' && (
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                  paymentMethod === 'cash'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-3 text-gray-600" />
                  <div>
                    <div className="font-medium text-gray-900">Pago en Efectivo</div>
                    <div className="text-sm text-gray-600">Pagar al recoger</div>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        {submitting && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
            <p className="text-gray-600">Procesando tu orden...</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4Success = () => (
    <div className="pb-24">
      <div className="p-4 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2">¡Orden Confirmada!</h3>
        <p className="text-gray-600 mb-6">
          Tu orden por {formatCurrency(getFinalTotal())} ha sido procesada exitosamente.
        </p>
        
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
          <h4 className="font-medium text-green-900 mb-2">Detalles de la Orden</h4>
          <div className="text-sm text-green-800 space-y-1">
            <p>• Número de orden: #ORD-{Date.now()}</p>
            <p>• {getCartItemsCount()} productos</p>
            <p>• {deliveryInfo.deliveryType === 'delivery' ? 'Entrega a domicilio' : 'Recoger en punto'}</p>
            <p>• Pago: {paymentMethod === 'card' ? 'Tarjeta' : paymentMethod === 'pse' ? 'PSE' : 'Efectivo'}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => onComplete && onComplete()}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium"
          >
            Volver al Inicio
          </button>
          
          <button className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium">
            Ver Mis Órdenes
          </button>
        </div>
      </div>
    </div>
  );

  const renderBottomBar = () => {
    if (step === 4) return null;
    
    const canContinue = () => {
      if (step === 1) return Object.keys(cart).length > 0;
      if (step === 2) {
        if (deliveryInfo.deliveryType === 'delivery') {
          return deliveryInfo.address && deliveryInfo.city && deliveryInfo.phone;
        }
        return deliveryInfo.phone;
      }
      return true;
    };
    
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-600">
              {step === 1 && `${getCartItemsCount()} productos`}
              {step === 2 && `${deliveryInfo.deliveryType === 'delivery' ? 'Domicilio' : 'Recoger'}`}
              {step === 3 && 'Total a pagar'}
            </div>
            <div className="text-lg font-bold text-gray-900">
              {step < 3 ? formatCurrency(getCartTotal()) : formatCurrency(getFinalTotal())}
            </div>
          </div>
          
          <button
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleSubmitOrder();
              }
            }}
            disabled={!canContinue() || submitting}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              canContinue() && !submitting
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {step === 1 && 'Continuar'}
            {step === 2 && 'Ir a Pago'}
            {step === 3 && (submitting ? 'Procesando...' : 'Confirmar Orden')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeader()}
      
      <main>
        {step === 1 && renderStep1Cart()}
        {step === 2 && renderStep2Delivery()}
        {step === 3 && renderStep3Payment()}
        {step === 4 && renderStep4Success()}
      </main>
      
      {renderBottomBar()}
    </div>
  );
};

export default ShoppingFlow;