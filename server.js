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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Playwright API escuchando en puerto ${PORT}`);
});

