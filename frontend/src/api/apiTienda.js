import axios from 'axios';

// Instancia axios para la TIENDA PÚBLICA (cliente final, sin login).
// Sin Authorization y SIN el interceptor de 401 que redirige a /login (para no
// sacar al comprador de la tienda). Molde: api/apiRevendedor.js.
const apiTienda = axios.create({
    baseURL: window.location.origin,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

export default apiTienda;
