import axios from 'axios';

// Instancia axios dedicada al panel del revendedor. Usa su propio token
// (token_revendedor) para NO interferir con la sesión de negocios/superadmin.
const apiRevendedor = axios.create({
    baseURL: window.location.origin,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

apiRevendedor.interceptors.request.use((config) => {
    const token = localStorage.getItem('token_revendedor');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default apiRevendedor;
