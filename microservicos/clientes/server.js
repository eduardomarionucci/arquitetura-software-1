const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

app.get("/clientes", async (req, res) => {
    try {
        const resultado = await db.query("SELECT * FROM clientes ORDER BY id");
        res.json(resultado.rows);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar clientes" });
    }
});

app.get("/clientes/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
        return res.status(400).json({ erro: "ID inválido" });
    }
    try {
        const resultado = await db.query("SELECT * FROM clientes WHERE id = $1", [id]);
        if (!resultado.rows[0]) {
            return res.status(404).json({ erro: "Cliente não encontrado" });
        }
        res.json(resultado.rows[0]);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar cliente" });
    }
});

app.post("/clientes", async (req, res) => {
    const { nome, sobrenome, telefone, email } = req.body || {};
    const textoValido = (valor, limite) => typeof valor === "string" && valor.trim().length > 0 && valor.trim().length <= limite;
    if (!textoValido(nome, 100) || !textoValido(sobrenome, 100) ||
        !textoValido(email, 150) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        (telefone != null && (typeof telefone !== "string" || telefone.trim().length > 20))) {
        return res.status(400).json({ erro: "Nome, sobrenome, e-mail e telefone devem respeitar os formatos e limites permitidos" });
    }
    try {
        const resultado = await db.query(
            "INSERT INTO clientes (nome, sobrenome, telefone, email) VALUES ($1, $2, $3, $4) RETURNING *",
            [nome.trim(), sobrenome.trim(), telefone?.trim() || null, email.trim().toLowerCase()]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (erro) {
        if (erro.code === "23505") {
            return res.status(409).json({ erro: "E-mail já cadastrado" });
        }
        res.status(500).json({ erro: "Erro ao cadastrar cliente" });
    }
});

async function iniciar() {
    await db.query(`CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        sobrenome VARCHAR(100) NOT NULL,
        telefone VARCHAR(20),
        email VARCHAR(150) NOT NULL UNIQUE
    )`);
    app.listen(3003, () => console.log("Clientes rodando na porta 3003"));
}

iniciar().catch(erro => {
    console.error("Erro ao iniciar Clientes:", erro.message);
    process.exit(1);
});
