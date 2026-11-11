const express = require("express");
const axios = require("axios");
const db = require("./db");

const app = express();
const PRODUTOS_URL = process.env.PRODUTOS_URL || "http://localhost:3001";
const CLIENTES_URL = process.env.CLIENTES_URL || "http://localhost:3003";
app.use(express.json());

app.get("/pedidos", async (req, res) => {
    try {
        const resultado = await db.query("SELECT * FROM pedidos ORDER BY id");
        res.json(resultado.rows);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar pedidos" });
    }
});

app.post("/pedidos", async (req, res) => {
    const { cliente_id, produtoId, quantidade } = req.body || {};
    const inteiroValido = valor => Number.isInteger(valor) && valor > 0 && valor <= 2147483647;
    if (![cliente_id, produtoId, quantidade].every(inteiroValido)) {
        return res.status(400).json({ erro: "cliente_id, produtoId e quantidade devem ser inteiros positivos" });
    }
    try {
        await axios.get(`${CLIENTES_URL}/clientes/${cliente_id}`, { timeout: 3000 });
    } catch (erro) {
        if (erro.response?.status === 404) {
            return res.status(400).json({ erro: "Cliente não encontrado" });
        }
        return res.status(503).json({ erro: "Serviço de Clientes indisponível" });
    }
    let produto;
    try {
        const resposta = await axios.get(`${PRODUTOS_URL}/produtos/${produtoId}`, { timeout: 3000 });
        produto = resposta.data;
    } catch (erro) {
        if (erro.response?.status === 404) {
            return res.status(400).json({ erro: "Produto não encontrado" });
        }
        return res.status(503).json({ erro: "Serviço de Produtos indisponível" });
    }
    try {
        const resultado = await db.query(
            `INSERT INTO pedidos (cliente_id, produto_id, nome_produto, preco_unitario, quantidade, total)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [cliente_id, produto.id, produto.nome, produto.preco, quantidade, produto.preco * quantidade]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao criar pedido" });
    }
});

app.get("/pedidos/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
        return res.status(400).json({ erro: "ID inválido" });
    }
    try {
        const resultado = await db.query("SELECT * FROM pedidos WHERE id = $1", [id]);
        if (!resultado.rows[0]) {
            return res.status(404).json({ erro: "Pedido não encontrado" });
        }
        res.json(resultado.rows[0]);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar pedido" });
    }
});

async function iniciar() {
    await db.query(`CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER NOT NULL,
        produto_id INTEGER NOT NULL,
        nome_produto VARCHAR(100) NOT NULL,
        preco_unitario NUMERIC(10, 2) NOT NULL,
        quantidade INTEGER NOT NULL,
        total NUMERIC(10, 2) NOT NULL
    )`);
    await db.query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id INTEGER");
    app.listen(3002, () => console.log("Pedidos rodando na porta 3002"));
}

iniciar().catch(erro => {
    console.error("Erro ao iniciar Pedidos:", erro.message);
    process.exit(1);
});
