import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Heart, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2,
  CreditCard,
  Check,
  AlertCircle,
  Gift,
  Package,
  Calculator,
  Info
} from 'lucide-react';
import api from '../../services/api';

const UnifiedCart = ({ tenantId, user, onBack, onComplete }) => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: Cart, 2: Checkout, 3: Success
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [deliveryInfo, setDeliveryInfo] = useState({
    address: '',
    phone: '',
    notes: ''
  });

  useEffect(() => {
    loadCartData();
  }, [tenantId, user]);

  const loadCartData = async () => {
    try {
      setLoading(true);
      // TODO: Load cart from API or localStorage
      // For now, using mock data
      const mockCart = [
        {
          id: 'donation-1',
          type: 'donation',
          campaignId: 'camp-1',
          campaignTitle: 'Familias Necesitadas Diciembre',
          items: [
            {
              productId: 'prod-1',
              productName: 'Arroz',
              quantity: 5,
              unit: 'kg',
              unitPrice: 3500,
              totalPrice: 17500
            },
            {
              productId: 'prod-2',
              productName: 'Aceite',
              quantity: 2,
              unit: 'litros',
              unitPrice: 8000,
              totalPrice: 16000
            }
          ],
          subtotal: 33500
        },
        {
          id: 'purchase-1',
          type: 'purchase',
          items: [
            {
              productId: 'prod-3',
              productName: 'Panela',
              quantity: 3,
              unit: 'unidades',
              unitPrice: 2500,
              totalPrice: 7500
            }
          ],
          subtotal: 7500
        }
      ];
      setCartItems(mockCart);
    } catch (error) {
      console.error('Error cargando carrito:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateItemQuantity = (cartId, productId, change) => {
    setCartItems(prev => prev.map(cart => {
      if (cart.id === cartId) {
        const updatedItems = cart.items.map(item => {
          if (item.productId === productId) {
            const newQuantity = Math.max(0, item.quantity + change);
            return {
              ...item,
              quantity: newQuantity,
              totalPrice: newQuantity * item.unitPrice
            };
          }
          return item;
        }).filter(item => item.quantity > 0);

        const newSubtotal = updatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        
        return {
          ...cart,
          items: updatedItems,
          subtotal: newSubtotal
        };
      }
      return cart;
    }).filter(cart => cart.items.length > 0));
  };

  const removeCartSection = (cartId) => {
    setCartItems(prev => prev.filter(cart => cart.id !== cartId));
  };

  const getTotalDonations = () => {
    return cartItems
      .filter(cart => cart.type === 'donation')
      .reduce((total, cart) => total + cart.subtotal, 0);
  };

  const getTotalPurchases = () => {
    return cartItems
      .filter(cart => cart.type === 'purchase')
      .reduce((total, cart) => total + cart.subtotal, 0);
  };

  const getDeliveryFee = () => {
    const purchaseTotal = getTotalPurchases();
    return purchaseTotal > 0 ? 5000 : 0; // Solo cobrar envío si hay compras
  };

  const getPlatformFee = () => {
    const total = getTotalDonations() + getTotalPurchases();
    return Math.round(total * 0.03); // 3% fee de plataforma
  };

  const getFinalTotal = () => {
    return getTotalDonations() + getTotalPurchases() + getDeliveryFee() + getPlatformFee();
  };

  const getTotalItemsCount = () => {
    return cartItems.reduce((total, cart) => {
      return total + cart.items.reduce((sum, item) => sum + item.quantity, 0);
    }, 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleCheckout = async () => {
    try {
      setSubmitting(true);
      
      const orderData = {
        donations: cartItems.filter(cart => cart.type === 'donation'),
        purchases: cartItems.filter(cart => cart.type === 'purchase'),
        totals: {
          donations: getTotalDonations(),
          purchases: getTotalPurchases(),
          deliveryFee: getDeliveryFee(),
          platformFee: getPlatformFee(),
          finalTotal: getFinalTotal()
        },
        deliveryInfo,
        paymentMethod,
        userId: user?.id
      };

      // TODO: Implement API call
      console.log('Procesando orden unificada:', orderData);
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStep(3);
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
            {step === 2 && 'Finalizar Orden'}
            {step === 3 && 'Orden Confirmada'}
          </h1>
          {step < 3 && (
            <p className="text-sm text-gray-600">
              {getTotalItemsCount()} productos • {formatCurrency(getFinalTotal())}
            </p>
          )}
        </div>
        {step < 3 && (
          <div className="flex space-x-1">
            {[1, 2].map(stepNum => (
              <div
                key={stepNum}
                className={`w-2 h-2 rounded-full ${
                  stepNum <= step ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCartSection = (cart) => (
    <div key={cart.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {cart.type === 'donation' ? (
            <Heart className="w-5 h-5 text-red-500 mr-2" />
          ) : (
            <ShoppingCart className="w-5 h-5 text-green-500 mr-2" />
          )}
          <div>
            <h3 className="font-semibold text-gray-900">
              {cart.type === 'donation' ? 'Donación' : 'Compra Personal'}
            </h3>
            {cart.campaignTitle && (
              <p className="text-sm text-gray-600">{cart.campaignTitle}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => removeCartSection(cart.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {cart.items.map(item => (
          <div key={item.productId} className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{item.productName}</h4>
              <p className="text-sm text-gray-600">
                {formatCurrency(item.unitPrice)} por {item.unit}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => updateItemQuantity(cart.id, item.productId, -1)}
                className="w-8 h-8 bg-gray-100 border border-gray-300 rounded-full flex items-center justify-center"
              >
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="font-medium text-gray-900 w-8 text-center">
                {item.quantity}
              </span>
              <button
                onClick={() => updateItemQuantity(cart.id, item.productId, 1)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                  cart.type === 'donation' ? 'bg-red-600' : 'bg-green-600'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="ml-4 text-right min-w-[80px]">
              <div className="font-bold text-gray-900">
                {formatCurrency(item.totalPrice)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 mt-3 pt-3">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-gray-900">Subtotal</span>
          <span className={`font-bold text-lg ${
            cart.type === 'donation' ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatCurrency(cart.subtotal)}
          </span>
        </div>
      </div>
    </div>
  );

  const renderStep1Cart = () => (
    <div className="pb-24">
      <div className="p-4">
        {cartItems.length > 0 ? (
          <>
            {cartItems.map(cart => renderCartSection(cart))}
            
            {/* Order Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center mb-3">
                <Calculator className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-blue-900">Resumen de Orden</h3>
              </div>
              
              <div className="space-y-2">
                {getTotalDonations() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-800">Donaciones</span>
                    <span className="font-medium text-blue-900">
                      {formatCurrency(getTotalDonations())}
                    </span>
                  </div>
                )}
                
                {getTotalPurchases() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-800">Compras personales</span>
                    <span className="font-medium text-blue-900">
                      {formatCurrency(getTotalPurchases())}
                    </span>
                  </div>
                )}
                
                {getDeliveryFee() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-800">Envío</span>
                    <span className="font-medium text-blue-900">
                      {formatCurrency(getDeliveryFee())}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <div className="flex items-center">
                    <span className="text-blue-800">Sostenimiento plataforma</span>
                    <Info className="w-3 h-3 text-blue-600 ml-1" />
                  </div>
                  <span className="font-medium text-blue-900">
                    {formatCurrency(getPlatformFee())}
                  </span>
                </div>
                
                <div className="border-t border-blue-300 pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-blue-900">Total</span>
                    <span className="font-bold text-blue-900 text-lg">
                      {formatCurrency(getFinalTotal())}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Impact Message */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
              <div className="flex items-start">
                <Gift className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900 mb-1">Tu Impacto</h4>
                  <p className="text-sm text-green-800">
                    {getTotalDonations() > 0 && getTotalPurchases() > 0 
                      ? 'Estás donando para ayudar a familias necesitadas y comprando productos que sostienen la plataforma.'
                      : getTotalDonations() > 0
                      ? 'Tu donación ayudará directamente a familias necesitadas de la comunidad.'
                      : 'Tu compra ayuda a sostener la plataforma y beneficia a toda la comunidad.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">Tu carrito está vacío</p>
            <p className="text-sm text-gray-500">Agrega donaciones o productos para continuar</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2Checkout = () => (
    <div className="pb-24">
      <div className="p-4 space-y-4">
        {/* Final Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Resumen Final</h3>
          <div className="space-y-2">
            {getTotalDonations() > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Donaciones</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(getTotalDonations())}
                </span>
              </div>
            )}
            {getTotalPurchases() > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Compras</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(getTotalPurchases())}
                </span>
              </div>
            )}
            {getDeliveryFee() > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Envío</span>
                <span className="font-medium">{formatCurrency(getDeliveryFee())}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Sostenimiento</span>
              <span className="font-medium">{formatCurrency(getPlatformFee())}</span>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total a Pagar</span>
                <span className="font-bold text-blue-600 text-xl">
                  {formatCurrency(getFinalTotal())}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        {getTotalPurchases() > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Información de Entrega</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de entrega *
                </label>
                <input
                  type="text"
                  value={deliveryInfo.address}
                  onChange={(e) => setDeliveryInfo(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Calle 123 #45-67, Barrio..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono de contacto *
                </label>
                <input
                  type="tel"
                  value={deliveryInfo.phone}
                  onChange={(e) => setDeliveryInfo(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="2"
                  placeholder="Instrucciones especiales..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Payment Method */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Método de Pago</h3>
          <div className="space-y-3">
            <button
              onClick={() => setPaymentMethod('card')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                paymentMethod === 'card'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <CreditCard className="w-5 h-5 mr-3 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-900">Tarjeta de Crédito/Débito</div>
                  <div className="text-sm text-gray-600">Pago seguro con Wompi</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setPaymentMethod('pse')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                paymentMethod === 'pse'
                  ? 'border-blue-500 bg-blue-50'
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
          </div>
        </div>

        {submitting && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600">Procesando tu orden...</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3Success = () => (
    <div className="pb-24">
      <div className="p-4 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-2">¡Orden Procesada!</h3>
        <p className="text-gray-600 mb-6">
          Tu orden por {formatCurrency(getFinalTotal())} ha sido procesada exitosamente.
        </p>
        
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
          <h4 className="font-medium text-green-900 mb-2">Detalles de tu Orden</h4>
          <div className="text-sm text-green-800 space-y-1">
            <p>• Número de orden: #ORD-{Date.now()}</p>
            {getTotalDonations() > 0 && (
              <p>• Donaciones: {formatCurrency(getTotalDonations())}</p>
            )}
            {getTotalPurchases() > 0 && (
              <p>• Compras: {formatCurrency(getTotalPurchases())}</p>
            )}
            <p>• Total procesado: {formatCurrency(getFinalTotal())}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => onComplete && onComplete()}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium"
          >
            Volver al Inicio
          </button>
          
          <button className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium">
            Ver Mi Historial
          </button>
        </div>
      </div>
    </div>
  );

  const renderBottomBar = () => {
    if (step === 3 || cartItems.length === 0) return null;
    
    const canContinue = () => {
      if (step === 1) return cartItems.length > 0;
      if (step === 2) {
        if (getTotalPurchases() > 0) {
          return deliveryInfo.address && deliveryInfo.phone;
        }
        return true;
      }
      return true;
    };
    
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-600">
              {getTotalItemsCount()} productos
            </div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(getFinalTotal())}
            </div>
          </div>
          
          <button
            onClick={() => {
              if (step === 1) {
                setStep(2);
              } else {
                handleCheckout();
              }
            }}
            disabled={!canContinue() || submitting}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              canContinue() && !submitting
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {step === 1 && 'Continuar'}
            {step === 2 && (submitting ? 'Procesando...' : 'Pagar Ahora')}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando carrito...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeader()}
      
      <main>
        {step === 1 && renderStep1Cart()}
        {step === 2 && renderStep2Checkout()}
        {step === 3 && renderStep3Success()}
      </main>
      
      {renderBottomBar()}
    </div>
  );
};

export default UnifiedCart;