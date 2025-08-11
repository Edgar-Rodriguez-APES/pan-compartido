import api from './api';

class CheckoutService {
  constructor() {
    this.cart = this.loadCartFromStorage();
  }

  // Cart Management
  loadCartFromStorage() {
    try {
      const stored = localStorage.getItem('panCompartido_cart');
      return stored ? JSON.parse(stored) : { donations: [], purchases: [] };
    } catch (error) {
      console.error('Error loading cart from storage:', error);
      return { donations: [], purchases: [] };
    }
  }

  saveCartToStorage() {
    try {
      localStorage.setItem('panCompartido_cart', JSON.stringify(this.cart));
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  }

  // Add donation to cart
  addDonation(campaignId, campaignTitle, items) {
    const existingDonationIndex = this.cart.donations.findIndex(
      d => d.campaignId === campaignId
    );

    if (existingDonationIndex >= 0) {
      // Update existing donation
      this.cart.donations[existingDonationIndex] = {
        ...this.cart.donations[existingDonationIndex],
        items: this.mergeItems(this.cart.donations[existingDonationIndex].items, items),
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new donation
      this.cart.donations.push({
        id: `donation-${Date.now()}`,
        campaignId,
        campaignTitle,
        items,
        createdAt: new Date().toISOString()
      });
    }

    this.saveCartToStorage();
    return this.cart;
  }

  // Add purchase to cart
  addPurchase(items) {
    const existingPurchaseIndex = this.cart.purchases.findIndex(p => p.id === 'personal-purchase');

    if (existingPurchaseIndex >= 0) {
      // Update existing purchase
      this.cart.purchases[existingPurchaseIndex] = {
        ...this.cart.purchases[existingPurchaseIndex],
        items: this.mergeItems(this.cart.purchases[existingPurchaseIndex].items, items),
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new purchase
      this.cart.purchases.push({
        id: 'personal-purchase',
        items,
        createdAt: new Date().toISOString()
      });
    }

    this.saveCartToStorage();
    return this.cart;
  }

  // Merge items with same productId
  mergeItems(existingItems, newItems) {
    const merged = [...existingItems];
    
    newItems.forEach(newItem => {
      const existingIndex = merged.findIndex(item => item.productId === newItem.productId);
      
      if (existingIndex >= 0) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          quantity: merged[existingIndex].quantity + newItem.quantity,
          totalPrice: (merged[existingIndex].quantity + newItem.quantity) * newItem.unitPrice
        };
      } else {
        merged.push(newItem);
      }
    });

    return merged;
  }

  // Update item quantity
  updateItemQuantity(type, itemId, productId, newQuantity) {
    const cartSection = type === 'donation' ? this.cart.donations : this.cart.purchases;
    const itemIndex = cartSection.findIndex(item => item.id === itemId);
    
    if (itemIndex >= 0) {
      const productIndex = cartSection[itemIndex].items.findIndex(
        item => item.productId === productId
      );
      
      if (productIndex >= 0) {
        if (newQuantity <= 0) {
          // Remove item
          cartSection[itemIndex].items.splice(productIndex, 1);
          
          // Remove entire section if no items left
          if (cartSection[itemIndex].items.length === 0) {
            cartSection.splice(itemIndex, 1);
          }
        } else {
          // Update quantity
          const item = cartSection[itemIndex].items[productIndex];
          item.quantity = newQuantity;
          item.totalPrice = newQuantity * item.unitPrice;
        }
      }
    }

    this.saveCartToStorage();
    return this.cart;
  }

  // Remove entire cart section
  removeCartSection(type, itemId) {
    const cartSection = type === 'donation' ? this.cart.donations : this.cart.purchases;
    const itemIndex = cartSection.findIndex(item => item.id === itemId);
    
    if (itemIndex >= 0) {
      cartSection.splice(itemIndex, 1);
      this.saveCartToStorage();
    }
    
    return this.cart;
  }

  // Get cart summary
  getCartSummary() {
    const donationsTotal = this.cart.donations.reduce((total, donation) => {
      return total + donation.items.reduce((sum, item) => sum + item.totalPrice, 0);
    }, 0);

    const purchasesTotal = this.cart.purchases.reduce((total, purchase) => {
      return total + purchase.items.reduce((sum, item) => sum + item.totalPrice, 0);
    }, 0);

    const totalItems = this.cart.donations.reduce((total, donation) => {
      return total + donation.items.reduce((sum, item) => sum + item.quantity, 0);
    }, 0) + this.cart.purchases.reduce((total, purchase) => {
      return total + purchase.items.reduce((sum, item) => sum + item.quantity, 0);
    }, 0);

    const deliveryFee = purchasesTotal > 0 ? 5000 : 0;
    const platformFee = Math.round((donationsTotal + purchasesTotal) * 0.03);
    const finalTotal = donationsTotal + purchasesTotal + deliveryFee + platformFee;

    return {
      donationsTotal,
      purchasesTotal,
      deliveryFee,
      platformFee,
      finalTotal,
      totalItems,
      hasItems: totalItems > 0
    };
  }

  // Get formatted cart for display
  getFormattedCart() {
    const formatted = [];

    // Add donations
    this.cart.donations.forEach(donation => {
      formatted.push({
        id: donation.id,
        type: 'donation',
        campaignId: donation.campaignId,
        campaignTitle: donation.campaignTitle,
        items: donation.items,
        subtotal: donation.items.reduce((sum, item) => sum + item.totalPrice, 0)
      });
    });

    // Add purchases
    this.cart.purchases.forEach(purchase => {
      formatted.push({
        id: purchase.id,
        type: 'purchase',
        items: purchase.items,
        subtotal: purchase.items.reduce((sum, item) => sum + item.totalPrice, 0)
      });
    });

    return formatted;
  }

  // Clear cart
  clearCart() {
    this.cart = { donations: [], purchases: [] };
    this.saveCartToStorage();
    return this.cart;
  }

  // Process unified checkout
  async processCheckout(tenantId, userId, deliveryInfo, paymentMethod, customerInfo) {
    try {
      const summary = this.getCartSummary();
      
      if (!summary.hasItems) {
        throw new Error('El carrito está vacío');
      }

      // Import payment service dynamically to avoid circular dependencies
      const { default: paymentService } = await import('./paymentService');

      // Prepare payment data
      const paymentData = {
        amount: summary.finalTotal,
        currency: 'COP',
        paymentMethod,
        customerInfo: {
          email: customerInfo.email,
          name: customerInfo.name,
          phone: customerInfo.phone,
          country: 'CO',
          address: deliveryInfo
        },
        metadata: {
          tenantId,
          userId,
          donationsTotal: summary.donationsTotal,
          purchasesTotal: summary.purchasesTotal,
          platformFee: summary.platformFee,
          deliveryFee: summary.deliveryFee,
          cartItems: this.cart
        }
      };

      // Process payment first
      const paymentResult = await paymentService.processPayment(paymentData);

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed');
      }

      // If payment requires redirect (PSE), return early
      if (paymentResult.requiresRedirect || paymentResult.checkoutUrl) {
        return {
          success: true,
          requiresRedirect: true,
          checkoutUrl: paymentResult.checkoutUrl,
          paymentId: paymentResult.paymentId,
          reference: paymentResult.reference
        };
      }

      // Process donations after successful payment
      const donationPromises = this.cart.donations.map(donation => 
        api.post('/donations', {
          campaignId: donation.campaignId,
          items: donation.items,
          type: 'products',
          estimatedValue: donation.items.reduce((sum, item) => sum + item.totalPrice, 0),
          paymentId: paymentResult.paymentId,
          paymentReference: paymentResult.reference
        }, {
          headers: { 'X-Tenant-ID': tenantId }
        })
      );

      // Process purchases after successful payment
      const purchasePromises = this.cart.purchases.map(purchase =>
        api.post('/orders', {
          items: purchase.items,
          deliveryInfo,
          subtotal: purchase.items.reduce((sum, item) => sum + item.totalPrice, 0),
          deliveryFee: summary.deliveryFee,
          total: purchase.items.reduce((sum, item) => sum + item.totalPrice, 0) + summary.deliveryFee,
          paymentId: paymentResult.paymentId,
          paymentReference: paymentResult.reference
        }, {
          headers: { 'X-Tenant-ID': tenantId }
        })
      );

      // Wait for all operations to complete
      const [donationResults, purchaseResults] = await Promise.all([
        Promise.all(donationPromises),
        Promise.all(purchasePromises)
      ]);

      // Clear cart after successful processing
      this.clearCart();

      return {
        success: true,
        orderId: `ORD-${Date.now()}`,
        paymentId: paymentResult.paymentId,
        paymentReference: paymentResult.reference,
        gateway: paymentResult.gateway,
        donations: donationResults.map(r => r.data),
        purchases: purchaseResults.map(r => r.data),
        summary,
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error processing checkout:', error);
      throw error;
    }
  }

  // Quick add methods for easy integration
  quickAddDonation(campaignId, campaignTitle, productId, productName, quantity, unitPrice, unit) {
    const items = [{
      productId,
      productName,
      quantity,
      unit,
      unitPrice,
      totalPrice: quantity * unitPrice
    }];

    return this.addDonation(campaignId, campaignTitle, items);
  }

  quickAddPurchase(productId, productName, quantity, unitPrice, unit) {
    const items = [{
      productId,
      productName,
      quantity,
      unit,
      unitPrice,
      totalPrice: quantity * unitPrice
    }];

    return this.addPurchase(items);
  }

  // Get cart count for UI badges
  getCartCount() {
    return this.getCartSummary().totalItems;
  }

  // Check if cart has specific type
  hasDonations() {
    return this.cart.donations.length > 0;
  }

  hasPurchases() {
    return this.cart.purchases.length > 0;
  }
}

// Export singleton instance
export default new CheckoutService();