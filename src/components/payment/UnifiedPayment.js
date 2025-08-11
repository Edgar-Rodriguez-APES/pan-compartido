import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Shield, 
  AlertCircle,
  CheckCircle,
  Loader,
  ArrowLeft,
  Info
} from 'lucide-react';
import paymentService from '../../services/paymentService';

const UnifiedPayment = ({ 
  amount, 
  currency = 'COP', 
  tenantId, 
  customerInfo, 
  metadata = {},
  onSuccess, 
  onError, 
  onCancel 
}) => {
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [selectedGateway, setSelectedGateway] = useState('wompi');
  const [processing, setProcessing] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState({});
  const [supportedMethods, setSupportedMethods] = useState([]);
  const [gatewayFees, setGatewayFees] = useState({});

  useEffect(() => {
    loadSupportedMethods();
    calculateFees();
  }, [selectedGateway, selectedMethod, amount, currency]);

  const loadSupportedMethods = () => {
    const wompiMethods = paymentService.getSupportedPaymentMethods('wompi', currency);
    const stripeMethods = paymentService.getSupportedPaymentMethods('stripe', currency);
    
    setSupportedMethods({
      wompi: wompiMethods,
      stripe: stripeMethods
    });

    // Auto-select best gateway and method
    if (currency === 'COP' && wompiMethods.length > 0) {
      setSelectedGateway('wompi');
      setSelectedMethod(wompiMethods.includes('pse') ? 'pse' : wompiMethods[0]);
    } else if (stripeMethods.length > 0) {
      setSelectedGateway('stripe');
      setSelectedMethod(stripeMethods[0]);
    }
  };

  const calculateFees = () => {
    const fees = {};
    
    ['wompi', 'stripe'].forEach(gateway => {
      const methods = supportedMethods[gateway] || [];
      methods.forEach(method => {
        const fee = paymentService.getGatewayFees(gateway, amount, currency, method);
        fees[`${gateway}-${method}`] = fee;
      });
    });

    setGatewayFees(fees);
  };

  const handlePayment = async () => {
    try {
      setProcessing(true);

      const paymentData = {
        amount,
        currency,
        paymentMethod: selectedMethod,
        customerInfo,
        paymentDetails,
        metadata: {
          ...metadata,
          selectedGateway,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      };

      const result = await paymentService.processPayment(paymentData, tenantId);

      if (result.success) {
        // For redirect-based payments (PSE, some cards), redirect to payment URL
        if (result.paymentUrl) {
          window.location.href = result.paymentUrl;
        } else {
          onSuccess?.(result);
        }
      } else {
        throw new Error('Payment processing failed');
      }

    } catch (error) {
      console.error('Payment error:', error);
      onError?.(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return paymentService.formatCurrency(amount, currency);
  };

  const getMethodIcon = (method) => {
    const icons = {
      card: CreditCard,
      pse: Building2,
      nequi: Smartphone,
      bancolombia_transfer: Building2,
      paypal: CreditCard
    };
    return icons[method] || CreditCard;
  };

  const getMethodName = (method) => {
    const names = {
      card: 'Tarjeta de Crédito/Débito',
      pse: 'PSE - Débito desde tu Banco',
      nequi: 'Nequi',
      bancolombia_transfer: 'Transferencia Bancolombia',
      paypal: 'PayPal'
    };
    return names[method] || method;
  };

  const getGatewayName = (gateway) => {
    const names = {
      wompi: 'Wompi',
      stripe: 'Stripe'
    };
    return names[gateway] || gateway;
  };

  const renderPaymentMethods = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Método de Pago</h3>
      
      {/* Gateway Selection */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(supportedMethods).map(([gateway, methods]) => {
          if (methods.length === 0) return null;
          
          return (
            <button
              key={gateway}
              onClick={() => {
                setSelectedGateway(gateway);
                setSelectedMethod(methods[0]);
              }}
              className={`p-3 rounded-lg border-2 text-center transition-colors ${
                selectedGateway === gateway
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">{getGatewayName(gateway)}</div>
              <div className="text-xs text-gray-600">
                {gateway === 'wompi' ? 'Colombia' : 'Internacional'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Payment Method Selection */}
      <div className="space-y-2">
        {(supportedMethods[selectedGateway] || []).map(method => {
          const IconComponent = getMethodIcon(method);
          const fee = gatewayFees[`${selectedGateway}-${method}`] || 0;
          
          return (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                selectedMethod === method
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <IconComponent className="w-5 h-5 mr-3 text-gray-600" />
                  <div>
                    <div className="font-medium text-gray-900">
                      {getMethodName(method)}
                    </div>
                    {fee > 0 && (
                      <div className="text-sm text-gray-600">
                        Comisión: {formatCurrency(fee)}
                      </div>
                    )}
                  </div>
                </div>
                {selectedMethod === method && (
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderPaymentDetails = () => {
    if (selectedMethod === 'pse') {
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Información PSE</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Documento
            </label>
            <select
              value={paymentDetails.idType || 'CC'}
              onChange={(e) => setPaymentDetails(prev => ({ ...prev, idType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="CC">Cédula de Ciudadanía</option>
              <option value="CE">Cédula de Extranjería</option>
              <option value="NIT">NIT</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de Documento
            </label>
            <input
              type="text"
              value={paymentDetails.userId || ''}
              onChange={(e) => setPaymentDetails(prev => ({ ...prev, userId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="12345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Banco
            </label>
            <select
              value={paymentDetails.bankCode || ''}
              onChange={(e) => setPaymentDetails(prev => ({ ...prev, bankCode: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecciona tu banco</option>
              <option value="1007">Bancolombia</option>
              <option value="1019">Scotiabank Colpatria</option>
              <option value="1051">Davivienda</option>
              <option value="1001">Banco de Bogotá</option>
              <option value="1023">Banco de Occidente</option>
              <option value="1062">Banco Falabella</option>
              <option value="1012">Banco GNB Sudameris</option>
              <option value="1060">Banco Pichincha</option>
              <option value="1002">Banco Popular</option>
              <option value="1058">Banco Procredit</option>
              <option value="1065">Banco Santander</option>
              <option value="1066">Banco Serfinanza</option>
              <option value="1052">Av Villas</option>
              <option value="1032">Banco Caja Social</option>
              <option value="1292">Confiar</option>
            </select>
          </div>
        </div>
      );
    }

    if (selectedMethod === 'card') {
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Información de Tarjeta</h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start">
              <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Pago Seguro</p>
                <p>Serás redirigido a la página segura de {getGatewayName(selectedGateway)} para ingresar los datos de tu tarjeta.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cuotas (opcional)
            </label>
            <select
              value={paymentDetails.installments || 1}
              onChange={(e) => setPaymentDetails(prev => ({ ...prev, installments: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>1 cuota (sin intereses)</option>
              <option value={3}>3 cuotas</option>
              <option value={6}>6 cuotas</option>
              <option value={12}>12 cuotas</option>
            </select>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderPaymentSummary = () => {
    const fee = gatewayFees[`${selectedGateway}-${selectedMethod}`] || 0;
    const total = amount + fee;

    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Resumen de Pago</h3>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatCurrency(amount)}</span>
          </div>
          
          {fee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Comisión {getGatewayName(selectedGateway)}</span>
              <span className="font-medium">{formatCurrency(fee)}</span>
            </div>
          )}
          
          <div className="border-t border-gray-300 pt-2">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-900">Total a Pagar</span>
              <span className="font-bold text-blue-600 text-lg">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const canProceed = () => {
    if (selectedMethod === 'pse') {
      return paymentDetails.userId && paymentDetails.bankCode;
    }
    return true;
  };

  return (
    <div className="space-y-6">
      {renderPaymentMethods()}
      {renderPaymentDetails()}
      {renderPaymentSummary()}

      {/* Security Notice */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-start">
          <Shield className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-medium">Pago 100% Seguro</p>
            <p>Tus datos están protegidos con encriptación SSL de grado bancario.</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        
        <button
          onClick={handlePayment}
          disabled={processing || !canProceed()}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            processing || !canProceed()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {processing ? (
            <div className="flex items-center justify-center">
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Procesando...
            </div>
          ) : (
            `Pagar ${formatCurrency(amount + (gatewayFees[`${selectedGateway}-${selectedMethod}`] || 0))}`
          )}
        </button>
      </div>
    </div>
  );
};

export default UnifiedPayment;