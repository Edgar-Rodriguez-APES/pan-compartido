import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService, handleApiError } from '../services/api';

// Estado inicial
const initialState = {
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
};

// Tipos de acciones
const actionTypes = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_USER: 'UPDATE_USER',
  UPDATE_TENANT: 'UPDATE_TENANT'
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case actionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        tenant: action.payload.tenant,
        isAuthenticated: true,
        isLoading: false,
        error: null
      };

    case actionTypes.LOGOUT:
      return {
        ...initialState,
        isLoading: false
      };

    case actionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };

    case actionTypes.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case actionTypes.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };

    case actionTypes.UPDATE_TENANT:
      return {
        ...state,
        tenant: { ...state.tenant, ...action.payload }
      };

    default:
      return state;
  }
};

// Crear contexto
const AuthContext = createContext();

// Hook para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Provider del contexto
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Verificar token al cargar la aplicación
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        dispatch({ type: actionTypes.SET_LOADING, payload: false });
        return;
      }

      try {
        const response = await authService.verifyToken();
        
        if (response.valid) {
          // Guardar datos en localStorage
          localStorage.setItem('user', JSON.stringify(response.user));
          localStorage.setItem('tenant', JSON.stringify(response.tenant));
          localStorage.setItem('tenantId', response.user.tenantId);
          
          dispatch({
            type: actionTypes.LOGIN_SUCCESS,
            payload: {
              user: response.user,
              tenant: response.tenant
            }
          });
        } else {
          // Token inválido
          authService.logout();
          dispatch({ type: actionTypes.LOGOUT });
        }
      } catch (error) {
        console.error('Error verificando token:', error);
        authService.logout();
        dispatch({ type: actionTypes.LOGOUT });
      }
    };

    initializeAuth();
  }, []);

  // Función de login
  const login = async (tenantId, email, password) => {
    dispatch({ type: actionTypes.SET_LOADING, payload: true });
    dispatch({ type: actionTypes.CLEAR_ERROR });

    try {
      const response = await authService.login(tenantId, email, password);
      
      // Guardar en localStorage
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('tenant', JSON.stringify(response.tenant));
      localStorage.setItem('tenantId', response.user.tenantId);
      
      dispatch({
        type: actionTypes.LOGIN_SUCCESS,
        payload: {
          user: response.user,
          tenant: response.tenant
        }
      });

      return { success: true, message: response.message };
    } catch (error) {
      const errorMessage = handleApiError(error);
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  // Función de registro
  const register = async (tenantId, name, email, phone, password) => {
    dispatch({ type: actionTypes.SET_LOADING, payload: true });
    dispatch({ type: actionTypes.CLEAR_ERROR });

    try {
      const response = await authService.register(tenantId, name, email, phone, password);
      
      // Guardar en localStorage
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('tenant', JSON.stringify(response.tenant));
      localStorage.setItem('tenantId', response.user.tenantId);
      
      dispatch({
        type: actionTypes.LOGIN_SUCCESS,
        payload: {
          user: response.user,
          tenant: response.tenant
        }
      });

      return { success: true, message: response.message };
    } catch (error) {
      const errorMessage = handleApiError(error);
      dispatch({ type: actionTypes.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  // Función de logout
  const logout = () => {
    authService.logout();
    dispatch({ type: actionTypes.LOGOUT });
  };

  // Función para limpiar errores
  const clearError = () => {
    dispatch({ type: actionTypes.CLEAR_ERROR });
  };

  // Función para actualizar usuario
  const updateUser = (userData) => {
    const updatedUser = { ...state.user, ...userData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    dispatch({ type: actionTypes.UPDATE_USER, payload: userData });
  };

  // Función para actualizar tenant
  const updateTenant = (tenantData) => {
    const updatedTenant = { ...state.tenant, ...tenantData };
    localStorage.setItem('tenant', JSON.stringify(updatedTenant));
    dispatch({ type: actionTypes.UPDATE_TENANT, payload: tenantData });
  };

  // Verificar si el usuario tiene un rol específico
  const hasRole = (role) => {
    if (!state.user) return false;
    const userRoles = Array.isArray(state.user.role) ? state.user.role : [state.user.role];
    return userRoles.includes(role);
  };

  // Verificar si el usuario tiene alguno de los roles especificados
  const hasAnyRole = (roles) => {
    if (!state.user) return false;
    const userRoles = Array.isArray(state.user.role) ? state.user.role : [state.user.role];
    return roles.some(role => userRoles.includes(role));
  };

  const value = {
    // Estado
    ...state,
    
    // Funciones
    login,
    register,
    logout,
    clearError,
    updateUser,
    updateTenant,
    hasRole,
    hasAnyRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;