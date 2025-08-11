const logger = require('../utils/logger');
const NotificationService = require('./NotificationService');

class AuctionService {
  constructor() {
    this.auctionTypes = {
      REVERSE_AUCTION: 'reverse_auction', // Suppliers bid lower prices
      SEALED_BID: 'sealed_bid',           // Suppliers submit sealed bids
      OPEN_BID: 'open_bid'                // Suppliers can see other bids
    };

    this.auctionStatus = {
      DRAFT: 'draft',
      PUBLISHED: 'published',
      ACTIVE: 'active',
      CLOSED: 'closed',
      AWARDED: 'awarded',
      CANCELLED: 'cancelled'
    };

    this.bidStatus = {
      SUBMITTED: 'submitted',
      WITHDRAWN: 'withdrawn',
      ACCEPTED: 'accepted',
      REJECTED: 'rejected'
    };

    // Evaluation criteria weights
    this.defaultCriteriaWeights = {
      price: 0.40,        // 40% weight on price
      quality: 0.25,      // 25% weight on quality rating
      delivery_time: 0.20, // 20% weight on delivery time
      distance: 0.10,     // 10% weight on distance
      reliability: 0.05   // 5% weight on supplier reliability
    };
  }

  /**
   * Create a new auction/RFQ
   */
  async createAuction(tenantId, auctionData, createdBy) {
    try {
      const {
        title,
        description,
        items,
        auctionType = this.auctionTypes.REVERSE_AUCTION,
        startDate,
        endDate,
        evaluationCriteria = this.defaultCriteriaWeights,
        minimumSuppliers = 3,
        maxBidsPerSupplier = 1,
        allowPartialBids = true,
        requireSamples = false
      } = auctionData;

      // Validate auction data
      this.validateAuctionData(auctionData);

      // Create auction record
      const auction = await this.createAuctionRecord({
        tenantId,
        title,
        description,
        items,
        auctionType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        evaluationCriteria,
        minimumSuppliers,
        maxBidsPerSupplier,
        allowPartialBids,
        requireSamples,
        status: this.auctionStatus.DRAFT,
        createdBy,
        createdAt: new Date()
      });

      logger.info('Auction created:', {
        auctionId: auction.id,
        tenantId,
        createdBy: createdBy.id
      });

      return auction;

    } catch (error) {
      logger.error('Error creating auction:', error);
      throw error;
    }
  }

