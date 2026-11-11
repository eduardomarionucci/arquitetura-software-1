import json
import unittest
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE = "http://localhost:3000"


def requisicao(metodo, rota, dados=None, base=BASE):
    corpo = None if dados is None else json.dumps(dados).encode()
    req = Request(base + rota, data=corpo, method=metodo, headers={"Content-Type": "application/json"})
    try:
        resposta = urlopen(req, timeout=15)
    except HTTPError as erro:
        resposta = erro
    with resposta:
        return resposta.status, json.loads(resposta.read())


class Integracao(unittest.TestCase):
    def test_fluxo_completo(self):
        marcador = uuid.uuid4().hex[:10]
        clientes = []
        for i in range(5):
            dados = {"nome": f"Cliente {i + 1}", "sobrenome": "Demonstracao", "email": f"cliente{i}.{marcador}@example.com"}
            if i:
                dados["telefone"] = "46999999999"
            status, cliente = requisicao("POST", "/clientes", dados)
            self.assertEqual(status, 201)
            clientes.append(cliente)
        cliente = clientes[0]
        status, encontrado = requisicao("GET", f"/clientes/{cliente['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(encontrado, cliente)
        self.assertIsNone(cliente["telefone"])
        for base in [BASE, "http://localhost:3003"]:
            status, lista = requisicao("GET", "/clientes", base=base)
            self.assertEqual(status, 200)
            self.assertTrue({c['id'] for c in clientes}.issubset({c['id'] for c in lista}))
            self.assertEqual(requisicao("GET", "/clientes/2147483647", base=base)[0], 404)
        self.assertEqual(requisicao("GET", "/clientes/abc")[0], 400)
        for dados in [{}, {"nome": "Joao"}, {"nome": " ", "sobrenome": "Silva", "email": "a@b.com"}, {"nome": "Joao", "sobrenome": "Silva", "email": "invalido"}]:
            self.assertEqual(requisicao("POST", "/clientes", dados)[0], 400)
        self.assertEqual(requisicao("POST", "/clientes", cliente)[0], 409)
        status, produto = requisicao("POST", "/produtos", {"nome": f"Produto demonstracao {marcador}", "preco": 10})
        self.assertEqual(status, 201)
        dados = {"cliente_id": cliente['id'], "produtoId": produto['id'], "quantidade": 3}
        status, pedido = requisicao("POST", "/pedidos", dados)
        self.assertEqual(status, 201)
        self.assertEqual(pedido['cliente_id'], cliente['id'])
        self.assertEqual(float(pedido['total']), 30)
        self.assertEqual(requisicao("GET", f"/pedidos/{pedido['id']}")[0], 200)
        antes = len(requisicao("GET", "/pedidos")[1])
        for alteracao in [{"cliente_id": 2147483647}, {"cliente_id": None}, {"produtoId": 2147483647}, {"quantidade": 0}]:
            status, erro = requisicao("POST", "/pedidos", {**dados, **alteracao})
            self.assertEqual(status, 400, erro)
        self.assertEqual(len(requisicao("GET", "/pedidos")[1]), antes)


if __name__ == "__main__":
    unittest.main(verbosity=2)
