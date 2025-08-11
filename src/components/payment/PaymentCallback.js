import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Loader,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import paymentService from '../../services/paymentService';

const PaymentCallback = ({ tenantId }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [paymentStatus, setPaymentStatus] = useState('loading');
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    handlePaymentCallback();
  }, []);

  const handlePaymentCallback = async () => {
    try {
      setPaymentStatus('loading');
      setError(null);

      // Get payment info from URL parameters
      const paymentId = searchParams.get('id') || searchParams.get('payment_intent');
      const gateway = searchParams.get('gateway') || detectGatewayFromParams();
      const status = searchParams.get('status');

      if (!paymentId || !gateway) {
        throw new Error('Información de pago incompleta en la URL');
      }

      // Get payment status from backend
      const result = await paymentService.getPaymentStatus(paymentId, gateway, tenantId);
      
      setPaymentData(result);
      setPaymentStatus(result.status);

      // Handle different payment statuses
      switch (result.status) {
        case 'APPROVED':
        case 'succeeded':
          setPaymentStatus('success');
          // Auto-redirect to success page after 3 seconds
          setTimeout(() => {
            navigate('/payment/success', { 
              state: { paymentData: result },
              replace: true 
            });
          }, 3000);
          break;

        case 'DECLINED':
        case 'failed':
          setPaymentStatus('failed');
          break;

        case 'PENDING':
        case 'processing':
          setPaymentStatus('pending');
          // Poll for status updates
          pollPaymentStatus(paymentId, gateway);
          break;

        case 'VOIDED':
        case 'canceled':
          setPaymentStatus('canceled');
          break;

        default:
          setPaymentStatus('unknown');
      }

    } catch (error) {
      console.error('Payment callback error:', error);
      setError(error.message);
      setPaymentStatus('error');
    }
  };

  const detectGatewayFromParams = () => {
    // Detect gateway based on URL parameters
    if (searchParams.get('payment_intent')) {
      return 'stripe';
    }
    if (searchParams.get('id') && searchParams.get('status')) {
      return 'wompi';
    }
    return null;
  };

  const pollPaymentStatus = async (paymentId, gateway, maxAttempts = 10) => {
    let attempts = 0;
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        setPaymentStatus('timeout');
        return;
      }

      try {
        const result = await paymentService.getPaymentStatus(paymentId, gateway, tenantId);
        
        if (result.status === 'APPROVED' || result.status === 'succeeded') {
          setPaymentData(result);
          setPaymentStatus('success');
          setTimeout(() => {
            navigate('/payment/success', { 
              state: { paymentData: result },
              replace: true 
            });
          }, 2000);
        } else if (result.status === 'DECLINED' || result.status === 'failed') {
          setPaymentData(result);
          setPaymentStatus('failed');
        } else if (result.status === 'PENDING' || result.status === 'processing') {
          attempts++;
          setTimeout(poll, 3000); // Poll every 3 seconds
        } else {
          setPaymentData(result);
          setPaymentStatus(result.status);
        }
      } catch (error) {
        console.error('Polling error:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Retry after 5 seconds on error
        } else {
          setPaymentStatus('error');
          setError('No se pudo verificar el estado del pago');
        }
      }
    };

    poll();
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    handlePaymentCallback();
  };

  const formatCurrency = (amount, currency = 'COP') => {
    return paymentService.formatCurrency(amount, currency);
  };

  const renderStatusIcon = () => {
    const iconProps = { className: "w-16 h-16 mx-auto mb-4" };
    
    switch (paymentStatus) {
      case 'loading':
        return <Loader {...iconProps} className="w-16 h-16 mx-auto mb-4 animate-spin text-blue-600" />;
      case 'success':
        return <CheckCircle {...iconProps} className="w-16 h-16 mx-auto mb-4 text-green-600" />;
      case 'failed':
        return <XCircle {...iconProps} className="w-16 h-16 mx-auto mb-4 text-red-600" />;
      case 'pending':
        return <Clock {...iconProps} className="w-16 h-16 mx-auto mb-4 text-yellow-600" />;
      case 'canceled':
        return <XCircle {...iconProps} className="w-16 h-16 mx-auto mb-4 text-gray-600" />;
      case 'timeout':
      case 'error':
        return <AlertTriangle {...iconProps} className="w-16 h-16 mx-auto mb-4 text-orange-600" />;
      default:
        return <AlertTriangle {...iconProps} className="w-16 h-16 mx-auto mb-4 text-gray-600" />;
    }
  };

  const renderStatusMessage = () => {
    switch (paymentStatus) {
      case 'loading':
        return {
          title: 'Verificando Pago...',
          message: 'Estamos confirmando tu pago. Por favor espera un momento.',
          color: 'text-blue-600'
        };
      case 'success':
        return {
          title: '¡Pago Exitoso!',
          message: 'Tu pago ha sido procesado correctamente. Serás redirigido automáticamente.',
          color: 'text-green-600'
        };
      case 'failed':
        return {
          title: 'Pago Rechazado',
          message: 'Tu pago no pudo ser procesado. Por favor intenta con otro método de pago.',
          color: 'text-red-600'
        };
      case 'pending':
        return {
          title: 'Pago Pendiente',
          message: 'Tu pago está siendo procesado. Te notificaremos cuando se complete.',
          color: 'text-yellow-600'
        };
      case 'canceled':
        return {
          title: 'Pago Cancelado',
          message: 'El pago fue cancelado. Puedes intentar nuevamente si lo deseas.',
          color: 'text-gray-600'
        };
      case 'timeout':
        return {
          title: 'Tiempo Agotado',
          message: 'No pudimos verificar el estado de tu pago. Por favor contacta soporte.',
          color: 'text-orange-600'
        };
      case 'error':
        return {
          title: 'Error de Verificación',
          message: error || 'Ocurrió un error al verificar tu pago.',
          color: 'text-red-600'
        };
      default:
        return {
          title: 'Estado Desconocido',
          message: 'No pudimos determinar el estado de tu pago.',
          color: 'text-gray-600'
        };
    }
  };

  const renderPaymentDetails = () => {
    if (!paymentData) return null;

    return (
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Detalles del Pago</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">ID de Pago:</span>
            <span className="font-mono text-gray-900">{paymentData.paymentId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Monto:</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(paymentData.amount, paymentData.currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pasarela:</span>
            <span className="font-medium text-gray-900 capitalize">
              {paymentData.gateway}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Fecha:</span>
            <span className="font-medium text-gray-900">
              {new Date(paymentData.createdAt).toLocaleString('es-CO')}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderActions = () => {
    const actions = [];

    // Back to home button (always available)
    actions.push(
      <button
        key="home"
        onClick={() => navigate('/')}
        className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver al Inicio
      </button>
    );

    // Status-specific actions
    switch (paymentStatus) {
      case 'failed':
        actions.push(
          <button
            key="retry"
            onClick={() => navigate('/payment', { replace: true })}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Intentar Nuevamente
          </button>
        );
        break;

      case 'error':
      case 'timeout':
        actions.push(
          <button
            key="refresh"
            onClick={handleRetry}
            disabled={retryCount >= 3}
            className="flex-1 py-3 px-4 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {retryCount >= 3 ? 'Máximo Intentos' : 'Verificar Nuevamente'}
          </button>
        );
        break;

      case 'canceled':
        actions.push(
          <button
            key="retry"
            onClick={() => navigate('/payment', { replace: true })}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Intentar Pago
          </button>
        );
        break;

      case 'pending':
        actions.push(
          <button
            key="refresh"
            onClick={handleRetry}
            className="flex-1 py-3 px-4 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Verificar Estado
          </button>
        );
        break;
    }

    return (
      <div className="flex space-x-3">
        {actions}
      </div>
    );
  };

  const statusInfo = renderStatusMessage();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
        <div className="text-center">
          {renderStatusIcon()}
          
          <h2 className={`text-xl font-bold mb-2 ${statusInfo.color}`}>
            {statusInfo.title}
          </h2>
          
          <p className="text-gray-600 mb-6">
            {statusInfo.message}
          </p>
        </div>

        {renderPaymentDetails()}

        {/* Loading indicator for pending payments */}
        {paymentStatus === 'pending' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
            <div className="flex items-center">
              <Loader className="w-4 h-4 text-yellow-600 mr-2 animate-spin" />
              <span className="text-sm text-yellow-800">
                Verificando estado cada 3 segundos...
              </span>
            </div>
          </div>
        )}

        {/* Error details */}
        {error && paymentStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-800">{error}</p>
            {retryCount > 0 && (
              <p className="text-xs text-red-600 mt-1">
                Intentos: {retryCount}/3
              </p>
            )}
          </div>
        )}

        {renderActions()}

        {/* Support contact */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            ¿Problemas con tu pago?{' '}
            <a href="/support" className="text-blue-600 hover:underline">
              Contacta soporte
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentCallback;