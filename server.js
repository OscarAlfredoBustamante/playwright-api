const express = require('express');
const { llenarFormulario } = require('./scripts/llenarFormulario');
const { detectarCampos } = require('./scripts/detectarCampos');
const { entrenar } = require('./scripts/entrenar');

const app = express();
app.use(express.json());

app.post('/llenar', async (req, res) => {
    try {
        const result = await llenarFormulario(req.body);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/detectar', async (req, res) => {
    try {
        const result = await detectarCampos(req.body);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/entrenar', async (req, res) => {
    try {
        const result = await entrenar(req.body);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Función para iniciar el servidor en el primer puerto disponible
function startServer(port = 3000, maxPort = 4000) {
    const server = app.listen(port, () => {
        console.log(`Playwright API escuchando en puerto ${port}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Puerto ${port} en uso, probando con ${port + 1}...`);
            if (port + 1 <= maxPort) {
                setTimeout(() => startServer(port + 1, maxPort), 100);
            } else {
                console.error(`Todos los puertos del ${port} al ${maxPort} están ocupados`);
                process.exit(1);
            }
        } else {
            console.error('Error al iniciar el servidor:', err);
            process.exit(1);
        }
    });
}

startServer(3000, 4000);
