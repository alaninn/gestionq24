// =============================================
// TEST BÁSICO DE API - ALMACENQ24
// Verifica que los endpoints principales funcionen
// =============================================

const http = require('http');
require('dotenv').config();

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Colores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

// Función helper para hacer requests
function makeRequest(path, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(body)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: body
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Tests
async function runTests() {
    console.log(`${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.blue}🧪 TESTS DE API - ALMACENQ24${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}\n`);

    let token = null;
    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Verificar que el servidor está corriendo
    try {
        console.log(`${colors.yellow}Test 1: Verificar servidor...${colors.reset}`);
        const res = await makeRequest('/api/auth/me');
        if (res.status === 401 || res.status === 200) {
            console.log(`${colors.green}✅ Servidor corriendo en puerto ${PORT}${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 2: Login con credenciales incorrectas
    try {
        console.log(`${colors.yellow}Test 2: Login con credenciales incorrectas...${colors.reset}`);
        const res = await makeRequest('/api/auth/login', 'POST', {
            username: 'test',
            password: 'wrong'
        });
        if (res.status === 401) {
            console.log(`${colors.green}✅ Login rechazado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 3: Login con credenciales válidas (necesitas crear un usuario de prueba)
    try {
        console.log(`${colors.yellow}Test 3: Login con credenciales válidas...${colors.reset}`);
        // NOTA: Debes crear un usuario de prueba en la BD antes de ejecutar este test
        // const res = await makeRequest('/api/auth/login', 'POST', {
        //     username: 'admin',
        //     password: 'admin123'
        // });
        // if (res.status === 200 && res.data.token) {
        //     token = res.data.token;
        //     console.log(`${colors.green}✅ Login exitoso${colors.reset}\n`);
        //     testsPassed++;
        // } else {
        //     throw new Error(`Status inesperado: ${res.status}`);
        // }
        console.log(`${colors.yellow}⚠️  Test saltado - Crear usuario de prueba primero${colors.reset}\n`);
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 4: Verificar endpoint de productos (sin token)
    try {
        console.log(`${colors.yellow}Test 4: Acceso a productos sin token...${colors.reset}`);
        const res = await makeRequest('/api/productos');
        if (res.status === 401) {
            console.log(`${colors.green}✅ Acceso denegado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 5: Verificar endpoint de categorías (sin token)
    try {
        console.log(`${colors.yellow}Test 5: Acceso a categorías sin token...${colors.reset}`);
        const res = await makeRequest('/api/categorias');
        if (res.status === 401) {
            console.log(`${colors.green}✅ Acceso denegado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 6: Verificar endpoint de turnos (sin token)
    try {
        console.log(`${colors.yellow}Test 6: Acceso a turnos sin token...${colors.reset}`);
        const res = await makeRequest('/api/turnos');
        if (res.status === 401) {
            console.log(`${colors.green}✅ Acceso denegado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 7: Verificar endpoint de ventas (sin token)
    try {
        console.log(`${colors.yellow}Test 7: Acceso a ventas sin token...${colors.reset}`);
        const res = await makeRequest('/api/ventas');
        if (res.status === 401) {
            console.log(`${colors.green}✅ Acceso denegado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 8: Verificar endpoint de clientes (sin token)
    try {
        console.log(`${colors.yellow}Test 8: Acceso a clientes sin token...${colors.reset}`);
        const res = await makeRequest('/api/clientes');
        if (res.status === 401) {
            console.log(`${colors.green}✅ Acceso denegado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 9: Verificar endpoint de gastos (sin token)
    try {
        console.log(`${colors.yellow}Test 9: Acceso a gastos sin token...${colors.reset}`);
        const res = await makeRequest('/api/gastos');
        if (res.status === 401) {
            console.log(`${colors.green}✅ Acceso denegado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 10: Verificar endpoint de configuración (sin token)
    try {
        console.log(`${colors.yellow}Test 10: Acceso a configuración sin token...${colors.reset}`);
        const res = await makeRequest('/api/configuracion');
        if (res.status === 401) {
            console.log(`${colors.green}✅ Acceso denegado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 11: Verificar endpoint de reportes (sin token)
    try {
        console.log(`${colors.yellow}Test 11: Acceso a reportes sin token...${colors.reset}`);
        const res = await makeRequest('/api/reportes/dashboard');
        if (res.status === 401) {
            console.log(`${colors.green}✅ Acceso denegado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Test 12: Verificar endpoint de usuarios (sin token)
    try {
        console.log(`${colors.yellow}Test 12: Acceso a usuarios sin token...${colors.reset}`);
        const res = await makeRequest('/api/usuarios');
        if (res.status === 401) {
            console.log(`${colors.green}✅ Acceso denegado correctamente${colors.reset}\n`);
            testsPassed++;
        } else {
            throw new Error(`Status inesperado: ${res.status}`);
        }
    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);
        testsFailed++;
    }

    // Resumen
    console.log(`${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.blue}📊 RESUMEN DE TESTS${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.green}✅ Tests pasados: ${testsPassed}${colors.reset}`);
    console.log(`${colors.red}❌ Tests fallidos: ${testsFailed}${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}\n`);

    if (testsFailed === 0) {
        console.log(`${colors.green}🎉 ¡TODOS LOS TESTS PASARON!${colors.reset}`);
        process.exit(0);
    } else {
        console.log(`${colors.red}⚠️  ALGUNOS TESTS FALLARON${colors.reset}`);
        process.exit(1);
    }
}

// Ejecutar tests
runTests().catch(error => {
    console.error(`${colors.red}Error fatal: ${error.message}${colors.reset}`);
    process.exit(1);
});