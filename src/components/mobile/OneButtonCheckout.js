import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Heart, 
  ShoppingCart, 
  Check, 
  AlertCircle,
  Loader,
  Gift,
  Calculator
} from 'lucide-react';
import checkoutService from '../../services/checkoutService';

const OneButtonCheckout = ({ tenantId, user, onSuccess, onError }) => {
  const [cartSummary, setCartSummary] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');

  useEffect(() => {
    updateCartSummary();
    
    // Listen for cart updates
    const handleStorageChange = () => {
      updateCartSummary();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for cart updates within the same tab
    window.addEventListener('cartUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cartUpdated', handleStorageChange);
    };
  }, []);

  const updateCartSummary = () => {
    const summary = checkoutService.getCartSummary();
    setCartSummary(summary);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleQuickCheckout = async () => {
    if (!cartSummary?.hasItems) {
      onError?.('El carrito está vacío');
      return;
    }

    if (!user) {
      onError?.('Debes iniciar sesión para continuar');
      return;
    }

    try {
      setProcessing(true);

      // For purchases, we need delivery info
      let deliveryInfo = {};
      if (cartSummary.purchasesTotal > 0) {
        // In a real app, this would come from user profile or a quick form
        deliveryInfo = {
          address: user.address || '',
          phone: user.phone || '',
          notes: ''
        };

        // If no address, show error
        if (!deliveryInfo.address) {
          throw new Error('Se requiere dirección de entrega para las compras');
        }
      }

      const result = await checkoutService.processCheckout(
        tenantId,
        user.id,
        deliveryInfo,
        paymentMethod
      );

      onSuccess?.(result);
      
      // Update cart summary after successful checkout
      updateCartSummary();

    } catch (error) {
      console.error('Error in quick checkout:', error);
      onError?.(error.message || 'Error procesando el pago');
    } finally {
      setProcessing(false);
    }
  };

  const renderCartBreakdown = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Resumen de Carrito</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 text-sm font-medium"
        >
          {showDetails ? 'Ocultar' : 'Ver detalles'}
        </button>
      </div>

      {showDetails && (
        <div className="space-y-2 mb-3">
          {cartSummary.donationsTotal > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <Heart className="w-4 h-4 text-red-500 mr-2" />
                <span className="text-gray-600">Donaciones</span>
              </div>
              <span className="font-medium text-red-600">
                {formatCurrency(cartSummary.donationsTotal)}
              </span>
            </div>
          )}

          {cartSummary.purchasesTotal > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <ShoppingCart className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-gray-600">Compras</span>
              </div>
              <span className="font-medium text-green-600">
                {formatCurrency(cartSummary.purchasesTotal)}
              </span>
            </div>
          )}

          {cartSummary.deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Envío</span>
              <span className="font-medium">{formatCurrency(cartSummary.deliveryFee)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Sostenimiento (3%)</span>
            <span className="font-medium">{formatCurrency(cartSummary.platformFee)}</span>
          </div>

          <div className="border-t border-gray-200 pt-2">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-blue-600">
                {formatCurrency(cartSummary.finalTotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600 mb-1">
          {formatCurrency(cartSummary.finalTotal)}
        </div>
        <div className="text-sm text-gray-600">
          {cartSummary.totalItems} productos en tu carrito
        </div>
      </div>
    </div>
  );

  const renderPaymentMethods = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="font-semibold text-gray-900 mb-3">Método de Pago</h3>
      <div className="space-y-2">
        <button
          onClick={() => setPaymentMethod('card')}
          className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
            paymentMethod === 'card'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <CreditCard className="w-5 h-5 mr-3 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900">Tarjeta</div>
              <div className="text-sm text-gray-600">Crédito o débito</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setPaymentMethod('pse')}
          className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
            paymentMethod === 'pse'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center">
            <CreditCard className="w-5 h-5 mr-3 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900">PSE</div>
              <div className="text-sm text-gray-600">Débito desde tu banco</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  const renderImpactMessage = () => (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <Gift className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
        <div>
          <h4 className="font-medium text-green-900 mb-1">Tu Impacto</h4>
          <p className="text-sm text-green-800">
            {cartSummary.donationsTotal > 0 && cartSummary.purchasesTotal > 0 
              ? 'Estás ayudando a familias necesitadas y sosteniendo la plataforma.'
              : cartSummary.donationsTotal > 0
              ? 'Tu donación ayudará directamente a familias de la comunidad.'
              : 'Tu compra ayuda a sostener la plataforma para toda la comunidad.'
            }
          </p>
        </div>
      </div>
    </div>
  );

  if (!cartSummary?.hasItems) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <ShoppingCart className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600 text-sm">Tu carrito está vacío</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderCartBreakdown()}
      {renderPaymentMethods()}
      {renderImpactMessage()}

      {/* One Button Checkout */}
      <button
        onClick={handleQuickCheckout}
        disabled={processing || !user}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 ${
          processing
            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
            : !user
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 shadow-lg hover:shadow-xl'
        }`}
      >
        <div className="flex items-center justify-center">
          {processing ? (
            <>
              <Loader className="w-5 h-5 mr-2 animate-spin" />
              Procesando...
            </>
          ) : !user ? (
            <>
              <AlertCircle className="w-5 h-5 mr-2" />
              Inicia Sesión para Continuar
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              Pagar {formatCurrency(cartSummary.finalTotal)}
            </>
          )}
        </div>
      </button>

      {!user && (
        <p className="text-center text-sm text-gray-600">
          Necesitas una cuenta para procesar donaciones y compras
        </p>
      )}

      {cartSummary.purchasesTotal > 0 && user && !user.address && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start">
            <AlertCircle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
            <div className="text-sm">
              <p className="text-yellow-800 font-medium">Dirección requerida</p>
              <p className="text-yellow-700">
                Agrega tu dirección en el perfil para procesar compras con envío.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          🔒 Pago seguro procesado por Wompi • Datos protegidos con SSL
        </p>
      </div>
    </div>
  );
};

export default OneButtonCheckout;