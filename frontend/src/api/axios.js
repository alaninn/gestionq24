import axios from 'axios';

const api = axios.create({
    baseURL: window.location.origin,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Si el superadmin está accediendo a otro negocio, enviar el negocio_id en el header
    const accesoSuperadminNegocio = localStorage.getItem('acceso_superadmin_negocio');
    if (accesoSuperadminNegocio) {
        config.headers['x-negocio-id'] = accesoSuperadminNegocio;
    }
    
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Solo redirigimos al login si es 401 Y no es la ruta /me
        if (error.response?.status === 401 && 
            !error.config?.url?.includes('/api/auth/me') &&
            !error.config?.url?.includes('/api/auth/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;