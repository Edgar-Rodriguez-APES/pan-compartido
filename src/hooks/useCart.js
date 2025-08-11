import { useState, useEffect, useCallback } from 'react';
import checkoutService from '../services/checkoutService';

export const useCart = () => {
  const [cartSummary, setCartSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const updateCartSummary = useCallback(() => {
    try {
      const summary = checkoutService.getCartSummary();
      setCartSummary(summary);
      
      // Dispatch custom event for other components
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: summary }));
    } catch (error) {
      console.error('Error updating cart summary:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    updateCartSummary();

    // Listen for storage changes (other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'panCompartido_cart') {
        updateCartSummary();
      }
    };

    // Listen for custom cart events (same tab)
    const handleCartUpdate = () => {
      updateCartSummary();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('cartUpdated', handleCartUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, [updateCartSummary]);

  // Cart actions
  const addDonation = useCallback((campaignId, campaignTitle, items) => {
    try {
      checkoutService.addDonation(campaignId, campaignTitle, items);
      updateCartSummary();
      return true;
    } catch (error) {
      console.error('Error adding donation:', error);
      return false;
    }
  }, [updateCartSummary]);

  const addPurchase = useCallback((items) => {
    try {
      checkoutService.addPurchase(items);
      updateCartSummary();
      return true;
    } catch (error) {
      console.error('Error adding purchase:', error);
      return false;
    }
  }, [updateCartSummary]);

  const quickAddDonation = useCallback((campaignId, campaignTitle, productId, productName, quantity, unitPrice, unit) => {
    try {
      checkoutService.quickAddDonation(campaignId, campaignTitle, productId, productName, quantity, unitPrice, unit);
      updateCartSummary();
      return true;
    } catch (error) {
      console.error('Error adding donation:', error);
      return false;
    }
  }, [updateCartSummary]);

  const quickAddPurchase = useCallback((productId, productName, quantity, unitPrice, unit) => {
    try {
      checkoutService.quickAddPurchase(productId, productName, quantity, unitPrice, unit);
      updateCartSummary();
      return true;
    } catch (error) {
      console.error('Error adding purchase:', error);
      return false;
    }
  }, [updateCartSummary]);

  const updateItemQuantity = useCallback((type, itemId, productId, newQuantity) => {
    try {
      checkoutService.updateItemQuantity(type, itemId, productId, newQuantity);
      updateCartSummary();
      return true;
    } catch (error) {
      console.error('Error updating quantity:', error);
      return false;
    }
  }, [updateCartSummary]);

  const removeCartSection = useCallback((type, itemId) => {
    try {
      checkoutService.removeCartSection(type, itemId);
      updateCartSummary();
      return true;
    } catch (error) {
      console.error('Error removing cart section:', error);
      return false;
    }
  }, [updateCartSummary]);

  const clearCart = useCallback(() => {
    try {
      checkoutService.clearCart();
      updateCartSummary();
      return true;
    } catch (error) {
      console.error('Error clearing cart:', error);
      return false;
    }
  }, [updateCartSummary]);

  const getFormattedCart = useCallback(() => {
    return checkoutService.getFormattedCart();
  }, []);

  const processCheckout = useCallback(async (tenantId, userId, deliveryInfo, paymentMethod) => {
    try {
      const result = await checkoutService.processCheckout(tenantId, userId, deliveryInfo, paymentMethod);
      updateCartSummary(); // Cart will be cleared after successful checkout
      return result;
    } catch (error) {
      console.error('Error processing checkout:', error);
      throw error;
    }
  }, [updateCartSummary]);

  // Utility functions
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }, []);

  return {
    // State
    cartSummary,
    loading,
    
    // Computed values
    hasItems: cartSummary?.hasItems || false,
    totalItems: cartSummary?.totalItems || 0,
    finalTotal: cartSummary?.finalTotal || 0,
    donationsTotal: cartSummary?.donationsTotal || 0,
    purchasesTotal: cartSummary?.purchasesTotal || 0,
    hasDonations: checkoutService.hasDonations(),
    hasPurchases: checkoutService.hasPurchases(),
    
    // Actions
    addDonation,
    addPurchase,
    quickAddDonation,
    quickAddPurchase,
    updateItemQuantity,
    removeCartSection,
    clearCart,
    getFormattedCart,
    processCheckout,
    
    // Utilities
    formatCurrency,
    updateCartSummary
  };
};

export default useCart;