import axios from 'axios';

// Configuración base de la API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    const tenantId = localStorage.getItem('tenantId');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// Servicios de autenticación
export const authService = {
  login: async (tenantId, email, password) => {
    const response = await api.post('/auth/login', {
      tenantId,
      email,
      password
    });
    return response.data;
  },

  register: async (tenantId, name, email, phone, password) => {
    const response = await api.post('/auth/register', {
      tenantId,
      name,
      email,
      phone,
      password
    });
    return response.data;
  },

  verifyToken: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    localStorage.removeItem('tenantId');
  }
};

// Servicios de tenant
export const tenantService = {
  getCurrent: async () => {
    const response = await api.get('/tenants/current');
    return response.data;
  },

  updateCurrent: async (data) => {
    const response = await api.put('/tenants/current', data);
    return response.data;
  }
};

// Servicios de campañas
export const campaignService = {
  getAll: async (params = {}) => {
    const response = await api.get('/campaigns', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/campaigns/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/campaigns', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/campaigns/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/campaigns/${id}`);
    return response.data;
  }
};

// Servicios de donaciones
export const donationService = {
  getAll: async (params = {}) => {
    const response = await api.get('/donations', { params });
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/donations', data);
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/donations/${id}`);
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await api.patch(`/donations/${id}/status`, { status });
    return response.data;
  }
};

// Servicios de usuarios
export const userService = {
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await api.put('/users/profile', data);
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/users/password', {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  verifyEmail: async (verificationToken) => {
    const response = await api.post('/users/verify-email', {
      verificationToken
    });
    return response.data;
  },

  verifyPhone: async (verificationCode) => {
    const response = await api.post('/users/verify-phone', {
      verificationCode
    });
    return response.data;
  },

  getAll: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  search: async (searchTerm) => {
    const response = await api.get('/users/search', {
      params: { q: searchTerm }
    });
    return response.data;
  },

  getById: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  update: async (userId, data) => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  },

  deactivate: async (userId) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },

  reactivate: async (userId) => {
    const response = await api.post(`/users/${userId}/reactivate`);
    return response.data;
  },

  changeUserPassword: async (userId, newPassword) => {
    const response = await api.put(`/users/${userId}/password`, {
      newPassword
    });
    return response.data;
  }
};

// Servicios de pagos
export const paymentService = {
  createPayment: async (data) => {
    const response = await api.post('/payments', data);
    return response.data;
  },

  getPaymentHistory: async (params = {}) => {
    const response = await api.get('/payments', { params });
    return response.data;
  },

  getPaymentById: async (id) => {
    const response = await api.get(`/payments/${id}`);
    return response.data;
  }
};

// Servicios de proveedores
export const supplierService = {
  getAll: async (params = {}) => {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  }
};

// Servicios de branding
export const brandingService = {
  getConfig: async () => {
    const response = await api.get('/branding');
    return response.data;
  },

  getPublicConfig: async () => {
    const response = await api.get('/branding/public');
    return response.data;
  },

  updateConfig: async (data) => {
    const response = await api.put('/branding', data);
    return response.data;
  },

  getCSS: async () => {
    const response = await api.get('/branding/css');
    return response.data;
  },

  getTemplates: async () => {
    const response = await api.get('/branding/templates');
    return response.data;
  },

  updateTemplate: async (platform, templateType, content) => {
    const response = await api.put('/branding/templates', {
      platform,
      templateType,
      content
    });
    return response.data;
  },

  previewTemplate: async (platform, templateType, data = {}) => {
    const response = await api.post('/branding/templates/preview', {
      platform,
      templateType,
      data
    });
    return response.data;
  }
};

// Función helper para manejar errores de API
export const handleApiError = (error) => {
  if (error.response) {
    // El servidor respondió con un código de error
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return data.message || 'Datos inválidos. Por favor verifica la información.';
      case 401:
        return 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.';
      case 403:
        return 'No tienes permisos para realizar esta acción.';
      case 404:
        return 'El recurso solicitado no fue encontrado.';
      case 409:
        return data.message || 'Ya existe un registro con estos datos.';
      case 500:
        return 'Error interno del servidor. Nuestro equipo ha sido notificado.';
      default:
        return data.message || 'Ocurrió un error inesperado.';
    }
  } else if (error.request) {
    // La petición fue hecha pero no se recibió respuesta
    return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
  } else {
    // Algo pasó al configurar la petición
    return 'Error al procesar la solicitud.';
  }
};

export default api;