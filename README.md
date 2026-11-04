# 📚 Sistema de Gerenciamento de Livros – CRUD + API

Projeto 07 de Desenvolvimento Web III. Aplicação web para gerenciar o acervo de uma pequena biblioteca, com CRUD completo, API REST e integração com a [Open Library](https://openlibrary.org/dev/docs/api/search).

Tecnologias: Node.js, NPM, HTML, CSS e JavaScript puro (sem frameworks e sem dependências externas).

## Integrantes

- Nome do aluno 1
- Nome do aluno 2

## Requisitos

- Node.js 18 ou superior

## Instalação e execução

```bash
git clone <url-do-repositorio>
cd sistema-livros
npm install
npm start
```

Acesse: http://localhost:5000

Para usar outra porta: `PORT=3000 npm start` (Windows PowerShell: `$env:PORT=3000; npm start`).

## Funcionalidades

- Cadastrar, listar, consultar, editar e excluir livros (exclusão com confirmação)
- Pesquisa por título
- Status de leitura com identificação visual por cor: Quero ler, Lendo, Concluído
- Busca na Open Library pelo título, com preenchimento automático do formulário (título, autor, ano, capa e ISBN quando disponível)
- Se a API externa estiver indisponível ou não encontrar resultados, o cadastro manual continua funcionando
- Mensagens de sucesso e erro na interface

## Persistência

Os livros são gravados em `data/livros.json`, mantendo os dados após reiniciar o servidor.

## Modelo de livro

| Campo  | Tipo   | Obrigatório | Observações                                  |
|--------|--------|-------------|----------------------------------------------|
| id     | number | gerado      | Automático e único                           |
| titulo | string | sim         |                                              |
| autor  | string | sim         |                                              |
| isbn   | string | não         | 10 ou 13 caracteres; não pode se repetir     |
| ano    | number | sim         | Inteiro entre 1 e ano atual + 1              |
| genero | string | sim         |                                              |
| status | string | sim         | `Quero ler`, `Lendo` ou `Concluído`          |
| capa   | string | não         | URL (http/https) da imagem da capa           |

## Documentação da API

Base: `/api/livros`. Requisições e respostas em JSON.

| Método | Rota             | Descrição            | Sucesso | Erros possíveis       |
|--------|------------------|----------------------|---------|-----------------------|
| GET    | /api/livros      | Lista todos os livros (filtro opcional `?titulo=texto`) | 200 | — |
| GET    | /api/livros/:id  | Consulta um livro    | 200     | 400, 404              |
| POST   | /api/livros      | Cadastra um livro    | 201     | 400, 409              |
| PUT    | /api/livros/:id  | Atualiza um livro    | 200     | 400, 404, 409         |
| DELETE | /api/livros/:id  | Exclui um livro      | 200     | 400, 404              |

Códigos de erro: `400` dados inválidos/campos obrigatórios/ID inválido/JSON inválido; `404` livro ou rota inexistente; `405` método não permitido; `409` ISBN duplicado.

Erros retornam `{ "erro": "mensagem" }`.

### Exemplo – POST /api/livros

```json
{
  "titulo": "Dom Casmurro",
  "autor": "Machado de Assis",
  "isbn": "9788535910663",
  "ano": 1899,
  "genero": "Romance",
  "status": "Quero ler",
  "capa": ""
}
```

Resposta `201 Created`:

```json
{
  "id": 1,
  "titulo": "Dom Casmurro",
  "autor": "Machado de Assis",
  "isbn": "9788535910663",
  "ano": 1899,
  "genero": "Romance",
  "status": "Quero ler",
  "capa": ""
}
```

## Estrutura

```
├── app.js          # Servidor HTTP e rotas da API
├── database.js     # Persistência em arquivo JSON
├── data/livros.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js      # Front-end (fetch)
└── package.json
```