  /**
   * Publish auction and invite suppliers
   */
  async publishAuction(auctionId, tenantId, publishedBy) {
    try {
      const auction = await this.getAuctionById(auctionId, tenantId);
      
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== this.auctionStatus.DRAFT) {
        throw new Error('Only draft auctions can be published');
      }

      // Find eligible suppliers
      const eligibleSuppliers = await this.findEligibleSuppliers(auction, tenantId);

      if (eligibleSuppliers.length < auction.minimumSuppliers) {
        throw new Error(`Not enough eligible suppliers. Found ${eligibleSuppliers.length}, minimum required: ${auction.minimumSuppliers}`);
      }

      // Update auction status
      await this.updateAuctionStatus(auctionId, this.auctionStatus.PUBLISHED);

      // Send invitations to suppliers
      await this.sendSupplierInvitations(auction, eligibleSuppliers, tenantId);

      // Schedule auction start if needed
      if (auction.startDate > new Date()) {
        await this.scheduleAuctionStart(auctionId, auction.startDate);
      } else {
        // Start immediately
        await this.startAuction(auctionId, tenantId);
      }

      logger.info('Auction published:', {
        auctionId,
        tenantId,
        invitedSuppliers: eligibleSuppliers.length,
        publishedBy: publishedBy.id
      });

      return {
        auction,
        invitedSuppliers: eligibleSuppliers.length
      };

    } catch (error) {
      logger.error('Error publishing auction:', error);
      throw error;
    }
  }

  /**
   * Start auction (make it active for bidding)
   */
  async startAuction(auctionId, tenantId) {
    try {
      const auction = await this.getAuctionById(auctionId, tenantId);
      
      if (!auction || auction.status !== this.auctionStatus.PUBLISHED) {
        throw new Error('Auction not found or not in published status');
      }

      // Update status to active
      await this.updateAuctionStatus(auctionId, this.auctionStatus.ACTIVE);

      // Schedule auction end
      await this.scheduleAuctionEnd(auctionId, auction.endDate);

      // Notify suppliers that bidding is now open
      await this.notifyBiddingOpen(auction, tenantId);

      logger.info('Auction started:', { auctionId, tenantId });

      return auction;

    } catch (error) {
      logger.error('Error starting auction:', error);
      throw error;
    }
  }

  /**
   * Submit a bid
   */
  async submitBid(auctionId, supplierId, bidData, tenantId) {
    try {
      const auction = await this.getAuctionById(auctionId, tenantId);
      
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== this.auctionStatus.ACTIVE) {
        throw new Error('Auction is not active for bidding');
      }

      if (new Date() > auction.endDate) {
        throw new Error('Auction has ended');
      }

      // Check if supplier is invited
      const isInvited = await this.isSupplierInvited(auctionId, supplierId);
      if (!isInvited) {
        throw new Error('Supplier not invited to this auction');
      }

      // Check bid limits
      const existingBids = await this.getSupplierBids(auctionId, supplierId);
      if (existingBids.length >= auction.maxBidsPerSupplier) {
        throw new Error('Maximum bids per supplier exceeded');
      }

      // Validate bid data
      this.validateBidData(bidData, auction);

      // Create bid record
      const bid = await this.createBidRecord({
        auctionId,
        supplierId,
        tenantId,
        items: bidData.items,
        totalAmount: bidData.totalAmount,
        deliveryTime: bidData.deliveryTime,
        validUntil: bidData.validUntil,
        notes: bidData.notes,
        attachments: bidData.attachments || [],
        status: this.bidStatus.SUBMITTED,
        submittedAt: new Date()
      });

      // Update auction statistics
      await this.updateAuctionStats(auctionId);

      // Notify auction creator of new bid
      await this.notifyNewBid(auction, bid, tenantId);

      logger.info('Bid submitted:', {
        bidId: bid.id,
        auctionId,
        supplierId,
        totalAmount: bidData.totalAmount,
        tenantId
      });

      return bid;

    } catch (error) {
      logger.error('Error submitting bid:', error);
      throw error;
    }
  }

  /**
   * Close auction and evaluate bids
   */
  async closeAuction(auctionId, tenantId, closedBy) {
    try {
      const auction = await this.getAuctionById(auctionId, tenantId);
      
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== this.auctionStatus.ACTIVE) {
        throw new Error('Only active auctions can be closed');
      }

      // Update status
      await this.updateAuctionStatus(auctionId, this.auctionStatus.CLOSED);

      // Get all bids
      const bids = await this.getAuctionBids(auctionId);

      // Evaluate bids
      const evaluation = await this.evaluateBids(auction, bids, tenantId);

      // Store evaluation results
      await this.storeEvaluationResults(auctionId, evaluation);

      // Notify suppliers of auction closure
      await this.notifyAuctionClosed(auction, tenantId);

      logger.info('Auction closed:', {
        auctionId,
        tenantId,
        totalBids: bids.length,
        closedBy: closedBy.id
      });

      return {
        auction,
        bids,
        evaluation
      };

    } catch (error) {
      logger.error('Error closing auction:', error);
      throw error;
    }
  }

  /**
   * Evaluate bids using multi-criteria analysis
   */
  async evaluateBids(auction, bids, tenantId) {
    try {
      if (bids.length === 0) {
        return { rankings: [], winner: null, analysis: 'No bids received' };
      }

      const evaluatedBids = [];

      for (const bid of bids) {
        const supplier = await this.getSupplierInfo(bid.supplierId, tenantId);
        const scores = await this.calculateBidScores(bid, supplier, auction, tenantId);
        
        evaluatedBids.push({
          bid,
          supplier,
          scores,
          totalScore: this.calculateWeightedScore(scores, auction.evaluationCriteria)
        });
      }

      // Sort by total score (highest first)
      evaluatedBids.sort((a, b) => b.totalScore - a.totalScore);

      // Assign rankings
      evaluatedBids.forEach((item, index) => {
        item.rank = index + 1;
      });

      const winner = evaluatedBids.length > 0 ? evaluatedBids[0] : null;

      return {
        rankings: evaluatedBids,
        winner,
        analysis: this.generateEvaluationAnalysis(evaluatedBids, auction)
      };

    } catch (error) {
      logger.error('Error evaluating bids:', error);
      throw error;
    }
  }

  /**
   * Calculate bid scores for each criterion
   */
  async calculateBidScores(bid, supplier, auction, tenantId) {
    try {
      const scores = {};

      // Price score (lower is better, so invert)
      const maxPrice = Math.max(...auction.items.map(item => item.estimatedPrice * item.quantity));
      scores.price = Math.max(0, (maxPrice - bid.totalAmount) / maxPrice * 100);

      // Quality score (based on supplier rating)
      scores.quality = (supplier.rating || 0) * 20; // Convert 5-star to 100-point scale

      // Delivery time score (faster is better)
      const maxDeliveryTime = 30; // 30 days max
      scores.delivery_time = Math.max(0, (maxDeliveryTime - bid.deliveryTime) / maxDeliveryTime * 100);

      // Distance score (closer is better)
      const distance = await this.calculateDistance(auction.deliveryLocation, supplier.location);
      const maxDistance = 100; // 100km max
      scores.distance = Math.max(0, (maxDistance - distance) / maxDistance * 100);

      // Reliability score (based on supplier history)
      const reliabilityMetrics = await this.getSupplierReliabilityMetrics(supplier.id, tenantId);
      scores.reliability = reliabilityMetrics.onTimeDeliveryRate || 0;

      return scores;

    } catch (error) {
      logger.error('Error calculating bid scores:', error);
      return {
        price: 0,
        quality: 0,
        delivery_time: 0,
        distance: 0,
        reliability: 0
      };
    }
  }

  /**
   * Calculate weighted total score
   */
  calculateWeightedScore(scores, weights) {
    let totalScore = 0;
    
    for (const [criterion, weight] of Object.entries(weights)) {
      totalScore += (scores[criterion] || 0) * weight;
    }

    return Math.round(totalScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Award auction to winning supplier
   */
  async awardAuction(auctionId, winningSupplierId, tenantId, awardedBy) {
    try {
      const auction = await this.getAuctionById(auctionId, tenantId);
      
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== this.auctionStatus.CLOSED) {
        throw new Error('Auction must be closed before awarding');
      }

      // Get winning bid
      const winningBid = await this.getSupplierBid(auctionId, winningSupplierId);
      if (!winningBid) {
        throw new Error('Winning bid not found');
      }

      // Update auction status and winner
      await this.updateAuctionWinner(auctionId, winningSupplierId, winningBid.id);
      await this.updateAuctionStatus(auctionId, this.auctionStatus.AWARDED);

      // Create purchase order
      const purchaseOrder = await this.createPurchaseOrder(auction, winningBid, tenantId);

      // Notify winning supplier
      await this.notifyAuctionWinner(auction, winningBid, tenantId);

      // Notify losing suppliers
      await this.notifyAuctionLosers(auction, winningSupplierId, tenantId);

      logger.info('Auction awarded:', {
        auctionId,
        winningSupplierId,
        winningAmount: winningBid.totalAmount,
        tenantId,
        awardedBy: awardedBy.id
      });

      return {
        auction,
        winningBid,
        purchaseOrder
      };

    } catch (error) {
      logger.error('Error awarding auction:', error);
      throw error;
    }
  }

  /**
   * Get auction details with bids
   */
  async getAuctionDetails(auctionId, tenantId, userId) {
    try {
      const auction = await this.getAuctionById(auctionId, tenantId);
      
      if (!auction) {
        throw new Error('Auction not found');
      }

      // Get bids (filtered based on auction type and user role)
      let bids = await this.getAuctionBids(auctionId);
      
      // For suppliers, only show their own bids unless it's an open auction
      const user = await this.getUserInfo(userId);
      if (user.role === 'supplier' && auction.auctionType !== this.auctionTypes.OPEN_BID) {
        bids = bids.filter(bid => bid.supplierId === user.supplierId);
      }

      // Get evaluation results if auction is closed
      let evaluation = null;
      if (auction.status === this.auctionStatus.CLOSED || auction.status === this.auctionStatus.AWARDED) {
        evaluation = await this.getEvaluationResults(auctionId);
      }

      return {
        auction,
        bids,
        evaluation,
        canBid: await this.canUserBid(auction, userId),
        timeRemaining: this.calculateTimeRemaining(auction.endDate)
      };

    } catch (error) {
      logger.error('Error getting auction details:', error);
      throw error;
    }
  }

  /**
   * Find eligible suppliers for auction
   */
  async findEligibleSuppliers(auction, tenantId) {
    try {
      const SupplierService = require('./SupplierService');
      
      // Get all active suppliers
      const allSuppliers = await SupplierService.getSuppliers(tenantId, { 
        status: 'active',
        limit: 100 
      });

      const eligibleSuppliers = [];

      for (const supplier of allSuppliers.suppliers) {
        // Check if supplier can provide the required items
        const canProvide = await this.canSupplierProvideItems(supplier.id, auction.items);
        
        if (canProvide) {
          // Check supplier rating threshold
          if ((supplier.rating || 0) >= 3.0) {
            eligibleSuppliers.push(supplier);
          }
        }
      }

      return eligibleSuppliers;

    } catch (error) {
      logger.error('Error finding eligible suppliers:', error);
      return [];
    }
  }

  /**
   * Send invitations to suppliers
   */
  async sendSupplierInvitations(auction, suppliers, tenantId) {
    try {
      const invitations = [];

      for (const supplier of suppliers) {
        try {
          // Create invitation record
          const invitation = await this.createInvitationRecord({
            auctionId: auction.id,
            supplierId: supplier.id,
            tenantId,
            invitedAt: new Date(),
            status: 'sent'
          });

          // Send notification
          await this.sendInvitationNotification(auction, supplier, tenantId);

          invitations.push(invitation);

        } catch (error) {
          logger.error('Error sending invitation to supplier:', {
            supplierId: supplier.id,
            error: error.message
          });
        }
      }

      return invitations;

    } catch (error) {
      logger.error('Error sending supplier invitations:', error);
      throw error;
    }
  }

  /**
   * Generate evaluation analysis
   */
  generateEvaluationAnalysis(evaluatedBids, auction) {
    if (evaluatedBids.length === 0) {
      return 'No bids were received for this auction.';
    }

    const winner = evaluatedBids[0];
    const analysis = [];

    analysis.push(`Auction received ${evaluatedBids.length} bid(s).`);
    analysis.push(`Winner: ${winner.supplier.name} with a total score of ${winner.totalScore.toFixed(2)}.`);
    analysis.push(`Winning bid amount: ${this.formatCurrency(winner.bid.totalAmount)}.`);

    // Price analysis
    const prices = evaluatedBids.map(b => b.bid.totalAmount);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const savings = avgPrice - winner.bid.totalAmount;
    
    if (savings > 0) {
      analysis.push(`This represents savings of ${this.formatCurrency(savings)} compared to average bid.`);
    }

    // Quality analysis
    if (winner.scores.quality > 80) {
      analysis.push(`Winner has excellent quality rating (${winner.supplier.rating}/5 stars).`);
    }

    return analysis.join(' ');
  }

  /**
   * Validate auction data
   */
  validateAuctionData(data) {
    const { title, items, startDate, endDate } = data;

    if (!title || title.trim().length < 5) {
      throw new Error('Auction title must be at least 5 characters long');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('At least one item is required');
    }

    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new Error('End date must be after start date');
    }

    if (end <= new Date()) {
      throw new Error('End date must be in the future');
    }

    // Validate items
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        throw new Error('Each item must have a valid product ID and positive quantity');
      }
    }
  }

  /**
   * Validate bid data
   */
  validateBidData(bidData, auction) {
    const { items, totalAmount, deliveryTime } = bidData;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Bid must include items');
    }

    if (!totalAmount || totalAmount <= 0) {
      throw new Error('Total amount must be positive');
    }

    if (!deliveryTime || deliveryTime <= 0) {
      throw new Error('Delivery time must be positive');
    }

    // Check if all required items are included (if partial bids not allowed)
    if (!auction.allowPartialBids) {
      const requiredItems = auction.items.map(item => item.productId);
      const bidItems = items.map(item => item.productId);
      
      for (const requiredItem of requiredItems) {
        if (!bidItems.includes(requiredItem)) {
          throw new Error(`Missing required item: ${requiredItem}`);
        }
      }
    }
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Calculate time remaining
   */
  calculateTimeRemaining(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) {
      return { expired: true, text: 'Expired' };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return { expired: false, text: `${days}d ${hours}h remaining` };
    } else if (hours > 0) {
      return { expired: false, text: `${hours}h ${minutes}m remaining` };
    } else {
      return { expired: false, text: `${minutes}m remaining` };
    }
  }

  // Mock database operations (replace with actual database calls)
  async createAuctionRecord(data) {
    return { id: `auction_${Date.now()}`, ...data };
  }

  async getAuctionById(id, tenantId) {
    // Mock implementation
    return null;
  }

  async updateAuctionStatus(id, status) {
    // Mock implementation
    return true;
  }

  async createBidRecord(data) {
    return { id: `bid_${Date.now()}`, ...data };
  }

  async getAuctionBids(auctionId) {
    return [];
  }

  async getSupplierInfo(supplierId, tenantId) {
    return { id: supplierId, name: 'Mock Supplier', rating: 4.5 };
  }

  async canSupplierProvideItems(supplierId, items) {
    return true; // Mock implementation
  }

  async createInvitationRecord(data) {
    return { id: `invitation_${Date.now()}`, ...data };
  }

  async sendInvitationNotification(auction, supplier, tenantId) {
    // Mock implementation
    return true;
  }
}

module.exports = new AuctionService();