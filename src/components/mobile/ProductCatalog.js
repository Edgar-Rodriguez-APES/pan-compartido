import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Plus, 
  Minus,
  ArrowLeft,
  Grid,
  List,
  Star,
  Package
} from 'lucide-react';
import api from '../../services/api';

const ProductCatalog = ({ tenantId, onBack, onAddToCart }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'
  const [cart, setCart] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price', 'popular'

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [tenantId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products', {
        headers: { 'X-Tenant-ID': tenantId },
        params: {
          search: searchTerm,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          sortBy,
          limit: 50
        }
      });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/products/categories', {
        headers: { 'X-Tenant-ID': tenantId }
      });
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadProducts();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedCategory, sortBy]);

  const handleQuantityChange = (productId, change) => {
    setCart(prev => {
      const currentQuantity = prev[productId]?.quantity || 0;
      const newQuantity = Math.max(0, currentQuantity + change);
      
      if (newQuantity === 0) {
        const { [productId]: removed, ...rest } = prev;
        return rest;
      }
      
      const product = products.find(p => p.id === productId);
      const newItem = {
        quantity: newQuantity,
        product: product,
        totalPrice: newQuantity * (product?.estimated_price || 0)
      };
      
      return {
        ...prev,
        [productId]: newItem
      };
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const renderHeader = () => (
    <div className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="flex items-center p-4">
        <button onClick={onBack} className="mr-3 p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Catálogo de Productos</h1>
          <p className="text-sm text-gray-600">Precios mayoristas especiales</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 text-gray-600 hover:text-gray-800"
          >
            {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 text-gray-600 hover:text-gray-800"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Buscar productos..."
          />
        </div>
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="px-4 pb-4 border-t bg-gray-50">
          <div className="py-3">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Categoría</h3>
            <div className="flex space-x-2 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                Todos
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                    selectedCategory === category.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="py-3 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Ordenar por</h3>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="name">Nombre A-Z</option>
              <option value="price">Precio menor a mayor</option>
              <option value="popular">Más populares</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );

  const renderProductGrid = () => (
    <div className="grid grid-cols-2 gap-3 p-4">
      {products.map(product => (
        <div key={product.id} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Package className="w-8 h-8 text-gray-400" />
            )}
          </div>
          
          <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">{product.name}</h3>
          <p className="text-xs text-gray-600 mb-2">{product.unit}</p>
          
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-green-600">
              {formatCurrency(product.estimated_price)}
            </div>
            {product.rating && (
              <div className="flex items-center">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span className="text-xs text-gray-600 ml-1">{product.rating}</span>
              </div>
            )}
          </div>
          
          {cart[product.id] ? (
            <div className="flex items-center justify-between">
              <button
                onClick={() => handleQuantityChange(product.id, -1)}
                className="w-7 h-7 bg-gray-100 border border-gray-300 rounded-full flex items-center justify-center"
              >
                <Minus className="w-3 h-3 text-gray-600" />
              </button>
              <span className="font-medium text-gray-900">
                {cart[product.id].quantity}
              </span>
              <button
                onClick={() => handleQuantityChange(product.id, 1)}
                className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleQuantityChange(product.id, 1)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Agregar
            </button>
          )}
        </div>
      ))}
    </div>
  );

  const renderProductList = () => (
    <div className="p-4 space-y-3">
      {products.map(product => (
        <div key={product.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="w-16 h-16 bg-gray-100 rounded-lg mr-4 flex items-center justify-center flex-shrink-0">
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <Package className="w-6 h-6 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 mb-1">{product.name}</h3>
              <p className="text-sm text-gray-600 mb-1">{product.unit}</p>
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-green-600">
                  {formatCurrency(product.estimated_price)}
                </div>
                {product.rating && (
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600 ml-1">{product.rating}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="ml-4 flex-shrink-0">
              {cart[product.id] ? (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleQuantityChange(product.id, -1)}
                    className="w-8 h-8 bg-gray-100 border border-gray-300 rounded-full flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="font-medium text-gray-900 w-8 text-center">
                    {cart[product.id].quantity}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(product.id, 1)}
                    className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleQuantityChange(product.id, 1)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Agregar
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCartSummary = () => {
    const itemsCount = getCartItemsCount();
    const total = getCartTotal();
    
    if (itemsCount === 0) return null;
    
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">{itemsCount} productos</div>
            <div className="text-lg font-bold text-gray-900">{formatCurrency(total)}</div>
          </div>
          
          <button
            onClick={() => onAddToCart && onAddToCart(cart)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Ver Carrito
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
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeader()}
      
      <main className="pb-24">
        {products.length > 0 ? (
          <>
            {viewMode === 'grid' ? renderProductGrid() : renderProductList()}
          </>
        ) : (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay productos</h3>
            <p className="text-gray-600">
              {searchTerm || selectedCategory !== 'all' 
                ? 'No se encontraron productos con los filtros aplicados'
                : 'No hay productos disponibles en este momento'
              }
            </p>
            {(searchTerm || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        )}
      </main>
      
      {renderCartSummary()}
    </div>
  );
};

export default ProductCatalog;